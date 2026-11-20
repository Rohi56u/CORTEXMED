import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { HUDReticle } from '../components/HUDReticle';
import { BVPWaveform } from '../components/BVPWaveform';

export const Scene4ARVisionRPPG: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Virtual camera slow drift
  const zoom = interpolate(frame, [0, 600], [1.0, 1.04]);

  // Pill bottle lock-on spring
  const bottleSpring = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 85 },
  });

  // Face capillary tracking coordinates jitter
  const faceX = 380 + Math.sin(frame * 0.05) * 4;
  const faceY = 320 + Math.cos(frame * 0.04) * 3;

  // Spatial beacon pulse
  const beaconPulse = Math.sin(frame * 0.18) * 0.3 + 0.7;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#040B0E',
        color: '#FFFFFF',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        overflow: 'hidden',
        transform: `scale(${zoom})`,
      }}
    >
      {/* Simulated Live Camera Feed Background with Room Elements */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 60% 50%, #0F2A30 0%, #061418 55%, #02080A 100%)',
        }}
      />

      {/* AR HUD Grid & Horizon Lines */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(16, 185, 129, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(16, 185, 129, 0.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          opacity: 0.8,
        }}
      />

      {/* Top Stream Status Header */}
      <div
        style={{
          position: 'absolute',
          top: 24,
          left: 40,
          right: 40,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 30,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              backgroundColor: '#059669',
              fontFamily: 'monospace',
              fontSize: 12,
              fontWeight: 800,
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: '#A7F3D0',
                boxShadow: '0 0 8px #A7F3D0',
              }}
            />
            LIVE AR STREAM · http://localhost:3000/stream
          </div>
          <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#34D399', fontWeight: 700 }}>
            YOLOv8n ONNX Edge Inference &middot; 30.2 FPS
          </span>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: 11,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              border: '1px solid #10B981',
              color: '#6EE7B7',
              padding: '4px 10px',
              borderRadius: 6,
            }}
          >
            RESOLUTION: 1920x1080 (HD)
          </span>
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: 11,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              border: '1px solid #38BDF8',
              color: '#7DD3FC',
              padding: '4px 10px',
              borderRadius: 6,
            }}
          >
            CAMERA: RESIDENT ROOM 204
          </span>
        </div>
      </div>

      {/* LEFT PORTION: Simulated Video Feed with Bottle Recognition & Spatial Memory */}
      <div
        style={{
          position: 'absolute',
          top: 80,
          left: 40,
          width: 1040,
          height: 640,
          borderRadius: 20,
          border: '1px solid rgba(16, 185, 129, 0.3)',
          backgroundColor: 'rgba(5, 20, 24, 0.65)',
          overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
        }}
      >
        {/* Simulated Room Counter & Pill Bottle */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Simulated Medicine Bottle Silhouette */}
          <div
            style={{
              width: 180,
              height: 290,
              backgroundColor: '#1E293B',
              borderRadius: '24px 24px 12px 12px',
              border: '2px solid #334155',
              position: 'relative',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: 12,
            }}
          >
            {/* White Cap */}
            <div
              style={{
                width: 130,
                height: 38,
                backgroundColor: '#F8FAFC',
                borderRadius: '8px 8px 4px 4px',
                marginBottom: 16,
                border: '1px solid #CBD5E1',
              }}
            />
            {/* Bottle Label */}
            <div
              style={{
                width: '100%',
                backgroundColor: '#FFFFFF',
                borderRadius: 8,
                padding: '12px 10px',
                color: '#0F172A',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 900, color: '#0F766E' }}>Rx #482910</div>
              <div style={{ fontSize: 17, fontWeight: 900, marginTop: 4 }}>COUMADIN</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>Warfarin Sodium 5mg</div>
              <div
                style={{
                  fontSize: 10,
                  fontFamily: 'monospace',
                  color: '#0D9488',
                  marginTop: 8,
                  backgroundColor: '#F0FDFA',
                  padding: '2px 4px',
                  borderRadius: 4,
                }}
              >
                PATIENT: CHEN, M.
              </div>
            </div>
          </div>
        </div>

        {/* Authentic YOLOv8n Green Targeting HUD Reticle Locking on Bottle */}
        <HUDReticle
          label="YOLOv8n: Prescription Bottle"
          confidence={0.94}
          width={280}
          height={380}
          x={520}
          y={330}
          showCropPreview={true}
        />

        {/* 3D Spatial Memory Pin & Beacon */}
        <div
          style={{
            position: 'absolute',
            top: 100,
            left: 120,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          {/* Pulsing Beacon Point */}
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              backgroundColor: '#06B6D4',
              boxShadow: `0 0 20px rgba(6, 182, 212, ${beaconPulse})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#FFFFFF' }} />
          </div>

          {/* Spatial Anchor Card */}
          <div
            style={{
              backgroundColor: 'rgba(8, 47, 73, 0.9)',
              border: '1px solid #0284C7',
              borderRadius: 10,
              padding: '8px 14px',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#38BDF8', fontWeight: 800 }}>
              3D SPATIAL MEMORY ANCHOR
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#FFFFFF', marginTop: 2 }}>
              Zone: Bathroom Cabinet &middot; Shelf 2
            </div>
            <div style={{ fontSize: 11, color: '#BAE6FD', fontFamily: 'monospace', marginTop: 2 }}>
              Coordinates: [X: +1.42m, Y: -0.21m, Z: +2.18m]
            </div>
          </div>
        </div>

        {/* Bottom Corner Raw ROI Crop Preview */}
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            width: 220,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            border: '1px solid #10B981',
            borderRadius: 10,
            padding: 10,
          }}
        >
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: 10,
              fontWeight: 800,
              color: '#34D399',
              marginBottom: 6,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>RAW 15% ROI CROP</span>
            <span>OCR FEED</span>
          </div>
          <div
            style={{
              height: 70,
              backgroundColor: '#0F172A',
              borderRadius: 6,
              border: '1px dashed #334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94A3B8',
              fontSize: 11,
              fontFamily: 'monospace',
              textAlign: 'center',
              padding: 4,
            }}
          >
            &ldquo;COUMADIN 5MG<br />WARFARIN SODIUM&rdquo;
          </div>
        </div>
      </div>

      {/* RIGHT PORTION: Contactless rPPG Vitals Monitor */}
      <div
        style={{
          position: 'absolute',
          top: 80,
          right: 40,
          width: 580,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* Face Capillary Tracking ROI Card */}
        <div
          style={{
            backgroundColor: 'rgba(10, 25, 28, 0.92)',
            border: '1px solid rgba(6, 182, 212, 0.4)',
            borderRadius: 16,
            padding: '16px 20px',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: '#06B6D4',
                  boxShadow: '0 0 8px #06B6D4',
                }}
              />
              <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 800, color: '#67E8F9' }}>
                FACE ROI CAPILLARY TRACKING
              </span>
            </div>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: 10,
                color: '#38BDF8',
                backgroundColor: 'rgba(6, 182, 212, 0.15)',
                padding: '2px 8px',
                borderRadius: 4,
              }}
            >
              OPENCV CHROM rPPG
            </span>
          </div>

          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            {/* Wireframe Face ROI representation */}
            <div
              style={{
                width: 110,
                height: 110,
                borderRadius: 12,
                backgroundColor: '#082F49',
                border: '1px dashed #38BDF8',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Forehead ROI */}
              <div
                style={{
                  position: 'absolute',
                  top: 18,
                  width: 50,
                  height: 18,
                  border: '1px solid #10B981',
                  backgroundColor: 'rgba(16, 185, 129, 0.25)',
                  borderRadius: 3,
                }}
              />
              {/* Left Cheek ROI */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 30,
                  left: 18,
                  width: 24,
                  height: 20,
                  border: '1px solid #10B981',
                  backgroundColor: 'rgba(16, 185, 129, 0.25)',
                  borderRadius: 3,
                }}
              />
              {/* Right Cheek ROI */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 30,
                  right: 18,
                  width: 24,
                  height: 20,
                  border: '1px solid #10B981',
                  backgroundColor: 'rgba(16, 185, 129, 0.25)',
                  borderRadius: 3,
                }}
              />
              <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#67E8F9', position: 'absolute', bottom: 4 }}>
                ROI ACTIVE
              </span>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#E0F2FE' }}>
                Contactless Hemodynamic Sensing
              </div>
              <p style={{ fontSize: 11, color: '#94A3B8', margin: '4px 0 8px 0', lineHeight: 1.4 }}>
                Sub-dermal microvascular hemoglobin absorption extracted from green optical channel at 30 FPS. Zero wearables required.
              </p>
              <div style={{ display: 'flex', gap: 8, fontFamily: 'monospace', fontSize: 10, color: '#34D399' }}>
                <span>&bull; GREEN CHROMA: 99.1%</span>
                <span>&bull; MOTION REJECT: ON</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Filtered BVP Pulse Waveform Canvas */}
        <BVPWaveform
          width={580}
          height={160}
          bpm={72.0}
          hrv={42}
          signalQuality={98.4}
        />
      </div>

      {/* Bottom Bar: Operational Metrics */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          left: 40,
          right: 40,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'rgba(10, 25, 28, 0.85)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: 12,
          padding: '8px 20px',
          fontFamily: 'monospace',
          fontSize: 11,
          color: '#6EE7B7',
        }}
      >
        <span>&bull; ON-DEVICE PRIVACY: ZERO RAW FRAMES TRANSMITTED</span>
        <span>&bull; FAST FOURIER TRANSFORM (FFT) BANDPASS: 0.7 - 3.5 HZ</span>
        <span>&bull; ZERO FAKE SINE WAVES &middot; AUTHENTIC CAPILLARY SPECTRAL PEAKS</span>
      </div>
    </AbsoluteFill>
  );
};
