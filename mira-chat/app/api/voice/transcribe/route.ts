import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, code: "TRANSCRIBE_UNCONFIGURED", error: "OPENAI_API_KEY is not configured" },
        { status: 503 }
      );
    }

    const formData = await request.formData();
    const audio = formData.get("audio") as File | null;
    const language = formData.get("language") as string | null;

    if (!audio) {
      return NextResponse.json({ ok: false, error: "audio file is required" }, { status: 400 });
    }

    // Forward to OpenAI Whisper API
    const whisperForm = new FormData();
    whisperForm.append("file", audio, "audio.webm");
    whisperForm.append("model", "whisper-1");
    if (language && language !== "auto" && language !== "bilingual") {
      whisperForm.append("language", language);
    }
    whisperForm.append("response_format", "json");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: whisperForm,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[Whisper] Error:", res.status, errText);
      return NextResponse.json(
        { ok: false, error: `Whisper API error: ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json({ ok: true, text: data.text });
  } catch (error) {
    console.error("[Whisper] Error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "unknown_error" },
      { status: 500 }
    );
  }
}
