-- username으로 email을 반환하는 RPC
-- 로그인 시 username → email 변환에 사용됩니다.
-- SECURITY DEFINER: RLS를 우회해 미인증 상태에서도 호출 가능

CREATE OR REPLACE FUNCTION get_email_by_username(p_username text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT email INTO v_email
  FROM profiles
  WHERE lower(username) = lower(trim(p_username))
  LIMIT 1;

  RETURN v_email;
END;
$$;

-- 모든 역할(익명 포함)에서 호출 가능하도록 EXECUTE 권한 부여
GRANT EXECUTE ON FUNCTION get_email_by_username(text) TO anon, authenticated;
