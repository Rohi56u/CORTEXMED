import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export interface CardItem {
  id: string;
  title: string;
  badge: string;
  description: string;
  gradient: string;
  shadowColor: string;
  accentColor: string;
  iconSvg: React.ReactNode;
  route: string;
}

interface CardPreviewProps {
  card: CardItem;
  index: number;
  isFocused?: boolean;
}

export const CardPreview: React.FC<CardPreviewProps> = ({ card, index, isFocused = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Stagger entry by index
  const entryFrame = Math.max(0, frame - index * 6);
  const cardSpring = spring({
    frame: entryFrame,
    fps,
    config: { damping: 13, stiffness: 90 },
  });

  const focusScale = isFocused ? 1.05 : 1.0;
  const opacity = interpolate(entryFrame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div
      style={{
        transform: `scale(${cardSpring * focusScale}) translateY(${(1 - cardSpring) * 35}px)`,
        opacity,
        background: card.gradient,
        borderRadius: 20,
        padding: '24px 22px',
        color: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: 280,
        boxShadow: isFocused
          ? `0 24px 48px ${card.shadowColor}, 0 0 24px ${card.accentColor}88`
          : `0 12px 28px ${card.shadowColor}`,
        position: 'relative',
        overflow: 'hidden',
        border: isFocused ? `2px solid ${card.accentColor}` : '1px solid rgba(255, 255, 255, 0.15)',
      }}
    >
      {/* Background radial glow */}
      <div
        style={{
          position: 'absolute',
          top: -20,
          right: -20,
          width: 100,
          height: 100,
          borderRadius: '50%',
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          pointerEvents: 'none',
        }}
      />

      {/* Top portion */}
      <div>
        {/* Icon & Badge */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: 'rgba(255, 255, 255, 0.14)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(8px)',
            }}
          >
            {card.iconSvg}
          </div>
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: 10,
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: 6,
              backgroundColor: 'rgba(255, 255, 255, 0.16)',
              color: '#FFFFFF',
              letterSpacing: '0.05em',
            }}
          >
            {card.badge}
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: 20,
            fontWeight: 800,
            lineHeight: 1.25,
            marginBottom: 8,
          }}
        >
          {card.title}
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.45,
            color: 'rgba(255, 255, 255, 0.85)',
          }}
        >
          {card.description}
        </div>
      </div>

      {/* Footer link button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 12,
          borderTop: '1px solid rgba(255, 255, 255, 0.15)',
        }}
      >
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: 11,
            fontWeight: 700,
            color: card.accentColor,
          }}
        >
          {card.route}
        </span>
        <span
          style={{
            fontFamily: 'system-ui, sans-serif',
            fontSize: 12,
            fontWeight: 700,
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          Launch &rarr;
        </span>
      </div>
    </div>
  );
};
