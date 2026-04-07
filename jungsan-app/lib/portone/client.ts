/**
 * 포트원 V2 NHN KCP 테스트 결제 연동
 *
 * 포트원 관리자콘솔(https://admin.portone.io) 설정 순서:
 * 1. 로그인 후 [연동 관리] > [채널 관리] 메뉴 이동
 * 2. [테스트 채널 추가] 클릭
 * 3. PG사 목록에서 "NHN KCP" 선택
 * 4. 채널 이름 입력 후 저장 (예: "NHN KCP 테스트")
 * 5. 생성된 채널의 "채널 키"를 복사하여 .env.local의
 *    NEXT_PUBLIC_PORTONE_CHANNEL_KEY에 붙여넣기
 * 6. [연동 관리] > [식별코드 및 API Keys]에서
 *    - 상점 아이디(Store ID) → NEXT_PUBLIC_PORTONE_STORE_ID
 *    - V2 API Secret → PORTONE_API_SECRET (또는 PORTONE_V2_API_SECRET, 서버 전용)
 */

import PortOne from "@portone/browser-sdk/v2";

export const PORTONE_STORE_ID = process.env.NEXT_PUBLIC_PORTONE_STORE_ID ?? "";
export const PORTONE_CHANNEL_KEY =
  process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY ?? "";

export interface PaymentRequest {
  /** 주문 ID (고유값, 중복 불가) */
  orderId: string;
  /** 주문명 */
  orderName: string;
  /** 결제 금액 (원 단위) */
  totalAmount: number;
  /** 구매자 이름 */
  customerName?: string;
  /** 구매자 이메일 */
  customerEmail?: string;
  /** 구매자 전화번호 */
  customerPhoneNumber?: string;
  /** 결제 완료 후 리다이렉트 URL (모바일 환경) */
  redirectUrl?: string;
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  transactionType?: string;
  txId?: string;
  error?: {
    code?: string;
    message?: string;
  };
}

/**
 * 포트원 V2 NHN KCP 테스트 결제 요청
 */
export async function requestPayment(
  request: PaymentRequest
): Promise<PaymentResult> {
  if (!PORTONE_STORE_ID || PORTONE_STORE_ID.includes("xxxxxxxx")) {
    return {
      success: false,
      error: {
        code: "STORE_ID_NOT_SET",
        message:
          "포트원 상점 아이디(NEXT_PUBLIC_PORTONE_STORE_ID)가 설정되지 않았습니다. .env.local 파일을 확인하세요.",
      },
    };
  }

  if (!PORTONE_CHANNEL_KEY || PORTONE_CHANNEL_KEY.includes("xxxxxxxx")) {
    return {
      success: false,
      error: {
        code: "CHANNEL_KEY_NOT_SET",
        message:
          "포트원 채널 키(NEXT_PUBLIC_PORTONE_CHANNEL_KEY)가 설정되지 않았습니다. .env.local 파일을 확인하세요.",
      },
    };
  }

  try {
    const response = await PortOne.requestPayment({
      storeId: PORTONE_STORE_ID,
      channelKey: PORTONE_CHANNEL_KEY,
      paymentId: request.orderId,
      orderName: request.orderName,
      totalAmount: request.totalAmount,
      currency: "CURRENCY_KRW",
      payMethod: "CARD",
      customer: {
        fullName: request.customerName,
        email: request.customerEmail,
        phoneNumber: request.customerPhoneNumber,
      },
      redirectUrl: request.redirectUrl,
    });

    if (!response || response.code !== undefined) {
      return {
        success: false,
        error: {
          code: response?.code,
          message: response?.message ?? "결제에 실패했습니다.",
        },
      };
    }

    return {
      success: true,
      paymentId: response.paymentId,
      transactionType: response.transactionType,
      txId: response.txId,
    };
  } catch (error) {
    const err = error as Error;
    return {
      success: false,
      error: {
        message: err.message ?? "결제 처리 중 오류가 발생했습니다.",
      },
    };
  }
}

/**
 * 고유한 주문 ID 생성 (KCP 최대 40자 제한)
 */
export function generateOrderId(prefix = "ord"): string {
  const ts = Date.now().toString(36); // ~8자
  const rand = Math.random().toString(36).substring(2, 7); // 5자
  return `${prefix}-${ts}-${rand}`; // 예: ord-m0abc123-x9k2f (최대 20자)
}
