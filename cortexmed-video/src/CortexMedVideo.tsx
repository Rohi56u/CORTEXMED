import React from 'react';
import { Audio, Series, staticFile } from 'remotion';
import { Scene1CrisisMission } from './scenes/Scene1CrisisMission';
import { Scene2CommandCenter } from './scenes/Scene2CommandCenter';
import { Scene3CDSSLangGraph } from './scenes/Scene3CDSSLangGraph';
import { Scene4ARVisionRPPG } from './scenes/Scene4ARVisionRPPG';
import { Scene5ResidentCaregiver } from './scenes/Scene5ResidentCaregiver';
import { Scene6ArchitectureOutro } from './scenes/Scene6ArchitectureOutro';

export const CortexMedVideo: React.FC = () => {
  return (
    <>
      {/* 90-second synchronized master audio: Voiceover + Ducked Ambient Tech Soundtrack + SFX */}
      <Audio src={staticFile('master_soundtrack_90s.mp3')} />

      <Series>
        {/* Scene 1: The Eldercare Crisis & CortexMed Mission (0:00 - 0:15 / 450 frames) */}
        <Series.Sequence durationInFrames={450}>
          <Scene1CrisisMission />
        </Series.Sequence>

        {/* Scene 2: Command Center & Real-Time System Readiness (0:15 - 0:30 / 450 frames) */}
        <Series.Sequence durationInFrames={450}>
          <Scene2CommandCenter />
        </Series.Sequence>

        {/* Scene 3: Clinical Decision Support Console (CDSS) & LangGraph (0:30 - 0:50 / 600 frames) */}
        <Series.Sequence durationInFrames={600}>
          <Scene3CDSSLangGraph />
        </Series.Sequence>

        {/* Scene 4: AR Vision HUD & Contactless rPPG Vitals (0:50 - 1:10 / 600 frames) */}
        <Series.Sequence durationInFrames={600}>
          <Scene4ARVisionRPPG />
        </Series.Sequence>

        {/* Scene 5: Resident Companion & Caregiver Telemetry Command (1:10 - 1:25 / 450 frames) */}
        <Series.Sequence durationInFrames={450}>
          <Scene5ResidentCaregiver />
        </Series.Sequence>

        {/* Scene 6: Architecture & Closing Bumper (1:25 - 1:30 / 150 frames) */}
        <Series.Sequence durationInFrames={150}>
          <Scene6ArchitectureOutro />
        </Series.Sequence>
      </Series>
    </>
  );
};
