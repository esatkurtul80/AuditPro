import { NextRequest } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { prompt, context } = await req.json()

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Construct the full prompt with context
    const fullPrompt = context
      ? `Continue writing based on this context:\n\n${context}\n\nContinue with: ${prompt}`
      : `Write a continuation for: ${prompt}`

    const modelNames = [
        "llama-3.1-8b-instant",
        "llama-3.3-70b-versatile"
    ];

    let text = "";
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
                            { role: "system", content: "You are an assistant helping autocomplete notes or sentences. Continue the user's sentence directly and briefly, without any introduction or quotes." },
                            { role: "user", content: fullPrompt }
                        ],
                        temperature: 0.7,
                        max_tokens: 200
                    })
                });

                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(`HTTP error! status: ${response.status} - ${errText}`);
                }

                const data = await response.json();
                text = data.choices[0].message.content.trim();
                break;
            } catch (err: any) {
                attempts++;
                lastError = err;
                const isTransient = err?.message && (err.message.includes("503") || err.message.includes("429") || err.message.includes("rate limit") || err.message.includes("overloaded"));
                
                if (isTransient && attempts < maxAttempts) {
                    console.warn(`[Groq Autocomplete] ${modelName} transient error (${err?.message}). Retrying in ${attempts * 400}ms...`);
                    await new Promise(resolve => setTimeout(resolve, attempts * 400));
                } else {
                    console.warn(`[Groq Autocomplete] ${modelName} failed on attempt ${attempts} (${err?.message}), trying next model...`);
                    break;
                }
            }
        }
        if (text) break;
    }

    if (!text) {
        throw new Error("Tüm Groq modelleri meşgul veya hata verdi: " + (lastError?.message ?? "Bilinmeyen hata"));
    }

    return new Response(
      JSON.stringify({ completion: text }),
      { 
        status: 200, 
        headers: { "Content-Type": "application/json" } 
      }
    )
  } catch (error) {
    console.error("AI Autocomplete Error:", error)
    return new Response(
      JSON.stringify({ 
        error: "Failed to generate autocomplete suggestion",
        details: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
