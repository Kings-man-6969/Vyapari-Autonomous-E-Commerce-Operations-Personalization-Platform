import dotenv from "dotenv";

dotenv.config({ path: "../.env" });
dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

/**
 * Executes a chat completion query using Gemini or the configured AI gateway.
 */
export async function chatCompletion(
  messages: Array<{ role: string; content: string }>,
  responseFormatJson: boolean = false
): Promise<string> {
  const apiKey = GEMINI_API_KEY || process.env.AI_API_KEY || process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key (GEMINI_API_KEY) or AI API key is not configured in environment variables.");
  }

  let url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
  let authHeader = `Bearer ${apiKey}`;
  let modelName = "gemini-2.5-flash";

  // Fallback to Lovable gateway if GEMINI_API_KEY is not defined but AI_GATEWAY_URL is
  if (!GEMINI_API_KEY && process.env.AI_GATEWAY_URL) {
    url = process.env.AI_GATEWAY_URL;
    authHeader = `Bearer ${apiKey}`;
    modelName = "google/gemini-2.5-flash";
  }

  const body: any = {
    model: modelName,
    messages: messages,
  };

  if (responseFormatJson) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini/AI API chat error: ${res.status} - ${text}`);
  }

  const json = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return json.choices?.[0]?.message?.content ?? "";
}

/**
 * Generates an image using Gemini's Imagen 3 model or the fallback gateway.
 */
export async function generateImage(prompt: string): Promise<string> {
  const apiKey = GEMINI_API_KEY || process.env.AI_API_KEY || process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key (GEMINI_API_KEY) or AI API key is not configured in environment variables.");
  }

  // If using official Gemini API key, use the official Imagen 3 model
  if (GEMINI_API_KEY) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:generateImages?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: `Generate a clean, professional product photo: ${prompt}. Studio lighting, soft shadow, neutral background, photorealistic.`,
        numberOfImages: 1,
        outputMimeType: "image/png",
        aspectRatio: "1:1",
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gemini Imagen 3 API error: ${res.status} - ${text}`);
    }

    const json = (await res.json()) as {
      generatedImages?: Array<{ image: { imageBytes: string } }>;
    };

    const b64Bytes = json.generatedImages?.[0]?.image?.imageBytes;
    if (!b64Bytes) {
      throw new Error("Imagen did not return any image data");
    }

    return `data:image/png;base64,${b64Bytes}`;
  }

  // Otherwise fallback to Lovable gateway style
  const url = process.env.AI_GATEWAY_URL || "https://ai.gateway.lovable.dev/v1/chat/completions";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [
        {
          role: "user",
          content: `Generate a clean, professional product photo: ${prompt}. Studio lighting, soft shadow, neutral background, photorealistic.`,
        },
      ],
      modalities: ["image", "text"],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI gateway image error: ${res.status} - ${text}`);
  }

  const json = (await res.json()) as any;
  const dataUrl = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!dataUrl || !dataUrl.startsWith("data:")) throw new Error("AI gateway did not return an image");
  return dataUrl;
}
