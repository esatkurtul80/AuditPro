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
Bu verileri analiz edip, denetmenin bu bölüm için yazacağı "Görüş ve Öneriler" kısmını doldurmak üzere yapıcı, profesyonel ve kısa bir özet metin oluşturmaktır.

KESİN KURALLAR:
1. Çok kısa (birkaç kelimelik) veya tek cümlelik yarım kalmış yanıtlar yazma. Başarısız noktaları yapıcı bir dille ele alan ve gelişim önerileri sunan, en az 2-3 tam cümlelik profesyonel ve öz bir paragraf oluştur. Cümlelerin tamamlanmış olmasına ve havada kalmamasına dikkat et.
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

        const result = await model.generateContent({
            contents: [
                { role: "user", parts: [{ text: userPrompt }] }
            ],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 300
            }
        });

        const feedback = result.response.text().trim();

        return NextResponse.json({ feedback });

    } catch (error: any) {
        console.error("AI Analyze Section Error:", error);
        return NextResponse.json({ 
            error: "Görüş oluşturulurken bir hata oluştu: " + error.message 
        }, { status: 500 });
    }
}
