import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
    try {
        const { sectionName, failedAnswers } = await req.json();

        if (!failedAnswers || failedAnswers.length === 0) {
            return NextResponse.json({ error: "Eksik soru bilgisi" }, { status: 400 });
        }

        const systemPrompt = `Sen profesyonel bir iç denetim uzmanı ve mağaza operasyon analistisin.
Sana bir denetimde "${sectionName}" bölümünde olumsuz sonuçlanan/eksik puan alan soruları, denetmenin bu sorular için aldığı notları ve bu soruların önceki denetimlerde de olumsuz olup olmadığını (ardışık hata sayısı) iletiyorum.

GÖREVİN:
Bu verileri analiz edip, denetmenin bu bölüm için yazacağı "Görüş ve Öneriler" kısmını doldurmak üzere yapıcı, profesyonel, akıcı ve tamamlanmış bir değerlendirme metni oluşturmaktır.

KESİN KURALLAR:
1. Görüş metni en az 3-4 cümleden oluşan, anlam bütünlüğü olan tam bir paragraf olmalıdır. Kesinlikle tek cümlelik, kısa veya yarım bırakılmış cümleler yazma. Metnin son cümlesi de dahil olmak üzere tüm cümleler dilbilgisine uygun şekilde tamamlanmış olmalıdır.
2. Bölümdeki HER BİR olumsuz madde/eksiklik için ayrı ayrı analiz notu ve yapıcı çözüm önerisi metinde mutlaka yer almalıdır. Hiçbir eksikliği atlamadan rapora yansıt.
3. ÜSLUP (ÇOK ÖNEMLİ): Kesinlikle sert ve emir kipi taşıyan "-meli, -malı, yapılmalıdır, gösterilmelidir, edilmelidir" gibi ifadeler KULLANMA. Bunun yerine çok daha yumuşak, yapıcı ve tavsiye niteliğinde olan "-ebilir, -abilir, yapılabilir, sağlanabilir, gösterilebilir, dikkat edilebilir, yararlı olacaktır" gibi yapıcı kelimeler kullan.
4. Doğrudan görüşe başla. "Bu bölüm için görüşlerim şunlardır:" gibi gereksiz giriş cümleleri yazma.
5. Metni Türkçe dilinde üret.
6. SÜREGELEN SORUNLARIN BELİRTİLMESİ: Eğer ardışık hata sayısı 2 veya daha fazla (consecutiveFailCount >= 2) olan, yani önceki denetimlerden süregelen maddeler varsa, bunları hem ana paragrafta süregelen bir sorun olarak belirt hem de ana paragraftan sonra bir satır boşluk bırakarak "Önceki Denetimlerden Süregelen Eksiklikler:" başlığı altında liste (madde) halinde yaz (Örn: "- [Konu/Soru Tanımı] (X denetimdir üst üste eksik)"). Süregelen eksiklik yoksa bu listeyi ve başlığı asla oluşturma.`;

        // Use gemini-2.5-flash as explicitly requested by the user
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            systemInstruction: systemPrompt
        });

        const userPrompt = `Bölüm: ${sectionName}
Eksikler ve Alınan Notlar:
${failedAnswers.map((item: any, i: number) => `
Soru: ${item.questionText}
Not: ${item.notes.join(" | ")}
Ardışık Hata Sayısı (Mevcut Dahil): ${item.consecutiveFailCount} denetimdir üst üste olumsuz.
`).join("\n")}

Lütfen yukarıda yer alan eksiklerin HER BİRİNİ tek tek ele alarak analiz notunu ve yapıcı önerisini yaz. En az 50 en fazla 70 kelimeden oluşan (yaklaşık 3-4 cümle) tam ve akıcı bir değerlendirme paragrafı oluştur. Metindeki tüm cümleleri dilbilgisine uygun şekilde tamamla. Üslup olarak kesinlikle "-meli, -malı" (yapılmalı, gösterilmeli vb.) ifadeleri yerine "-ebilir, -abilir" (yapılabilir, gösterilebilir, sağlanabilir, dikkat edilebilir vb.) şeklinde çok daha yumuşak ve yapıcı bir dil kullan.

ÖNEMLİ: Eğer ardışık hata sayısı 2 veya daha fazla (consecutiveFailCount >= 2) olan süregelen maddeler varsa, bunları ana paragrafın ardından boş bir satır bırakarak "Önceki Denetimlerden Süregelen Eksiklikler:" başlığı altında liste (madde) halinde belirt (Örn: "- [Madde/Soru Konusu] (X denetimdir üst üste eksik/olumsuz)"). Eğer süregelen eksiklik yoksa bu listeyi ve başlığı asla ekleme.`;

        let feedback = "";
        
        console.log("--- AI Input Prompt ---");
        console.log(userPrompt);
        console.log("-----------------------");

        try {
            // Primary attempt: gemini-2.5-flash-lite (fast, highly available)
            console.log("Attempting generation with gemini-2.5-flash-lite...");
            const model = genAI.getGenerativeModel({ 
                model: "gemini-2.5-flash-lite",
                systemInstruction: systemPrompt
            });

            const result = await model.generateContent({
                contents: [
                    { role: "user", parts: [{ text: userPrompt }] }
                ],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 600
                }
            });
            feedback = result.response.text().trim();
            console.log("Response from gemini-2.5-flash-lite:", feedback);
        } catch (error) {
            console.warn("Primary model gemini-2.5-flash-lite failed or overloaded. Falling back to gemini-2.5-flash...", error);
            
            try {
                // Fallback attempt 1: gemini-2.5-flash
                console.log("Attempting generation with gemini-2.5-flash...");
                const fallbackModel1 = genAI.getGenerativeModel({ 
                    model: "gemini-2.5-flash",
                    systemInstruction: systemPrompt
                });

                const result = await fallbackModel1.generateContent({
                    contents: [
                        { role: "user", parts: [{ text: userPrompt }] }
                    ],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 600
                    }
                });
                feedback = result.response.text().trim();
                console.log("Response from fallback gemini-2.5-flash:", feedback);
            } catch (fbError) {
                console.warn("Fallback model gemini-2.5-flash failed. Falling back to gemini-flash-latest...", fbError);
                
                // Fallback attempt 2: stable gemini-flash-latest (supported by user subscription)
                const fallbackModel2 = genAI.getGenerativeModel({ 
                    model: "gemini-flash-latest",
                    systemInstruction: systemPrompt
                });

                const result = await fallbackModel2.generateContent({
                    contents: [
                        { role: "user", parts: [{ text: userPrompt }] }
                    ],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 600
                    }
                });
                feedback = result.response.text().trim();
                console.log("Response from fallback gemini-flash-latest:", feedback);
            }
        }

        return NextResponse.json({ feedback });

    } catch (error: any) {
        console.error("AI Analyze Section Error:", error);
        return NextResponse.json({ 
            error: "Görüş oluşturulurken bir hata oluştu: " + error.message 
        }, { status: 500 });
    }
}
