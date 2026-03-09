import Link from 'next/link'
import { Zap } from 'lucide-react'

export const metadata = {
  title: '이용약관 | JUNGSAN-TIME',
  description: 'JUNGSAN-TIME 서비스 이용약관 및 환불 규정',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-200">
      {/* 헤더 */}
      <header className="border-b border-white/5 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white fill-white" />
            </div>
            <span className="font-bold text-white tracking-tight">JUNGSAN-TIME</span>
          </Link>
          <Link
            href="/"
            className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            ← 홈으로
          </Link>
        </div>
      </header>

      {/* 본문 */}
      <main className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-white mb-2">이용약관</h1>
        <p className="text-sm text-slate-500 mb-12">
          시행일 : 2025년 01월 01일 &nbsp;·&nbsp; 최종 수정일 : 2026년 03월 01일
        </p>

        <div className="space-y-12 text-sm text-slate-300 leading-7">

          {/* 제1조 */}
          <section>
            <h2 className="text-base font-semibold text-white mb-3">제1조 (목적)</h2>
            <p>
              본 약관은 위드라온(이하 "회사")이 운영하는 라이더 정산 자동화 플랫폼 JUNGSAN-TIME
              (이하 "서비스")의 이용과 관련하여 회사와 이용자 간의 권리·의무 및 책임 사항,
              기타 필요한 사항을 규정함을 목적으로 합니다.
            </p>
          </section>

          {/* 제2조 */}
          <section>
            <h2 className="text-base font-semibold text-white mb-3">제2조 (용어의 정의)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li><span className="text-slate-400">"서비스"</span>란 회사가 제공하는 라이더 정산 자동화 플랫폼 일체를 의미합니다.</li>
              <li><span className="text-slate-400">"회원"</span>이란 본 약관에 동의하고 회원가입을 완료한 사업자(지사 운영자)를 의미합니다.</li>
              <li><span className="text-slate-400">"라이더"</span>란 회원이 등록한 배달 종사자를 의미합니다.</li>
              <li><span className="text-slate-400">"구독"</span>이란 회원이 서비스 이용 대가로 일정 기간 동안 정기 결제하는 방식을 의미합니다.</li>
              <li><span className="text-slate-400">"콘텐츠"</span>란 회원이 서비스를 통해 업로드·생성·공유하는 데이터, 정산서, 파일 등 일체를 의미합니다.</li>
            </ol>
          </section>

          {/* 제3조 */}
          <section>
            <h2 className="text-base font-semibold text-white mb-3">제3조 (약관의 효력 및 변경)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>본 약관은 서비스 화면에 게시하거나 기타 방법으로 회원에게 공지함으로써 효력이 발생합니다.</li>
              <li>회사는 관련 법령을 위반하지 않는 범위에서 본 약관을 변경할 수 있으며, 변경 시 적용일 7일 전(중요한 변경의 경우 30일 전)에 공지합니다.</li>
              <li>회원이 변경된 약관에 동의하지 않을 경우 서비스 이용을 중단하고 탈퇴할 수 있습니다. 변경 공지 후 계속 이용하면 변경 약관에 동의한 것으로 간주합니다.</li>
            </ol>
          </section>

          {/* 제4조 */}
          <section>
            <h2 className="text-base font-semibold text-white mb-3">제4조 (회원가입)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>서비스 이용을 원하는 자는 회사가 정한 가입 양식에 따라 회원 정보를 기입한 후 본 약관에 동의함으로써 가입을 신청합니다.</li>
              <li>회사는 아래 각 호에 해당하는 신청에 대해 승낙을 거부하거나 취소할 수 있습니다.
                <ul className="list-disc pl-5 mt-1 space-y-1 text-slate-400">
                  <li>실명이 아니거나 타인의 명의를 사용한 경우</li>
                  <li>허위 정보를 기재한 경우</li>
                  <li>회사가 정한 이용 자격 기준에 부합하지 않는 경우</li>
                </ul>
              </li>
              <li>회원가입 완료 후 30일간 모든 기능을 무료로 이용할 수 있습니다.</li>
            </ol>
          </section>

          {/* 제5조 */}
          <section>
            <h2 className="text-base font-semibold text-white mb-3">제5조 (서비스의 제공 및 변경)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>회사는 다음 서비스를 제공합니다.
                <ul className="list-disc pl-5 mt-1 space-y-1 text-slate-400">
                  <li>엑셀 파일 자동 정산 처리</li>
                  <li>프로모션·보험료·원천세 자동 계산</li>
                  <li>선지급금 등록 및 자동 공제</li>
                  <li>지사 순이익 대시보드(12주)</li>
                  <li>라이더 개인 정산서 URL 발행</li>
                  <li>멀티 플랫폼 데이터 통합 및 라이더 상태 관리</li>
                </ul>
              </li>
              <li>회사는 서비스 개선을 위해 서비스의 전부 또는 일부를 변경할 수 있으며, 중요한 변경 시 사전 공지합니다.</li>
              <li>회사는 설비 점검·보수·장애 등의 사유로 일시적으로 서비스를 중단할 수 있으며, 사전 공지를 원칙으로 합니다.</li>
            </ol>
          </section>

          {/* 제6조 */}
          <section>
            <h2 className="text-base font-semibold text-white mb-3">제6조 (요금 및 구독 결제)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>서비스 요금은 월 20,000원(부가세 포함)이며, 신규 가입 후 30일간 무료 체험이 제공됩니다.</li>
              <li>무료 체험 기간 종료 후 자동으로 유료 구독으로 전환되며, 등록된 결제 수단으로 매월 자동 결제됩니다.</li>
              <li>결제일은 최초 유료 전환일을 기준으로 매월 동일 날짜로 적용됩니다.</li>
              <li>회사는 요금 정책을 변경할 수 있으며, 변경 시 최소 30일 전에 서비스 내 공지 또는 이메일로 안내합니다.</li>
            </ol>
          </section>

          {/* 제7조 */}
          <section>
            <h2 className="text-base font-semibold text-white mb-3">제7조 (회원의 의무)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>회원은 관계 법령, 본 약관의 규정, 회사의 이용 안내 등을 준수해야 합니다.</li>
              <li>회원은 계정 정보를 타인과 공유하거나 양도할 수 없습니다.</li>
              <li>회원은 서비스를 통해 처리하는 라이더의 개인정보에 대해 관련 법령(개인정보 보호법 등)을 준수하여야 합니다.</li>
              <li>회원은 다음 행위를 해서는 안 됩니다.
                <ul className="list-disc pl-5 mt-1 space-y-1 text-slate-400">
                  <li>허위 정보 등록 및 타인을 사칭하는 행위</li>
                  <li>서비스의 운영을 방해하거나 서버에 과부하를 주는 행위</li>
                  <li>서비스를 역설계(reverse engineering)하거나 무단 복제하는 행위</li>
                  <li>불법적인 목적으로 서비스를 이용하는 행위</li>
                </ul>
              </li>
            </ol>
          </section>

          {/* 제8조 */}
          <section>
            <h2 className="text-base font-semibold text-white mb-3">제8조 (데이터 및 개인정보)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>회원이 업로드한 엑셀 파일 및 정산 데이터는 서비스 제공 목적으로만 사용됩니다.</li>
              <li>회사는 회원의 콘텐츠를 마케팅·광고·제3자 제공 등의 목적으로 사용하지 않습니다.</li>
              <li>회원 탈퇴 시, 회원의 요청에 따라 보관 데이터를 삭제 처리합니다. 단, 관련 법령에 따라 일정 기간 보관이 필요한 정보는 예외로 합니다.</li>
              <li>개인정보 처리에 관한 세부 사항은 별도의 개인정보 처리방침을 따릅니다.</li>
            </ol>
          </section>

          {/* 제9조 */}
          <section>
            <h2 className="text-base font-semibold text-white mb-3">제9조 (서비스 이용 제한 및 계정 해지)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>회사는 회원이 본 약관을 위반하거나 서비스의 정상적인 운영을 방해하는 경우 사전 경고 없이 서비스 이용을 제한하거나 계정을 해지할 수 있습니다.</li>
              <li>회원은 언제든지 서비스 내 설정 또는 이메일(jimcard@naver.com)을 통해 탈퇴를 요청할 수 있습니다.</li>
              <li>탈퇴 처리 후에는 회원 정보 및 콘텐츠가 복구되지 않으므로, 필요한 데이터는 탈퇴 전에 백업하시기 바랍니다.</li>
            </ol>
          </section>

          {/* 제10조 — 환불 규정 */}
          <section id="refund" className="bg-blue-950/30 border border-blue-800/40 rounded-xl p-6">
            <h2 className="text-base font-semibold text-white mb-4">
              제10조 (환불 규정)
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-blue-300 mb-2">① 무료 체험 기간</h3>
                <p>
                  회원가입 후 30일간의 무료 체험 기간에는 별도의 요금이 청구되지 않으므로 환불 대상이 되지 않습니다.
                  무료 체험 기간 내 서비스 해지 시 어떠한 비용도 발생하지 않습니다.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-blue-300 mb-2">② 유료 구독 결제 후 환불</h3>
                <ul className="list-disc pl-5 space-y-2 text-slate-300">
                  <li>
                    <span className="text-slate-200 font-medium">결제일로부터 7일 이내</span>에 서비스를 이용하지 않은 경우(정산 데이터 업로드 이력 없음)
                    전액 환불이 가능합니다.
                  </li>
                  <li>
                    <span className="text-slate-200 font-medium">결제일로부터 7일 이내</span>이나 서비스를 이용한 경우, 이용 일수에 비례하여 일할 계산한 금액을 공제 후 환불합니다.
                    <br />
                    <span className="text-slate-500 text-xs">환불액 = 결제금액 × (잔여일수 ÷ 구독 총일수)</span>
                  </li>
                  <li>
                    <span className="text-slate-200 font-medium">결제일로부터 7일 초과</span> 후에는 원칙적으로 환불이 불가합니다.
                    단, 회사의 귀책 사유(서비스 장애·기능 오류)로 인해 7일 이상 정상 이용이 불가능했던 경우에는 예외적으로 환불 처리합니다.
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-medium text-blue-300 mb-2">③ 자동 결제 취소 (구독 해지)</h3>
                <p>
                  구독 해지를 원하는 경우 다음 결제일 전일까지 이메일(jimcard@naver.com) 또는 전화(070-8949-7469)로
                  해지 신청을 하면 해당 결제 주기 종료 후 자동 결제가 중단됩니다.
                  해지 신청 즉시 서비스가 중단되지 않으며, 이미 결제된 기간 동안은 정상 이용 가능합니다.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-blue-300 mb-2">④ 환불 신청 방법</h3>
                <p>
                  환불을 원하는 회원은 아래 연락처로 신청하시기 바랍니다.
                  환불 처리는 신청일로부터 영업일 기준 3~5일 이내에 완료되며, 결제 수단에 따라 최종 처리까지 추가 시간이 소요될 수 있습니다.
                </p>
                <div className="mt-2 text-slate-400">
                  <p>· 이메일 : jimcard@naver.com</p>
                  <p>· 전화 : 070-8949-7469</p>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-blue-300 mb-2">⑤ 환불 불가 사항</h3>
                <ul className="list-disc pl-5 space-y-1 text-slate-400">
                  <li>회원의 귀책 사유(약관 위반, 부정 이용 등)로 인한 서비스 이용 제한·해지의 경우</li>
                  <li>이미 발행된 라이더 정산서 URL 서비스를 이용한 경우</li>
                  <li>결제 후 7일이 초과된 경우 (회사 귀책 사유 제외)</li>
                </ul>
              </div>
            </div>
          </section>

          {/* 제11조 */}
          <section>
            <h2 className="text-base font-semibold text-white mb-3">제11조 (책임의 제한)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>회사는 천재지변, 전쟁, 서비스 인프라(Vercel, Supabase 등 제3자 인프라) 장애 등 회사의 통제 범위를 벗어난 사유로 인한 서비스 중단에 대해서는 책임을 지지 않습니다.</li>
              <li>회사는 회원이 서비스를 이용하여 기대하는 수익을 얻지 못하거나 손실이 발생한 경우 이에 대해 책임을 지지 않습니다.</li>
              <li>회사는 회원이 서비스에 게시한 정보·콘텐츠의 신뢰성·정확성에 대해 보증하지 않습니다.</li>
            </ol>
          </section>

          {/* 제12조 */}
          <section>
            <h2 className="text-base font-semibold text-white mb-3">제12조 (분쟁 해결 및 준거법)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>서비스 이용과 관련하여 회사와 회원 간에 분쟁이 발생한 경우 양 당사자는 성실히 협의하여 해결하도록 노력합니다.</li>
              <li>협의가 이루어지지 않을 경우, 관련 법령에 따른 소비자 분쟁 조정 기관에 조정을 신청할 수 있습니다.</li>
              <li>본 약관은 대한민국 법령에 따라 해석되며, 소송이 제기되는 경우 회사 소재지를 관할하는 법원을 합의 관할 법원으로 합니다.</li>
            </ol>
          </section>

          {/* 부칙 */}
          <section className="border-t border-white/5 pt-8">
            <h2 className="text-base font-semibold text-white mb-3">부칙</h2>
            <p>본 약관은 2025년 01월 01일부터 시행합니다.</p>
          </section>

        </div>
      </main>

      {/* 푸터 */}
      <footer className="border-t border-white/5 py-8 px-6 mt-8">
        <div className="max-w-4xl mx-auto text-xs text-slate-600 text-center space-y-1">
          <p>위드라온 · 대표자 : 김형진 · 사업자등록번호 : 628-27-01385</p>
          <p>경기도 부천시 성주로 96 제일빌딩 5층 · 070-8949-7469 · jimcard@naver.com</p>
          <p className="mt-2">© 2025 위드라온 · 라이더 정산 자동화 플랫폼</p>
        </div>
      </footer>
    </div>
  )
}
