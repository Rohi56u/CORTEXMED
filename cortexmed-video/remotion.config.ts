import { Config } from '@remotion/cli/config';
import path from 'path';

Config.overrideWebpackConfig((currentConfiguration) => {
  return {
    ...currentConfiguration,
    resolve: {
      ...currentConfiguration.resolve,
      alias: {
        ...(currentConfiguration.resolve?.alias ?? {}),
        '@mediabunny/flac-encoder': path.resolve(process.cwd(), 'src/mock-flac.js'),
      },
    },
  };
});

Config.setVideoImageFormat('png');
Config.setDisallowParallelEncoding(true);

Config.overrideFfmpegCommand(({ args }) => {
  if (args.includes('image2pipe')) {
    const iIndex = args.indexOf('-i');
    if (iIndex !== -1 && !args.includes('-probesize')) {
      args.splice(iIndex, 0, '-probesize', '50M', '-analyzeduration', '50M');
    }
  }
  return args;
});
