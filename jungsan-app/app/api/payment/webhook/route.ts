/**
 * 포트원 V2 웹훅 처리 API
 *
 * 포트원 관리자콘솔 > 연동 관리 > 결제알림(Webhook) 관리 에서
 * 아래 URL을 웹훅 URL로 등록하세요:
 *
 * - 테스트:  http://localhost:3000/api/payment/webhook  (ngrok 등 터널 필요)
 * - 실연동:  https://your-domain.com/api/payment/webhook
 */

import { NextRequest, NextResponse } from "next/server";
import { getPayment } from "@/lib/portone/server";
import { savePayment, updatePaymentStatus } from "@/lib/portone/db";

const IS_TEST = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY?.startsWith(
  "channel-key-"
)
  ? process.env.NODE_ENV !== "production"
  : false;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data } = body as {
      type: string;
      data: { paymentId: string; transactionId?: string };
    };

    // 결제 완료 웹훅
    if (type === "Transaction.Paid") {
      const { paymentId } = data;
      if (!paymentId) {
        return NextResponse.json({ error: "paymentId가 없습니다." }, { status: 400 });
      }

      // 포트원 서버에서 실제 결제 정보 조회
      const payment = await getPayment(paymentId);

      if (payment.status !== "PAID") {
        console.error(`[웹훅] 결제 상태 이상 - paymentId: ${paymentId}, status: ${payment.status}`);
        return NextResponse.json(
          { error: `결제 상태가 올바르지 않습니다: ${payment.status}` },
          { status: 400 }
        );
      }

      // DB에 결제 내역 저장
      const { success, error } = await savePayment(payment, { isTest: IS_TEST });
      if (!success) {
        console.error(`[웹훅] DB 저장 실패 - paymentId: ${paymentId}, 오류: ${error}`);
        // DB 저장 실패해도 200 응답 (포트원 재전송 방지)
        // 실제 운영 시 슬랙 알림 등 모니터링 연동 권장
      }

      console.log(`[웹훅] 결제 완료 - paymentId: ${paymentId}, 금액: ${payment.amount.total}원`);

      // TODO: 추가 비즈니스 로직 (예: 구독 활성화, 이메일 발송 등)

      return NextResponse.json({ success: true });
    }

    // 결제 취소 웹훅
    if (type === "Transaction.Cancelled") {
      const { paymentId } = data;
      await updatePaymentStatus(paymentId, "CANCELLED", {
        cancelledAt: new Date().toISOString(),
      });
      console.log(`[웹훅] 결제 취소 - paymentId: ${paymentId}`);
      return NextResponse.json({ success: true });
    }

    // 결제 실패 웹훅
    if (type === "Transaction.Failed") {
      const { paymentId } = data;
      await updatePaymentStatus(paymentId, "FAILED", {
        failedAt: new Date().toISOString(),
      });
      console.log(`[웹훅] 결제 실패 - paymentId: ${paymentId}`);
      return NextResponse.json({ success: true });
    }

    // 알 수 없는 타입 - 200 응답 (재전송 방지)
    console.log(`[웹훅] 미처리 이벤트: ${type}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[웹훅] 처리 오류:", error);
    return NextResponse.json(
      { error: "웹훅 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
