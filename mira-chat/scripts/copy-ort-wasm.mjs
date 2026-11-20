import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, "..");
const srcDir = path.join(projectRoot, "node_modules", "onnxruntime-web", "dist");
const destDir = path.join(projectRoot, "public", "ort");

if (!fs.existsSync(srcDir)) {
  console.log(`Source directory does not exist yet: ${srcDir}`);
  process.exit(0);
}

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const files = fs.readdirSync(srcDir);
let copied = 0;
for (const file of files) {
  if (file.startsWith("ort-wasm")) {
    const srcFile = path.join(srcDir, file);
    const destFile = path.join(destDir, file);
    fs.copyFileSync(srcFile, destFile);
    copied++;
  }
}

console.log(`Copied ${copied} ORT WASM/MJS runtime files to ${destDir}`);
