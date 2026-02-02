import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextRequest } from "next/server"

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

export async function POST(req: NextRequest) {
  try {
    const { prompt, context } = await req.json()

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Get the generative model
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" })

    // Construct the full prompt with context
    const fullPrompt = context
      ? `Continue writing based on this context:\n\n${context}\n\nContinue with: ${prompt}`
      : `Write a continuation for: ${prompt}`

    // Generate content
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
      generationConfig: {
        maxOutputTokens: 200,
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
      },
    })

    const response = result.response
    const text = response.text()

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
