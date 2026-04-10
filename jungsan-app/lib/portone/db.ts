/**
 * 포트원 V2 결제 내역 DB 저장 유틸리티 (서버 전용)
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { PortOnePaymentResponse } from "@/lib/portone/server";

export interface SavePaymentOptions {
  userId?: string;
  isTest?: boolean;
}

/**
 * 결제 내역을 Supabase payments 테이블에 저장
 */
export async function savePayment(
  payment: PortOnePaymentResponse,
  options: SavePaymentOptions = {}
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  const isTest = options.isTest ?? true;

  const row: Record<string, unknown> = {
    payment_id: payment.id,
    portone_tx_id: payment.txId ?? null,
    status: payment.status,
    order_name: payment.orderName,
    amount: payment.amount.total,
    currency: payment.amount.currency ?? "KRW",
    pay_method: payment.method?.type ?? null,
    customer_name: payment.customer?.fullName ?? null,
    customer_email: payment.customer?.email ?? null,
    customer_phone: payment.customer?.phoneNumber ?? null,
    paid_at: payment.paidAt ?? null,
    cancelled_at: payment.cancelledAt ?? null,
    failed_at: payment.failedAt ?? null,
    raw_response: payment,
    is_test: isTest,
  };
  if (options.userId) {
    row.user_id = options.userId;
  }

  const { error } = await supabase.from("payments").upsert(row, {
    onConflict: "payment_id",
  });

  if (error) {
    console.error("[DB] 결제 내역 저장 실패:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 결제 상태 업데이트 (취소/실패 등)
 */
export async function updatePaymentStatus(
  paymentId: string,
  status: string,
  extra: { cancelledAt?: string; failedAt?: string; failReason?: string } = {}
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("payments")
    .update({
      status,
      cancelled_at: extra.cancelledAt ?? null,
      failed_at: extra.failedAt ?? null,
      fail_reason: extra.failReason ?? null,
    })
    .eq("payment_id", paymentId);

  if (error) {
    console.error("[DB] 결제 상태 업데이트 실패:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true };
}
