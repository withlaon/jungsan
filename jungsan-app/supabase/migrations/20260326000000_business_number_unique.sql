-- 사업자등록번호 중복 방지
-- 숫자만 추출해 비교하므로 000-00-00000 / 0000000000 형식 모두 처리

-- 1. 사업자등록번호 중복 확인 RPC
CREATE OR REPLACE FUNCTION check_business_number_exists(p_business_number text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE business_number IS NOT NULL
      AND trim(business_number) != ''
      AND regexp_replace(business_number, '[^0-9]', '', 'g')
            = regexp_replace(p_business_number,  '[^0-9]', '', 'g')
      AND regexp_replace(p_business_number, '[^0-9]', '', 'g') != ''
  );
$$;

-- 2. create_profile_on_signup 재정의: 사업자등록번호 중복 시 EXCEPTION 발생
CREATE OR REPLACE FUNCTION create_profile_on_signup(
  p_id              uuid,
  p_username        text,
  p_company_name    text,
  p_business_number text,
  p_manager_name    text,
  p_phone           text,
  p_email           text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 사업자등록번호 중복 확인 (숫자만 추출 후 비교)
  IF p_business_number IS NOT NULL AND trim(p_business_number) != '' THEN
    IF EXISTS (
      SELECT 1 FROM profiles
      WHERE business_number IS NOT NULL
        AND trim(business_number) != ''
        AND regexp_replace(business_number, '[^0-9]', '', 'g')
              = regexp_replace(p_business_number, '[^0-9]', '', 'g')
    ) THEN
      RAISE EXCEPTION '이미 등록된 사업자등록번호입니다.';
    END IF;
  END IF;

  INSERT INTO profiles (id, username, company_name, business_number, manager_name, phone, email)
  VALUES (p_id, p_username, p_company_name, p_business_number, p_manager_name, p_phone, p_email);
END;
$$;
