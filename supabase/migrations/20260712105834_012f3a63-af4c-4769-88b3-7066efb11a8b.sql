
-- Drop unused legacy cloud tables (never used since app moved offline)
DROP TABLE IF EXISTS public.monthly_bills CASCADE;
DROP TABLE IF EXISTS public.monthly_clients CASCADE;
DROP TABLE IF EXISTS public.udhar_entries CASCADE;
DROP TABLE IF EXISTS public.udhar_customers CASCADE;
DROP TABLE IF EXISTS public.cash_sales CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TYPE IF EXISTS public.app_role CASCADE;

-- Shared updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TABLE public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT, phone TEXT,
  currency TEXT NOT NULL DEFAULT 'PKR',
  language TEXT NOT NULL DEFAULT 'en',
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.businesses TO authenticated;
GRANT ALL ON public.businesses TO service_role;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_businesses_updated BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL, address TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_branches_business ON public.branches(business_id);
CREATE TRIGGER trg_branches_updated BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'business_role') THEN
    CREATE TYPE public.business_role AS ENUM ('owner','manager','staff');
  END IF;
END $$;

CREATE TABLE public.business_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  role public.business_role NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_members TO authenticated;
GRANT ALL ON public.business_members TO service_role;
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_bm_user ON public.business_members(user_id);
CREATE INDEX idx_bm_business ON public.business_members(business_id);

CREATE OR REPLACE FUNCTION public.is_business_member(_business_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.business_members
    WHERE business_id = _business_id AND user_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.business_role_of(_business_id UUID)
RETURNS public.business_role LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.business_members
  WHERE business_id = _business_id AND user_id = auth.uid() LIMIT 1
$$;

CREATE POLICY "members read business" ON public.businesses
  FOR SELECT TO authenticated USING (public.is_business_member(id));
CREATE POLICY "auth create business" ON public.businesses
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "owner update business" ON public.businesses
  FOR UPDATE TO authenticated USING (public.business_role_of(id) = 'owner')
  WITH CHECK (public.business_role_of(id) = 'owner');
CREATE POLICY "owner delete business" ON public.businesses
  FOR DELETE TO authenticated USING (public.business_role_of(id) = 'owner');

CREATE POLICY "members read branches" ON public.branches
  FOR SELECT TO authenticated USING (public.is_business_member(business_id));
CREATE POLICY "managers write branches" ON public.branches
  FOR ALL TO authenticated
  USING (public.business_role_of(business_id) IN ('owner','manager'))
  WITH CHECK (public.business_role_of(business_id) IN ('owner','manager'));

CREATE POLICY "members read members" ON public.business_members
  FOR SELECT TO authenticated USING (public.is_business_member(business_id));
CREATE POLICY "owner manages members" ON public.business_members
  FOR ALL TO authenticated
  USING (public.business_role_of(business_id) = 'owner')
  WITH CHECK (public.business_role_of(business_id) = 'owner');
CREATE POLICY "self bootstrap member" ON public.business_members
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ------------------ synced mirrors ------------------

CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  client_id TEXT, sync_version INT NOT NULL DEFAULT 1, deleted_at TIMESTAMPTZ,
  name TEXT NOT NULL, mobile TEXT, address TEXT,
  opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE TABLE public.purchase_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  client_id TEXT, sync_version INT NOT NULL DEFAULT 1, deleted_at TIMESTAMPTZ,
  name TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'item',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  client_id TEXT, sync_version INT NOT NULL DEFAULT 1, deleted_at TIMESTAMPTZ,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.purchase_categories(id) ON DELETE SET NULL,
  purchase_date DATE NOT NULL,
  qty NUMERIC(14,3) NOT NULL DEFAULT 0, unit TEXT,
  rate NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_mode TEXT NOT NULL DEFAULT 'cash',
  invoice_no TEXT, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE TABLE public.supplier_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  client_id TEXT, sync_version INT NOT NULL DEFAULT 1, deleted_at TIMESTAMPTZ,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  mode TEXT NOT NULL DEFAULT 'cash',
  reference_no TEXT, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE TABLE public.monthly_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  client_id TEXT, sync_version INT NOT NULL DEFAULT 1, deleted_at TIMESTAMPTZ,
  name TEXT NOT NULL, mobile TEXT, address TEXT,
  daily_quantity NUMERIC(10,3) NOT NULL DEFAULT 0,
  rate_per_liter NUMERIC(10,2) NOT NULL DEFAULT 0,
  milk_type TEXT, active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE TABLE public.monthly_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  client_id TEXT, sync_version INT NOT NULL DEFAULT 1, deleted_at TIMESTAMPTZ,
  monthly_client_id UUID NOT NULL REFERENCES public.monthly_clients(id) ON DELETE CASCADE,
  delivery_date DATE NOT NULL,
  quantity NUMERIC(10,3) NOT NULL DEFAULT 0,
  rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'delivered',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE TABLE public.delivery_pauses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  client_id TEXT, sync_version INT NOT NULL DEFAULT 1, deleted_at TIMESTAMPTZ,
  monthly_client_id UUID NOT NULL REFERENCES public.monthly_clients(id) ON DELETE CASCADE,
  from_date DATE NOT NULL, to_date DATE NOT NULL, reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE TABLE public.monthly_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  client_id TEXT, sync_version INT NOT NULL DEFAULT 1, deleted_at TIMESTAMPTZ,
  monthly_client_id UUID NOT NULL REFERENCES public.monthly_clients(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL, period TEXT,
  payment_date DATE NOT NULL, note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE TABLE public.udhar_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  client_id TEXT, sync_version INT NOT NULL DEFAULT 1, deleted_at TIMESTAMPTZ,
  name TEXT NOT NULL, mobile TEXT, address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE TABLE public.udhar_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  client_id TEXT, sync_version INT NOT NULL DEFAULT 1, deleted_at TIMESTAMPTZ,
  customer_id UUID NOT NULL REFERENCES public.udhar_customers(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(14,2) NOT NULL, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE TABLE public.cash_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  client_id TEXT, sync_version INT NOT NULL DEFAULT 1, deleted_at TIMESTAMPTZ,
  amount NUMERIC(14,2) NOT NULL,
  operator_name TEXT, slip_number BIGINT,
  sale_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'suppliers','purchase_categories','purchases','supplier_payments',
    'monthly_clients','monthly_deliveries','delivery_pauses','monthly_payments',
    'udhar_customers','udhar_entries','cash_sales'
  ]) LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated;', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role;', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE TRIGGER trg_%I_updated BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();', t, t);
    EXECUTE format('CREATE INDEX idx_%I_business ON public.%I(business_id);', t, t);
    EXECUTE format('CREATE INDEX idx_%I_updated ON public.%I(business_id, updated_at);', t, t);
    EXECUTE format($p$CREATE POLICY "members read %1$s" ON public.%1$I FOR SELECT TO authenticated USING (public.is_business_member(business_id));$p$, t);
    EXECUTE format($p$CREATE POLICY "members write %1$s" ON public.%1$I FOR ALL TO authenticated USING (public.is_business_member(business_id)) WITH CHECK (public.is_business_member(business_id));$p$, t);
  END LOOP;
END $$;

-- Sync RPCs
CREATE OR REPLACE FUNCTION public.get_changes(
  p_business_id UUID, p_since TIMESTAMPTZ DEFAULT 'epoch', p_limit INT DEFAULT 500
) RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result JSONB := '{}'::jsonb; t TEXT; rows JSONB;
BEGIN
  IF NOT public.is_business_member(p_business_id) THEN
    RAISE EXCEPTION 'Not a member of this business';
  END IF;
  FOR t IN SELECT unnest(ARRAY[
    'suppliers','purchase_categories','purchases','supplier_payments',
    'monthly_clients','monthly_deliveries','delivery_pauses','monthly_payments',
    'udhar_customers','udhar_entries','cash_sales'
  ]) LOOP
    EXECUTE format(
      'SELECT COALESCE(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) FROM (
         SELECT * FROM public.%I WHERE business_id = $1 AND updated_at > $2
         ORDER BY updated_at ASC LIMIT $3) x', t
    ) INTO rows USING p_business_id, p_since, p_limit;
    result := result || jsonb_build_object(t, rows);
  END LOOP;
  RETURN result || jsonb_build_object('server_time', to_jsonb(now()));
