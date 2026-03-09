-- 사이트 방문자 기록 테이블
CREATE TABLE IF NOT EXISTS site_visits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  visited_at timestamptz DEFAULT now() NOT NULL,
  path text NOT NULL DEFAULT '/',
  referrer text,
  user_agent text,
  ip_hash text
);

CREATE INDEX IF NOT EXISTS site_visits_visited_at_idx ON site_visits (visited_at DESC);
CREATE INDEX IF NOT EXISTS site_visits_path_idx ON site_visits (path);

ALTER TABLE site_visits ENABLE ROW LEVEL SECURITY;

-- 익명 방문자도 INSERT 허용
CREATE POLICY "allow_anon_insert" ON site_visits
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- service_role만 SELECT 허용
CREATE POLICY "allow_service_role_select" ON site_visits
  FOR SELECT USING (auth.role() = 'service_role');
