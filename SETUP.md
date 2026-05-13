# Meetup — Setup Guide

## 1. Clone and install dependencies

```bash
git clone <your-repo-url>
cd meetup
npm install
```

## 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New project** and fill in the details.
3. Wait for the project to be provisioned (about 1–2 minutes).

## 3. Run the database schema

1. In your Supabase dashboard, go to **SQL Editor**.
2. Open the file `supabase/schema.sql` from this repo.
3. Paste the entire contents into the SQL editor and click **Run**.

This creates the following tables with Row Level Security enabled:
- `profiles` — user profiles (username, display name)
- `friend_requests` — friend request tracking
- `pings` — activity pins on the map
- `ping_attendees` — who is joining a ping

## 4. Get your Supabase credentials

1. In your Supabase dashboard, go to **Settings → API**.
2. Copy the **Project URL** — this is your `NEXT_PUBLIC_SUPABASE_URL`.
3. Copy the **anon / public** key — this is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## 5. Get a Google Maps API key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (or select an existing one).
3. Navigate to **APIs & Services → Library**.
4. Enable the following APIs:
   - **Maps JavaScript API**
   - **Places API**
5. Go to **APIs & Services → Credentials**.
6. Click **Create Credentials → API key**.
7. Copy the key.
8. (Recommended) Restrict the key to your domain for production.

## 6. Configure environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and fill in your values:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key-here
```

## 7. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

You will be redirected to the login page. Sign up for an account to get started.

---

## App Features

- **Auth**: Email/password sign up and login
- **Map**: Main screen showing all active friend pings as markers
- **Pings**: Create activity pins with Google Places location search and a date/time
- **Friends**: Search by username, send and accept friend requests
- **Join**: Tap "I want to join" on a ping to instantly become an attendee
- **Profile**: View your profile, friend count, and ping count; sign out

## Notes

- Pings automatically disappear from the map after their event time passes.
- Only the ping host can hide a ping.
- The map uses Belgium (Brussels) as the default center — you can change this in `src/components/map/MapView.tsx`.
