"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { consumeChatSSE } from "@/lib/sse-parser";
import { useBilingualSpeech, LanguagePreference } from "@/hooks/useBilingualSpeech";
import ChatBubble, { ChatMessage } from "./components/ChatBubble";
import ChatInput from "./components/ChatInput";
import MicButton from "./components/MicButton";
import StatusIndicator from "./components/StatusIndicator";
import { StepInfo } from "./components/ThinkingStepper";

const DEMO_PATIENT_ID = "a1b2c3d4-0001-4000-8000-000000000001";

export default function DevicePage() {
  const {
    speak,
    replayLast,
    stop: stopSpeech,
    languagePreference,
    setLanguagePreference,
    muted,
    setMuted,
    isSpeaking,
    unlockAudio,
  } = useBilingualSpeech();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi! I\u2019m CortexMed, your clinical care companion. You can ask me in English or \u0939\u093f\u0928\u094d\u0926\u0940 about your medications, last doses, vitals, or help finding things. How can I support you today?",
      timestamp: new Date(),
    },
  ]);
  const [isSending, setIsSending] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [searchingFor, setSearchingFor] = useState<string | null>(null);
  const [patientId] = useState(DEMO_PATIENT_ID);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingRequestIds = useRef<Set<string>>(new Set());

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Realtime subscription for object location events
  useEffect(() => {
    const channel = supabase
      .channel(`device-events-${patientId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "events",
          filter: `patient_id=eq.${patientId}`,
        },
        (payload) => {
          const event = payload.new as {
            type: string;
            payload: {
              object_name?: string;
              request_id?: string;
              location?: { description?: string };
            };
            receipt_text?: string;
          };

          const requestId = event.payload?.request_id;

          if (
            event.type === "OBJECT_LOCATED" &&
            requestId &&
            pendingRequestIds.current.has(requestId)
          ) {
            pendingRequestIds.current.delete(requestId);
            setSearchingFor(null);

            const objectName = event.payload?.object_name || "item";
            const location =
              event.payload?.location?.description || "nearby";
            const msg = `Great news! Your ${objectName} was found ${location}.`;

            setMessages((prev) => [
              ...prev,
              {
                id: `sys-${Date.now()}`,
                role: "system",
                content: msg,
                timestamp: new Date(),
                action: "FIND_OBJECT",
              },
            ]);
            speak(`Found your ${objectName}! It's ${location}.`);
          }

          if (
            event.type === "OBJECT_NOT_FOUND" &&
            requestId &&
            pendingRequestIds.current.has(requestId)
          ) {
            pendingRequestIds.current.delete(requestId);
            setSearchingFor(null);

            const objectName = event.payload?.object_name || "item";
            setMessages((prev) => [
              ...prev,
              {
                id: `sys-${Date.now()}`,
                role: "system",
                content: `Sorry, we couldn\u2019t locate your ${objectName} right now. Would you like me to alert a caregiver?`,
                timestamp: new Date(),
              },
            ]);
            speak(
              `Sorry, we couldn't find your ${objectName} right now.`
            );
          }
        }
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId, speak]);

  // ── SSE-based chat send ──────────────────────────────────────
  const handleSend = useCallback(
    async (text: string) => {
      unlockAudio();
      // Add user message
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsSending(true);

      // Add a "thinking" assistant message (will be updated with steps)
      const thinkingId = `thinking-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: thinkingId,
          role: "assistant",
          content: "",
          timestamp: new Date(),
          steps: [],
          stepsFinished: false,
        },
      ]);

      // Track steps locally
      const stepsRef: StepInfo[] = [];

      try {
        await consumeChatSSE(patientId, text, {
          onStep: (event) => {
            stepsRef.push({
              label: event.label,
              detail: event.detail,
              searches: event.searches,
              status: "active",
            });
            for (let i = 0; i < stepsRef.length - 1; i++) {
              stepsRef[i].status = "done";
            }
            setMessages((prev) =>
              prev.map((m) =>
                m.id === thinkingId ? { ...m, steps: [...stepsRef] } : m
              )
            );
          },
          onStepDone: (event) => {
            if (stepsRef[event.index]) {
              stepsRef[event.index].status = "done";
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === thinkingId ? { ...m, steps: [...stepsRef] } : m
                )
              );
            }
          },
          onText: (event) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === thinkingId
                  ? { ...m, content: (m.content || "") + event.chunk }
                  : m
              )
            );
          },
          onResult: (event) => {
            stepsRef.forEach((s) => (s.status = "done"));
            setMessages((prev) =>
              prev.map((m) =>
                m.id === thinkingId
                  ? {
                      ...m,
                      content: event.reply || "Sorry, something went wrong.",
                      steps: [...stepsRef],
                      stepsFinished: true,
                      action: event.action as ChatMessage["action"],
                      citations: event.citations || undefined,
                      timestamp: new Date(),
                    }
                  : m
              )
            );
            if (event.action === "FIND_OBJECT" && event.request_id) {
              pendingRequestIds.current.add(event.request_id);
              setSearchingFor(event.object_name || "item");
            }
            if (event.reply) {
              speak(event.reply);
            }
          },
          onError: (err) => {
            console.error("Chat error:", err);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === thinkingId
                  ? {
                      ...m,
                      content:
                        "Sorry, I\u2019m having trouble connecting right now. Please try again.",
                      steps: [],
                      stepsFinished: true,
                      timestamp: new Date(),
                    }
                  : m
              )
            );
          },
        });
      } finally {
        setIsSending(false);
      }
    },
    [patientId, unlockAudio, speak]
  );

  return (
    <div className="h-screen flex flex-col bg-[#f4f6f5]">
      {/* Header */}
      <header className="relative h-[72px] bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600 flex items-center justify-between px-4 sm:px-6 shrink-0 shadow-lg overflow-hidden">
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/5" />
        <div className="absolute -bottom-12 -left-4 w-24 h-24 rounded-full bg-white/5" />

        <div className="flex items-center gap-3.5 relative z-10">
          <Link href="/" className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/10 hover:bg-white/25 transition-colors">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2a3 3 0 0 0-3 3v1a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10H5a2 2 0 0 0-2 2v1a8 8 0 0 0 8 8h2a8 8 0 0 0 8-8v-1a2 2 0 0 0-2-2Z" />
            </svg>
          </Link>
          <div>
            <h1 className="text-white font-bold text-xl tracking-tight font-display flex items-center gap-2">
              CortexMed
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-white font-mono font-medium">
                Voice Assistant
              </span>
            </h1>
            <p className="text-teal-100/80 text-[11px] font-medium tracking-wide uppercase">
              Bilingual Clinical Companion
            </p>
          </div>
        </div>

        {/* Audio HUD Controls & Status */}
        <div className="flex items-center gap-2.5 relative z-10">
          {/* Language Selector */}
          <div className="flex items-center bg-black/25 backdrop-blur-md rounded-xl p-0.5 border border-white/15">
            {(["en", "hi", "bilingual"] as LanguagePreference[]).map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguagePreference(lang)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  languagePreference === lang
                    ? "bg-white text-teal-800 shadow-sm"
                    : "text-white/80 hover:text-white"
                }`}
              >
                {lang === "en" ? "EN" : lang === "hi" ? "\u0939\u093f\u0928\u094d\u0926\u0940" : "Auto"}
              </button>
            ))}
          </div>

          {/* Mute Toggle */}
          <button
            onClick={() => setMuted(!muted)}
            title={muted ? "Unmute Voice" : "Mute Voice"}
            className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all ${
              muted
                ? "bg-red-500/20 border-red-300/40 text-red-200"
                : "bg-white/15 border-white/15 text-white hover:bg-white/25"
            }`}
          >
            {muted ? (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            ) : (
              <svg className={`w-4 h-4 ${isSpeaking ? "animate-pulse text-emerald-300" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
          </button>

          {/* Replay Last Speech */}
          <button
            onClick={replayLast}
            title="Replay Last Voice Output"
            className="w-9 h-9 rounded-xl bg-white/15 border border-white/15 text-white hover:bg-white/25 transition-all flex items-center justify-center"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 4v6h6" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </button>

          <StatusIndicator
            connected={connected}
            searchingFor={searchingFor}
          />
        </div>
      </header>

      {/* Transcribing indicator */}
      {isTranscribing && (
        <div className="bg-amber-50 border-b border-amber-100 px-5 py-2.5 flex items-center gap-2.5 text-sm text-amber-700 font-medium">
          <div className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          Transcribing speech (English / \u0939\u093f\u0928\u094d\u0926\u0940)...
        </div>
      )}

      {/* Chat area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 sm:px-6 py-6"
      >
        <div className="max-w-2xl mx-auto space-y-1">
          {messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} />
          ))}
        </div>
      </div>

      {/* Input bar */}
      <div className="border-t border-slate-200/60 glass px-4 sm:px-6 py-4 shrink-0">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <MicButton
            onResult={handleSend}
            onTranscribing={setIsTranscribing}
            disabled={isSending}
            language={languagePreference}
          />
          <div className="flex-1">
            <ChatInput
              onSend={handleSend}
              disabled={isSending || isTranscribing}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
