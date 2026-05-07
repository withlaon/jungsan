/**
 * Supabase 직접 뮤테이션(insert/update/delete)에 타임아웃을 적용합니다.
 * 네트워크 지연이나 커넥션 행업으로 인해 "저장 중" 상태가 무한 지속되는 것을 방지합니다.
 */
export const MUTATION_TIMEOUT_MS = 15_000

const ERR_TIMEOUT = '저장 시간이 초과되었습니다. 네트워크 상태를 확인 후 다시 시도해 주세요.'

export async function withMutationTimeout<T>(
  query: PromiseLike<T>
): Promise<T> {
  return Promise.race([
    Promise.resolve(query),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(ERR_TIMEOUT)), MUTATION_TIMEOUT_MS)
    ),
  ])
}
