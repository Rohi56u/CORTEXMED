import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';

interface AudioWaveformProps {
  width?: number;
  height?: number;
  activeLanguage?: 'en' | 'hi';
  transcriptText?: string;
  warningLevel?: 'critical' | 'caution' | 'normal';
  isActive?: boolean;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  width = 680,
  height = 90,
  activeLanguage = 'en',
  transcriptText = 'Critical warning: Advil interacts dangerously with Coumadin. High hemorrhage risk.',
  warningLevel = 'critical',
  isActive = true,
}) => {
  const frame = useCurrentFrame();

  const numBars = 48;
  const barWidth = 6;
  const gap = (width - numBars * barWidth) / (numBars - 1);

  const primaryColor =
    warningLevel === 'critical' ? '#EF4444' : warningLevel === 'caution' ? '#F59E0B' : '#10B981';

  return (
    <div
      style={{
        width,
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        borderRadius: 14,
        border: `1px solid ${primaryColor}55`,
        padding: '14px 18px',
        boxShadow: `0 8px 30px rgba(0, 0, 0, 0.6), 0 0 20px ${primaryColor}22`,
        backdropFilter: 'blur(10px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: primaryColor,
              boxShadow: `0 0 10px ${primaryColor}`,
            }}
          />
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: 11,
              fontWeight: 800,
              color: '#F1F5F9',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Bilingual Voice Synthesizer · Calm Cadence
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <span
            style={{
              fontSize: 10,
              fontFamily: 'monospace',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 4,
              backgroundColor: activeLanguage === 'en' ? `${primaryColor}33` : 'rgba(255,255,255,0.05)',
              color: activeLanguage === 'en' ? primaryColor : '#94A3B8',
              border: `1px solid ${activeLanguage === 'en' ? primaryColor : 'transparent'}`,
            }}
          >
            EN (English)
          </span>
          <span
            style={{
              fontSize: 10,
              fontFamily: 'monospace',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 4,
              backgroundColor: activeLanguage === 'hi' ? `${primaryColor}33` : 'rgba(255,255,255,0.05)',
              color: activeLanguage === 'hi' ? primaryColor : '#94A3B8',
              border: `1px solid ${activeLanguage === 'hi' ? primaryColor : 'transparent'}`,
            }}
          >
            HI (हिन्दी)
          </span>
        </div>
      </div>

      {/* Waveform Bar Graphic */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 48,
          gap: 2,
        }}
      >
        {Array.from({ length: numBars }).map((_, i) => {
          // Dynamic frequency calculation
          const offset = i * 0.18;
          let barHeight = 4;
          if (isActive) {
            const wave1 = Math.sin(frame * 0.32 + offset);
            const wave2 = Math.cos(frame * 0.21 - offset * 1.4);
            const wave3 = Math.sin((frame + i * 2) * 0.15);
            const rawHeight = Math.abs(wave1 * 0.5 + wave2 * 0.3 + wave3 * 0.2);
            barHeight = Math.max(6, rawHeight * 44);
          } else {
            // Standby gentle breathing ripple
            barHeight = Math.max(3, 4 + Math.sin(frame * 0.1 + offset) * 2);
          }

          return (
            <div
              key={i}
              style={{
                width: barWidth,
                height: barHeight,
                borderRadius: 3,
                background: isActive
                  ? `linear-gradient(180deg, ${primaryColor}, ${primaryColor}66)`
                  : 'rgba(148, 163, 184, 0.3)',
                boxShadow: isActive ? `0 0 6px ${primaryColor}55` : 'none',
              }}
            />
          );
        })}
      </div>

      {/* Live Audio Transcript Subtitle */}
      <div
        style={{
          fontFamily: 'system-ui, sans-serif',
          fontSize: 13,
          fontWeight: 600,
          color: '#E2E8F0',
          lineHeight: 1.4,
          backgroundColor: 'rgba(0, 0, 0, 0.35)',
          padding: '6px 10px',
          borderRadius: 6,
          borderLeft: `3px solid ${primaryColor}`,
        }}
      >
        {transcriptText}
      </div>
    </div>
  );
};
