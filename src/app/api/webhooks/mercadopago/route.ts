import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, PreApproval } from "mercadopago";
import { createServiceClient } from "@/lib/supabase/service";
import crypto from "crypto";

const MP_STATUS_MAP: Record<string, "active" | "past_due" | "cancelled"> = {
  authorized: "active",
  paused: "past_due",
  cancelled: "cancelled",
};

function verifySignature(request: NextRequest, body: string): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) return true; // Skip in dev if no secret configured

  const xSignature = request.headers.get("x-signature");
  const xRequestId = request.headers.get("x-request-id");
  if (!xSignature || !xRequestId) return false;

  const parts = Object.fromEntries(
    xSignature.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k.trim(), v.trim()];
    })
  );

  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const parsed = JSON.parse(body);
  const dataId = parsed?.data?.id;

  const manifest = `id:${dataId ?? ""};request-id:${xRequestId};ts:${ts};`;
  const hmac = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  return hmac === v1;
}

export async function POST(request: NextRequest) {
  const bodyText = await request.text();

  if (!verifySignature(request, bodyText)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(bodyText) as {
    type: string;
    data: { id: string };
  };

  if (body.type !== "subscription_preapproval") {
    return NextResponse.json({ received: true });
  }

  const preapprovalId = body.data.id;

  try {
    // Fetch full preapproval details from MercadoPago
    const mp = new MercadoPagoConfig({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
    });
    const preapproval = await new PreApproval(mp).get({ id: preapprovalId });

    const newStatus = MP_STATUS_MAP[preapproval.status ?? ""];
    if (!newStatus) {
      return NextResponse.json({ received: true });
    }

    // Match by the preapproval ID stored during checkout creation
    const supabase = createServiceClient();
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("mercadopago_subscription_id", preapprovalId)
      .single();

    if (!sub) {
      console.warn(`No subscription found for preapproval ${preapprovalId}`);
      return NextResponse.json({ received: true });
    }

    await supabase
      .from("subscriptions")
      .update({
        status: newStatus,
        current_period_start: preapproval.date_created
          ? new Date(preapproval.date_created).toISOString()
          : undefined,
      })
      .eq("id", sub.id);

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("MercadoPago webhook error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
