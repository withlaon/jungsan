# Supabase 설정 가이드

## Vercel 배포 후 라이더 등록이 안 될 때

1. **Supabase Dashboard** 접속: https://supabase.com/dashboard
2. 프로젝트 선택 → **SQL Editor** 메뉴
3. **New query** 클릭
4. `supabase/migrations/20250305000000_riders_setup_complete.sql` 파일 내용 전체 복사 후 붙여넣기
5. **Run** 실행

이 SQL을 실행하면 riders 테이블, RPC 함수, RLS 정책이 설정됩니다.

## Vercel 환경 변수 (선택)

라이더 API fallback을 위해 다음을 설정하면 더 안정적입니다:

- `SUPABASE_SERVICE_ROLE_KEY` - Supabase Dashboard → Settings → API → service_role key
