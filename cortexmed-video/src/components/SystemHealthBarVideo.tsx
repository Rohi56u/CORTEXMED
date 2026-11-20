import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export const SystemHealthBarVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 100 },
  });

  const pulse = Math.sin(frame * 0.15) * 0.25 + 0.75;

  return (
    <div
      style={{
        transform: `scale(${scale})`,
        width: '100%',
        maxWidth: 1080,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        border: '1px solid rgba(226, 232, 240, 0.9)',
        borderRadius: 20,
        padding: '20px 28px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05)',
        backdropFilter: 'blur(16px)',
      }}
    >
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: '#CCFBF1',
              border: '1px solid #99F6E4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0D9488"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  fontWeight: 800,
                  fontSize: 16,
                  color: '#0F172A',
                  fontFamily: 'system-ui, sans-serif',
                }}
              >
                CortexMed End-to-End System Readiness
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: 20,
                  backgroundColor: '#ECFDF5',
                  color: '#047857',
                  border: '1px solid #A7F3D0',
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    backgroundColor: '#10B981',
                    opacity: pulse,
                  }}
                />
                All Services Operational
              </span>
            </div>
            <p
              style={{
                fontSize: 12,
                color: '#64748B',
                margin: '2px 0 0 0',
                fontFamily: 'monospace',
              }}
            >
              Live zero-mock health check · Polling 10s · Latency 24ms
            </p>
          </div>
        </div>

        <div
          style={{
            fontFamily: 'monospace',
            fontSize: 11,
            color: '#0D9488',
            backgroundColor: '#F0FDFA',
            padding: '4px 10px',
            borderRadius: 8,
            border: '1px solid #CCFBF1',
            fontWeight: 700,
          }}
        >
          v2.4.0-PROD
        </div>
      </div>

      {/* 4 Service Status Badges */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {/* Service 1 */}
        <div
          style={{
            padding: '12px 14px',
            backgroundColor: '#F8FAFC',
            borderRadius: 12,
            border: '1px solid #E2E8F0',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>Frontend Engine</span>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: '#10B981',
              }}
            />
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginTop: 4 }}>
            Next.js 16.1 (App)
          </div>
          <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#10B981', marginTop: 2 }}>
            Turbopack &middot; 30 FPS
          </div>
        </div>

        {/* Service 2 */}
        <div
          style={{
            padding: '12px 14px',
            backgroundColor: '#F8FAFC',
            borderRadius: 12,
            border: '1px solid #E2E8F0',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>Edge CV Model</span>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: '#10B981',
              }}
            />
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginTop: 4 }}>
            YOLOv8n ONNX
          </div>
          <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#10B981', marginTop: 2 }}>
            12.2 MB Wasm Ready
          </div>
        </div>

        {/* Service 3 */}
        <div
          style={{
            padding: '12px 14px',
            backgroundColor: '#F8FAFC',
            borderRadius: 12,
            border: '1px solid #E2E8F0',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>CDSS Backend</span>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: '#10B981',
              }}
            />
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginTop: 4 }}>
            FastAPI :8000
          </div>
          <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#10B981', marginTop: 2 }}>
            LangGraph + RxNorm
          </div>
        </div>

        {/* Service 4 */}
        <div
          style={{
            padding: '12px 14px',
            backgroundColor: '#F8FAFC',
            borderRadius: 12,
            border: '1px solid #E2E8F0',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>Cloud Telemetry</span>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: '#10B981',
              }}
            />
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginTop: 4 }}>
            Supabase DB
          </div>
          <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#10B981', marginTop: 2 }}>
            Realtime Audit Vault
          </div>
        </div>
      </div>
    </div>
  );
};
