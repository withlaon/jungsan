-- 구독 관리 테이블
CREATE TABLE IF NOT EXISTS subscriptions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status                text NOT NULL DEFAULT 'trial',
  -- trial    : 무료 체험 중
  -- active   : 유료 구독 중 (결제 정상)
  -- past_due : 결제 실패 (재시도 대기)
  -- cancelled: 해지됨

  -- 빌링키 정보 (서버 전용, 클라이언트 노출 금지)
  billing_key           text,
  billing_key_issued_at timestamptz,
  card_company          text,
  card_number_masked    text,               -- 예: ****1234

  -- 구독 기간
  trial_ends_at         timestamptz NOT NULL,
  current_period_start  timestamptz,
  current_period_end    timestamptz,
  next_billing_at       timestamptz,

  -- 결제 이력
  last_payment_id       text,
  last_payment_at       timestamptz,
  failed_count          integer NOT NULL DEFAULT 0,

  cancelled_at          timestamptz,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),

  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id      ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status       ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing ON subscriptions(next_billing_at);

CREATE OR REPLACE FUNCTION set_subscriptions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_subscriptions_updated_at();

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sub_select_own" ON subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "sub_service_all" ON subscriptions
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- profiles INSERT 시 자동 구독 생성 트리거
CREATE OR REPLACE FUNCTION create_subscription_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(NEW.username) = 'admin' THEN
    RETURN NEW;
  END IF;
  INSERT INTO subscriptions (user_id, trial_ends_at)
  VALUES (NEW.id, now() + interval '30 days')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_subscription ON profiles;
CREATE TRIGGER trg_create_subscription
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_subscription_on_signup();
