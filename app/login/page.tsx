"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const { signInWithGoogle, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push("/");
    }
  }, [user, router]);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      await signInWithGoogle();
      toast.success("Giriş başarılı!");
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Giriş yapılırken bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  if (user) {
    return null;
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Left side - Login Form */}
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="#" className="flex items-center gap-2 font-medium">
            <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
              <span className="text-lg font-bold">AP</span>
            </div>
            AuditPro
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <form className="flex flex-col gap-6">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col items-center gap-2 text-center">
                  <h1 className="text-2xl font-bold">Hesabınıza Giriş Yapın</h1>
                  <p className="text-muted-foreground text-sm text-balance">
                    Mağaza Denetim ve Aksiyon Takip Sistemi
                  </p>
                </div>
                <div className="flex flex-col gap-4">
                  <Button
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    variant="outline"
                    type="button"
                    className="w-full"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Giriş yapılıyor...
                      </>
                    ) : (
                      <>
                        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                          <path
                            fill="currentColor"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="currentColor"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="currentColor"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          />
                          <path
                            fill="currentColor"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          />
                        </svg>
                        Google ile Giriş Yap
                      </>
                    )}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground text-balance">
                    Giriş yaparak{" "}
                    <a href="#" className="underline underline-offset-4 hover:text-primary">
                      Kullanım Koşulları
                    </a>{" "}
                    ve{" "}
                    <a href="#" className="underline underline-offset-4 hover:text-primary">
                      Gizlilik Politikası
                    </a>
                    &apos;nı kabul etmiş olursunuz.
                  </p>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Right side - AuditPro Logo */}
      <div className="relative hidden bg-muted lg:block">
        <Image
          src="/auditpro-logo.png"
          alt="AuditPro"
          fill
          quality={100}
          unoptimized
          className="object-cover dark:brightness-90"
          style={{ imageRendering: 'crisp-edges' }}
          priority
        />
      </div>
    </div>
  );
}
