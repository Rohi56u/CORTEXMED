import React from 'react';
import { Composition } from 'remotion';
import { CortexMedVideo } from './CortexMedVideo';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CortexMedDemo"
        component={CortexMedVideo}
        durationInFrames={2700}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
      <Composition
        id="CortexMedVideo"
        component={CortexMedVideo}
        durationInFrames={2700}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
    </>
  );
};
