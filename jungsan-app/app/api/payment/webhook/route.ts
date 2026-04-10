/**
 * PortOne V2 webhook handler.
 * Register POST URL in PortOne console. Env: PORTONE_WEBHOOK_SECRET (whsec_...)
 */

import { NextRequest, NextResponse } from "next/server";
import { getPayment } from "@/lib/portone/server";
import { savePayment, updatePaymentStatus } from "@/lib/portone/db";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPaidPortOneStatus } from "@/lib/portone/payment-normalize";
import { resolveUserIdBySubscriptionPaymentPrefix } from "@/lib/portone/subscription-reconcile";
import {
  getPortOneWebhookSecret,
  verifyPortOneWebhookPayload,
} from "@/lib/portone/webhook-verify";

const IS_TEST = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY?.startsWith(
  "channel-key-"
)
  ? process.env.NODE_ENV !== "production"
  : false;

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const hookSecret = getPortOneWebhookSecret();
    if (
      hookSecret &&
      !verifyPortOneWebhookPayload(
        rawBody,
        request.headers.get("webhook-id"),
        request.headers.get("webhook-timestamp"),
        request.headers.get("webhook-signature"),
        hookSecret,
      )
    ) {
      console.warn("[webhook] signature verification failed");
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBody) as {
      type: string;
      data: { paymentId: string; transactionId?: string };
    };
    const { type, data } = body;

    if (type === "Transaction.Paid") {
      const { paymentId } = data;
      if (!paymentId) {
        return NextResponse.json({ error: "paymentId가 없습니다." }, { status: 400 });
      }

      const payment = await getPayment(paymentId);

      if (!isPaidPortOneStatus(payment.status)) {
        console.error(
          `[webhook] unexpected payment status paymentId=${paymentId} status=${payment.status}`,
        );
        return NextResponse.json(
          { error: `Invalid payment status: ${payment.status}` },
          { status: 400 }
        );
      }

      const admin = createAdminClient();
      let resolvedUserId: string | undefined;
      if (paymentId.startsWith("sub-")) {
        const r = await resolveUserIdBySubscriptionPaymentPrefix(admin, paymentId);
        if (r) resolvedUserId = r;
      }

      const { success, error } = await savePayment(payment, {
        isTest: IS_TEST,
        userId: resolvedUserId,
      });
      if (!success) {
        console.error(`[webhook] DB save failed paymentId=${paymentId} err=${error}`);
      }

      console.log(`[webhook] paid paymentId=${paymentId} amount=${payment.amount.total}`);

      if (paymentId.startsWith("sub-")) {
        try {
          const periodStartIso = payment.paidAt ?? new Date().toISOString();
          const periodStart = new Date(periodStartIso);
          const nextBillingAt = new Date(periodStart);
          nextBillingAt.setMonth(nextBillingAt.getMonth() + 1);
          const periodEnd = new Date(periodStart);
          periodEnd.setMonth(periodEnd.getMonth() + 1);

          const { data: paymentRow } = await admin
            .from("payments")
            .select("user_id")
            .eq("payment_id", paymentId)
            .maybeSingle();

          const uid = paymentRow?.user_id ?? resolvedUserId;
          if (uid) {
            await admin
              .from("subscriptions")
              .update({
                status: "active",
                failed_count: 0,
                last_payment_id: paymentId,
                last_payment_at: periodStartIso,
                current_period_start: periodStart.toISOString(),
                current_period_end: periodEnd.toISOString(),
                next_billing_at: nextBillingAt.toISOString(),
              })
              .eq("user_id", uid);

            console.log(`[webhook] subscription renewed userId=${uid}`);
          } else {
            console.warn(
              `[webhook] subscription renew skipped: no user_id paymentId=${paymentId}`,
            );
          }
        } catch (subErr) {
          console.error("[webhook] subscription renew error:", subErr);
        }
      }

      return NextResponse.json({ success: true });
    }

    if (type === "Transaction.Cancelled") {
      const { paymentId } = data;
      await updatePaymentStatus(paymentId, "CANCELLED", {
        cancelledAt: new Date().toISOString(),
      });
      console.log(`[webhook] cancelled paymentId=${paymentId}`);
      return NextResponse.json({ success: true });
    }

    if (type === "Transaction.Failed") {
      const { paymentId } = data;
      await updatePaymentStatus(paymentId, "FAILED", {
        failedAt: new Date().toISOString(),
      });
      console.log(`[webhook] failed paymentId=${paymentId}`);
      return NextResponse.json({ success: true });
    }

    console.log(`[webhook] ignored event type=${type}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[webhook] error:", error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
