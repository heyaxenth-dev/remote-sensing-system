-- PENRO NGP reference fields (from COMPLIANCE-TO-PENRONGP-DATA-BASE)

alter table public.reforestation_plots
  add column if not exists site_code text,
  add column if not exists po_name text,
  add column if not exists representative text,
  add column if not exists location_text text,
  add column if not exists area_ha double precision,
  add column if not exists species_planted text,
  add column if not exists seedlings_contracted integer,
  add column if not exists contract_expiry date,
  add column if not exists third_year_survival_rate numeric,
  add column if not exists latest_survival_rate numeric,
  add column if not exists penro_source text default 'PENRO NGP CY 2011-2021';

create unique index if not exists reforestation_plots_site_code_idx
  on public.reforestation_plots (site_code)
  where site_code is not null;

alter table public.monitoring_submissions
  add column if not exists penro_accuracy_score integer,
  add column if not exists penro_accuracy_detail jsonb;

create index if not exists monitoring_submissions_penro_score_idx
  on public.monitoring_submissions (penro_accuracy_score desc nulls last);
