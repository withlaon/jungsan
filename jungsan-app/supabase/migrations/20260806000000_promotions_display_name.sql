-- promotions 테이블에 정산서 표기 프로모션명 컬럼 추가
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS display_name text;
