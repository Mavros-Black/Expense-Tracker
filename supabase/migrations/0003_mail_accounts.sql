create table if not exists public.mail_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  provider text not null,
  email text,
  access_token text not null,
  refresh_token text,
  expiry_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mail_accounts_user_id_idx
  on public.mail_accounts (user_id);

create index if not exists mail_accounts_user_provider_idx
  on public.mail_accounts (user_id, provider);
