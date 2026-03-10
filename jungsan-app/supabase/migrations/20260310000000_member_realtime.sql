-- ================================================================
-- 회원 실시간 알림 테이블 + 트리거
-- 목적: 신규 가입 / 탈퇴 시 site-admin 페이지에 즉시 반영
-- ================================================================

-- 1. 알림 테이블 생성
CREATE TABLE IF NOT EXISTS member_change_notifications (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type text   NOT NULL,   -- 'signup' | 'withdraw'
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 2. Supabase Realtime 발행 등록
ALTER PUBLICATION supabase_realtime ADD TABLE member_change_notifications;

-- 3. RLS 활성화
ALTER TABLE member_change_notifications ENABLE ROW LEVEL SECURITY;

-- 4. 인증된 모든 사용자 INSERT 허용 (탈퇴/가입 시 서버에서 삽입)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='member_change_notifications' AND policyname='mcn_allow_insert'
  ) THEN
    EXECUTE $$
      CREATE POLICY "mcn_allow_insert" ON member_change_notifications
        FOR INSERT TO authenticated WITH CHECK (true)
    $$;
  END IF;
END $$;

-- 5. 인증된 모든 사용자 SELECT 허용 (realtime 수신에 필요)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='member_change_notifications' AND policyname='mcn_allow_select'
  ) THEN
    EXECUTE $$
      CREATE POLICY "mcn_allow_select" ON member_change_notifications
        FOR SELECT TO authenticated USING (true)
    $$;
  END IF;
END $$;

-- 6. profiles INSERT/DELETE 시 자동 알림 트리거 함수
CREATE OR REPLACE FUNCTION notify_member_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO member_change_notifications (event_type) VALUES ('signup');
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO member_change_notifications (event_type) VALUES ('withdraw');
  END IF;
  RETURN NEW;
END;
$$;

-- 7. 트리거 등록 (중복 방지)
DROP TRIGGER IF EXISTS trg_member_change ON profiles;
CREATE TRIGGER trg_member_change
  AFTER INSERT OR DELETE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION notify_member_change();
