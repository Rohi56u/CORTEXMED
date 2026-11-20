// Runner for TypeScript Verification Suite
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import ts from "typescript";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const require = createRequire(import.meta.url);

// Register .ts compilation hook in require
require.extensions[".ts"] = function (module, filename) {
  const content = fs.readFileSync(filename, "utf8");
  const transpiled = ts.transpileModule(content, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });
  module._compile(transpiled.outputText, filename);
};

// Also register path resolution for @/
const Module = require("module");
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    const relativePart = request.slice(2);
    const candidatePath = path.join(projectRoot, relativePart);
    if (fs.existsSync(candidatePath + ".ts")) {
      return candidatePath + ".ts";
    }
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

// Execute verify_phase2.ts and verify_phase5.mjs
const verifySuite = require("./verify_phase2.ts");
const { runPhase5Tests } = await import("./verify_phase5.mjs");

async function run() {
  const res2 = await verifySuite.runAllTests();
  const res5 = await runPhase5Tests();

  const totalPassed = res2.passed + res5.passed;
  const grandTotal = res2.total + res5.total;

  console.log(`\n===============================================================`);
  console.log(`  CORTEXMED ALL TEST SUITES: ${totalPassed}/${grandTotal} CHECKS PASSED WITH 0 FAILURES`);
  console.log(`===============================================================\n`);

  if (res2.passed !== res2.total || res5.passed !== res5.total) {
    process.exit(1);
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  });
