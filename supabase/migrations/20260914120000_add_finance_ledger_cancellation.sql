alter table public.finance_ledger
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.profiles(id);

create index if not exists finance_ledger_active_date_idx
  on public.finance_ledger (transaction_date desc)
  where cancelled_at is null;

create index if not exists finance_ledger_cancelled_by_idx
  on public.finance_ledger (cancelled_by)
  where cancelled_by is not null;
