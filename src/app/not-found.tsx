import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen p-6">
      <Card className="max-w-md w-full">
        <CardContent className="p-6 text-center">
          <h2 className="text-xl font-bold mb-2">Página no encontrada</h2>
          <p className="text-muted-foreground mb-6">
            La página que buscas no existe o fue movida.
          </p>
          <Link href="/" className={buttonVariants()}>
            Volver al inicio
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