END $$;

CREATE OR REPLACE FUNCTION public.apply_changes(
  p_business_id UUID, p_device_id TEXT, p_changes JSONB
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t TEXT; applied INT := 0; n INT; cols TEXT; updates TEXT;
BEGIN
  IF NOT public.is_business_member(p_business_id) THEN
    RAISE EXCEPTION 'Not a member of this business';
  END IF;
  FOR t IN SELECT unnest(ARRAY[
    'suppliers','purchase_categories','purchases','supplier_payments',
    'monthly_clients','monthly_deliveries','delivery_pauses','monthly_payments',
    'udhar_customers','udhar_entries','cash_sales'
  ]) LOOP
    IF p_changes ? t THEN
      SELECT string_agg(quote_ident(column_name), ',' ORDER BY ordinal_position),
             string_agg(quote_ident(column_name)||' = EXCLUDED.'||quote_ident(column_name), ',' ORDER BY ordinal_position)
        INTO cols, updates
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name=t AND column_name <> 'created_at';
      EXECUTE format(
        'INSERT INTO public.%I (%s)
           SELECT %s FROM jsonb_populate_recordset(NULL::public.%I, $1->%L)
           WHERE business_id = $2
         ON CONFLICT (id) DO UPDATE SET %s, updated_at = now()
           WHERE public.%I.sync_version <= EXCLUDED.sync_version',
        t, cols, cols, t, t, updates, t
      ) USING p_changes, p_business_id;
      GET DIAGNOSTICS n = ROW_COUNT;
      applied := applied + n;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('applied', applied, 'server_time', to_jsonb(now()), 'device_id', p_device_id);
END $$;

REVOKE ALL ON FUNCTION public.get_changes(UUID, TIMESTAMPTZ, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_changes(UUID, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_changes(UUID, TIMESTAMPTZ, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_changes(UUID, TEXT, JSONB) TO authenticated;
