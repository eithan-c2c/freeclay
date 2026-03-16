import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

function extractJSON(text: string): Record<string, string> {
  // Try to find the outermost valid JSON object by matching balanced braces
  const start = text.indexOf("{");
  if (start === -1) throw new Error("No JSON object found in response");

  let depth = 0;
  let end = -1;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) throw new Error("No JSON object found in response");

  const parsed = JSON.parse(text.slice(start, end + 1));
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    result[key] = String(value ?? "N/A");
  }
  return result;
}

export async function POST(req: NextRequest) {
  try {
    const { provider, apiKey, modelId, prompt, useWebSearch = true } = await req.json();

    if (!apiKey || !modelId || !prompt) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (provider === "anthropic") {
      const client = new Anthropic({ apiKey });

      const tools = useWebSearch
        ? [{ type: "web_search_20250305" as const, name: "web_search" as const, max_uses: 3 }]
        : [];

      const response = await client.messages.create({
        model: modelId,
        max_tokens: 1024,
        ...(tools.length > 0 ? { tools } : {}),
        messages: [{ role: "user", content: prompt }],
      });

      let text = "";
      for (const block of response.content) {
        if (block.type === "text") {
          text += block.text;
        }
      }

      const data = extractJSON(text);
      return NextResponse.json({
        data,
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
      });
    } else if (provider === "gemini") {
      const genAI = new GoogleGenerativeAI(apiKey);

      const modelConfig = useWebSearch
        ? { model: modelId, tools: [{ googleSearch: {} } as never] }
        : { model: modelId };

      const model = genAI.getGenerativeModel(modelConfig);

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const data = extractJSON(text);

      const usage = result.response.usageMetadata;
      return NextResponse.json({
        data,
        inputTokens: usage?.promptTokenCount || 0,
        outputTokens: usage?.candidatesTokenCount || 0,
      });
    } else {
      return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Enrichment failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
