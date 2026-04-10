-- Resolve auth user (profiles.id) from subscription merchant uid: sub-{first8hex}-...
CREATE OR REPLACE FUNCTION public.profile_id_for_sub_merchant_uid(payment_id text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (array_agg(p.id ORDER BY p.id))[1]
  FROM public.profiles p
  WHERE payment_id ~* '^sub-[0-9a-f]{8}-'
    AND p.id::text LIKE lower(substr(payment_id, 5, 8)) || '-%'
  GROUP BY lower(substr(payment_id, 5, 8))
  HAVING count(*) = 1;
$$;

REVOKE ALL ON FUNCTION public.profile_id_for_sub_merchant_uid(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_id_for_sub_merchant_uid(text) TO service_role;
