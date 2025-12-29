# Tech Test – Angular + Supabase Auth + Tab Presence

Small Angular app demonstrating:

- Supabase **email/password auth**
- Protected route: `/app`
- Multi-tab/device presence via heartbeats + **Active/Idle/Stale** (stable, no flicker)

## Setup

```bash
npm install
ng serve
```

Open: http://localhost:4200

Configure Supabase keys in `src/environments/environment.ts`:

```ts
export const environment = {
  production: false,
  supabaseUrl: "https://zqpezexjcilfatwgbduv.supabase.co",
  supabaseKey: "YOUR_ANON_KEY_HERE",
};
```

## Supabase / DB

Presence data is stored in `public.user_tabs` (already created with RLS):

```sql
create table if not exists public.user_tabs (
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  tab_id text not null,
  user_agent text not null,
  is_active boolean not null default false,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, device_id, tab_id)
);
```

**Important:** Enable Realtime replication for `public.user_tabs` in Supabase, otherwise the dashboard only updates on refresh.

## Auth (Supabase)

- Implemented in `SupabaseClientService` + `AuthService`
- `/app` is protected by an auth guard (checks Supabase session)
- Unauthenticated users are redirected to `/login`

## Presence Strategy (Why it’s stable)

Each tab writes/upserts:

- `deviceId` (localStorage), `tabId` (sessionStorage)
- `is_active`, `last_seen`, `user_agent`

Instead of strict online/offline, the UI uses a **stale/idle model**:

- **Active** = fresh heartbeat + active flag
- **Idle** = heartbeat within grace window (tolerates background throttling)
- **Stale** = heartbeat too old

Only one tab per device is “active” at a time (lightweight localStorage lease).

## Trade-offs

- `last_seen` uses client time (`new Date().toISOString()`) for simplicity
- Dashboard refetches on each realtime event (simple + reliable, not optimized)

## Troubleshooting

- No live updates(Dashboard doesn’t update until refresh): enable Realtime replication for `user_tabs`, check subscription status is `SUBSCRIBED`
- Different tab status: expected (only one tab is Active; others become Idle/Background)
