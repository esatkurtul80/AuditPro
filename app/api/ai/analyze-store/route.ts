import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { adminDb, initAdmin } from "@/lib/firebase-admin";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
    try {
        const { storeId } = await req.json();

        // Initialize Firebase Admin
        initAdmin();
        const db = adminDb();

        if (!storeId) {
            return NextResponse.json({ error: "Store ID is required" }, { status: 400 });
        }

        // 1. Fetch Store Data
        const storeDoc = await db.collection("stores").doc(storeId).get();
        if (!storeDoc.exists) {
            return NextResponse.json({ error: "Store not found" }, { status: 404 });
        }
        const storeData = storeDoc.data();
        const storeName = storeData?.name || "Bilinmeyen Mağaza";

        // 2. Fetch Recent Audits (Last 6 completed: 1 current + 5 past)
        const auditsSnapshot = await db.collection("audits")
            .where("storeId", "==", storeId)
            .where("status", "==", "tamamlandi")
            .orderBy("completedAt", "desc")
            .limit(6)
            .get();

        if (auditsSnapshot.empty) {
            return NextResponse.json({
                report: "Bu mağaza için yeterli denetim verisi bulunamadı. Lütfen daha sonra tekrar deneyiniz."
            });
        }

        const audits = auditsSnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }) as any);
        const currentAudit = audits[0] as any; // En güncel denetim

        const pastAuditsData = audits.slice(1).map((data: any) => {
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
                id: data.id,
                totalScore: data.totalScore,
                date: dateStr,
                summary: data.sections?.map((s: any) => ({
                    name: s.name || s.title || "İsimsiz Bölüm",
                    score: s.score,
                }))
            };
        });

        // 3. Güncel denetim verilerini JSON formatına dönüştürme
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
                const answersInfo = section.answers?.map((ans: any) => {
                    return {
                        question: ans.questionText,
                        answer: ans.answer,
                        points: ans.earnedPoints,
                        notes: ans.notes || [], // Denetmenin girdiği 'ÖNEMLİ', 'NOT', 'ÖNERİ'
                        actionOriginalNotes: ans.actionData?.originalNotes || null
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

        // 4. API İsteği: System Prompt Ayarlaması
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

        // Not: Kullanıcı isteği üzerine gemini-1.5-flash kullanılıyor.
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            systemInstruction: systemPrompt 
        });

        const prompt = `Aşağıda güncel denetim ve geçmiş denetim özetlerini içeren JSON verisi bulunmaktadır. Lütfen bu veriyi okuyarak sistem talimatlarına KESİNLİKLE uygun bir analiz raporunu oluştur. Orijinal notları (varsa) mutlaka tırnak içinde birebir ekle. Şablon dışına çıkma.

VERİ:
${jsonInput}`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        let startTimeStr = '-';
        if (currentAudit.createdAt) {
            const d = typeof currentAudit.createdAt.toDate === 'function' ? currentAudit.createdAt.toDate() : new Date((currentAudit.createdAt.seconds || currentAudit.createdAt._seconds) * 1000);
            startTimeStr = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        } else if (currentAudit.startedAt) {
             const d = typeof currentAudit.startedAt.toDate === 'function' ? currentAudit.startedAt.toDate() : new Date((currentAudit.startedAt.seconds || currentAudit.startedAt._seconds) * 1000);
             startTimeStr = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        }

        let endTimeStr = '-';
        if (currentAudit.completedAt) {
            const d = typeof currentAudit.completedAt.toDate === 'function' ? currentAudit.completedAt.toDate() : new Date((currentAudit.completedAt.seconds || currentAudit.completedAt._seconds) * 1000);
            endTimeStr = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        }
        
        // Find week number if not explicitly defined
        let weekStr = currentAudit.period || currentAudit.week || '-';
        if (weekStr === '-' && currentAudit.completedAt) {
             const d = typeof currentAudit.completedAt.toDate === 'function' ? currentAudit.completedAt.toDate() : new Date((currentAudit.completedAt.seconds || currentAudit.completedAt._seconds) * 1000);
             const startDate = new Date(d.getFullYear(), 0, 1);
             const days = Math.floor((d.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
             const weekNumber = Math.ceil(days / 7);
             weekStr = `${d.getFullYear()} / ${weekNumber}. Hafta`;
        }

        return NextResponse.json({ 
            report: responseText,
            metadata: {
                storeName: storeName,
                auditorName: currentAudit.auditorName || currentAudit.inspectorName || '-',
                relatedWeek: weekStr,
                totalScore: currentAudit.totalScore || 0,
                auditDate: currentDateStr,
                startTime: startTimeStr,
                endTime: endTimeStr,
                previousAuditor: audits.length > 1 ? (audits[1].auditorName || audits[1].inspectorName || '-') : '-'
            }
        });

    } catch (error: any) {
        console.error("AI API Error:", error);
        return NextResponse.json({ error: "Analiz oluşturulurken bir hata oluştu: " + error.message }, { status: 500 });
    }
}
