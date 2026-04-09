import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function DashboardNotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <Card className="max-w-md w-full">
        <CardContent className="p-6 text-center">
          <h2 className="text-xl font-bold mb-2">Página no encontrada</h2>
          <p className="text-muted-foreground mb-6">
            La sección del panel que buscas no existe.
          </p>
          <Link href="/dashboard" className={buttonVariants()}>
            Volver al panel
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
