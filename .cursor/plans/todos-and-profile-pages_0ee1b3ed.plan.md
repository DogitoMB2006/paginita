---
name: todos-and-profile-pages
overview: Add Supabase-backed Todo and Profile pages, wiring them into the existing dashboard layout and navbar with username and avatar support.
todos:
  - id: setup-routes
    content: Wire /dashboard/todo and /dashboard/perfil routes in App.tsx and confirm navigation from RightSidebar
    status: completed
  - id: build-todo-page
    content: Create CosasQueHacer page with HeroUI/Tailwind UI and hook it up to Supabase todos CRUD with created-by info
    status: completed
  - id: build-profile-page
    content: Create Perfil page to edit display_name and avatar using Supabase profiles table and fotos bucket
    status: completed
  - id: connect-profile-to-todos
    content: Ensure todos list shows creator username and avatar by joining profiles in Supabase queries
    status: completed
isProject: false
---

### Overall goal

- **Add two new feature pages** under `src/pages`: `CosasQueHacer` (shared todo list) and `Perfil` (username + profile picture). 
- **Persist data in Supabase** using the existing `profiles` and `todos` tables from `supabase_schema.sql`, plus your `fotos` storage bucket for avatars.
- **Integrate with the existing layout** so the RightSidebar items navigate to these pages and show `created by {username}` with a small avatar on each todo.

### Backend / Supabase schema

- **Use existing tables** from `[supabase_schema.sql](supabase_schema.sql)`:
  - `public.profiles(id uuid primary key, display_name text, avatar_url text, created_at timestamptz)`
  - `public.todos(id uuid primary key, title text, is_completed boolean, created_by uuid references profiles(id), created_at timestamptz)`
- **Behavior assumptions (aligned with your answers)**:
  - Todos are **shared** between both of you: any authenticated user can see/create/update/delete all todos (already reflected in the RLS policies in `supabase_schema.sql`).
  - Profile pictures are uploaded to the **public `fotos` bucket** and we store a **public URL** in `profiles.avatar_url`.
- **No extra schema needed** beyond this; we may only add optional indexes later (e.g., on `todos.created_at`) if performance is needed.

### Frontend routing

- **Update routes in** `[src/App.tsx](src/App.tsx)`:
  - Import new pages: `CosasQueHacer` and `Perfil` from `src/pages/CosasQueHacer.tsx` and `src/pages/Perfil.tsx`.
  - Inside the `/dashboard` route (inside `DashboardLayout`), add two nested routes:
    - `/dashboard/todo` → `CosasQueHacer` component.
    - `/dashboard/perfil` → `Perfil` component.
- **Keep the existing index** route pointing to `Dashboard` so your current home view still works.

### CosasQueHacer page (shared todo list)

- **Create `src/pages/CosasQueHacer.tsx`**:
  - Use HeroUI + Tailwind to build a **card-based, dark UI** consistent with `Dashboard`.
  - Core UI pieces:
    - Input + "Add" button at the top to create new todos.
    - Todo list as a vertical stack of cards/rows, each with:
      - Checkbox or toggle for `is_completed`.
      - Title text (struck-through or dimmed when completed).
      - Small footer: `Created by {display_name}` + tiny avatar circle.
      - Delete icon/button on the right.
  - **Data flow with Supabase** (`supabase` client from `src/lib/supabase`):
    - On mount: fetch all todos with `select('id,title,is_completed,created_at,created_by, profiles(display_name,avatar_url)')` using a `join` on `profiles` (via `created_by`).
    - On add:
      - Call `supabase.auth.getUser()` to get current user id.
      - Insert into `public.todos` with `title` + `created_by`.
      - Optimistically update local state or re-fetch.
    - On toggle complete:
      - `update public.todos set is_completed = !current where id = ...`.
      - Update local state.
    - On delete:
      - `delete from public.todos where id = ...`.
      - Remove from local state.
  - **UX niceties**:
    - Loading spinner while fetching.
    - Error text if Supabase calls fail.
    - Disabled state on buttons while a request is in flight.

### Perfil page (username + avatar)

- **Create `src/pages/Perfil.tsx`**:
  - Layout: centered card with fields for **Username** and **Profile picture**.
  - On mount:
    - Get current user id via `supabase.auth.getUser()`.
    - Fetch the user profile row from `public.profiles` and pre-fill `display_name` and avatar preview if they exist.
  - **Username editing**:
    - Controlled text input bound to `display_name`.
    - "Save" button that upserts/updates `profiles.display_name` for `id = auth.uid()`.
  - **Avatar upload**:
    - File input (accepting image files) with preview.
    - On upload:
      - Generate a unique path in `fotos` like `userId/timestamp.ext`.
      - Use `supabase.storage.from('fotos').upload(path, file, { upsert: true })`.
      - Get a public URL via `getPublicUrl(path)` and store that URL in `profiles.avatar_url`.
      - Update local state and show preview.
  - **UI details**:
    - Use HeroUI `Card`, `Input`, `Button`, `Avatar`, and maybe a subtle gradient background to match dashboard styling.
    - Show success / error message chips when saving.

### Wiring username + avatar into todos

- **Query shape**:
  - In `CosasQueHacer`, select todos with joined profile info:
    - `.from('todos').select('id,title,is_completed,created_at, profiles(display_name,avatar_url)')` with `profiles:created_by (display_name, avatar_url)` depending on your Supabase client typing.
- **Render**:
  - For each todo, display at the bottom-right or bottom-left:
    - A tiny circular image or initials (HeroUI `Avatar`) using `avatar_url` when available.
    - Text `Creado por {display_name || 'Anónimo'}`.
- **Fallbacks**:
  - If no avatar_url, show a colored circle with first letter of the username.
  - If no display_name yet, show email-derived name or "Sin nombre".

### Files to touch / create

- **Existing files to update**:
  - `[src/App.tsx](src/App.tsx)` → add routes for `/dashboard/todo` and `/dashboard/perfil`.
  - `[src/components/layout/RightSidebar.tsx](src/components/layout/RightSidebar.tsx)` → ensure paths match and (optionally) highlight active state for new pages.
- **New files to create**:
  - `[src/pages/CosasQueHacer.tsx](src/pages/CosasQueHacer.tsx)`
  - `[src/pages/Perfil.tsx](src/pages/Perfil.tsx)`
  - Optionally `[src/components/todos/TodoItem.tsx](src/components/todos/TodoItem.tsx)` and `[src/components/profile/AvatarUploader.tsx](src/components/profile/AvatarUploader.tsx)` if we want to keep pages clean.

### Supabase SQL snippet recap for you

You already have this in `supabase_schema.sql`, but here is the relevant part to apply in Supabase if you haven’t run it yet:

```sql
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  display_name text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.todos (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  is_completed boolean default false not null,
  created_by uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

RLS policies in that file already allow any authenticated user to view and modify todos and profiles.

### Implementation order

- Step 1: Confirm Supabase schema is applied (run `supabase_schema.sql` in your project or Supabase SQL editor).
- Step 2: Add new React pages (`CosasQueHacer`, `Perfil`) with static UI only (no Supabase) to verify routing and navbar work.
- Step 3: Wire `CosasQueHacer` to Supabase `todos` table (CRUD operations + created-by display).
- Step 4: Wire `Perfil` to `profiles` table and `fotos` storage (username edit + avatar upload).
- Step 5: Smoke-test flows end-to-end: signup/login → set profile → create todos → see username + avatar on each item.
