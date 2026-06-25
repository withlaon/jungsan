-- advance_payments 테이블에 deducted_at 컬럼 추가
-- 공제완료(deducted_settlement_id 설정) 시각을 기록, 3일 후 자동 삭제에 활용

ALTER TABLE advance_payments
  ADD COLUMN IF NOT EXISTS deducted_at timestamptz;

-- 이미 공제완료된 기존 데이터: deducted_settlement_id 기준으로 weekly_settlements.created_at을 활용
-- (deducted_at이 NULL인 기존 공제완료 항목에 대해 현재 시각으로 설정)
UPDATE advance_payments
SET deducted_at = now()
WHERE deducted_settlement_id IS NOT NULL
  AND deducted_at IS NULL;

-- deducted_settlement_id가 설정될 때 deducted_at을 자동으로 기록하는 트리거
CREATE OR REPLACE FUNCTION set_advance_payment_deducted_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- deducted_settlement_id가 NULL→값으로 바뀌면 deducted_at 설정
  IF (OLD.deducted_settlement_id IS NULL AND NEW.deducted_settlement_id IS NOT NULL) THEN
    NEW.deducted_at = now();
  END IF;
  -- deducted_settlement_id가 값→NULL로 초기화되면 deducted_at도 초기화
  IF (OLD.deducted_settlement_id IS NOT NULL AND NEW.deducted_settlement_id IS NULL) THEN
    NEW.deducted_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_advance_payment_deducted_at ON advance_payments;
CREATE TRIGGER trg_advance_payment_deducted_at
  BEFORE UPDATE ON advance_payments
  FOR EACH ROW EXECUTE FUNCTION set_advance_payment_deducted_at();

-- 인덱스 (cron 쿼리 성능)
CREATE INDEX IF NOT EXISTS idx_advance_payments_deducted_at
  ON advance_payments(deducted_at)
  WHERE deducted_at IS NOT NULL;
