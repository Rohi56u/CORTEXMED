import Link from "next/link";
import SystemHealthBar from "./components/SystemHealthBar";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-between p-6 sm:p-10 gap-10 bg-[#f4f6f5] relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-teal-100/40 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-emerald-100/30 to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Logo + Brand */}
      <div className="text-center relative z-10 pt-4">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-500 mb-6 shadow-xl shadow-teal-500/20">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2a3 3 0 0 0-3 3v1a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10H5a2 2 0 0 0-2 2v1a8 8 0 0 0 8 8h2a8 8 0 0 0 8-8v-1a2 2 0 0 0-2-2Z" />
            <path d="M12 18v4" />
            <path d="M8 22h8" />
          </svg>
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground font-display">
          CortexMed
        </h1>
        <p className="text-base sm:text-lg mt-3 text-muted max-w-xl mx-auto leading-relaxed">
          Intelligent multimodal clinical care platform for assisted living facilities. Real-time vision safety guardrails, bilingual patient companion, and clinical decision support.
        </p>
      </div>

      {/* Live System Readiness Aggregator */}
      <div className="w-full max-w-4xl relative z-10">
        <SystemHealthBar />
      </div>

      {/* 4 Core Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-5xl relative z-10">
        {/* 1. AR Vision HUD */}
        <Link
          href="/stream"
          className="group relative overflow-hidden rounded-2xl p-6 text-white transition-all duration-300 hover:scale-[1.02] hover:shadow-xl bg-gradient-to-br from-teal-700 to-teal-800 shadow-lg shadow-teal-700/20 flex flex-col justify-between"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/15 to-transparent" />
          <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-white/5" />
          <div className="relative z-10">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-4">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
            <div className="text-lg font-bold">AR Vision HUD</div>
            <div className="text-xs mt-1 text-teal-100/80 leading-relaxed">
              YOLOv8n Pill Bottle Verification, Spatial Object Indexing & Contactless rPPG Vitals.
            </div>
          </div>
          <div className="relative z-10 mt-4 text-[11px] font-mono text-teal-200/90 font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
            Launch HUD &rarr;
          </div>
        </Link>

        {/* 2. Resident Voice Companion */}
        <Link
          href="/device"
          className="group relative overflow-hidden rounded-2xl p-6 text-white transition-all duration-300 hover:scale-[1.02] hover:shadow-xl bg-gradient-to-br from-emerald-600 to-teal-700 shadow-lg shadow-emerald-600/20 flex flex-col justify-between"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/15 to-transparent" />
          <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-white/5" />
          <div className="relative z-10">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-4">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className="text-lg font-bold">Resident Voice</div>
            <div className="text-xs mt-1 text-emerald-100/80 leading-relaxed">
              Bilingual (English / हिन्दी) voice assistant with real MCP tools & PII redaction.
            </div>
          </div>
          <div className="relative z-10 mt-4 text-[11px] font-mono text-emerald-200/90 font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
            Open Companion &rarr;
          </div>
        </Link>

        {/* 3. Caregiver Dashboard */}
        <Link
          href="/dashboard"
          className="group relative overflow-hidden rounded-2xl p-6 text-white transition-all duration-300 hover:scale-[1.02] hover:shadow-xl bg-gradient-to-br from-slate-700 to-slate-800 shadow-lg shadow-slate-700/20 flex flex-col justify-between"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/15 to-transparent" />
          <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-white/5" />
          <div className="relative z-10">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-4">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="9" rx="1" />
                <rect x="14" y="3" width="7" height="5" rx="1" />
                <rect x="14" y="12" width="7" height="9" rx="1" />
                <rect x="3" y="16" width="7" height="5" rx="1" />
              </svg>
            </div>
            <div className="text-lg font-bold">Clinical Command</div>
            <div className="text-xs mt-1 text-slate-300/80 leading-relaxed">
              Realtime safety alerts, prescriptions, contactless vitals telemetry & spatial memory.
            </div>
          </div>
          <div className="relative z-10 mt-4 text-[11px] font-mono text-slate-300 font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
            Open Dashboard &rarr;
          </div>
        </Link>

        {/* 4. Clinical Decision Support (CDSS) */}
        <Link
          href="/cdss"
          className="group relative overflow-hidden rounded-2xl p-6 text-white transition-all duration-300 hover:scale-[1.02] hover:shadow-xl bg-gradient-to-br from-cyan-700 to-slate-800 shadow-lg shadow-cyan-700/20 flex flex-col justify-between"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/15 to-transparent" />
          <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-white/5" />
          <div className="relative z-10">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-4">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <div className="text-lg font-bold">Clinical Decision Support (CDSS)</div>
            <div className="text-xs mt-1 text-cyan-100/80 leading-relaxed">
              Realtime LangGraph safety guardrails, NIH RxNorm normalization & live OpenFDA drug interaction verification.
            </div>
          </div>
          <div className="relative z-10 mt-4 text-[11px] font-mono text-cyan-200 font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
            Launch CDSS Console &rarr;
          </div>
        </Link>
      </div>

      {/* Footer */}
      <footer className="text-xs text-muted-foreground font-medium relative z-10 text-center pb-2">
        CortexMed Platform &middot; Production Hardened Clinical Intelligence &middot; 100% Real Execution
      </footer>
    </div>
  );
}
