import { NextResponse } from "next/server";

export const maxDuration = 60; // Allows the function to run for up to 60 seconds (useful for Vercel Hobby/Pro timeouts)

export async function POST(req: Request) {
    try {
        const { compressedData } = await req.json();

        if (!compressedData || !compressedData.sections) {
            return NextResponse.json({ error: "No audit data provided for analysis" }, { status: 400 });
        }

        const systemPrompt = `Sen, bir kuruyemiş firmasında mağaza operasyonlarını, kaliteyi ve personel motivasyonunu artırmayı hedefleyen uzman bir iç denetim analistisin.

Sana verilen veride BERABER SEÇİLMİŞ BİRDEN FAZLA MAĞAZANIN belirli bir tarih aralığındaki denetim özetleri bulunuyor. Bu veriler mağaza mağaza değil, BÖLÜM BÖLÜM (Personel Analizi, Kuruyemiş, Lokum vb.) gruplandırılmıştır. Ayrıca mağazaların tam puan alamadığı (sorunlu tespit edilen) eksiklikler ve denetmen notları (Önemli, Not, Öneri) sana sunulmuştur. Verilerde her bölüm altında hangi mağazaya ait olduğu ve o mağazanın varsa eksiklikleri/notları gönderilmiştir. Mağazaları denetleyen denetmen ("auditor") listelenmiştir ancak asıl aradığımız şey denetmen notlarında geçen "personel isimleri" ve personellerle ilgili yorumlardır.

GÖREVİN: Olası kronik sorunları tespit etmek, yönetime "Bölüm Bazlı" kapsamlı fakat ÖZ VE KISA bir stratejik analiz raporu sunmaktır. Rapor çok uzun ve şişirilmiş OLMAMALIDIR!

KESİN KURALLAR (BUNLARA SIKI SIKIYA UY):
1. Üslup: Asla suçlayıcı veya kırıcı olma. Motive edici, yapıcı ve profesyonel bir dil kullan.
2. Sadece Sorunları Listele: Tespiti (sorunu/notu) olmayan veya boş olan mağaza ve bölümleri atla, pas geç.
3. BİREBİR AKTARIM (KIRMIZI ÇİZGİ): Denetmenin sistemde girdiği 'ÖNEMLİ', 'NOT' ve 'ÖNERİ' kısımlarını ASLA kendi kelimelerinle özetleme, değiştirme veya yorumlama. Tırnak içinde orijinal metin olarak ekle. Özel isimleri (personeller vb.) kesinlikle sansürleme veya gizleme.

RAPOR ÇIKTI FORMATI:
Lütfen gereksiz uzun cümlelerden kaçın ve çıktıyı kısa, net ve tam olarak aşağıdaki düzende ver:

👥 1. Personel Gelişim ve Analiz Raporu
(Sana gönderilen denetmen notlarına ve tespitlere göre SADECE eksikliği, hatası veya olumsuz bir durumu olan personelleri filtrele. Olumlu veya sorunsuz personelleri RAPORA YANSITMA. Olumsuz personeller için isimleriyle birlikte: Nerede hata yaptıkları / eksiklikleri ve gelişim yönleri ile ilgili yapıcı analizler yap. Denetmenin personeller için yazdığı orijinal notları varsa "TIRNAK İÇİNDE AYNEN" aktar.)

🔍 2. Bölüm Bazlı Analiz ve Aksiyonlar
(Sana gönderilen "sections" içerisindeki her bir bölüm için alt başlıklar oluştur)

[Bölüm Adı - Örn: Kuruyemiş Bölümü]
- A Mağazası:
  * **Tespit Edilen Eksiklikler:** (Kısa ve net olarak eksikleri yaz)
  * **Gelişim Alanları:** (Bu eksikliklerin nasıl giderileceğine dair yapılabilecekler)
  * **Denetmen Notları:** (Sisteme girilen not varsa TIRNAK İÇİNDE yaz, yoksa bu satırı boş geçebilirsin)

- B Mağazası: ...
(Sadece sorun olan mağazaları yaz. Sorun yoksa o mağazayı pas geç.)`;

        const prompt = `Aşağıda belirli bir aralıktaki tüm mağazaların bölüm bölüm gruplanmış sıkıntılı noktaları (tam puan alınmayanlar) ve denetmen notları bulunmaktadır. Lütfen yukarıdaki talimatlara KESİNLİKLE uygun bir toplu analiz raporu oluştur.

BULK ANALİZ VERİSİ (Bölüm Bazında):
${JSON.stringify(compressedData, null, 2)}`;

        const modelNames = [
            "llama-3.3-70b-versatile",
            "llama-3.1-8b-instant",
            "mixtral-8x7b-32768"
        ];

        let responseText = "";
        let lastError: any = null;

        for (const modelName of modelNames) {
            let attempts = 0;
            const maxAttempts = 3;
            while (attempts < maxAttempts) {
                try {
                    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            model: modelName,
                            messages: [
                                { role: "system", content: systemPrompt },
                                { role: "user", content: prompt }
                            ],
                            temperature: 0.7
                        })
                    });

                    if (!response.ok) {
                        const errText = await response.text();
                        throw new Error(`HTTP error! status: ${response.status} - ${errText}`);
                    }

                    const data = await response.json();
                    responseText = data.choices[0].message.content.trim();
                    break;
                } catch (err: any) {
                    attempts++;
                    lastError = err;
                    const isTransient = err?.message && (err.message.includes("503") || err.message.includes("429") || err.message.includes("rate limit") || err.message.includes("overloaded"));
                    
                    if (isTransient && attempts < maxAttempts) {
                        console.warn(`[Groq Bulk] ${modelName} transient error (${err?.message}). Retrying in ${attempts * 400}ms...`);
                        await new Promise(resolve => setTimeout(resolve, attempts * 400));
                    } else {
                        console.warn(`[Groq Bulk] ${modelName} failed on attempt ${attempts} (${err?.message}), trying next model...`);
                        break;
                    }
                }
            }
            if (responseText) break;
        }

        if (!responseText) {
            throw new Error("Tüm Groq modelleri meşgul veya hata verdi: " + (lastError?.message ?? "Bilinmeyen hata"));
        }

        return NextResponse.json({ 
            report: responseText
        });

    } catch (error: any) {
        console.error("Bulk AI API Error:", error);
        return NextResponse.json({ error: "Toplu Analiz oluşturulurken bir hata oluştu: " + error.message }, { status: 500 });
    }
}
