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

        // 2. Fetch Recent Audits (Last 10 completed)
        const auditsSnapshot = await db.collection("audits")
            .where("storeId", "==", storeId)
            .where("status", "==", "tamamlandi")
            .orderBy("completedAt", "desc")
            .limit(10)
            .get();

        if (auditsSnapshot.empty) {
            return NextResponse.json({
                report: "Bu mağaza için yeterli denetim verisi bulunamadı. Lütfen daha sonra tekrar deneyiniz."
            });
        }

        const audits = auditsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const totalAudits = audits.length;
        const averageScore = audits.reduce((acc, curr: any) => acc + (curr.totalScore || 0), 0) / totalAudits;

        // --- Data Processing for Advanced Analysis ---

        // A. Question History for Streaks
        // Map: QuestionText -> Array of { date, passed (bool) }
        const questionHistory: Record<string, { date: Date, passed: boolean, notes: string[] }[]> = {};

        // B. Action Stats
        let totalActions = 0;
        let overdueActions = 0; // Pending store > 3 days
        let completedActions = 0;
        let storeResponseTimes: number[] = []; // In days

        // C. Consolidated Notes
        const allAuditorNotes: string[] = [];

        // Iterate audits (oldest to newest for streak calculation context, but we fetched desc)
        // Let's reverse for processing
        const auditsAsc = [...audits].reverse();

        auditsAsc.forEach((audit: any) => {
            const auditDate = audit.completedAt?.toDate ? audit.completedAt.toDate() : new Date();

            audit.sections?.forEach((section: any) => {
                section.answers?.forEach((answer: any) => {
                    const questionText = answer.questionText;
                    const passed = answer.answer === "evet" || (answer.questionType === "checkbox" && answer.earnedPoints === answer.maxPoints);

                    if (!questionHistory[questionText]) {
                        questionHistory[questionText] = [];
                    }

                    // Collect notes from "hayir" answers
                    if (!passed && answer.notes && answer.notes.length > 0) {
                        allAuditorNotes.push(...answer.notes.map((n: string) => `[${questionText}]: ${n}`));
                    } else if (!passed && answer.answer === "hayir") {
                        // Some notes might be in actionData
                        if (answer.actionData?.originalNotes) {
                            allAuditorNotes.push(`[${questionText}]: ${answer.actionData.originalNotes}`);
                        }
                    }

                    questionHistory[questionText].push({
                        date: auditDate,
                        passed,
                        notes: answer.notes || []
                    });

                    // Action Analysis
                    const isActionNeeded = !passed;
                    if (isActionNeeded && answer.actionData) {
                        totalActions++;
                        const action = answer.actionData;

                        if (action.status === "approved" || action.status === "resolved") {
                            completedActions++;
                            if (action.submittedAt && audit.completedAt) {
                                const submitted = action.submittedAt.toDate();
                                const completed = audit.completedAt.toDate();
                                const diffTime = Math.abs(submitted.getTime() - completed.getTime());
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                storeResponseTimes.push(diffDays);
                            }
                        } else if (action.status === "pending_store") {
                            // Check if overdue (3 days)
                            const daysPending = Math.ceil((new Date().getTime() - auditDate.getTime()) / (1000 * 60 * 60 * 24));
                            if (daysPending > 3) {
                                overdueActions++;
                            }
                        }
                    }
                });
            });
        });

        // Detect Streaks (Consecutive Failures in last 3+ appearnces)
        const streakFailures: string[] = [];
        Object.entries(questionHistory).forEach(([qText, history]) => {
            // Get last 3 entries
            const last3 = history.slice(-3);
            if (last3.length >= 3 && last3.every(h => !h.passed)) {
                streakFailures.push(`${qText} (Son ${last3.length} denetimde üst üste hatalı)`);
            }
        });

        // Calculate Stats
        const avgResponseTime = storeResponseTimes.length > 0
            ? (storeResponseTimes.reduce((a, b) => a + b, 0) / storeResponseTimes.length).toFixed(1)
            : "Veri Yok";

        const topNotes = allAuditorNotes.slice(-10).join("\n- "); // Last 10 notes

        // 4. Construct Prompt
        const prompt = `
            Sen uzman bir perakende denetim yöneticisisin ve veriye dayalı stratejik analiz yapıyorsun.
            Aşağıdaki detaylı verilere dayanarak, mağaza müdürü için **SWOT Analizi** (Güçlü Yönler, Zayıf Yönler, Fırsatlar, Tehditler) formatında profesyonel bir rapor hazırla.

            MAĞAZA: ${storeName}
            ANALİZ DÖNEMİ: Son ${totalAudits} Denetim
            ORTALAMA PUAN: ${averageScore.toFixed(1)} / 100

            🚩 KRİTİK BULGULAR (STREAKS):
            [Aşağıdaki maddeler son denetimlerde sürekli olarak hatalı çıkmıştır. Bu kronik bir sorundur.]
            ${streakFailures.join("\n") || "Kronikleşen (arka arkaya 3+) hata bulunmamaktadır."}

            ⚡ AKSİYON PERFORMANSI:
            - Toplam Açılan Aksiyon: ${totalActions}
            - Gecikmiş Aksiyonlar: ${overdueActions} (Mağaza 3 günden uzun süredir dönüş yapmamış)
            - Ortalama Mağaza Dönüş Hızı: ${avgResponseTime} Gün
            
            📝 DENETMEN NOTLARI VE BULGULAR (Özet):
            - ${topNotes || "Önemli bir not bulunmamaktadır."}

            ---
            
            GÖREVİN:
            Bu verileri yorumla ve aşağıdaki başlıklarla markdown formatında rapor oluştur.
            
            ## 🛡️ SWOT ANALİZİ
            
            ### 💪 Strengths (Güçlü Yönler)
            - Puanı yüksek tutan alanlar ve iyi yönetilen süreçler.
            
            ### ⚠️ Weaknesses (Zayıf Yönler)
            - Özellikle "Kritik Bulgular" (Streaks) kısmındaki kronikleşen hataları buraya al.
            - Geciken aksiyonlar varsa mağaza disiplini hakkında yorum yap.
            
            ### 🎯 Opportunities (Fırsatlar)
            - Puanı artırmak için hızlı kazanım alanları.
            - Denetmen notlarından yola çıkarak iyileştirme önerileri.
            
            ### 🚫 Threats (Tehditler)
            - Tekrarlanan hataların (Streaks) yaratabileceği uzun vadeli riskler.
            
            ## 🚀 STRATEJİK YOL HARİTASI
            [Mağaza müdürüne, sorunları çözmek için 3 maddelik net ve sert olmayan, motive edici bir aksiyon planı ver.]
            
            Ton: Profesyonel, yapıcı, analitik ve çözüm odaklı. Türkçe yanıt ver.
        `;

        // 5. Call Gemini
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        return NextResponse.json({ report: responseText });

    } catch (error: any) {
        console.error("AI API Error:", error);
        return NextResponse.json({ error: "Analiz oluşturulurken bir hata oluştu: " + error.message }, { status: 500 });
    }
}
