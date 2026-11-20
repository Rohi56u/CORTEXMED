import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export const Scene6ArchitectureOutro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoSpring = spring({
    frame,
    fps,
    config: { damping: 13, stiffness: 90 },
  });

  const zoom = interpolate(frame, [0, 150], [1.0, 1.05]);

  const stackItems = [
    { title: 'Next.js 16', desc: 'App Router & Turbopack', color: '#FFFFFF' },
    { title: 'FastAPI & Python 3.12', desc: 'LangGraph 5-Node CDSS', color: '#009688' },
    { title: 'YOLOv8n ONNX', desc: 'Browser-Side Wasm Worker', color: '#10B981' },
    { title: 'OpenCV rPPG', desc: 'Optical Capillary Hemodynamics', color: '#06B6D4' },
    { title: 'Supabase DB', desc: 'Realtime PostgreSQL & RLS', color: '#3ECF8E' },
    { title: 'NIH RxNorm + OpenFDA', desc: 'Clinical Ground Truth SPL', color: '#38BDF8' },
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#060B12',
        color: '#FFFFFF',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `scale(${zoom})`,
      }}
    >
      {/* Background radial glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 50% 40%, rgba(13, 148, 136, 0.25) 0%, #060B12 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Emblem & Brand Title */}
      <div
        style={{
          transform: `scale(${logoSpring})`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <div
          style={{
            width: 90,
            height: 90,
            borderRadius: 24,
            background: 'linear-gradient(135deg, #0D9488 0%, #10B981 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 20px 50px rgba(13, 148, 136, 0.5), 0 0 40px rgba(16, 185, 129, 0.3)',
            marginBottom: 16,
          }}
        >
          <svg
            width="50"
            height="50"
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

        <h1
          style={{
            fontSize: 64,
            fontWeight: 900,
            letterSpacing: '-0.03em',
            margin: 0,
            background: 'linear-gradient(180deg, #FFFFFF 20%, #5EEAD4 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 10px 40px rgba(94, 234, 212, 0.3)',
          }}
        >
          CORTEXMED
        </h1>

        <p
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: '#A7F3D0',
            margin: '8px 0 0 0',
            letterSpacing: '0.02em',
          }}
        >
          Zero-Hardware Spatial Memory & Clinical Safety Guardian
        </p>
      </div>

      {/* Production Hardened Tech Stack Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: 12,
          maxWidth: 1200,
          width: '90%',
          marginTop: 16,
        }}
      >
        {stackItems.map((item, idx) => {
          const itemSpring = spring({
            frame: Math.max(0, frame - 20 - idx * 5),
            fps,
            config: { damping: 14, stiffness: 100 },
          });

          return (
            <div
              key={idx}
              style={{
                transform: `scale(${itemSpring})`,
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 12,
                padding: '12px 10px',
                textAlign: 'center',
                backdropFilter: 'blur(8px)',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, color: item.color }}>{item.title}</div>
              <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#94A3B8', marginTop: 4 }}>
                {item.desc}
              </div>
            </div>
          );
        })}
      </div>

      {/* Closing Call to Action & Verification Badge */}
      <div
        style={{
          marginTop: 36,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            padding: '10px 24px',
            borderRadius: 30,
            background: 'linear-gradient(135deg, #0D9488 0%, #10B981 100%)',
            color: '#FFFFFF',
            fontFamily: 'monospace',
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: '0.08em',
            boxShadow: '0 8px 30px rgba(16, 185, 129, 0.4)',
          }}
        >
          100% REAL CLINICAL EXECUTION &middot; ZERO FAKE DATA
        </div>
        <div style={{ fontSize: 12, color: '#64748B', fontFamily: 'monospace' }}>
          TreeHacks 2026 &middot; Stanford University &middot; Healthcare & Assistive Intelligence
        </div>
      </div>
    </AbsoluteFill>
  );
};
