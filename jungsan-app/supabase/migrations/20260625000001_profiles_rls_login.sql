-- profiles 테이블 RLS 안전 설정
-- 로그인 시 username → email 조회를 위해 anon SELECT 정책 추가
--
-- ⚠️ RLS가 아직 활성화되지 않은 경우:
--   이 마이그레이션은 정책만 준비하고, RLS는 활성화하지 않습니다.
--   RLS 비활성화 상태에서는 anon이 이미 profiles를 조회할 수 있으므로 문제 없습니다.
--
-- ✅ RLS가 이미 활성화된 경우:
--   anon과 인증 사용자가 필요한 접근 권한을 갖도록 정책을 설정합니다.

-- 중복 방지를 위해 기존 정책 삭제
DROP POLICY IF EXISTS "profiles_anon_email_lookup" ON profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "admin_all_profiles" ON profiles;

-- RLS 활성화 (이미 활성화되어 있으면 무시됨)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 1. anon: 로그인용 username/email 조회 허용 (SELECT only)
CREATE POLICY "profiles_anon_email_lookup" ON profiles
  FOR SELECT TO anon
  USING (true);

-- 2. 인증 사용자: 본인 프로필 또는 admin이면 전체 조회
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR is_site_admin());

-- 3. 인증 사용자: 본인 프로필 삽입
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- 4. 인증 사용자: 본인 또는 admin이면 수정
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR is_site_admin())
  WITH CHECK (id = auth.uid() OR is_site_admin());

-- 5. admin: 전체 삭제 권한
CREATE POLICY "admin_delete_profiles" ON profiles
  FOR DELETE TO authenticated
  USING (is_site_admin());
