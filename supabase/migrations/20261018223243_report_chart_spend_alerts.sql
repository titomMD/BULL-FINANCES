-- BULLMILTON · Gráfica de Reportes y alertas de gasto (preferencias de cada cuenta)
--
-- report_chart: la vista del panel de análisis de Reportes. Se recuerda la última elegida y
-- también se elige en Ajustes → Apariencia ("Gráfica inicial de Reportes"). Los valores son los
-- de src/lib/preferences.ts.
-- spend_alerts / spend_alert_threshold: avisos dentro de la app cuando el mes va mal
-- (Ajustes → Alertas). El umbral es el % de lo que entró ya gastado.

alter table public.profiles
  add column report_chart text not null default 'income_expense'
    check (report_chart in ('income_expense', 'pace', 'category', 'person', 'remaining', 'compare')),
  add column spend_alerts boolean not null default true,
  add column spend_alert_threshold smallint not null default 80
    check (spend_alert_threshold in (50, 60, 70, 80, 90));

comment on column public.profiles.report_chart is
  'Vista del panel de análisis de Reportes (la última elegida).';
comment on column public.profiles.spend_alert_threshold is
  'Porcentaje de los ingresos del mes ya gastado a partir del cual se avisa.';

-- ---------------------------------------------------------------------------
-- Privilegios
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public, private from public, anon;

grant update (report_chart, spend_alerts, spend_alert_threshold)
  on public.profiles to authenticated;
