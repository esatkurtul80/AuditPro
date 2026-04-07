import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

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
  * Tespit Edilen Eksiklikler: (Kısa ve net olarak eksikleri yaz)
  * Gelişim Alanları: (Bu eksikliklerin nasıl giderileceğine dair yapılabilecekler)
  * Denetmen Notları: (Sisteme girilen not varsa TIRNAK İÇİNDE yaz, yoksa bu satırı boş geçebilirsin)

- B Mağazası: ...
(Sadece sorun olan mağazaları yaz. Sorun yoksa o mağazayı pas geç.)`;

        // Not: API'deki en stabil ve güncel model olan gemini-2.5-flash kullanılıyor.
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            systemInstruction: systemPrompt 
        });

        const prompt = `Aşağıda belirli bir aralıktaki tüm mağazaların bölüm bölüm gruplanmış sıkıntılı noktaları (tam puan alınmayanlar) ve denetmen notları bulunmaktadır. Lütfen yukarıdaki talimatlara KESİNLİKLE uygun bir toplu analiz raporu oluştur.

BULK ANALİZ VERİSİ (Bölüm Bazında):
${JSON.stringify(compressedData, null, 2)}`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        return NextResponse.json({ 
            report: responseText
        });

    } catch (error: any) {
        console.error("Bulk AI API Error:", error);
        return NextResponse.json({ error: "Toplu Analiz oluşturulurken bir hata oluştu: " + error.message }, { status: 500 });
    }
}
