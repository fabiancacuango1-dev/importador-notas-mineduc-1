create table if not exists teacher_subscriptions (
  id uuid primary key default gen_random_uuid(),
  teacher_key text not null,
  teacher_label text,
  provider text not null default 'payphone',
  payment_id text,
  license_code text,
  status text not null default 'pending',
  paid boolean not null default false,
  browser_fingerprint text,
  activated_by_teacher text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (teacher_key)
);

create index if not exists idx_teacher_subscriptions_teacher_key on teacher_subscriptions(teacher_key);
create index if not exists idx_teacher_subscriptions_status on teacher_subscriptions(status);
create index if not exists idx_teacher_subscriptions_payment_id on teacher_subscriptions(payment_id);
create index if not exists idx_teacher_subscriptions_license_code on teacher_subscriptions(license_code);

-- License activation tracking (one-time use licenses)
create table if not exists license_activations (
  id uuid primary key default gen_random_uuid(),
  license_key text not null unique,
  teacher_id text not null,
  browser_fingerprint text,
  activated boolean not null default true,
  activated_at timestamptz not null default now()
);

create index if not exists idx_license_activations_key on license_activations(license_key);
create index if not exists idx_license_activations_teacher on license_activations(teacher_id);
