-- 라이더 삭제 시 FK 제약 오류 수정
-- 연도와 무관하게 해당 라이더의 정산·선지급·프로모션·관리비·보험 자료를 먼저 삭제

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
