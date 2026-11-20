import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { SystemHealthBarVideo } from '../components/SystemHealthBarVideo';
import { CardPreview, CardItem } from '../components/CardPreview';

export const Scene2CommandCenter: React.FC = () => {
  const frame = useCurrentFrame();

  // Subtle camera pan & zoom
  const scale = interpolate(frame, [0, 450], [1.0, 1.05]);

  // Card highlight shifts across the scene
  // Frames 0-120: Card 1 (AR Vision HUD)
  // Frames 120-220: Card 2 (Resident Voice)
  // Frames 220-330: Card 3 (Caregiver Dashboard)
  // Frames 330-450: Card 4 (CDSS Console)
  const focusedCardIndex =
    frame < 120 ? 0 : frame < 220 ? 1 : frame < 330 ? 2 : 3;

  const cards: CardItem[] = [
    {
      id: 'stream',
      title: 'AR Vision HUD',
      badge: 'YOLOv8n ONNX',
      description: 'Pill Bottle Verification, Spatial Object Indexing & Contactless rPPG Vitals.',
      gradient: 'linear-gradient(135deg, #0F766E 0%, #115E59 100%)',
      shadowColor: 'rgba(15, 118, 110, 0.4)',
      accentColor: '#2DD4BF',
      route: '/stream',
      iconSvg: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      ),
    },
    {
      id: 'device',
      title: 'Resident Voice',
      badge: 'Bilingual AI',
      description: 'Bilingual (English / हिन्दी) voice assistant with real MCP tools & PII redaction.',
      gradient: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
      shadowColor: 'rgba(5, 150, 105, 0.4)',
      accentColor: '#34D399',
      route: '/device',
      iconSvg: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      id: 'dashboard',
      title: 'Clinical Command',
      badge: 'Caregiver Portal',
      description: 'Realtime safety alerts, prescriptions, contactless vitals telemetry & spatial memory.',
      gradient: 'linear-gradient(135deg, #334155 0%, #1E293B 100%)',
      shadowColor: 'rgba(30, 41, 59, 0.5)',
      accentColor: '#94A3B8',
      route: '/dashboard',
      iconSvg: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="9" rx="1" />
          <rect x="14" y="3" width="7" height="5" rx="1" />
          <rect x="14" y="12" width="7" height="9" rx="1" />
          <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
      ),
    },
    {
      id: 'cdss',
      title: 'Clinical Decision Support',
      badge: 'LangGraph CDSS',
      description: 'Realtime LangGraph safety guardrails, NIH RxNorm normalization & OpenFDA check.',
      gradient: 'linear-gradient(135deg, #0E7490 0%, #0F172A 100%)',
      shadowColor: 'rgba(14, 116, 144, 0.4)',
      accentColor: '#38BDF8',
      route: '/cdss',
      iconSvg: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      ),
    },
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#F4F6F5',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '30px 60px',
        transform: `scale(${scale})`,
      }}
    >
      {/* Background Soft Blobs */}
      <div
        style={{
          position: 'absolute',
          top: -100,
          right: -100,
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(204, 251, 241, 0.6) 0%, transparent 70%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -100,
          left: -100,
          width: 450,
          height: 450,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(209, 250, 229, 0.5) 0%, transparent 70%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />

      {/* Top Header Logo + Brand */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #0D9488 0%, #10B981 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(13, 148, 136, 0.3)',
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2a3 3 0 0 0-3 3v1a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10H5a2 2 0 0 0-2 2v1a8 8 0 0 0 8 8h2a8 8 0 0 0 8-8v-1a2 2 0 0 0-2-2Z" />
              <path d="M12 18v4" />
              <path d="M8 22h8" />
            </svg>
          </div>
          <span
            style={{
              fontSize: 38,
              fontWeight: 900,
              color: '#0F172A',
              letterSpacing: '-0.02em',
            }}
          >
            CortexMed Command Center
          </span>
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: 12,
              fontWeight: 700,
              padding: '4px 10px',
              backgroundColor: '#E2E8F0',
              borderRadius: 6,
              color: '#475569',
            }}
          >
            localhost:3000
          </span>
        </div>
        <p
          style={{
            fontSize: 15,
            color: '#64748B',
            margin: 0,
            maxWidth: 700,
            textAlign: 'center',
          }}
        >
          Intelligent multimodal clinical care platform for assisted living facilities. Real-time vision safety guardrails and clinical decision support.
        </p>
      </div>

      {/* Live Zero-Mock System Health Bar */}
      <div style={{ width: '100%', maxWidth: 1100, marginBottom: 24 }}>
        <SystemHealthBarVideo />
      </div>

      {/* 4 Core Navigation Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          width: '100%',
          maxWidth: 1100,
        }}
      >
        {cards.map((card, idx) => (
          <CardPreview
            key={card.id}
            card={card}
            index={idx}
            isFocused={focusedCardIndex === idx}
          />
        ))}
      </div>

      {/* Live Telemetry Ticker Bottom */}
      <div
        style={{
          marginTop: 18,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          fontFamily: 'monospace',
          fontSize: 11,
          color: '#64748B',
        }}
      >
        <span>&bull; REALTIME WEBSOCKET: 30 FPS</span>
        <span>&bull; BROWSER ONNX WASM: ACTIVE</span>
        <span>&bull; FASTAPI CDSS: 0 MOCKS</span>
        <span>&bull; HIPAA/PII ENCRYPTED VAULT: ENFORCED</span>
      </div>
    </AbsoluteFill>
  );
};
