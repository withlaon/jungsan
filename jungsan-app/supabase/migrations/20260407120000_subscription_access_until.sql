-- 해지 후에도 서비스 이용 가능 종료 시각 (이 시각까지 이용 허용)
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS access_until timestamptz;

COMMENT ON COLUMN subscriptions.access_until IS '구독 해지 시점부터 남은 이용 기간 종료일시';
