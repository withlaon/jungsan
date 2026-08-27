-- promotions 테이블에 콜프로모션 여부 플래그 추가
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS is_call_promo boolean NOT NULL DEFAULT false;

-- 기존 콜프로모션 이름들을 true로 업데이트
UPDATE promotions SET is_call_promo = true
WHERE description IN ('1000원 프로모션', '호걸,영실 100건이상 프로모션');
