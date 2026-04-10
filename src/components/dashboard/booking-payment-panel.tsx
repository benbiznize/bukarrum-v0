"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Undo2, Trash2 } from "lucide-react";
import {
  recordBookingPayment,
  recordBookingRefund,
  deleteBookingPayment,
  type PaymentInput,
} from "@/app/(dashboard)/dashboard/[tenantSlug]/bookings/actions";
import type { Database } from "@/lib/supabase/database.types";
import { useDict } from "@/lib/i18n/dict-context";

type PaymentMethod = Database["public"]["Enums"]["payment_method"];
type PaymentEntryType = Database["public"]["Enums"]["payment_entry_type"];
type PaymentStatus = Database["public"]["Enums"]["booking_payment_status"];

export type BookingPaymentRow = {
  id: string;
  amount: number;
  entry_type: PaymentEntryType;
  method: PaymentMethod;
  paid_at: string;
  reference: string | null;
  notes: string | null;
};

const METHODS: PaymentMethod[] = [
  "cash",
  "transfer",
  "card",
  "mercadopago",
  "other",
];

const fmtCLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  minimumFractionDigits: 0,
});

function toDateTimeLocalValue(iso: string): string {
  // HTML datetime-local expects "YYYY-MM-DDTHH:mm" in local time
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

export function BookingPaymentPanel({
  tenantSlug,
  bookingId,
  totalPrice,
  paidAmount,
  paymentStatus,
  payments,
  locale,
  timeZone,
}: {
  tenantSlug: string;
  bookingId: string;
  totalPrice: number;
  paidAmount: number;
  paymentStatus: PaymentStatus;
  payments: BookingPaymentRow[];
  locale: string;
  timeZone: string;
}) {
  const { dashboard, common } = useDict();
  const d = dashboard.bookingDetail;
  const methodLabels = dashboard.paymentMethods as Record<string, string>;

  type DialogState = {
    type: PaymentEntryType;
    initialAmount: number;
    initialPaidAt: string;
  };

  type FormError =
    | { field: "amount"; message: string; hint?: string }
    | { field: "form"; message: string };

  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [formError, setFormError] = useState<FormError | null>(null);
  const [isPending, startTransition] = useTransition();

  const balance = Math.max(totalPrice - paidAmount, 0);
  const dialogType = dialog?.type ?? null;
  const isRefunded = paymentStatus === "refunded";
  // Gross amount refunded — shown in place of "Balance" when the booking is
  // fully refunded, since "Balance $30.000" misleads (net paid_amount is 0 and
  // the customer owes nothing).
  const totalRefunded = payments
    .filter((p) => p.entry_type === "refund")
    .reduce((sum, p) => sum + p.amount, 0);

  const openDialog = (type: PaymentEntryType) => {
    setFormError(null);
    setDialog({
      type,
      initialAmount: type === "refund" ? paidAmount : balance,
      initialPaidAt: toDateTimeLocalValue(new Date().toISOString()),
    });
  };

  const closeDialog = () => {
    setDialog(null);
    setFormError(null);
  };

  const focusAmount = () => {
    // Defer until after React commits the aria-invalid change so assistive
    // tech reads the new state together with the focus move.
    requestAnimationFrame(() => {
      document.getElementById("pay-amount")?.focus();
    });
  };

  function mapServerError(code: string, type: PaymentEntryType): FormError {
    if (code === "OVERPAY") {
      return {
        field: "amount",
        message: d.errorOverpay,
        hint: `${d.errorMaxLabel}: ${fmtCLP.format(balance)}`,
      };
    }
    if (code === "OVER_REFUND") {
      return {
        field: "amount",
        message: d.errorOverRefund,
        hint: `${d.errorMaxLabel}: ${fmtCLP.format(paidAmount)}`,
      };
    }
    return { field: "form", message: d.errorGeneric };
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dialog) return;
    setFormError(null);

    const form = new FormData(e.currentTarget);
    const amount = Number(form.get("amount"));
    const method = form.get("method") as PaymentMethod;
    const paidAtLocal = form.get("paid_at") as string;
    const reference = (form.get("reference") as string) || null;
    const notes = (form.get("notes") as string) || null;

    // Client-side: amount must be a positive finite number.
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError({ field: "amount", message: d.errorInvalidAmount });
      focusAmount();
      return;
    }

    // Client-side: amount must not exceed the relevant cap. Saves a round trip
    // in the common case; server remains authoritative for race conditions.
    const max = dialog.type === "refund" ? paidAmount : balance;
    if (amount > max) {
      setFormError({
        field: "amount",
        message:
          dialog.type === "refund" ? d.errorOverRefund : d.errorOverpay,
        hint: `${d.errorMaxLabel}: ${fmtCLP.format(max)}`,
      });
      focusAmount();
      return;
    }

    const input: PaymentInput = {
      amount: Math.round(amount),
      method,
      paidAt: new Date(paidAtLocal).toISOString(),
      reference,
      notes,
    };

    startTransition(async () => {
      const result =
        dialog.type === "refund"
          ? await recordBookingRefund(tenantSlug, bookingId, input)
          : await recordBookingPayment(tenantSlug, bookingId, input);

      if (result.error) {
        const mapped = mapServerError(result.error, dialog.type);
        setFormError(mapped);
        if (mapped.field === "amount") focusAmount();
        return;
      }
      closeDialog();
    });
  }

  function handleDelete(paymentId: string) {
    if (!confirm(d.confirmDelete)) return;
    startTransition(async () => {
      await deleteBookingPayment(tenantSlug, bookingId, paymentId);
    });
  }

  const dateTimeFmt = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
  // Node's ICU emits U+202F (narrow no-break space) before day-period markers
  // like "p. m.", while some browser ICU builds emit U+0020. React hydration
  // compares strings byte-wise, so we normalize to a regular space to prevent
  // a SSR/client mismatch.
  const formatDateTime = (iso: string) =>
    dateTimeFmt.format(new Date(iso)).replace(/[\u202F\u00A0]/g, " ");

  return (
    <div>
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <SummaryTile label={d.totalPaid} value={fmtCLP.format(paidAmount)} />
        {isRefunded ? (
          <SummaryTile
            label={d.refunded}
            value={fmtCLP.format(totalRefunded)}
          />
        ) : (
          <SummaryTile
            label={d.balance}
            value={fmtCLP.format(balance)}
            emphasis={balance > 0}
          />
        )}
        <SummaryTile label={common.total} value={fmtCLP.format(totalPrice)} />
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mb-4">
        <Button
          size="sm"
          onClick={() => openDialog("payment")}
          disabled={isPending || balance <= 0}
        >
          <Plus className="h-4 w-4 mr-1" />
          {d.recordPayment}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => openDialog("refund")}
          disabled={isPending || paidAmount <= 0}
        >
          <Undo2 className="h-4 w-4 mr-1" />
          {d.recordRefund}
        </Button>
      </div>

      {/* Payments history */}
      {payments.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{d.date}</TableHead>
                <TableHead>{d.method}</TableHead>
                <TableHead>{d.reference}</TableHead>
                <TableHead className="text-right">{d.amount}</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => {
                const isRefund = p.entry_type === "refund";
                return (
                  <TableRow key={p.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTime(p.paid_at)}
                    </TableCell>
                    <TableCell>
                      {methodLabels[p.method] ?? p.method}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.reference || "—"}
                      {p.notes && (
                        <span className="block text-xs">{p.notes}</span>
                      )}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        isRefund ? "text-destructive" : ""
                      }`}
                    >
                      {isRefund ? "−" : ""}
                      {fmtCLP.format(p.amount)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        disabled={isPending}
                        onClick={() => handleDelete(p.id)}
                        aria-label={d.deletePayment}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-md border border-dashed py-8 text-center">
          <p className="text-muted-foreground text-sm">{d.paymentsEmpty}</p>
        </div>
      )}

      {/* Record payment / refund dialog */}
      <Dialog open={dialogType !== null} onOpenChange={(o) => (o ? null : closeDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogType === "refund" ? d.recordRefund : d.recordPayment}
            </DialogTitle>
          </DialogHeader>
          <form
            // Keyed so the entire form (and its uncontrolled defaultValue-driven
            // Inputs) remounts whenever openDialog() is called with a new
            // initial state. Base UI's Dialog keeps the content mounted across
            // open/close for animation — without a key, the same Input
            // instances would receive a changing defaultValue, which Base UI
            // warns about.
            key={
              dialog
                ? `${dialog.type}:${dialog.initialAmount}:${dialog.initialPaidAt}`
                : "closed"
            }
            onSubmit={handleSubmit}
            onChange={() => {
              // Any edit dismisses the current error; revalidate on next submit.
              if (formError) setFormError(null);
            }}
            className="grid gap-4"
            noValidate
          >
            <div className="grid gap-2">
              <Label htmlFor="pay-amount">{d.amount}</Label>
              <Input
                id="pay-amount"
                name="amount"
                type="number"
                min="1"
                step="1"
                required
                defaultValue={dialog?.initialAmount}
                aria-invalid={formError?.field === "amount" || undefined}
                aria-describedby={
                  formError?.field === "amount" ? "pay-amount-error" : undefined
                }
              />
              {formError?.field === "amount" && (
                <div
                  id="pay-amount-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  <p>{formError.message}</p>
                  {formError.hint && (
                    <p className="text-xs opacity-80">{formError.hint}</p>
                  )}
                </div>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pay-method">{d.method}</Label>
              <Select name="method" defaultValue="cash">
                <SelectTrigger id="pay-method" className="w-full">
                  <SelectValue>
                    {(value: string) =>
                      methodLabels[value] ?? value
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {methodLabels[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pay-date">{d.date}</Label>
              <Input
                id="pay-date"
                name="paid_at"
                type="datetime-local"
                required
                defaultValue={dialog?.initialPaidAt}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pay-reference">{d.reference}</Label>
              <Input
                id="pay-reference"
                name="reference"
                placeholder={d.referencePlaceholder}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pay-notes">{d.paymentNotes}</Label>
              <Textarea
                id="pay-notes"
                name="notes"
                rows={2}
                placeholder={d.paymentNotesPlaceholder}
              />
            </div>
            {formError?.field === "form" && (
              <p role="alert" className="text-sm text-destructive">
                {formError.message}
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={closeDialog} disabled={isPending}>
                {common.cancel}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? d.saving : d.save}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`text-lg font-semibold ${
          emphasis ? "text-destructive" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
