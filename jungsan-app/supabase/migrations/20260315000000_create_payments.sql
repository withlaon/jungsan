-- 포트원 V2 결제 내역 저장 테이블
-- Supabase Dashboard > SQL Editor 에서 실행하거나 supabase db push 로 적용

CREATE TABLE IF NOT EXISTS payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  payment_id      text NOT NULL UNIQUE,          -- 포트원 paymentId (고객사 주문번호)
  portone_tx_id   text,                           -- 포트원 내부 거래 ID (txId)
  status          text NOT NULL DEFAULT 'PENDING', -- PENDING | PAID | CANCELLED | FAILED
  order_name      text NOT NULL,
  amount          integer NOT NULL,               -- 결제 금액 (원 단위)
  currency        text NOT NULL DEFAULT 'KRW',
  pay_method      text,                           -- CARD | VIRTUAL_ACCOUNT | TRANSFER 등
  pg_provider     text,                           -- kcp_v2 등
  channel_key     text,
  customer_name   text,
  customer_email  text,
  customer_phone  text,
  paid_at         timestamptz,
  cancelled_at    timestamptz,
  failed_at       timestamptz,
  fail_reason     text,
  raw_response    jsonb DEFAULT '{}',             -- 포트원 원본 응답 저장
  is_test         boolean NOT NULL DEFAULT true,  -- 테스트 결제 여부
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_payments_user_id    ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_id ON payments(payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_status     ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION set_payments_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_updated_at ON payments;
CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION set_payments_updated_at();

-- RLS 활성화
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- 본인 결제 내역만 조회 가능 (인증 사용자)
CREATE POLICY "payments_select_own" ON payments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 서비스 롤(서버)만 insert/update 가능 (클라이언트에서 직접 결제 내역 생성 불가)
CREATE POLICY "payments_insert_service" ON payments
  FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "payments_update_service" ON payments
  FOR UPDATE TO service_role
  USING (true);
