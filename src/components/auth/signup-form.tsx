"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Magic link / OTP state
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpResent, setOtpResent] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    setLoading(false);

    if (error) {
      if (error.message.includes("already registered")) {
        setError("Este correo ya está registrado");
      } else {
        setError("Algo salió mal. Intenta nuevamente.");
      }
      return;
    }

    window.location.href = "/onboarding";
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setOtpError(null);
    setOtpLoading(true);
    setOtpResent(false);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: otpEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        shouldCreateUser: true,
      },
    });

    setOtpLoading(false);

    if (error) {
      setOtpError("Algo salió mal. Intenta nuevamente.");
      return;
    }

    setOtpSent(true);
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setOtpError(null);
    setOtpLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email: otpEmail,
      token: otpCode,
      type: "email",
    });

    setOtpLoading(false);

    if (error) {
      setOtpError("Código incorrecto o expirado. Intenta nuevamente.");
      return;
    }

    window.location.href = "/onboarding";
  }

  async function handleResendOtp() {
    setOtpError(null);
    setOtpLoading(true);
    setOtpResent(false);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: otpEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        shouldCreateUser: true,
      },
    });

    setOtpLoading(false);

    if (error) {
      setOtpError("Algo salió mal. Intenta nuevamente.");
      return;
    }

    setOtpResent(true);
  }

  async function handleGoogleSignup() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Crear cuenta</CardTitle>
        <CardDescription>
          Registra tu negocio en Bukarrum
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <Tabs defaultValue={0}>
            <TabsList className="w-full">
              <TabsTrigger value={0}>Contraseña</TabsTrigger>
              <TabsTrigger value={1}>Enlace mágico</TabsTrigger>
            </TabsList>

            <TabsContent value={0}>
              <form onSubmit={handleSignup} className="grid gap-4 pt-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">Correo electrónico</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@correo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                </div>

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Cargando..." : "Crear cuenta"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value={1}>
              {!otpSent ? (
                <form onSubmit={handleSendOtp} className="grid gap-4 pt-4">
                  <div className="grid gap-2">
                    <Label htmlFor="otp-email">Correo electrónico</Label>
                    <Input
                      id="otp-email"
                      type="email"
                      placeholder="tu@correo.com"
                      value={otpEmail}
                      onChange={(e) => setOtpEmail(e.target.value)}
                      required
                    />
                  </div>

                  {otpError && (
                    <p className="text-sm text-destructive">{otpError}</p>
                  )}

                  <Button type="submit" className="w-full" disabled={otpLoading}>
                    {otpLoading ? "Enviando..." : "Enviar código"}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="grid gap-4 pt-4">
                  <p className="text-sm text-muted-foreground">
                    Revisa tu correo. Puedes ingresar el código de 6 dígitos o hacer clic en el enlace.
                  </p>
                  <div className="grid gap-2">
                    <Label htmlFor="otp-code">Código de verificación</Label>
                    <Input
                      id="otp-code"
                      type="text"
                      inputMode="numeric"
                      placeholder="123456"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                      required
                    />
                  </div>

                  {otpError && (
                    <p className="text-sm text-destructive">{otpError}</p>
                  )}

                  {otpResent && (
                    <p className="text-sm text-green-600">Código reenviado</p>
                  )}

                  <Button type="submit" className="w-full" disabled={otpLoading}>
                    {otpLoading ? "Verificando..." : "Verificar código"}
                  </Button>

                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={otpLoading}
                    className="text-sm text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
                  >
                    Reenviar código
                  </button>
                </form>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex items-center gap-4">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground uppercase">o</span>
            <Separator className="flex-1" />
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignup}
            type="button"
          >
            <GoogleIcon />
            Continuar con Google
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="text-primary underline-offset-4 hover:underline">
              Iniciar sesión
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function GoogleIcon() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
