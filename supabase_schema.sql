-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Create Profiles table (extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  display_name text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  -- Notification helpers: when each user last saw sections
  last_seen_todos_at timestamp with time zone,
  last_seen_plans_at timestamp with time zone,
  last_seen_para_ver_at timestamp with time zone,
  last_seen_letters_at timestamp with time zone
);

-- 2. Create Todos table (Cosas que hacer)
create table public.todos (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  is_completed boolean default false not null,
  created_by uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Create Plans table (Planes)
create table public.plans (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  plan_date timestamp with time zone not null,
  created_by uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Create Letters table (Cartitas)
create table public.letters (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  content text not null,
  image_url text,
  recipient_id uuid references public.profiles(id) on delete cascade not null,
  is_read boolean default false not null,
  read_at timestamp with time zone,
  created_by uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Create Para Ver table (Peliculas / series para ver)
create table public.para_ver_items (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  image_url text,
  status text not null default 'no_visto' check (status in ('no_visto', 'viendo', 'visto')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS)
-- Since this app is just for you and your girlfriend, we will allow all authenticated users 
-- to read and write to these tables so you can share plans, letters, and todos.

alter table public.profiles enable row level security;
alter table public.todos enable row level security;
alter table public.plans enable row level security;
alter table public.letters enable row level security;
alter table public.para_ver_items enable row level security;

-- Profiles Policies
create policy "Authenticated users can view profiles" on public.profiles
  for select using (auth.role() = 'authenticated');
  
create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id);

-- Todos Policies
create policy "Authenticated users can view all todos" on public.todos
  for select using (auth.role() = 'authenticated');
  
create policy "Authenticated users can insert todos" on public.todos
  for insert with check (auth.role() = 'authenticated');
  
create policy "Authenticated users can update todos" on public.todos
  for update using (auth.role() = 'authenticated');
  
create policy "Authenticated users can delete todos" on public.todos
  for delete using (auth.role() = 'authenticated');

-- Plans Policies
create policy "Authenticated users can view all plans" on public.plans
  for select using (auth.role() = 'authenticated');
  
create policy "Authenticated users can insert plans" on public.plans
  for insert with check (auth.role() = 'authenticated');
  
create policy "Authenticated users can update plans" on public.plans
  for update using (auth.role() = 'authenticated');
  
create policy "Authenticated users can delete plans" on public.plans
  for delete using (auth.role() = 'authenticated');

-- Letters Policies
create policy "Users can view sent and received letters" on public.letters
  for select using (created_by = auth.uid() or recipient_id = auth.uid());
  
create policy "Users can insert their own letters" on public.letters
  for insert with check (created_by = auth.uid());
  
create policy "Recipients can mark letters as read" on public.letters
  for update using (recipient_id = auth.uid());
  
create policy "Users can delete their own sent letters" on public.letters
  for delete using (created_by = auth.uid());

-- Para ver Policies (shared list)
create policy "Authenticated users can view para ver items" on public.para_ver_items
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert para ver items" on public.para_ver_items
  for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update para ver items" on public.para_ver_items
  for update using (auth.role() = 'authenticated');

create policy "Authenticated users can delete para ver items" on public.para_ver_items
  for delete using (auth.role() = 'authenticated');

-- Storage bucket for "para ver" images (run in Supabase SQL editor)
insert into storage.buckets (id, name, public)
values ('para-ver', 'para-ver', true)
on conflict (id) do nothing;

create policy "Authenticated users can view para ver images" on storage.objects
  for select using (bucket_id = 'para-ver');

create policy "Authenticated users can upload para ver images" on storage.objects
  for insert with check (bucket_id = 'para-ver' and auth.role() = 'authenticated');

create policy "Authenticated users can update para ver images" on storage.objects
  for update using (bucket_id = 'para-ver' and auth.role() = 'authenticated');

create policy "Authenticated users can delete para ver images" on storage.objects
  for delete using (bucket_id = 'para-ver' and auth.role() = 'authenticated');

-- Automatically create a profile when a new user signs up
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
