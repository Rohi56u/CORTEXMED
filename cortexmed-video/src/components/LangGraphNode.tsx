import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export type NodeState = 'waiting' | 'active' | 'success' | 'blocked';

interface LangGraphNodeProps {
  index: number;
  id: string;
  name: string;
  subtitle: string;
  state: NodeState;
  outputSummary?: string;
  delayFrames?: number;
}

export const LangGraphNode: React.FC<LangGraphNodeProps> = ({
  index,
  id,
  name,
  subtitle,
  state = 'waiting',
  outputSummary,
  delayFrames = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const adjustedFrame = Math.max(0, frame - delayFrames);
  const entrySpring = spring({
    frame: adjustedFrame,
    fps,
    config: { damping: 14, stiffness: 100 },
  });

  const stateColors = {
    waiting: { border: '#334155', bg: '#0F172A', text: '#64748B', badgeBg: '#1E293B', glow: 'none' },
    active: {
      border: '#38BDF8',
      bg: '#082F49',
      text: '#E0F2FE',
      badgeBg: '#0284C7',
      glow: '0 0 24px rgba(56, 189, 248, 0.4)',
    },
    success: {
      border: '#10B981',
      bg: '#064E3B',
      text: '#D1FAE5',
      badgeBg: '#059669',
      glow: '0 0 20px rgba(16, 185, 129, 0.35)',
    },
    blocked: {
      border: '#EF4444',
      bg: '#450A0A',
      text: '#FEE2E2',
      badgeBg: '#DC2626',
      glow: '0 0 28px rgba(239, 68, 68, 0.5)',
    },
  }[state];

  // Active pulsing border
  const pulse = state === 'active' ? Math.sin(frame * 0.2) * 0.3 + 0.7 : 1;

  return (
    <div
      style={{
        transform: `scale(${entrySpring}) translateY(${(1 - entrySpring) * 20}px)`,
        opacity: interpolate(adjustedFrame, [0, 8], [0, 1], { extrapolateRight: 'clamp' }),
        backgroundColor: stateColors.bg,
        border: `2px solid ${stateColors.border}`,
        borderRadius: 14,
        padding: '14px 18px',
        boxShadow: stateColors.glow,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minWidth: 210,
        maxWidth: 240,
        transition: 'all 0.2s ease',
      }}
    >
      {/* Step Badge & State */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: 10,
            fontWeight: 800,
            color: '#94A3B8',
            letterSpacing: '0.06em',
          }}
        >
          NODE 0{index}
        </span>
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: 9,
            fontWeight: 800,
            textTransform: 'uppercase',
            padding: '2px 7px',
            borderRadius: 4,
            backgroundColor: stateColors.badgeBg,
            color: '#FFFFFF',
            boxShadow: state === 'blocked' ? '0 0 8px #EF4444' : undefined,
          }}
        >
          {state}
        </span>
      </div>

      {/* Node Name */}
      <div
        style={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: 13,
          fontWeight: 700,
          color: stateColors.text,
          lineHeight: 1.25,
        }}
      >
        {name}
      </div>

      {/* Subtitle / Tech */}
      <div
        style={{
          fontFamily: 'monospace',
          fontSize: 10,
          color: '#94A3B8',
          lineHeight: 1.2,
        }}
      >
        {subtitle}
      </div>

      {/* Output Summary Pill */}
      {outputSummary && (
        <div
          style={{
            marginTop: 4,
            padding: '4px 8px',
            borderRadius: 6,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            border: `1px solid ${stateColors.border}44`,
            fontSize: 10,
            fontFamily: 'monospace',
            color: stateColors.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {outputSummary}
        </div>
      )}
    </div>
  );
};
