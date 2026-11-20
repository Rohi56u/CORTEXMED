import type { NextConfig } from "next";
import path from "path";
import fs from "fs";

// Windows Defender / Search Indexer EPERM retry wrapper on directory creation
if (process.platform === "win32") {
  const origMkdirSync = fs.mkdirSync;
  fs.mkdirSync = function (dirPath: fs.PathLike, options?: any) {
    let retries = 0;
    while (true) {
      try {
        return origMkdirSync.call(fs, dirPath, options);
      } catch (e: any) {
        if (e?.code === "EPERM" && retries < 10) {
          retries++;
          const waitTill = Date.now() + 60 * retries;
          while (Date.now() < waitTill) {}
          continue;
        }
        throw e;
      }
    }
  } as typeof fs.mkdirSync;

  const origMkdir = fs.mkdir;
  fs.mkdir = function (dirPath: fs.PathLike, ...args: any[]) {
    const callback = typeof args[args.length - 1] === "function" ? args.pop() : null;
    const options = args[0];

    const attempt = (retries: number) => {
      (origMkdir as any)(dirPath, options, (err: any) => {
        if (err && err.code === "EPERM" && retries < 10) {
          setTimeout(() => attempt(retries + 1), 60 * (retries + 1));
          return;
        }
        if (callback) callback(err);
      });
    };
    attempt(0);
  } as typeof fs.mkdir;
}

const nextConfig: NextConfig = {
  devIndicators: false,
  experimental: {
    cpus: 1,
  },
  webpack: (config) => {
    // ONNX Runtime Web needs .wasm files served as assets
    config.module.rules.push({
      test: /\.wasm$/,
      type: "asset/resource",
    });
    return config;
  },
  // Allow WASM files from node_modules to be served
  serverExternalPackages: ["onnxruntime-web"],
};

export default nextConfig;
