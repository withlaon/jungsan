-- riders RPC에 user_id 지원 추가 (기존 RPC가 있으면 교체, 없으면 생성)

-- insert_rider: p_user_id 추가
CREATE OR REPLACE FUNCTION insert_rider(
  p_user_id uuid,
  p_join_date date,
  p_name text,
  p_rider_username text,
  p_id_number text,
  p_phone text,
  p_bank_name text,
  p_bank_account text,
  p_account_holder text,
  p_status text DEFAULT 'active'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO riders (user_id, join_date, name, rider_username, id_number, phone, bank_name, bank_account, account_holder, status)
  VALUES (p_user_id, p_join_date, p_name, nullif(trim(p_rider_username), ''), nullif(trim(p_id_number), ''), nullif(trim(p_phone), ''), nullif(trim(p_bank_name), ''), nullif(trim(p_bank_account), ''), nullif(trim(p_account_holder), ''), coalesce(p_status, 'active'))
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

-- 기존 insert_rider(파라미터 9개) 호환: p_user_id 없이 호출 시 auth.uid() 사용
CREATE OR REPLACE FUNCTION insert_rider(
  p_join_date date,
  p_name text,
  p_rider_username text,
  p_id_number text,
  p_phone text,
  p_bank_name text,
  p_bank_account text,
  p_account_holder text,
  p_status text DEFAULT 'active'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN insert_rider(auth.uid(), p_join_date, p_name, p_rider_username, p_id_number, p_phone, p_bank_name, p_bank_account, p_account_holder, p_status);
END;
$$;

-- update_rider: user_id는 변경하지 않음 (기존 레코드 유지)
-- insert_riders_bulk: p_user_id 추가
CREATE OR REPLACE FUNCTION insert_riders_bulk(p_user_id uuid, p_riders jsonb)
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
    INSERT INTO riders (user_id, join_date, name, rider_username, id_number, phone, bank_name, bank_account, account_holder, status)
    VALUES (
      p_user_id,
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

-- 기존 insert_riders_bulk(p_riders만) 호환
CREATE OR REPLACE FUNCTION insert_riders_bulk(p_riders jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM insert_riders_bulk(auth.uid(), p_riders);
END;
$$;
