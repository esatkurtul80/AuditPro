"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Loader2, Users, ListPlus, ClipboardCheck, WifiOff, Camera, FileText, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";
// DiagnosticPanel kaldırıldı, sorun tespit edildi.

export default function LoginPage() {
  const { signInWithGoogle, user, loading: authLoading } = useAuth();
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
      // Redirect olduğu için burası çalışıp sayfa yenilenebilir.
      toast.info("Google'a yönlendiriliyor...");
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Giriş yapılırken bir hata oluştu");
      setLoading(false);
    }
  };

  // Auth durumu yüklenirken veya kullanıcı varsa spinner göster
  // Bu, "Rendered more hooks" hatasını da engeller
  if (authLoading || user) {
    return (
      <div className="flex items-center justify-center h-screen w-full bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-slate-500 text-sm">Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full font-sans antialiased text-slate-900 bg-white overflow-hidden">
      {/* Left side - Login Form */}
      <div className="relative flex flex-col justify-center w-full xl:w-[800px] h-full px-8 py-12 bg-white border-r border-slate-200 z-20 shadow-xl xl:shadow-none">
        <div className="w-full max-w-[400px] mx-auto">

          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 text-center">Hoş Geldiniz</h1>
            <h2 className="mt-4 text-xl font-medium tracking-tight text-slate-900 text-center font-playwrite-norge xl:hidden leading-snug">
              <span className="text-red-500">Denetim</span>, sürdürülebilir <br /> başarının sigortasıdır
            </h2>
            <div className="flex justify-center mt-6">
              <Image
                src="/login-assets-new/welcome-image.jpg"
                alt="Login Illustration"
                width={400}
                height={400}
                className="object-contain"
                priority
              />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <Button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full h-11 text-base shadow-lg shadow-blue-500/20"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Yönlendiriliyor...
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

            <p className="text-center text-xs text-slate-500 mt-4">
              Giriş yaparak{" "}
              <a href="#" className="font-medium text-primary hover:underline underline-offset-4">
                Kullanım Koşulları
              </a>{" "}
              ve{" "}
              <a href="#" className="font-medium text-primary hover:underline underline-offset-4">
                Gizlilik Politikası
              </a>
              &apos;nı kabul etmiş olursunuz.
            </p>
          </div>

        </div>

      </div>

      {/* Right side - Info & Features */}
      <div className="relative hidden xl:flex flex-1 flex-col h-full overflow-hidden bg-slate-50 z-10">
        <div className="absolute inset-0 z-0">
          <Image
            src="/login-assets-new/logo.png"
            alt="Background"
            fill
            className="object-contain opacity-10 p-20"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/40 to-white/60"></div>
        </div>

        <div className="relative z-10 flex flex-col justify-center h-full px-12 xl:px-24 overflow-y-auto py-10 custom-scrollbar">
          <div className="max-w-2xl">
            <h2 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-slate-900 mb-2 leading-tight">
              <span className="text-red-400">Denetim</span>, sürdürülebilir
            </h2>
            <h2 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-primary mb-10 leading-tight">
              başarının sigortasıdır
            </h2>

            <div className="grid gap-6">
              {[
                { icon: Users, title: "Çoklu Kullanıcı Rolleri", desc: "Admin ve Denetmen (Auditor) rolleri ile yetkilendirme yönetimi." },
                { icon: ListPlus, title: "Dinamik Soru Yönetimi", desc: "Admin paneli üzerinden denetim kategorileri ve soruları oluşturma, düzenleme." },
                { icon: ClipboardCheck, title: "Puanlama Sistemi", desc: "Evet/Hayır, 1-5 Puanlama, Çoktan Seçmeli ve Checkbox gibi farklı soru tipleri ile detaylı puanlama." },
                { icon: WifiOff, title: "Offline Çalışma", desc: "Denetmenler internet olmadan denetim yapabilir, internet geldiğinde veriler senkronize edilir." },
                { icon: Camera, title: "Fotoğraf ve Not Ekleme", desc: "Denetim sırasında her soruya fotoğraf kanıtı ve açıklayıcı notlar eklenebilir." },
                { icon: FileText, title: "Detaylı Raporlama", desc: "Denetim sonunda otomatik hesaplanan puanlar ve kategori bazlı başarı özetleri." },
                { icon: LayoutDashboard, title: "Yönetici Paneli (Dashboard)", desc: "Mağaza, kullanıcı ve denetim tiplerinin tek bir yerden yönetimi." }
              ].map((feature, i) => (
                <div key={i} className="flex items-start gap-4 group">
                  <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-primary shadow-sm group-hover:border-primary/30 group-hover:shadow-md transition-all duration-300">
                    <feature.icon className="h-[22px] w-[22px]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 text-base">{feature.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed mt-1">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Logo Bottom Right */}
      <div className="absolute bottom-8 right-8 hidden xl:flex items-center gap-3 z-20">
        <div className="relative w-10 h-10 rounded-lg overflow-hidden shadow-md shadow-blue-200">
          <Image
            src="/login-assets-new/logo.png"
            alt="AuditPro Logo"
            fill
            className="object-cover"
          />
        </div>
        <span className="text-lg font-bold tracking-tight text-slate-900">AuditPro</span>
      </div>
    </div>
  );
}
