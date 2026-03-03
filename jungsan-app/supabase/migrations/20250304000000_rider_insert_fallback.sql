-- user_id 컬럼이 없는 riders 테이블용 fallback RPC
-- 기존 insert_riders_bulk가 user_id 오류로 실패할 때 사용
-- Supabase SQL Editor에서 수동 실행 가능

CREATE OR REPLACE FUNCTION insert_riders_bulk_legacy(p_riders jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r jsonb;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(p_riders)
  LOOP
    INSERT INTO riders (join_date, name, rider_username, id_number, phone, bank_name, bank_account, account_holder, status)
    VALUES (
      (r->>'join_date')::date,
      (r->>'name')::text,
      nullif(trim((r->>'rider_username')::text), ''),
      nullif(trim((r->>'id_number')::text), ''),
      nullif(trim((r->>'phone')::text), ''),
      nullif(trim((r->>'bank_name')::text), ''),
      nullif(trim((r->>'bank_account')::text), ''),
      nullif(trim((r->>'account_holder')::text), ''),
      coalesce((r->>'status')::text, 'active')
    );
  END LOOP;
END;
$$;
