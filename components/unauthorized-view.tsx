"use client";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert, LogOut } from "lucide-react";

export function UnauthorizedView() {
    const { signOut, userProfile } = useAuth();

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <div className="flex justify-center mb-4">
                        <div className="p-3 bg-yellow-100 rounded-full">
                            <ShieldAlert className="h-10 w-10 text-yellow-600" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl">Yetki Talebiniz Alındı</CardTitle>
                    <CardDescription className="text-base mt-2">
                        Merhaba {userProfile?.displayName},
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <p className="text-muted-foreground">
                        Hesabınız başarıyla oluşturuldu ancak henüz yetkilendirilmedi.
                        Yöneticilerimiz talebinizi inceledikten sonra size uygun yetkiyi tanımlayacaktır.
                    </p>

                    <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-700">
                        <p>Onaylandığında sisteme erişim sağlayabileceksiniz.</p>
                    </div>

                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => signOut()}
                    >
                        <LogOut className="mr-2 h-4 w-4" />
                        Çıkış Yap
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
