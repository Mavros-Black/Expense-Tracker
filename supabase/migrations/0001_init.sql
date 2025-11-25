create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  source text not null check (source in ('gmail', 'sms', 'manual')),
  amount numeric(12, 2) not null,
  currency text not null default 'USD',
  vendor text,
  date timestamptz not null,
  category text,
  confidence_score numeric(3, 2),
  raw_text text,
  reference_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  pattern text not null,
  category text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.gmail_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  access_token text not null,
  refresh_token text,
  expiry_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
