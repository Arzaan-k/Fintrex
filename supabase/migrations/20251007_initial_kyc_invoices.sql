-- KYC and Invoices schema (idempotent where possible)
-- Run on Supabase Postgres

-- KYC document types master
create table if not exists public.kyc_document_types (
  code text primary key,
  name text not null,
  required_for text[] default '{}'::text[] -- e.g. {proprietorship, partnership, pvt_ltd}
);

-- KYC checklist per client
create table if not exists public.kyc_checklists (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  type_code text not null references public.kyc_document_types(code) on delete restrict,
  required boolean not null default true,
  status text not null default 'pending', -- pending | received | verified
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists kyc_checklists_client_idx on public.kyc_checklists(client_id);

-- KYC documents uploaded
create table if not exists public.kyc_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  type_code text not null references public.kyc_document_types(code) on delete restrict,
  file_path text not null,
  file_name text,
  file_size bigint,
  status text not null default 'pending', -- pending | processing | completed | failed
  extracted_data jsonb,
  confidence numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists kyc_documents_client_idx on public.kyc_documents(client_id);

-- Invoices table consumed by src/pages/Invoices.tsx
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.documents(id) on delete set null,
  client_id uuid not null references public.clients(id) on delete cascade,
  invoice_type text not null check (invoice_type in ('sales','purchase')),
  invoice_number text,
  invoice_date date,
  due_date date,
  vendor_name text,
  vendor_gstin text,
  customer_name text,
  customer_gstin text,
  line_items jsonb,
  tax_details jsonb,
  total_amount numeric,
  currency text default 'INR',
  payment_status text default 'unpaid' check (payment_status in ('unpaid','paid','partial','overdue')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists invoices_client_idx on public.invoices(client_id);
create index if not exists invoices_type_idx on public.invoices(invoice_type);

-- Minimal seed for common KYC types
insert into public.kyc_document_types(code, name, required_for) values
  ('kyc_pan','PAN Card', '{proprietorship,partnership,pvt_ltd}'::text[]),
  ('kyc_aadhaar','Aadhaar Card', '{proprietorship,partnership}'::text[]),
  ('kyc_gst','GST Certificate', '{proprietorship,partnership,pvt_ltd}'::text[]),
  ('kyc_incorp','Incorporation Certificate', '{pvt_ltd}'::text[]),
  ('kyc_bank','Cancelled Cheque', '{proprietorship,partnership,pvt_ltd}'::text[])
  on conflict (code) do nothing;
