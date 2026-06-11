import { NextResponse } from "next/server";
import { adminDb, initAdmin } from "@/lib/firebase-admin";

export async function POST(req: Request) {
    try {
        const { auditId } = await req.json();

        initAdmin();
        const db = adminDb();

        if (!auditId) {
            return NextResponse.json({ error: "Audit ID is required" }, { status: 400 });
        }

        // 1. O anki güncel denetimi çek
        const auditDoc = await db.collection("audits").doc(auditId).get();
        if (!auditDoc.exists) {
            return NextResponse.json({ error: "Denetim bulunamadı" }, { status: 404 });
        }
        
        const currentAudit = auditDoc.data() as any;
        const storeId = currentAudit.storeId;
        const storeName = currentAudit.storeName || "Bilinmeyen Mağaza";

        // 2. Geçmiş Veri: Aynı mağazanın geçmiş denetimlerini bul
        const pastAuditsSnapshot = await db.collection("audits")
            .where("storeId", "==", storeId)
            .where("status", "==", "tamamlandi")
            .orderBy("completedAt", "desc")
            .limit(5)
            .get();

        const pastAuditsData = pastAuditsSnapshot.docs
            .filter(doc => doc.id !== auditId) // O anki denetimi dışarıda tut
            .map(doc => {
                const data = doc.data();
                // Firestore timestamp parsing
                let dateStr = 'Tarih Yok';
                if (data.completedAt) {
                    if (typeof data.completedAt.toDate === 'function') {
                        dateStr = data.completedAt.toDate().toLocaleDateString('tr-TR');
                    } else if (data.completedAt._seconds) {
                        dateStr = new Date(data.completedAt._seconds * 1000).toLocaleDateString('tr-TR');
                    } else if (data.completedAt.seconds) {
                        dateStr = new Date(data.completedAt.seconds * 1000).toLocaleDateString('tr-TR');
                    }
                }
                
                return {
                    id: doc.id,
                    totalScore: data.totalScore,
                    date: dateStr,
                    summary: data.sections?.map((s: any) => ({
                        name: s.name || s.title || "İsimsiz Bölüm",
                        score: s.score,
                    }))
                };
            });

        // 3. Güncel denetim verilerini JSON/String'e formatlama
        let currentDateStr = 'Tarih Yok';
        if (currentAudit.completedAt) {
            if (typeof currentAudit.completedAt.toDate === 'function') {
                currentDateStr = currentAudit.completedAt.toDate().toLocaleDateString('tr-TR');
            } else if (currentAudit.completedAt._seconds) {
                currentDateStr = new Date(currentAudit.completedAt._seconds * 1000).toLocaleDateString('tr-TR');
            } else if (currentAudit.completedAt.seconds) {
                currentDateStr = new Date(currentAudit.completedAt.seconds * 1000).toLocaleDateString('tr-TR');
            }
        }

        const currentAuditFormatted = {
            storeName,
            totalScore: currentAudit.totalScore,
            date: currentDateStr,
            generalNotes: currentAudit.summary || currentAudit.notes || "",
            sections: currentAudit.sections?.map((section: any) => {
                // Her bölüm için puan ve notları (ÖNEMLİ, NOT, vb.) çek
                const answersInfo = section.answers?.map((ans: any) => {
                    return {
                        question: ans.questionText,
                        answer: ans.answer, // evet, hayir, yok
                        points: ans.earnedPoints,
                        notes: ans.notes || [], // Denetmenin girdiği "NOT", "ÖNEMLİ" vs
                        actionOriginalNotes: ans.actionData?.originalNotes || null // Aksiyonlara eklenen notlar
                    }
                });
                return {
                    sectionName: section.title || section.name || "Genel",
                    sectionScore: section.score,
                    details: answersInfo
                };
            })
        };

        const jsonInput = JSON.stringify({
            currentAudit: currentAuditFormatted,
            pastAuditsSummary: pastAuditsData
        }, null, 2);

        // 4. API İsteği ve System Prompt
        const systemPrompt = `Sen, bir kuruyemiş firmasında mağaza operasyonlarını, kaliteyi ve personel motivasyonunu artırmayı hedefleyen uzman bir iç denetim analistisin.

Sana veritabanından çekilmiş, mağazanın tüm bölümlerine (Lokum, Kuruyemiş, Kasa, Leblebi, Personel vb.) ait detaylı denetim verilerini ve geçmiş denetim özetlerini iletiyorum.

GÖREVİN: Bu verileri okuyarak, tüm bölümleri kapsayan tek bir bütüncül analiz raporu oluşturmak.

KESİN KURALLAR (BUNLARA SIKI SIKIYA UY):

Üslup: Asla suçlayıcı veya kırıcı olma. Motive edici, yapıcı ve profesyonel bir kurumsal dil kullan. Eksikleri birer 'hata' değil, 'gelişim alanı' olarak belirt.

Tüm Bölümleri Analiz Et: Sana gönderilen verideki hiçbir bölümü atlama. Lokum, Kuruyemiş, Kasa, Leblebi vb. veride hangi bölümler varsa hepsini raporun içinde ayrı alt başlıklar halinde tek tek yorumla.

BİREBİR AKTARIM (KIRMIZI ÇİZGİ): Denetmenin sistemde girdiği 'ÖNEMLİ', 'NOT' ve 'ÖNERİ' kısımlarını ASLA kendi kelimelerinle özetleme, değiştirme veya yorumlama. Bu kısımları rapora tırnak işareti içinde ve denetmenin yazdığı orijinal cümlelerle birebir ekle.

Geçmiş Analizi: Aynı eksiklikler geçmiş denetimlerde de varsa bunu nazikçe 'tekrar eden bir durum' olarak belirt. Düzelen konular varsa ekibi tebrik et.

RAPOR ÇIKTI FORMATI:
Lütfen çıktıyı tam olarak aşağıdaki düzende ve emojileri kullanarak ver:

🌟 1. Denetim Genel Değerlendirmesi
Mağazanın genel puanı üzerinden motive edici bir özet. (Denetmen genel bir NOT bırakmışsa birebir buraya ekle).

🔍 2. Bölüm Bazlı Detaylı Analiz
(Verideki her bir bölüm için aşağıdaki yapıyı uyarla ve tüm bölümleri listele)

[Bölüm Adı - Örn: Lokum]: Bölüm puanına ve sorulardaki eksiklere göre kısa, yapıcı analiz.

📌 Denetmenin Notu / Önemli: "[Eğer bu bölüme özel yazılmış bir ÖNEMLİ veya NOT varsa, denetmenin cümlesini buraya birebir yaz, yoksa bu satırı ekleme]"

[Bölüm Adı - Örn: Kuruyemiş]: ...
(Bu şekilde tüm bölümleri tek tek analiz et)

📈 3. Geçmişten Bugüne Durumumuz
Geçmiş verilere kıyasla mağazanın ilerleyişi ve dikkat edilmesi gereken kronikleşmeye yüz tutmuş detaylar.

💡 4. Denetmenin Önerileri ve Aksiyon Adımları
Denetmenin 'ÖNERİ' başlığı altında yazdığı cümleleri BİREBİR aktar. Eğer denetmenin özel bir önerisi yoksa, senin verilerden çıkardığın en kritik 2-3 yapıcı tavsiyeyi maddeler halinde yaz.`;

        // Prompt body
        const prompt = `Aşağıda güncel denetim ve geçmiş denetim özetlerini içeren JSON verisi bulunmaktadır. Lütfen bu veriyi okuyarak sistem talimatlarına (istenen markdown formatına) KESİNLİKLE uygun bir analiz raporunu oluştur. Orijinal notları (varsa) mutlaka tırnak içinde birebir ekle.

VERİ:
${jsonInput}`;

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
                        console.warn(`[Groq Single Audit] ${modelName} transient error (${err?.message}). Retrying in ${attempts * 400}ms...`);
                        await new Promise(resolve => setTimeout(resolve, attempts * 400));
                    } else {
                        console.warn(`[Groq Single Audit] ${modelName} failed on attempt ${attempts} (${err?.message}), trying next model...`);
                        break;
                    }
                }
            }
            if (responseText) break;
        }

        if (!responseText) {
            throw new Error("Tüm Groq modelleri meşgul veya hata verdi: " + (lastError?.message ?? "Bilinmeyen hata"));
        }

        return NextResponse.json({ report: responseText });

    } catch (error: any) {
        console.error("AI Single Audit Analysis Error:", error);
        return NextResponse.json({ error: "Rapor oluşturulurken bir hata oluştu: " + error.message }, { status: 500 });
    }
}
