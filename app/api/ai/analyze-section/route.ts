import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { sectionName, failedAnswers } = await req.json();

        if (!failedAnswers || failedAnswers.length === 0) {
            return NextResponse.json({ error: "Eksik soru bilgisi" }, { status: 400 });
        }

        const systemPrompt = `Sen profesyonel bir iç denetim uzmanı ve mağaza operasyon analistisin.
Sana bir denetimde "${sectionName}" bölümünde olumsuz sonuçlanan/eksik puan alan soruları ve bu sorular için alınan notları iletiyorum.

GÖREVİN:
Bu verileri analiz edip, denetmenin bu bölüm için yazacağı "Görüş ve Öneriler" kısmını doldurmak üzere yapıcı, profesyonel, akıcı ve tamamlanmış bir değerlendirme metni oluşturmaktır.

KESİN KURALLAR:
1. Görüş metninin ana gövdesi en az 3-4 cümleden oluşan, anlam bütünlüğü olan tam bir paragraf olmalıdır. Kesinlikle tek cümlelik, kısa veya yarım bırakılmış cümleler yazma. Metnin son cümlesi de dahil olmak üzere tüm cümleler dilbilgisine uygun şekilde tamamlanmış olmalıdır.
2. Bölümdeki HER BİR olumsuz madde/eksiklik için ayrı ayrı analiz notu ve yapıcı çözüm önerisi metinde mutlaka yer almalıdır. Hiçbir eksikliği atlamadan rapora yansıt.
3. ÜSLUP (ÇOK ÖNEMLİ): Kesinlikle sert ve emir kipi taşıyan "-meli, -malı, yapılmalıdır, gösterilmelidir, edilmelidir" gibi ifadeler KULLANMA. Bunun yerine çok daha yumuşak, yapıcı ve tavsiye niteliğinde olan "-ebilir, -abilir, yapılabilir, sağlanabilir, gösterilebilir, dikkat edilebilir, yararlı olacaktır" gibi yapıcı kelimeler kullan.
4. Doğrudan görüşe başla. "Bu bölüm için görüşlerim şunlardır:" gibi gereksiz giriş cümleleri yazma.
5. Metni Türkçe dilinde üret.`;

        const userPrompt = `Bölüm: ${sectionName}

Bu Denetimdeki Eksikler ve Alınan Notlar:
${failedAnswers.map((item: any) => `- Soru: ${item.questionText}\n  Not: ${item.notes.join(" | ")}`).join("\n")}

Lütfen yukarıda yer alan eksiklerin HER BİRİNİ tek tek ele alarak analiz notunu ve yapıcı önerisini yaz. En az 50 en fazla 70 kelimeden oluşan (yaklaşık 3-4 cümle) tam ve akıcı bir değerlendirme paragrafı oluştur. Metindeki tüm cümleleri dilbilgisine uygun şekilde tamamla. Üslup olarak kesinlikle "-meli, -malı" (yapılmalı, gösterilmeli vb.) ifadeleri yerine "-ebilir, -abilir" (yapılabilir, gösterilebilir, sağlanabilir, dikkat edilebilir vb.) şeklinde çok daha yumuşak ve yapıcı bir dil kullan.`;

        let feedback = "";
        const modelNames = [
            "llama-3.3-70b-versatile",
            "llama-3.1-8b-instant",
            "mixtral-8x7b-32768"
        ];

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
                                { role: "user", content: userPrompt }
                            ],
                            temperature: 0.7,
                            max_tokens: 600
                        })
                    });

                    if (!response.ok) {
                        const errText = await response.text();
                        throw new Error(`HTTP error! status: ${response.status} - ${errText}`);
                    }

                    const data = await response.json();
                    feedback = data.choices[0].message.content.trim();
                    break; // Başarılı → döngüden çık
                } catch (err: any) {
                    attempts++;
                    lastError = err;
                    const isTransient = err?.message && (err.message.includes("503") || err.message.includes("429") || err.message.includes("rate limit") || err.message.includes("overloaded"));
                    
                    if (isTransient && attempts < maxAttempts) {
                        console.warn(`[Groq AI] ${modelName} transient error (${err?.message}). Retrying in ${attempts * 400}ms...`);
                        await new Promise(resolve => setTimeout(resolve, attempts * 400));
                    } else {
                        console.warn(`[Groq AI] ${modelName} failed on attempt ${attempts} (${err?.message}), trying next model...`);
                        break;
                    }
                }
            }
            if (feedback) break;
        }

        if (!feedback) {
            throw new Error("Tüm Groq modelleri şu anda meşgul veya yanıt veremiyor. Lütfen birkaç saniye bekleyip tekrar deneyin. (" + (lastError?.message ?? "Bilinmeyen hata") + ")");
        }

        return NextResponse.json({ feedback });

    } catch (error: any) {
        console.error("AI Analyze Section Error:", error);
        return NextResponse.json({ 
            error: "Görüş oluşturulurken bir hata oluştu: " + error.message 
        }, { status: 500 });
    }
}
