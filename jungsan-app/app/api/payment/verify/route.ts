/**
 * 포트원 V2 결제 검증 API
 * 클라이언트 결제 완료 후 서버에서 금액을 검증하고 DB에 저장합니다.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyPayment } from "@/lib/portone/server";
import { savePayment } from "@/lib/portone/db";
import { createClient } from "@/lib/supabase/server";

const IS_TEST = process.env.NODE_ENV !== "production";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paymentId, expectedAmount } = body as {
      paymentId: string;
      expectedAmount: number;
    };

    if (!paymentId) {
      return NextResponse.json(
        { success: false, error: "paymentId가 필요합니다." },
        { status: 400 }
      );
    }

    if (!expectedAmount || typeof expectedAmount !== "number") {
      return NextResponse.json(
        { success: false, error: "expectedAmount(예상 결제 금액)가 필요합니다." },
        { status: 400 }
      );
    }

    // 포트원 서버에서 결제 조회 및 금액 검증
    const { valid, payment, error } = await verifyPayment(paymentId, expectedAmount);

    if (!valid || !payment) {
      return NextResponse.json(
        { success: false, error },
        { status: 400 }
      );
    }

    // 현재 로그인한 사용자 ID 가져오기 (있으면)
    let userId: string | undefined;
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id;
    } catch {
      // 비로그인 결제도 허용
    }

    // DB에 결제 내역 저장
    const { success: saved, error: dbError } = await savePayment(payment, {
      userId,
      isTest: IS_TEST,
    });

    if (!saved) {
      console.error(`[결제 검증] DB 저장 실패: ${dbError}`);
      // DB 저장 실패해도 결제 자체는 유효 - 검증 성공으로 응답
    }

    return NextResponse.json({
      success: true,
      payment: {
        id: payment.id,
        status: payment.status,
        amount: payment.amount,
        orderName: payment.orderName,
        paidAt: payment.paidAt,
      },
    });
  } catch (error) {
    console.error("[결제 검증] 오류:", error);
    const err = error as Error;
    return NextResponse.json(
      { success: false, error: err.message ?? "결제 검증 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
