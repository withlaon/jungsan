-- 라이더 시스템 완전 설정 (Supabase SQL Editor에서 실행)
-- https://supabase.com/dashboard/project/_/sql 에서 실행

CREATE TABLE IF NOT EXISTS riders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  join_date date,
  name text NOT NULL,
  rider_username text,
  id_number text,
  phone text,
  bank_name text,
  bank_account text,
  account_holder text,
  status text NOT NULL DEFAULT 'active',
  access_token text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. user_id 컬럼 추가 (없으면)
ALTER TABLE riders ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_riders_user_id ON riders(user_id);
-- rider_username unique 제거: 기존 중복 데이터가 있으면 인덱스 생성 실패하므로 생략

-- 3. insert_rider (p_user_id 명시)
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

-- 4. insert_rider (9개 파라미터 - auth.uid 사용)
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

-- 5. insert_riders_bulk (기존 함수 삭제 후 재생성)
DROP FUNCTION IF EXISTS insert_riders_bulk(jsonb);
DROP FUNCTION IF EXISTS insert_riders_bulk(uuid, jsonb);

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

-- 6. insert_riders_bulk (1개 파라미터)
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

-- 7. update_rider, delete_rider, update_rider_status
CREATE OR REPLACE FUNCTION update_rider(
  p_id uuid,
  p_join_date date,
  p_name text,
  p_rider_username text,
  p_id_number text,
  p_phone text,
  p_bank_name text,
  p_bank_account text,
  p_account_holder text,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE riders SET
    join_date = p_join_date,
    name = p_name,
    rider_username = nullif(trim(p_rider_username), ''),
    id_number = nullif(trim(p_id_number), ''),
    phone = nullif(trim(p_phone), ''),
    bank_name = nullif(trim(p_bank_name), ''),
    bank_account = nullif(trim(p_bank_account), ''),
    account_holder = nullif(trim(p_account_holder), ''),
    status = coalesce(p_status, 'active'),
    updated_at = now()
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION update_rider_status(p_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE riders SET status = coalesce(p_status, 'active'), updated_at = now() WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION delete_rider(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 관련 데이터 먼저 삭제 (FK 제약 순서 고려)
  DELETE FROM settlement_details WHERE rider_id = p_id;
  DELETE FROM advance_payments WHERE rider_id = p_id;
  DELETE FROM promotions WHERE rider_id = p_id;
  DELETE FROM management_fees WHERE rider_id = p_id;
  DELETE FROM insurance_fees WHERE rider_id = p_id;
  DELETE FROM riders WHERE id = p_id;
END;
$$;

-- 8. RLS: riders 테이블 select 허용 (인증 사용자)
ALTER TABLE riders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "riders_select_policy" ON riders;
CREATE POLICY "riders_select_policy" ON riders FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);
DROP POLICY IF EXISTS "riders_insert_policy" ON riders;
CREATE POLICY "riders_insert_policy" ON riders FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
DROP POLICY IF EXISTS "riders_update_policy" ON riders;
CREATE POLICY "riders_update_policy" ON riders FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);
DROP POLICY IF EXISTS "riders_delete_policy" ON riders;
CREATE POLICY "riders_delete_policy" ON riders FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);
