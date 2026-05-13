-- Enable UUID
create extension if not exists "uuid-ossp";

-- Profiles
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  display_name text not null,
  created_at timestamptz default now() not null
);
alter table public.profiles enable row level security;

-- Anyone can search profiles (needed for friend search by username)
create policy "profiles_select" on public.profiles for select using (true);
-- Users can only update their own profile
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);
-- Users can insert their own profile (on signup)
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);

-- Friend requests
create table public.friend_requests (
  id uuid default uuid_generate_v4() primary key,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  receiver_id uuid references public.profiles(id) on delete cascade not null,
  status text check (status in ('pending', 'accepted')) default 'pending' not null,
  created_at timestamptz default now() not null,
  unique(sender_id, receiver_id)
);
alter table public.friend_requests enable row level security;

create policy "friend_requests_select" on public.friend_requests for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);
create policy "friend_requests_insert" on public.friend_requests for insert
  with check (auth.uid() = sender_id);
create policy "friend_requests_update" on public.friend_requests for update
  using (auth.uid() = receiver_id);

-- Helper function: are_friends(user_a, user_b)
create or replace function public.are_friends(user_a uuid, user_b uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.friend_requests
    where status = 'accepted'
    and ((sender_id = user_a and receiver_id = user_b)
      or (sender_id = user_b and receiver_id = user_a))
  );
$$;

-- Pings
create table public.pings (
  id uuid default uuid_generate_v4() primary key,
  host_id uuid references public.profiles(id) on delete cascade not null,
  place_id text not null,
  place_name text not null,
  place_address text,
  lat double precision not null,
  lng double precision not null,
  event_at timestamptz not null,
  hidden boolean default false not null,
  created_at timestamptz default now() not null
);
alter table public.pings enable row level security;

-- Friends can see pings (and own pings)
create policy "pings_select" on public.pings for select
  using (
    auth.uid() = host_id
    or public.are_friends(auth.uid(), host_id)
  );
create policy "pings_insert" on public.pings for insert
  with check (auth.uid() = host_id);
create policy "pings_update" on public.pings for update
  using (auth.uid() = host_id);

-- Ping attendees
create table public.ping_attendees (
  id uuid default uuid_generate_v4() primary key,
  ping_id uuid references public.pings(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  joined_at timestamptz default now() not null,
  unique(ping_id, user_id)
);
alter table public.ping_attendees enable row level security;

create policy "ping_attendees_select" on public.ping_attendees for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.pings where id = ping_id and host_id = auth.uid()
    )
    or exists (
      select 1 from public.ping_attendees pa2
      where pa2.ping_id = ping_attendees.ping_id and pa2.user_id = auth.uid()
    )
  );
create policy "ping_attendees_insert" on public.ping_attendees for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.pings p
      where p.id = ping_id
      and public.are_friends(auth.uid(), p.host_id)
    )
  );
create policy "ping_attendees_delete" on public.ping_attendees for delete
  using (auth.uid() = user_id);

-- Trigger to auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  -- Profile is inserted by the client on signup, this is a fallback
  return new;
end;
$$;
