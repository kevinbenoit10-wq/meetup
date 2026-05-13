# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start dev server at localhost:3000
npm run build     # production build
npm run lint      # ESLint
npx tsc --noEmit  # type-check without building
```

## Required environment variables

Copy `.env.local.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL       # https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY  # sb_publishable_... or eyJ... JWT
NEXT_PUBLIC_MAPBOX_TOKEN       # pk.eyJ1... (public token)
```

## Architecture

**Next.js 15 App Router** with two route groups:
- `(auth)` — `/login`, `/signup` — unauthenticated, no layout wrapper
- `(app)` — `/map`, `/friends`, `/profile`, `/pings/[id]` — protected by middleware, wrapped in bottom-nav layout

`src/middleware.ts` handles all auth redirects: unauthenticated → `/login`, authenticated on auth pages → `/map`, `/` → redirect based on session.

**Supabase** is used for auth + database. Two client helpers:
- `src/lib/supabase/client.ts` — `createBrowserClient` for client components (`'use client'`)
- `src/lib/supabase/server.ts` — `createServerClient` with cookie access for server components and route handlers

All database types live in `src/lib/types.ts`: `Profile`, `FriendRequest`, `Ping`, `PingAttendee`.

## Database & RLS

Four tables with RLS enabled: `profiles`, `friend_requests`, `pings`, `ping_attendees`.

Key security functions (both `security definer`, bypass RLS):
- `are_friends(user_a, user_b)` — used in pings SELECT and ping_attendees INSERT policies
- `is_attending(ping_id)` — **must be present** to avoid infinite recursion on `ping_attendees` SELECT; apply this fix if the table was created from the original `schema.sql`:

```sql
drop policy if exists "ping_attendees_select" on public.ping_attendees;
create or replace function public.is_attending(ping_id_param uuid)
returns boolean language sql security definer as $$
  select exists (select 1 from public.ping_attendees where ping_id = ping_id_param and user_id = auth.uid());
$$;
create policy "ping_attendees_select" on public.ping_attendees for select
  using (
    auth.uid() = user_id
    or exists (select 1 from public.pings where id = ping_id and host_id = auth.uid())
    or public.is_attending(ping_id)
  );
```

Signup flow: `supabase.auth.signUp` passes `username` and `display_name` as `options.data` (user metadata). If email confirmation is disabled (recommended for dev), the client inserts into `profiles` directly after signup. A DB trigger (`handle_new_user`) exists as fallback but is a no-op — the real profile insert happens client-side in `src/app/(auth)/signup/page.tsx`.

## Map & pings

`MapView` (`src/components/map/MapView.tsx`) uses **react-map-gl v7** (not v8 — v8's subpath exports break Next.js webpack) with **mapbox-gl** and the `streets-v12` style. `mapbox-gl` is in `transpilePackages` in `next.config.ts`.

The main map page (`src/app/(app)/map/page.tsx`) owns the full ping lifecycle:
- **Tap on map** → reverse geocode via Mapbox Geocoding API v5 → opens create-ping bottom sheet
- **Tap a marker** → opens `PingDetail` bottom sheet (join / hide)
- Pings are filtered client-side: `event_at > now && !hidden`

Location search (in `/pings/new`) and reverse geocode both call:
`https://api.mapbox.com/geocoding/v5/mapbox.places/{query}.json?access_token={token}&language=nl,en`

## PWA

`src/app/manifest.ts` exports the web app manifest (Next.js 15 native). The app is installable on iOS via "Add to Home Screen" and on Android via "Install app". Icons (`/icon-192.png`, `/icon-512.png`) need to be placed in `public/`.
