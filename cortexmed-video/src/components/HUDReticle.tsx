import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

interface HUDReticleProps {
  label?: string;
  confidence?: number;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  showCropPreview?: boolean;
}

export const HUDReticle: React.FC<HUDReticleProps> = ({
  label = 'Medicine Bottle (Coumadin 5mg)',
  confidence = 0.94,
  width = 340,
  height = 420,
  x = 0,
  y = 0,
  showCropPreview = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Spring lock animation
  const lockSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  // Corner bracket expansion to target size
  const bracketSize = 28;
  const currentWidth = interpolate(lockSpring, [0, 1], [width + 60, width]);
  const currentHeight = interpolate(lockSpring, [0, 1], [height + 60, height]);
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  // Pulsing scanline & glow
  const pulse = Math.sin(frame * 0.12) * 0.2 + 0.8;
  const scanlineY = (frame * 6) % currentHeight;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: currentWidth,
        height: currentHeight,
        opacity,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
      }}
    >
      {/* 4 Corner L-Brackets */}
      {/* Top Left */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: bracketSize,
          height: bracketSize,
          borderTop: '3px solid #10B981',
          borderLeft: '3px solid #10B981',
          boxShadow: '0 0 12px rgba(16, 185, 129, 0.6)',
        }}
      />
      {/* Top Right */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: bracketSize,
          height: bracketSize,
          borderTop: '3px solid #10B981',
          borderRight: '3px solid #10B981',
          boxShadow: '0 0 12px rgba(16, 185, 129, 0.6)',
        }}
      />
      {/* Bottom Left */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: bracketSize,
          height: bracketSize,
          borderBottom: '3px solid #10B981',
          borderLeft: '3px solid #10B981',
          boxShadow: '0 0 12px rgba(16, 185, 129, 0.6)',
        }}
      />
      {/* Bottom Right */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: bracketSize,
          height: bracketSize,
          borderBottom: '3px solid #10B981',
          borderRight: '3px solid #10B981',
          boxShadow: '0 0 12px rgba(16, 185, 129, 0.6)',
        }}
      />

      {/* Center crosshair */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 14,
          height: 14,
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ position: 'absolute', width: 14, height: 1, backgroundColor: '#10B981' }} />
        <div style={{ position: 'absolute', width: 1, height: 14, backgroundColor: '#10B981' }} />
        <div
          style={{
            width: 4,
            height: 4,
            borderRadius: '50%',
            backgroundColor: '#34D399',
            boxShadow: '0 0 8px #10B981',
          }}
        />
      </div>

      {/* Laser Scanline */}
      <div
        style={{
          position: 'absolute',
          top: scanlineY,
          left: 4,
          right: 4,
          height: 2,
          background: 'linear-gradient(90deg, transparent, #10B981, #34D399, transparent)',
          boxShadow: '0 0 10px #10B981',
          opacity: 0.7,
        }}
      />

      {/* Top Banner Tag */}
      <div
        style={{
          position: 'absolute',
          top: -38,
          left: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 10px',
          background: 'rgba(6, 78, 59, 0.85)',
          border: '1px solid #10B981',
          borderRadius: 6,
          backdropFilter: 'blur(8px)',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: '#10B981',
            boxShadow: '0 0 6px #10B981',
            opacity: pulse,
          }}
        />
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: 12,
            fontWeight: 700,
            color: '#A7F3D0',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: 11,
            fontWeight: 800,
            color: '#FFFFFF',
            background: '#059669',
            padding: '1px 5px',
            borderRadius: 4,
          }}
        >
          {Math.round(confidence * 100)}% MATCH
        </span>
      </div>

      {/* Telemetry info bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: -28,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: 'monospace',
          fontSize: 10,
          color: '#6EE7B7',
          opacity: 0.85,
        }}
      >
        <span>WASM 640x640: LOCKED</span>
        <span>ROI: +15% PADDING</span>
      </div>

      {/* 15% ROI Padding Crop Indicator */}
      {showCropPreview && (
        <div
          style={{
            position: 'absolute',
            top: -16,
            left: -16,
            right: -16,
            bottom: -16,
            border: '1px dashed rgba(16, 185, 129, 0.45)',
            borderRadius: 8,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 2,
              right: 4,
              fontSize: 9,
              fontFamily: 'monospace',
              color: '#34D399',
            }}
          >
            CROPPED ROI
          </div>
        </div>
      )}
    </div>
  );
};
