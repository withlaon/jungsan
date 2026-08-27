-- settlement_details 테이블에 콜프로모션/일반프로모션 분리 컬럼 추가
ALTER TABLE settlement_details
  ADD COLUMN IF NOT EXISTS call_promotion_amount    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS general_promotion_amount integer NOT NULL DEFAULT 0;
