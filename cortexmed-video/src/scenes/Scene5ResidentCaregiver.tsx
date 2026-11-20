import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export const Scene5ResidentCaregiver: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Subtle camera drift
  const zoom = interpolate(frame, [0, 450], [1.0, 1.04]);

  // Mic pulse spring
  const micPulse = Math.sin(frame * 0.2) * 0.15 + 0.85;

  // Caregiver alert badge blink
  const alertBlink = Math.sin(frame * 0.3) > 0;

  // Stagger entry
  const leftSpring = spring({ frame, fps, config: { damping: 14, stiffness: 90 } });
  const rightSpring = spring({
    frame: Math.max(0, frame - 15),
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  // Stagger conversational dialogue bubbles
  const residentBubbleSpring = spring({
    frame: Math.max(0, frame - 15),
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  const companionBubbleSpring = spring({
    frame: Math.max(0, frame - 95),
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#090E17',
        color: '#FFFFFF',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        overflow: 'hidden',
        padding: '28px 48px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transform: `scale(${zoom})`,
      }}
    >
      {/* Background Ambient Glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(circle at 25% 40%, rgba(16, 185, 129, 0.1) 0%, transparent 50%), radial-gradient(circle at 75% 60%, rgba(59, 130, 246, 0.1) 0%, transparent 50%)',
          pointerEvents: 'none',
        }}
      />

      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          paddingBottom: 14,
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              backgroundColor: '#047857',
              fontFamily: 'monospace',
              fontSize: 12,
              fontWeight: 800,
              color: '#FFFFFF',
            }}
          >
            CARE ECOSYSTEM
          </div>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>
              Resident Companion & Caregiver Telemetry Command
            </h2>
            <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#94A3B8', marginTop: 2 }}>
              http://localhost:3000/device &middot; http://localhost:3000/dashboard
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: 11,
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid #10B981',
              color: '#6EE7B7',
              padding: '4px 10px',
              borderRadius: 6,
            }}
          >
            PATIENT: MARGARET CHEN
          </span>
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: 11,
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid #3B82F6',
              color: '#93C5FD',
              padding: '4px 10px',
              borderRadius: 6,
            }}
          >
            ROOM 204 &middot; ASSISTED LIVING
          </span>
        </div>
      </div>

      {/* Main Split Screen: Left = Resident Voice Companion, Right = Caregiver Telemetry */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.25fr',
          gap: 28,
          margin: '16px 0',
          position: 'relative',
          zIndex: 5,
        }}
      >
        {/* LEFT COLUMN: Resident Companion (/device) */}
        <div
          style={{
            transform: `scale(${leftSpring})`,
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            borderRadius: 20,
            padding: '24px 26px',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: 520,
          }}
        >
          {/* Header */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    backgroundColor: '#064E3B',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #10B981',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#F1F5F9' }}>
                    Resident Voice Companion
                  </div>
                  <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#34D399' }}>
                    Bilingual AI &middot; Spatial Memory Agent
                  </div>
                </div>
              </div>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: 10,
                  color: '#6EE7B7',
                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                  padding: '3px 8px',
                  borderRadius: 6,
                }}
              >
                MCP LINKED
              </span>
            </div>

            {/* Simulated Chat Dialogue */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 24 }}>
              {/* Resident Bubble */}
              <div
                style={{
                  transform: `scale(${residentBubbleSpring}) translateY(${(1 - residentBubbleSpring) * 16}px)`,
                  opacity: interpolate(Math.max(0, frame - 15), [0, 10], [0, 1], { extrapolateRight: 'clamp' }),
                  alignSelf: 'flex-end',
                  backgroundColor: '#047857',
                  color: '#FFFFFF',
                  borderRadius: '16px 16px 4px 16px',
                  padding: '12px 18px',
                  maxWidth: '85%',
                  boxShadow: '0 4px 12px rgba(4, 120, 87, 0.3)',
                }}
              >
                <div style={{ fontSize: 11, fontFamily: 'monospace', opacity: 0.8, marginBottom: 2 }}>
                  Margaret Chen (Resident)
                </div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  &ldquo;Where did I put my reading glasses?&rdquo;
                </div>
                <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
                  &ldquo;मेरा चश्मा कहाँ है?&rdquo;
                </div>
              </div>

              {/* CortexMed Companion Response Bubble */}
              <div
                style={{
                  transform: `scale(${companionBubbleSpring}) translateY(${(1 - companionBubbleSpring) * 16}px)`,
                  opacity: interpolate(Math.max(0, frame - 95), [0, 10], [0, 1], { extrapolateRight: 'clamp' }),
                  alignSelf: 'flex-start',
                  backgroundColor: '#1E293B',
                  border: '1px solid #334155',
                  color: '#F8FAFC',
                  borderRadius: '16px 16px 16px 4px',
                  padding: '14px 18px',
                  maxWidth: '92%',
                }}
              >
                <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#38BDF8', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#38BDF8' }} />
                  CortexMed Spatial Agent (MCP Verified)
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.45 }}>
                  &ldquo;Margaret, your reading glasses were indexed <strong>14 minutes ago</strong> on the <strong>living room side table next to the lamp</strong>.&rdquo;
                </div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>
                  &ldquo;मार्गरेट, आपका चश्मा 14 मिनट पहले लिविंग रूम की साइड टेबल पर देखा गया था।&rdquo;
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Mic Button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
                boxShadow: `0 0 30px rgba(16, 185, 129, ${micPulse})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #6EE7B7',
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#E2E8F0' }}>
                Tap to Speak &middot; बोलें
              </div>
              <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#6EE7B7' }}>
                Streaming STT + PII Scrubber Active
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Caregiver Telemetry Dashboard (/dashboard) */}
        <div
          style={{
            transform: `scale(${rightSpring})`,
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid rgba(59, 130, 246, 0.35)',
            borderRadius: 20,
            padding: '24px 26px',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: 520,
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: '#1E3A8A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #3B82F6',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="9" rx="1" />
                  <rect x="14" y="3" width="7" height="5" rx="1" />
                  <rect x="14" y="12" width="7" height="9" rx="1" />
                  <rect x="3" y="16" width="7" height="5" rx="1" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#F1F5F9' }}>
                  Caregiver Clinical Command
                </div>
                <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#60A5FA' }}>
                  Supabase Realtime Telemetry & Audit Vault
                </div>
              </div>
            </div>

            <div
              style={{
                fontFamily: 'monospace',
                fontSize: 10,
                color: '#EF4444',
                backgroundColor: alertBlink ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.1)',
                border: '1px solid #EF4444',
                padding: '3px 8px',
                borderRadius: 6,
                fontWeight: 800,
              }}
            >
              1 CRITICAL ALERT ESCALATED
            </div>
          </div>

          {/* Realtime Safety Alert Card */}
          <div
            style={{
              backgroundColor: '#450A0A',
              border: '1px solid #EF4444',
              borderRadius: 12,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              margin: '8px 0',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: '#FCA5A5' }}>
                  [CRITICAL_BLOCK] Margaret Chen reached for Ibuprofen (Advil)
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#FEE2E2', marginTop: 2 }}>
                Interacts with Coumadin 5mg. Caregiver voice warning delivered. Dispensation blocked.
              </div>
            </div>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: 10,
                color: '#FFFFFF',
                backgroundColor: '#DC2626',
                padding: '4px 8px',
                borderRadius: 6,
                fontWeight: 700,
              }}
            >
              RESOLVED
            </span>
          </div>

          {/* Historical Vitals Trendline SVG */}
          <div
            style={{
              backgroundColor: '#0F172A',
              border: '1px solid #1E293B',
              borderRadius: 12,
              padding: '12px 16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#94A3B8', fontWeight: 800 }}>
                24-HOUR CONTACTLESS VITALS TELEMETRY
              </span>
              <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#10B981', fontWeight: 700 }}>
                CURRENT: 72.0 BPM (STABLE)
              </span>
            </div>

            {/* SVG Trendline */}
            <svg width="100%" height="60" viewBox="0 0 500 60" style={{ overflow: 'visible' }}>
              <path
                d="M 0 35 L 50 32 L 100 36 L 150 28 L 200 34 L 250 30 L 300 33 L 350 29 L 400 32 L 450 30 L 500 31"
                fill="none"
                stroke="#10B981"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx="500" cy="31" r={3.5 + Math.sin(frame * 0.25) * 1.5} fill="#34D399" />
            </svg>
          </div>

          {/* Spatial Memory Registry Table */}
          <div
            style={{
              backgroundColor: '#0F172A',
              border: '1px solid #1E293B',
              borderRadius: 12,
              padding: '10px 14px',
            }}
          >
            <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#94A3B8', fontWeight: 800, marginBottom: 6 }}>
              ACTIVE SPATIAL MEMORY OBJECTS
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: 11 }}>
              <div style={{ backgroundColor: '#1E293B', padding: '6px 8px', borderRadius: 6 }}>
                <div style={{ fontWeight: 700, color: '#E2E8F0' }}>Reading Glasses</div>
                <div style={{ color: '#38BDF8', fontSize: 10 }}>Living Room Table</div>
              </div>
              <div style={{ backgroundColor: '#1E293B', padding: '6px 8px', borderRadius: 6 }}>
                <div style={{ fontWeight: 700, color: '#E2E8F0' }}>Coumadin 5mg</div>
                <div style={{ color: '#10B981', fontSize: 10 }}>Bathroom Shelf 2</div>
              </div>
              <div style={{ backgroundColor: '#1E293B', padding: '6px 8px', borderRadius: 6 }}>
                <div style={{ fontWeight: 700, color: '#E2E8F0' }}>Walking Cane</div>
                <div style={{ color: '#F59E0B', fontSize: 10 }}>Foyer Entrance</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Status */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontFamily: 'monospace',
          fontSize: 11,
          color: '#64748B',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          paddingTop: 10,
        }}
      >
        <span>&bull; REALTIME PG NOTIFY WEBSOCKET: CONNECTED</span>
        <span>&bull; LATENCY FROM BOTTLE SCAN TO NURSE ALERT: 142MS</span>
        <span>&bull; ZERO-MOCK TELEMETRY RECORDED IN POSTGRESQL</span>
      </div>
    </AbsoluteFill>
  );
};
