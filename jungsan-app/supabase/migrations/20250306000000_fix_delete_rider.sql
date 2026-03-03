-- 라이더 삭제 시 FK 제약 오류 수정
-- Supabase SQL Editor에서 실행하세요
-- settlement_details, advance_payments, promotions 등 관련 데이터를 먼저 삭제

CREATE OR REPLACE FUNCTION delete_rider(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM settlement_details WHERE rider_id = p_id;
  DELETE FROM advance_payments WHERE rider_id = p_id;
  DELETE FROM promotions WHERE rider_id = p_id;
  DELETE FROM management_fees WHERE rider_id = p_id;
  DELETE FROM insurance_fees WHERE rider_id = p_id;
  DELETE FROM riders WHERE id = p_id;
END;
$$;
