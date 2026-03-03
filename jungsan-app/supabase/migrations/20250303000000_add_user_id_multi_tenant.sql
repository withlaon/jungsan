-- 아이디별 관리자 시스템: 각 회원(지사)별로 데이터 분리
-- user_id = profiles.id (auth.users.id)

-- 1. riders
ALTER TABLE riders ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_riders_user_id ON riders(user_id);

-- 2. weekly_settlements
ALTER TABLE weekly_settlements ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_weekly_settlements_user_id ON weekly_settlements(user_id);

-- 3. advance_payments (rider_id로 연결되지만, rider가 user별로 분리되므로 user_id 추가로 쿼리 단순화)
ALTER TABLE advance_payments ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_advance_payments_user_id ON advance_payments(user_id);

-- 4. promotions
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_promotions_user_id ON promotions(user_id);

-- 5. management_fees
ALTER TABLE management_fees ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_management_fees_user_id ON management_fees(user_id);

-- 6. insurance_fees
ALTER TABLE insurance_fees ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_insurance_fees_user_id ON insurance_fees(user_id);

-- 기존 데이터: user_id가 null인 행을 첫 번째 비-admin 프로필에 할당
DO $$
DECLARE
  first_user_id uuid;
BEGIN
  SELECT id INTO first_user_id FROM profiles WHERE lower(username) != 'admin' LIMIT 1;
  IF first_user_id IS NOT NULL THEN
    UPDATE riders SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE weekly_settlements SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE advance_payments SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE promotions SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE management_fees SET user_id = first_user_id WHERE user_id IS NULL;
    UPDATE insurance_fees SET user_id = first_user_id WHERE user_id IS NULL;
  END IF;
END $$;
