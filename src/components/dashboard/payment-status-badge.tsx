import { Badge } from "@/components/ui/badge";
import type { Database } from "@/lib/supabase/database.types";

type PaymentStatus = Database["public"]["Enums"]["booking_payment_status"];

const PAYMENT_VARIANT: Record<
  PaymentStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  unpaid: "destructive",
  partial: "outline",
  paid: "default",
  refunded: "secondary",
};

export function PaymentStatusBadge({
  status,
  label,
}: {
  status: PaymentStatus;
  label: string;
}) {
  return (
    <Badge variant={PAYMENT_VARIANT[status]} data-testid="payment-status-badge">
      {label}
    </Badge>
  );
}
