alter table public.finance_ledger
  add column if not exists submission_key uuid;

create unique index if not exists finance_ledger_submission_key_unique
  on public.finance_ledger(submission_key)
  where submission_key is not null;
