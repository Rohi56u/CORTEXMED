import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, code: "TTS_UNCONFIGURED", error: "OPENAI_API_KEY is not configured" },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { text, language, voice, model } = body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ ok: false, error: "text is required" }, { status: 400 });
    }

    // OpenAI TTS natively supports English, Hindi (Devanagari script), and Hinglish (Latin transliteration)
    const selectedVoice = voice || (language === "hi" ? "nova" : "alloy");
    const selectedModel = model || "tts-1";

    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: selectedModel,
        voice: selectedVoice,
        input: text.trim(),
        response_format: "mp3",
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[OpenAI TTS] Error:", res.status, errText);
      return NextResponse.json(
        { ok: false, error: `OpenAI TTS error: ${res.status} - ${errText}` },
        { status: 502 }
      );
    }

    const audioBuffer = await res.arrayBuffer();
    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("[OpenAI TTS] Error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "unknown_error" },
      { status: 500 }
    );
  }
}
