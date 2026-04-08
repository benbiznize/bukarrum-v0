import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();

  // TODO: Verify MercadoPago webhook signature
  // TODO: Process subscription status updates
  console.log("MercadoPago webhook received:", body.type);

  return NextResponse.json({ received: true });
}
