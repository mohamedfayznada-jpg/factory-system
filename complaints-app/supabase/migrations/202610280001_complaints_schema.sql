-- Complaints portal schema. Apply only to a dedicated Supabase project.
create extension if not exists pgcrypto;

create type public.complaint_status as enum ('new', 'in_review', 'answered', 'closed');
create type public.portal_role as enum ('employee', 'admin');

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  sap_no text not null unique,
  full_name text not null,
  department text,
  section text,
  job_title text,
  shift text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint employees_sap_no_digits check (sap_no ~ '^[0-9]{3,12}$')
);

create table public.portal_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  employee_id uuid unique references public.employees(id) on delete restrict,
  role public.portal_role not null default 'employee',
  created_at timestamptz not null default now()
);

create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  subject text not null check (char_length(trim(subject)) between 3 and 160),
  body text not null check (char_length(trim(body)) between 5 and 10000),
  status public.complaint_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.complaint_replies (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete restrict,
  body text not null check (char_length(trim(body)) between 1 and 10000),
  created_at timestamptz not null default now()
);

create table public.complaint_audit (
  id bigint generated always as identity primary key,
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);

create index complaints_employee_created_idx on public.complaints(employee_id, created_at desc);
create index complaints_status_created_idx on public.complaints(status, created_at desc);
create index complaint_replies_complaint_created_idx on public.complaint_replies(complaint_id, created_at);

alter table public.employees enable row level security;
alter table public.portal_profiles enable row level security;
alter table public.complaints enable row level security;
alter table public.complaint_replies enable row level security;
alter table public.complaint_audit enable row level security;

-- No anonymous access. All user-facing access requires a provisioned Auth account.
create policy "profile reads own record" on public.portal_profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy "employees read own profile" on public.employees for select to authenticated
  using (id = (select employee_id from public.portal_profiles where user_id = (select auth.uid())));
create policy "employees read own complaints" on public.complaints for select to authenticated
  using (employee_id = (select employee_id from public.portal_profiles where user_id = (select auth.uid()))
    or exists (select 1 from public.portal_profiles p where p.user_id = (select auth.uid()) and p.role = 'admin'));
create policy "employees create own complaints" on public.complaints for insert to authenticated
  with check (employee_id = (select employee_id from public.portal_profiles where user_id = (select auth.uid())));
create policy "admins update complaints" on public.complaints for update to authenticated
  using (exists (select 1 from public.portal_profiles p where p.user_id = (select auth.uid()) and p.role = 'admin'))
  with check (exists (select 1 from public.portal_profiles p where p.user_id = (select auth.uid()) and p.role = 'admin'));
create policy "own replies or admin replies visible" on public.complaint_replies for select to authenticated
  using (exists (
    select 1 from public.complaints c
    where c.id = complaint_id and (
      c.employee_id = (select employee_id from public.portal_profiles where user_id = (select auth.uid()))
      or exists (select 1 from public.portal_profiles p where p.user_id = (select auth.uid()) and p.role = 'admin')
    )
  ));
create policy "admins add replies" on public.complaint_replies for insert to authenticated
  with check (author_user_id = (select auth.uid()) and exists (select 1 from public.portal_profiles p where p.user_id = (select auth.uid()) and p.role = 'admin'));
create policy "admins read audit" on public.complaint_audit for select to authenticated
  using (exists (select 1 from public.portal_profiles p where p.user_id = (select auth.uid()) and p.role = 'admin'));

-- Admin role must be assigned by a trusted operator in Supabase, never by a client-side form.
-- SAP number alone is not authentication. Employee access requires an authenticated account
-- securely mapped to portal_profiles.employee_id before enabling the portal lookup flow.
