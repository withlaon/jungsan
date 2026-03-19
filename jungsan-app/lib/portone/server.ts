/**
 * 포트원 V2 서버 사이드 결제 검증 유틸리티
 * 결제 완료 후 서버에서 실제 결제 금액을 검증하는 데 사용합니다.
 */

const PORTONE_API_BASE = "https://api.portone.io";
const PORTONE_API_SECRET = process.env.PORTONE_API_SECRET ?? "";

export interface PortOnePaymentResponse {
  id: string;
  transactionType: string;
  status: string;
  amount: {
    total: number;
    currency: string;
  };
  orderName: string;
  customer?: {
    fullName?: string;
    email?: string;
    phoneNumber?: string;
  };
  paidAt?: string;
  failedAt?: string;
  cancelledAt?: string;
  method?: {
    type: string;
  };
}

/**
 * 포트원 V2 API로 결제 정보 조회
 */
export async function getPayment(
  paymentId: string
): Promise<PortOnePaymentResponse> {
  if (!PORTONE_API_SECRET) {
    throw new Error(
      "PORTONE_API_SECRET 환경변수가 설정되지 않았습니다. .env.local 파일을 확인하세요."
    );
  }

  const response = await fetch(
    `${PORTONE_API_BASE}/payments/${encodeURIComponent(paymentId)}`,
    {
      headers: {
        Authorization: `PortOne ${PORTONE_API_SECRET}`,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `포트원 결제 조회 실패 (${response.status}): ${errorText}`
    );
  }

  return response.json() as Promise<PortOnePaymentResponse>;
}

/**
 * 결제 금액 검증 (위변조 방지)
 * @param paymentId 결제 ID
 * @param expectedAmount 예상 결제 금액 (원 단위)
 */
export async function verifyPayment(
  paymentId: string,
  expectedAmount: number
): Promise<{ valid: boolean; payment?: PortOnePaymentResponse; error?: string }> {
  try {
    const payment = await getPayment(paymentId);

    if (payment.status !== "PAID") {
      return {
        valid: false,
        payment,
        error: `결제 상태가 올바르지 않습니다: ${payment.status}`,
      };
    }

    if (payment.amount.total !== expectedAmount) {
      return {
        valid: false,
        payment,
        error: `결제 금액이 일치하지 않습니다. 예상: ${expectedAmount}원, 실제: ${payment.amount.total}원`,
      };
    }

    return { valid: true, payment };
  } catch (error) {
    const err = error as Error;
    return {
      valid: false,
      error: err.message,
    };
  }
}
