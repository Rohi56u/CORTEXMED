import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { LangGraphNode, NodeState } from '../components/LangGraphNode';
import { AudioWaveform } from '../components/AudioWaveform';

export const Scene3CDSSLangGraph: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Scene 3 runs for 600 frames (20 seconds)
  // Sub-phases:
  // Phase 1 (0-320 frames): Advil + Coumadin CRITICAL_BLOCK with LangGraph execution nodes 1->5
  // Phase 2 (320-600 frames): Robert Williams Allergy Contraindication + Bilingual Calm Voice Warning

  const isPhase2 = frame >= 320;
  const phase1Opacity = interpolate(frame, [0, 15, 305, 320], [0, 1, 1, 0], {
    extrapolateRight: 'clamp',
  });
  const phase2Opacity = interpolate(frame, [315, 330], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // LangGraph node state progress for Scenario A (Advil + Coumadin)
  // Node 1: active at 15, success at 45
  // Node 2: active at 45, success at 80
  // Node 3: active at 80, success at 115
  // Node 4: active at 115, success at 155
  // Node 5: active at 155, blocked at 185
  const getNode1State = (): NodeState => (frame < 15 ? 'waiting' : frame < 45 ? 'active' : 'success');
  const getNode2State = (): NodeState => (frame < 45 ? 'waiting' : frame < 80 ? 'active' : 'success');
  const getNode3State = (): NodeState => (frame < 80 ? 'waiting' : frame < 115 ? 'active' : 'success');
  const getNode4State = (): NodeState => (frame < 115 ? 'waiting' : frame < 155 ? 'active' : 'success');
  const getNode5State = (): NodeState => (frame < 155 ? 'waiting' : frame < 185 ? 'active' : 'blocked');

  // Pulse effect for critical alert badge
  const alertPulse = Math.sin(frame * 0.25) * 0.15 + 0.85;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#090D16',
        color: '#FFFFFF',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        overflow: 'hidden',
        padding: '28px 48px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      {/* Background Matrix Glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(circle at 70% 20%, rgba(14, 116, 144, 0.15) 0%, transparent 60%), radial-gradient(circle at 20% 80%, rgba(239, 68, 68, 0.1) 0%, transparent 50%)',
          pointerEvents: 'none',
        }}
      />

      {/* Top Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          paddingBottom: 16,
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              backgroundColor: '#0E7490',
              fontFamily: 'monospace',
              fontSize: 12,
              fontWeight: 800,
              color: '#E0F2FE',
            }}
          >
            CDSS ENGINE
          </div>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>
              LangGraph StateGraph &middot; Deterministic Safety Guardrail
            </h2>
            <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#94A3B8', marginTop: 2 }}>
              http://localhost:3000/cdss &middot; 5-Node Clinical Verification Pipeline
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '4px 12px',
              borderRadius: 8,
              fontFamily: 'monospace',
              fontSize: 11,
              color: '#38BDF8',
            }}
          >
            Active Regimen: Margaret Chen (Coumadin 5mg)
          </div>
          <div
            style={{
              backgroundColor: '#450A0A',
              border: '1px solid #EF4444',
              padding: '4px 12px',
              borderRadius: 8,
              fontFamily: 'monospace',
              fontSize: 11,
              fontWeight: 800,
              color: '#F87171',
            }}
          >
            LATENCY: 42ms
          </div>
        </div>
      </div>

      {/* SCENARIO A: Advil + Coumadin CRITICAL_BLOCK (Frames 0 - 320) */}
      <div
        style={{
          opacity: phase1Opacity,
          position: 'absolute',
          top: 90,
          left: 48,
          right: 48,
          bottom: 28,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          pointerEvents: isPhase2 ? 'none' : 'auto',
        }}
      >
        {/* Scenario Banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: 12,
            padding: '10px 18px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: '#EF4444',
                boxShadow: '0 0 10px #EF4444',
              }}
            />
            <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 800, color: '#FCA5A5' }}>
              SCENARIO 1: SCANNED OTC BOTTLE &ldquo;ADVIL 200MG&rdquo; &rarr; PATIENT ON PRESCRIBED &ldquo;COUMADIN (WARFARIN)&rdquo;
            </span>
          </div>
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: 11,
              color: '#EF4444',
              fontWeight: 800,
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              padding: '2px 8px',
              borderRadius: 4,
            }}
          >
            HIGH FATALITY RISK
          </span>
        </div>

        {/* 5 LangGraph Nodes Horizontal Flow */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            position: 'relative',
            margin: '12px 0',
          }}
        >
          <LangGraphNode
            index={1}
            id="vision_ocr_node"
            name="1. Vision OCR"
            subtitle="Gemini Vision OCR"
            state={getNode1State()}
            outputSummary="Text: 'Advil 200mg'"
            delayFrames={0}
          />
          <div style={{ color: '#475569', fontSize: 20 }}>&rarr;</div>

          <LangGraphNode
            index={2}
            id="normalize_and_load_context_node"
            name="2. NIH RxNorm"
            subtitle="RxCUI 5640 (Ibuprofen)"
            state={getNode2State()}
            outputSummary="RxCUI: 5640 Loaded"
            delayFrames={5}
          />
          <div style={{ color: '#475569', fontSize: 20 }}>&rarr;</div>

          <LangGraphNode
            index={3}
            id="temporal_double_dose_guard_node"
            name="3. Temporal Guard"
            subtitle="Supabase History Cooldown"
            state={getNode3State()}
            outputSummary="No dose within 6h"
            delayFrames={10}
          />
          <div style={{ color: '#475569', fontSize: 20 }}>&rarr;</div>

          <LangGraphNode
            index={4}
            id="drug_interaction_fda_node"
            name="4. OpenFDA Scan"
            subtitle="Boxed Warning & SPL"
            state={getNode4State()}
            outputSummary="Warfarin interaction found"
            delayFrames={15}
          />
          <div style={{ color: '#475569', fontSize: 20 }}>&rarr;</div>

          <LangGraphNode
            index={5}
            id="clinical_verdict_and_persist_node"
            name="5. Safety Verdict"
            subtitle="Deterministic Block"
            state={getNode5State()}
            outputSummary="CRITICAL_BLOCK"
            delayFrames={20}
          />
        </div>

        {/* Bottom Verdict Card: Real FDA Boxed Warning & DailyMed URL */}
        <div
          style={{
            backgroundColor: 'rgba(26, 11, 15, 0.95)',
            border: '2px solid #EF4444',
            borderRadius: 16,
            padding: '18px 24px',
            boxShadow: '0 12px 40px rgba(239, 68, 68, 0.25)',
            transform: `scale(${frame >= 185 ? alertPulse : 1})`,
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr',
            gap: 24,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span
                style={{
                  backgroundColor: '#EF4444',
                  color: '#FFFFFF',
                  fontFamily: 'monospace',
                  fontSize: 12,
                  fontWeight: 900,
                  padding: '3px 10px',
                  borderRadius: 6,
                  letterSpacing: '0.08em',
                }}
              >
                CRITICAL_BLOCK
              </span>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#FCA5A5' }}>
                Severe Bleeding & Hemorrhage Contraindication
              </span>
            </div>
            <p style={{ fontSize: 13, color: '#F1F5F9', lineHeight: 1.45, margin: 0 }}>
              <strong>FDA Boxed Warning:</strong> Co-administration of NSAIDs (Ibuprofen, RxCUI 5640) with oral anticoagulants (Warfarin/Coumadin, RxCUI 855332) substantially increases gastrointestinal hemorrhage risk and fatal bleeding.
            </p>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: 11,
                color: '#38BDF8',
                marginTop: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>Verified DailyMed Source:</span>
              <span style={{ textDecoration: 'underline' }}>
                https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=warfarin-spl
              </span>
            </div>
          </div>

          {/* Bilingual Voice Audio Waveform in Action */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <AudioWaveform
              width={520}
              height={70}
              activeLanguage="en"
              transcriptText="Critical safety alert: Stop. Advil interacts dangerously with your prescribed blood thinner Coumadin. Do not swallow."
              warningLevel="critical"
              isActive={frame >= 170}
            />
          </div>
        </div>
      </div>

      {/* SCENARIO B: Robert Williams Allergy Contraindication (Frames 320 - 600) */}
      <div
        style={{
          opacity: phase2Opacity,
          position: 'absolute',
          top: 90,
          left: 48,
          right: 48,
          bottom: 28,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          pointerEvents: isPhase2 ? 'auto' : 'none',
        }}
      >
        {/* Scenario Banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: 12,
            padding: '10px 18px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: '#F59E0B',
                boxShadow: '0 0 10px #F59E0B',
              }}
            />
            <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 800, color: '#FDE68A' }}>
              SCENARIO 2: RESIDENT ROBERT WILLIAMS &middot; ROOM 112 &middot; DOCUMENTED ALLERGIES: [ASPIRIN, CODEINE]
            </span>
          </div>
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: 11,
              color: '#F59E0B',
              fontWeight: 800,
              backgroundColor: 'rgba(245, 158, 11, 0.2)',
              padding: '2px 8px',
              borderRadius: 4,
            }}
          >
            ANAPHYLAXIS GUARDRAIL
          </span>
        </div>

        {/* Comparison Table / Medical Profile View */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.3fr',
            gap: 20,
            margin: '12px 0',
          }}
        >
          {/* Patient Health Record Card */}
          <div
            style={{
              backgroundColor: '#0F172A',
              border: '1px solid #334155',
              borderRadius: 14,
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#F1F5F9' }}>
                Resident Profile: Robert Williams
              </span>
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#94A3B8' }}>
                Age 74 &middot; Room 112
              </span>
            </div>

            <div style={{ borderTop: '1px solid #1E293B', paddingTop: 10 }}>
              <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#EF4444', fontWeight: 800 }}>
                DOCUMENTED ALLERGIES IN SUPABASE EHR:
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <span
                  style={{
                    backgroundColor: '#450A0A',
                    color: '#FCA5A5',
                    border: '1px solid #EF4444',
                    padding: '3px 10px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  &times; ASPIRIN (Severe Anaphylaxis / Bronchospasm)
                </span>
                <span
                  style={{
                    backgroundColor: '#450A0A',
                    color: '#FCA5A5',
                    border: '1px solid #EF4444',
                    padding: '3px 10px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  &times; CODEINE
                </span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #1E293B', paddingTop: 10 }}>
              <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#94A3B8' }}>
                DETECTED INTENT:
              </div>
              <div style={{ fontSize: 13, color: '#CBD5E1', marginTop: 4 }}>
                Resident reached for &ldquo;Bayer Aspirin 325mg&rdquo; bottle. Immediate LangGraph interception triggered prior to ingestion.
              </div>
            </div>
          </div>

          {/* LangGraph Interception Card */}
          <div
            style={{
              backgroundColor: 'rgba(30, 27, 75, 0.95)',
              border: '2px solid #6366F1',
              borderRadius: 14,
              padding: '20px 24px',
              boxShadow: '0 10px 30px rgba(99, 102, 241, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span
                  style={{
                    backgroundColor: '#6366F1',
                    color: '#FFFFFF',
                    fontFamily: 'monospace',
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 4,
                  }}
                >
                  INSTANT BLOCK
                </span>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#C7D2FE' }}>
                  Cross-Reaction Allergy Intercepted in 38ms
                </span>
              </div>
              <p style={{ fontSize: 13, color: '#E0E7FF', lineHeight: 1.4, margin: 0 }}>
                Matched against patient EHR allergy table. Active NSAID acetylsalicylic acid matches contraindicated allergen. Escalation pushed to Nurse Station telemetry console.
              </p>
            </div>

            <div
              style={{
                fontFamily: 'monospace',
                fontSize: 11,
                color: '#A5B4FC',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                padding: '8px 12px',
                borderRadius: 8,
              }}
            >
              Action: Block Dispensation &middot; Audio Guardrail Triggered &middot; Caregiver Paged
            </div>
          </div>
        </div>

        {/* Bilingual Hindi/English Calm Audio Waveform Demonstration */}
        <div
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid #334155',
            borderRadius: 16,
            padding: '16px 24px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 20,
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#38BDF8', fontWeight: 800, marginBottom: 4 }}>
              CALM CADENCE BILINGUAL SYNTHESIS (NO ALARM FATIGUE)
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#F8FAFC' }}>
              &ldquo;Robert, कृपया यह दवा न लें। आपको एस्पिरिन से एलर्जी है।&rdquo;
            </div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>
              &ldquo;Robert, please do not take this medication. You have a documented aspirin allergy.&rdquo;
            </div>
          </div>

          <AudioWaveform
            width={480}
            height={60}
            activeLanguage="hi"
            transcriptText="Robert, कृपया यह दवा न लें। आपको एस्पिरिन से एलर्जी है।"
            warningLevel="critical"
            isActive={frame >= 390}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
