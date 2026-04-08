import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Clock } from "lucide-react";

export default async function SubscriptionReturnPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const { tenantSlug } = await params;
  const query = await searchParams;

  // MercadoPago returns with ?preapproval_id=...&status=authorized (or pending)
  const status = query.status;
  const isAuthorized = status === "authorized";

  return (
    <div className="p-6 flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardContent className="p-6 text-center">
          {isAuthorized ? (
            <>
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">
                ¡Suscripción activada!
              </h2>
              <p className="text-muted-foreground mb-6">
                Tu pago ha sido procesado correctamente. Tu suscripción está
                activa.
              </p>
            </>
          ) : (
            <>
              <Clock className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">Pago pendiente</h2>
              <p className="text-muted-foreground mb-6">
                Tu suscripción está siendo procesada. Te notificaremos cuando
                esté activa.
              </p>
            </>
          )}
          <Link
            href={`/dashboard/${tenantSlug}/settings`}
            className={buttonVariants()}
          >
            Volver a configuración
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
