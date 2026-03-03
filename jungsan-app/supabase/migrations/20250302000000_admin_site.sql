-- 사이트 관리자 기능: 회원 전체 열람/수정 RPC
--
-- [admin 계정 설정 방법] (아이디: admin, 비밀번호: hjlje@1771)
-- 1. Supabase Dashboard > Authentication > Users > Add user
--    - Email: admin@jungsan.local (또는 .env의 NEXT_PUBLIC_ADMIN_EMAIL 값과 동일하게)
--    - Password: hjlje@1771
-- 2. 생성된 사용자의 ID(UUID)를 복사
-- 3. SQL Editor에서 실행:
--    INSERT INTO profiles (id, username, company_name, business_number, manager_name, phone, email)
--    VALUES ('<2번에서_복사한_UUID>', 'admin', '', '', '', '', 'admin@jungsan.local');
--    (email은 1번에서 입력한 이메일과 동일하게)
--

-- 1. admin인지 확인하는 헬퍼
CREATE OR REPLACE FUNCTION is_site_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND lower(username) = 'admin'
  );
END;
$$;

-- 2. 전체 회원(프로필) 목록 조회 (admin 전용)
CREATE OR REPLACE FUNCTION admin_get_all_profiles()
RETURNS TABLE (
  id uuid,
  username text,
  company_name text,
  business_number text,
  manager_name text,
  phone text,
  email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_site_admin() THEN
    RAISE EXCEPTION '권한이 없습니다.';
  END IF;
  RETURN QUERY
  SELECT p.id, p.username, p.company_name, p.business_number, p.manager_name, p.phone, p.email
  FROM profiles p
  ORDER BY p.username ASC NULLS LAST;
END;
$$;

-- 3. 회원 프로필 수정 (admin 전용)
CREATE OR REPLACE FUNCTION admin_update_profile(
  p_id uuid,
  p_username text,
  p_company_name text,
  p_business_number text,
  p_manager_name text,
  p_phone text,
  p_email text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_site_admin() THEN
    RAISE EXCEPTION '권한이 없습니다.';
  END IF;
  UPDATE profiles SET
    username = nullif(trim(p_username), ''),
    company_name = nullif(trim(p_company_name), ''),
    business_number = nullif(trim(p_business_number), ''),
    manager_name = nullif(trim(p_manager_name), ''),
    phone = nullif(trim(p_phone), ''),
    email = nullif(trim(p_email), '')
  WHERE id = p_id;
END;
$$;

-- 4. 회원별 기능 설정용 테이블 (추후 확장)
CREATE TABLE IF NOT EXISTS member_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  config jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_member_features_user ON member_features(user_id);
CREATE INDEX IF NOT EXISTS idx_member_features_key ON member_features(feature_key);

-- RLS
ALTER TABLE member_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_member_features" ON member_features
  FOR ALL
  USING (is_site_admin())
  WITH CHECK (is_site_admin());
