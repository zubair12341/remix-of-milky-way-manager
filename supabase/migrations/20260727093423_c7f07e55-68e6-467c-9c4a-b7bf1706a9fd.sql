CREATE OR REPLACE FUNCTION public.apply_changes(p_business_id uuid, p_device_id text, p_changes jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      SELECT string_agg(quote_ident(column_name), ',' ORDER BY ordinal_position)
        INTO cols
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name=t AND column_name <> 'created_at';
      SELECT string_agg(quote_ident(column_name)||' = EXCLUDED.'||quote_ident(column_name), ',' ORDER BY ordinal_position)
        INTO updates
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name=t
        AND column_name NOT IN ('created_at','updated_at','id');
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
END $function$;