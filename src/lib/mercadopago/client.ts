import { MercadoPagoConfig } from "mercadopago";

export function createMercadoPagoClient() {
  return new MercadoPagoConfig({
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
  });
}
