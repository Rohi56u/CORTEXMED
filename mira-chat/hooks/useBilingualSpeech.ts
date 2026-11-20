"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export type SpeechLanguage = "en" | "hi";
export type LanguagePreference = "en" | "hi" | "bilingual";
export type SpeechEngine = "server_tts" | "browser_speech" | "idle";

export interface SpeakOptions {
  language?: SpeechLanguage;
  rate?: number;
  pitch?: number;
  onEnd?: () => void;
  onError?: (err: any) => void;
  skipHistory?: boolean;
}

export interface AlertSpeechPayload {
  spoken_warning_en?: string | null;
  spoken_warning_hi?: string | null;
  fallback_text?: string;
  onEnd?: () => void;
}

const STORAGE_KEY = "cortexmed_speech_lang_pref";

export function useBilingualSpeech() {
  const [languagePreference, setLanguagePreferenceState] = useState<LanguagePreference>("bilingual");
  const [muted, setMutedState] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [engine, setEngine] = useState<SpeechEngine>("idle");
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeAudioResolveRef = useRef<(() => void) | null>(null);
  const audioBlobUrlRef = useRef<string | null>(null);
  const lastSpokenPayloadRef = useRef<{ type: "single" | "alert"; data: any } | null>(null);
  const cancelSequenceRef = useRef<boolean>(false);

  // Load language preference from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as LanguagePreference | null;
      if (saved && (saved === "en" || saved === "hi" || saved === "bilingual")) {
        setLanguagePreferenceState(saved);
      }
    } catch {
      // Ignore localStorage access failures
    }
  }, []);

  // Update language preference with localStorage persistence
  const setLanguagePreference = useCallback((pref: LanguagePreference) => {
    setLanguagePreferenceState(pref);
    try {
      localStorage.setItem(STORAGE_KEY, pref);
    } catch {
      // Ignore
    }
  }, []);

  // Set muted state
  const setMuted = useCallback((val: boolean) => {
    setMutedState(val);
    if (val) {
      stop();
    }
  }, []);

  // Populate browser speech synthesis voices
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const updateVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) {
        setVoices(v);
      }
    };

    updateVoices();
    window.speechSynthesis.addEventListener("voiceschanged", updateVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", updateVoices);
    };
  }, []);

  // Autoplay unlock helper
  const unlockAudio = useCallback(() => {
    if (audioUnlocked) return;
    try {
      // Play brief silent audio buffer
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const buffer = audioCtx.createBuffer(1, 1, 22050);
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.start(0);
      if (audioCtx.state === "suspended") {
        audioCtx.resume();
      }
      setAudioUnlocked(true);
    } catch {
      setAudioUnlocked(true);
    }
  }, [audioUnlocked]);

  // Clean stop for all active audio sources
  const stop = useCallback(() => {
    cancelSequenceRef.current = true;
    if (activeAudioResolveRef.current) {
      activeAudioResolveRef.current();
      activeAudioResolveRef.current = null;
    }
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
      } catch {}
      currentAudioRef.current = null;
    }
    if (audioBlobUrlRef.current) {
      try {
        URL.revokeObjectURL(audioBlobUrlRef.current);
      } catch {}
      audioBlobUrlRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setEngine("idle");
  }, []);

  // Browser Speech Synthesis Fallback
  const speakWithBrowserSpeech = useCallback(
    (text: string, lang: SpeechLanguage, options?: SpeakOptions): Promise<void> => {
      return new Promise((resolve) => {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) {
          resolve();
          return;
        }

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = options?.rate ?? 0.92; // Calm, deliberate eldercare rate
        utterance.pitch = options?.pitch ?? 1.0;

        // Deterministically match best language voice
        const currentVoices = voices.length > 0 ? voices : window.speechSynthesis.getVoices();
        if (lang === "hi") {
          utterance.lang = "hi-IN";
          const hiVoice =
            currentVoices.find(
              (v) =>
                v.lang.toLowerCase().startsWith("hi") ||
                v.lang.toLowerCase() === "hi-in" ||
                v.lang.toLowerCase() === "hi_in"
            ) ||
            currentVoices.find((v) => v.name.toLowerCase().includes("hindi"));
          if (hiVoice) utterance.voice = hiVoice;
        } else {
          utterance.lang = "en-US";
          const enVoice =
            currentVoices.find((v) => v.lang === "en-IN") ||
            currentVoices.find((v) => v.lang === "en-US") ||
            currentVoices.find((v) => v.lang.startsWith("en"));
          if (enVoice) utterance.voice = enVoice;
        }

        utterance.onstart = () => {
          setIsSpeaking(true);
          setEngine("browser_speech");
        };

        utterance.onend = () => {
          setIsSpeaking(false);
          setEngine("idle");
          options?.onEnd?.();
          resolve();
        };

        utterance.onerror = (e) => {
          console.warn("[useBilingualSpeech] Web Speech API event error:", e);
          setIsSpeaking(false);
          setEngine("idle");
          options?.onError?.(e);
          resolve();
        };

        window.speechSynthesis.speak(utterance);
      });
    },
    [voices]
  );

  // Single utterance playback (Primary: Real /api/voice/tts, Fallback: Browser Web Speech)
  const speak = useCallback(
    async (text: string, options?: SpeakOptions): Promise<void> => {
      if (muted || !text || !text.trim()) return;

      const lang: SpeechLanguage = options?.language || (languagePreference === "hi" ? "hi" : "en");
      if (!options?.skipHistory) {
        lastSpokenPayloadRef.current = { type: "single", data: { text, options } };
      }
      stop();
      cancelSequenceRef.current = false;

      // Try server-side OpenAI TTS first
      try {
        const res = await fetch("/api/voice/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: text.trim(),
            language: lang,
          }),
        });

        if (cancelSequenceRef.current) return;

        if (res.ok && res.status === 200) {
          const blob = await res.blob();
          if (cancelSequenceRef.current) return;

          const url = URL.createObjectURL(blob);
          audioBlobUrlRef.current = url;
          const audio = new Audio(url);
          currentAudioRef.current = audio;

          return new Promise<void>((resolve) => {
            activeAudioResolveRef.current = resolve;

            audio.onplay = () => {
              setIsSpeaking(true);
              setEngine("server_tts");
            };

            audio.onended = () => {
              activeAudioResolveRef.current = null;
              if (audioBlobUrlRef.current) {
                URL.revokeObjectURL(audioBlobUrlRef.current);
                audioBlobUrlRef.current = null;
              }
              currentAudioRef.current = null;
              setIsSpeaking(false);
              setEngine("idle");
              options?.onEnd?.();
              resolve();
            };

            audio.onerror = async (err) => {
              activeAudioResolveRef.current = null;
              console.warn("[useBilingualSpeech] Server audio element error, falling back to Web Speech:", err);
              if (audioBlobUrlRef.current) {
                URL.revokeObjectURL(audioBlobUrlRef.current);
                audioBlobUrlRef.current = null;
              }
              currentAudioRef.current = null;
              await speakWithBrowserSpeech(text, lang, options);
              resolve();
            };

            audio.play().catch(async (playErr) => {
              activeAudioResolveRef.current = null;
              console.warn("[useBilingualSpeech] Autoplay policy blocked audio.play(), attempting browser speech:", playErr);
              await speakWithBrowserSpeech(text, lang, options);
              resolve();
            });
          });
        } else {
          // Honest fallback when server TTS is unconfigured (503) or failed
          await speakWithBrowserSpeech(text, lang, options);
        }
      } catch (networkErr) {
        console.warn("[useBilingualSpeech] Network error reaching TTS API, using browser speech fallback:", networkErr);
        await speakWithBrowserSpeech(text, lang, options);
      }
    },
    [muted, languagePreference, stop, speakWithBrowserSpeech]
  );

  // Clinical Alert Bilingual Playback (English first, followed by Hindi when in bilingual mode)
  const speakAlert = useCallback(
    async (payload: AlertSpeechPayload): Promise<void> => {
      if (muted) return;

      const enText = payload.spoken_warning_en?.trim();
      const hiText = payload.spoken_warning_hi?.trim();
      const fallback = payload.fallback_text?.trim() || "";

      lastSpokenPayloadRef.current = { type: "alert", data: payload };
      stop();
      cancelSequenceRef.current = false;

      if (languagePreference === "en") {
        const textToSpeak = enText || fallback || hiText;
        if (textToSpeak) {
          await speak(textToSpeak, { language: "en", onEnd: payload.onEnd, skipHistory: true });
        }
      } else if (languagePreference === "hi") {
        const textToSpeak = hiText || fallback || enText;
        if (textToSpeak) {
          await speak(textToSpeak, { language: "hi", onEnd: payload.onEnd, skipHistory: true });
        }
      } else {
        // Bilingual mode: Play English warning first, then Hindi warning smoothly
        if (enText && hiText) {
          await speak(enText, { language: "en", skipHistory: true });
          if (cancelSequenceRef.current) return;
          // Brief 350ms pause between English and Hindi alert
          await new Promise((r) => setTimeout(r, 350));
          if (cancelSequenceRef.current) return;
          await speak(hiText, { language: "hi", skipHistory: true });
          if (!cancelSequenceRef.current) {
            payload.onEnd?.();
          }
        } else if (enText) {
          await speak(enText, { language: "en", onEnd: payload.onEnd, skipHistory: true });
        } else if (hiText) {
          await speak(hiText, { language: "hi", onEnd: payload.onEnd, skipHistory: true });
        } else if (fallback) {
          await speak(fallback, { language: "en", onEnd: payload.onEnd, skipHistory: true });
        }
      }
    },
    [muted, languagePreference, stop, speak]
  );

  // Replay last spoken warning or message
  const replayLast = useCallback(() => {
    if (!lastSpokenPayloadRef.current) return;
    const { type, data } = lastSpokenPayloadRef.current;
    if (type === "single") {
      speak(data.text, data.options);
    } else if (type === "alert") {
      speakAlert(data);
    }
  }, [speak, speakAlert]);

  return {
    speak,
    speakAlert,
    stop,
    replayLast,
    unlockAudio,
    languagePreference,
    setLanguagePreference,
    muted,
    setMuted,
    isSpeaking,
    audioUnlocked,
    engine,
  };
}