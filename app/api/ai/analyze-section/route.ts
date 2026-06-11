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
Sana bir denetimde "${sectionName}" bölümünde olumsuz sonuçlanan/eksik puan alan soruları ve denetmenin bu sorular için aldığı notları iletiyorum.

GÖREVİN:
Bu verileri analiz edip, denetmenin bu bölüm için yazacağı "Görüş ve Öneriler" kısmını doldurmak üzere yapıcı, profesyonel, akıcı ve tamamlanmış bir değerlendirme metni oluşturmaktır.

KESİN KURALLAR:
1. Görüş metni en az 3-4 cümleden oluşan, anlam bütünlüğü olan tam bir paragraf olmalıdır. Kesinlikle tek cümlelik, kısa veya yarım bırakılmış cümleler yazma. Metnin son cümlesi de dahil olmak üzere tüm cümleler dilbilgisine uygun şekilde tamamlanmış olmalıdır.
2. Üslubun kurumsal, motive edici ve çözüm odaklı olmalıdır. Eksikleri birer hata değil gelişim alanı olarak nitelendir.
3. Doğrudan görüşe başla. "Bu bölüm için görüşlerim şunlardır:" gibi gereksiz giriş cümleleri yazma.
4. Metni Türkçe dilinde üret.`;

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
`).join("\n")}`;

        let feedback = "";
        
        console.log("--- AI Input Prompt ---");
        console.log(userPrompt);
        console.log("-----------------------");

        try {
            // Primary attempt: gemini-2.5-flash
            console.log("Attempting generation with gemini-2.5-flash...");
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
            console.log("Response from gemini-2.5-flash:", feedback);
        } catch (error) {
            console.warn("Primary model gemini-2.5-flash failed or overloaded. Falling back to gemini-2.0-flash...", error);
            
            // Fallback attempt: stable gemini-2.0-flash (supported by user subscription)
            const fallbackModel = genAI.getGenerativeModel({ 
                model: "gemini-2.0-flash",
                systemInstruction: systemPrompt
            });

            const result = await fallbackModel.generateContent({
                contents: [
                    { role: "user", parts: [{ text: userPrompt }] }
                ],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 600
                }
            });
            feedback = result.response.text().trim();
            console.log("Response from fallback gemini-2.0-flash:", feedback);
        }

        return NextResponse.json({ feedback });

    } catch (error: any) {
        console.error("AI Analyze Section Error:", error);
        return NextResponse.json({ 
            error: "Görüş oluşturulurken bir hata oluştu: " + error.message 
        }, { status: 500 });
    }
}
