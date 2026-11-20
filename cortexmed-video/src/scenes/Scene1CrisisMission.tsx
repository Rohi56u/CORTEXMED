import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export const Scene1CrisisMission: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase 1 (0-220 frames): The Eldercare Crisis
  // Phase 2 (220-450 frames): CortexMed Brand Reveal & Mission

  const phase1Opacity = interpolate(frame, [0, 20, 200, 225], [0, 1, 1, 0], {
    extrapolateRight: 'clamp',
  });

  const phase2Opacity = interpolate(frame, [220, 245], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const card1Spring = spring({
    frame: Math.max(0, frame - 20),
    fps,
    config: { damping: 14, stiffness: 90 },
  });
  const card2Spring = spring({
    frame: Math.max(0, frame - 35),
    fps,
    config: { damping: 14, stiffness: 90 },
  });
  const card3Spring = spring({
    frame: Math.max(0, frame - 50),
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  const logoScale = spring({
    frame: Math.max(0, frame - 225),
    fps,
    config: { damping: 12, stiffness: 80 },
  });

  // Camera pan scale
  const zoom = interpolate(frame, [0, 450], [1.0, 1.06]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#070C14',
        color: '#FFFFFF',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        overflow: 'hidden',
        transform: `scale(${zoom})`,
      }}
    >
      {/* Dynamic Background Grid & Ambient Glows */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(circle at 50% 30%, rgba(13, 148, 136, 0.15) 0%, transparent 60%), radial-gradient(circle at 80% 80%, rgba(56, 189, 248, 0.08) 0%, transparent 50%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          opacity: 0.7,
        }}
      />

      {/* PHASE 1: The Crisis (Frames 0 - 220) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: phase1Opacity,
          padding: '0 80px',
        }}
      >
        {/* Urgent Warning Eyebrow */}
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: 14,
            fontWeight: 800,
            color: '#F87171',
            letterSpacing: '0.15em',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            padding: '6px 18px',
            borderRadius: 30,
            marginBottom: 24,
            textTransform: 'uppercase',
          }}
        >
          CRITICAL ASSISTED LIVING CHALLENGE
        </div>

        {/* Main Headline */}
        <h1
          style={{
            fontSize: 60,
            fontWeight: 900,
            textAlign: 'center',
            lineHeight: 1.15,
            maxWidth: 1200,
            letterSpacing: '-0.02em',
            margin: '0 0 20px 0',
            background: 'linear-gradient(180deg, #FFFFFF 0%, #94A3B8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Dementia Care Faces a Compounding Crisis:
          <br />
          <span style={{ color: '#F87171', WebkitTextFillColor: '#F87171' }}>
            Lost Memory & Preventable Drug Lethality
          </span>
        </h1>

        <p
          style={{
            fontSize: 22,
            color: '#94A3B8',
            textAlign: 'center',
            maxWidth: 880,
            lineHeight: 1.5,
            marginBottom: 48,
          }}
        >
          Every day, elderly residents with cognitive decline face severe adverse drug interactions
          and spatial disorientation without real-time vision safety guardrails.
        </p>

        {/* 3 Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 28, width: '100%', maxWidth: 1100 }}>
          {/* Metric 1 */}
          <div
            style={{
              transform: `scale(${card1Spring}) translateY(${(1 - card1Spring) * 24}px)`,
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 16,
              padding: '24px 20px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontFamily: 'monospace', fontSize: 44, fontWeight: 900, color: '#EF4444' }}>
              50%
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9', marginTop: 4 }}>
              Medication Non-Adherence
            </div>
            <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 4 }}>
              Leading to 125,000 preventable deaths annually
            </div>
          </div>

          {/* Metric 2 */}
          <div
            style={{
              transform: `scale(${card2Spring}) translateY(${(1 - card2Spring) * 24}px)`,
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 16,
              padding: '24px 20px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontFamily: 'monospace', fontSize: 44, fontWeight: 900, color: '#F59E0B' }}>
              60%
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9', marginTop: 4 }}>
              Spatial Disorientation
            </div>
            <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 4 }}>
              Critical objects & medications lost daily
            </div>
          </div>

          {/* Metric 3 */}
          <div
            style={{
              transform: `scale(${card3Spring}) translateY(${(1 - card3Spring) * 24}px)`,
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: 16,
              padding: '24px 20px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontFamily: 'monospace', fontSize: 44, fontWeight: 900, color: '#38BDF8' }}>
              $528B
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9', marginTop: 4 }}>
              Annual Economic Cost
            </div>
            <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 4 }}>
              Of uncoordinated geriatric prescriptions
            </div>
          </div>
        </div>
      </div>

      {/* PHASE 2: CortexMed Brand Reveal (Frames 220 - 450) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: phase2Opacity,
          padding: '0 60px',
        }}
      >
        {/* Brand Emblem */}
        <div
          style={{
            transform: `scale(${logoScale})`,
            width: 110,
            height: 110,
            borderRadius: 28,
            background: 'linear-gradient(135deg, #0D9488 0%, #10B981 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 20px 60px rgba(13, 148, 136, 0.5), 0 0 40px rgba(16, 185, 129, 0.3)',
            marginBottom: 28,
          }}
        >
          <svg
            width="60"
            height="60"
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

        {/* Title */}
        <h1
          style={{
            fontSize: 78,
            fontWeight: 900,
            letterSpacing: '-0.03em',
            margin: '0 0 16px 0',
            background: 'linear-gradient(180deg, #FFFFFF 30%, #5EEAD4 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 10px 40px rgba(94, 234, 212, 0.3)',
          }}
        >
          CORTEXMED
        </h1>

        {/* Mission Statement */}
        <div
          style={{
            fontFamily: 'system-ui, sans-serif',
            fontSize: 28,
            fontWeight: 700,
            color: '#A7F3D0',
            textAlign: 'center',
            maxWidth: 1000,
            lineHeight: 1.35,
            marginBottom: 20,
          }}
        >
          Zero-Hardware Browser-First 3D Spatial Memory
          <br />
          & Real-Time Clinical Medication Guardian
        </div>

        <p
          style={{
            fontSize: 19,
            color: '#94A3B8',
            textAlign: 'center',
            maxWidth: 820,
            lineHeight: 1.5,
          }}
        >
          Transforming standard webcams and browsers into clinical-grade safety guardians with
          on-device YOLOv8n, contactless optical hemodynamics, and deterministic LangGraph CDSS.
        </p>

        {/* 3 Value Pillars */}
        <div
          style={{
            display: 'flex',
            gap: 20,
            marginTop: 36,
          }}
        >
          <span
            style={{
              padding: '8px 18px',
              borderRadius: 30,
              backgroundColor: 'rgba(13, 148, 136, 0.15)',
              border: '1px solid #14B8A6',
              color: '#5EEAD4',
              fontFamily: 'monospace',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            100% REAL ZERO-MOCK EXECUTION
          </span>
          <span
            style={{
              padding: '8px 18px',
              borderRadius: 30,
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid #38BDF8',
              color: '#7DD3FC',
              fontFamily: 'monospace',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            NIH RXNORM & OPENFDA LINKED
          </span>
          <span
            style={{
              padding: '8px 18px',
              borderRadius: 30,
              backgroundColor: 'rgba(168, 85, 247, 0.15)',
              border: '1px solid #C084FC',
              color: '#E9D5FF',
              fontFamily: 'monospace',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            BILINGUAL ENGLISH / हिन्दी
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
