-- Explicit per-table grants for the app schema.
-- Replaces the earlier loop-over-pg_tables grant migration (20260727093857)
-- with a hand-enumerated list so future tables don't silently inherit grants.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.businesses           TO authenticated;
GRANT ALL                              ON public.businesses           TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches             TO authenticated;
GRANT ALL                              ON public.branches             TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_members     TO authenticated;
GRANT ALL                              ON public.business_members     TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers            TO authenticated;
GRANT ALL                              ON public.suppliers            TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_payments    TO authenticated;
GRANT ALL                              ON public.supplier_payments    TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_categories  TO authenticated;
GRANT ALL                              ON public.purchase_categories  TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases            TO authenticated;
GRANT ALL                              ON public.purchases            TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_clients      TO authenticated;
GRANT ALL                              ON public.monthly_clients      TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_deliveries   TO authenticated;
GRANT ALL                              ON public.monthly_deliveries   TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_payments     TO authenticated;
GRANT ALL                              ON public.monthly_payments     TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_pauses      TO authenticated;
GRANT ALL                              ON public.delivery_pauses      TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.udhar_customers      TO authenticated;
GRANT ALL                              ON public.udhar_customers      TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.udhar_entries        TO authenticated;
GRANT ALL                              ON public.udhar_entries        TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_sales           TO authenticated;
GRANT ALL                              ON public.cash_sales           TO service_role;
