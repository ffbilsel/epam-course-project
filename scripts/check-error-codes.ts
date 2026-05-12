/* eslint-disable no-console */
import { readFileSync } from "node:fs";
import { globSync } from "glob";
import { join } from "node:path";

/**
 * Quality Gate #9: every code in `ERROR_CODES` MUST be referenced by
 * at least one test. Fails the build with a non-zero exit code if
 * any code is unused.
 */
function loadCodes(): string[] {
  const src = readFileSync(join("src", "lib", "errors", "codes.ts"), "utf8");
  const matches = src.match(/^\s*([A-Z][A-Z0-9_]+):\s*\{/gm) ?? [];
  return matches.map((m) => m.replace(/[^A-Z0-9_]/g, ""));
}

function loadTestCorpus(): string {
  const files = [
    ...globSync("tests/**/*.{ts,tsx}"),
    ...globSync("src/**/__tests__/**/*.{ts,tsx}"),
    ...globSync("src/**/*.{spec,test}.{ts,tsx}"),
  ];
  return files.map((f) => readFileSync(f, "utf8")).join("\n");
}

const codes = loadCodes();
const corpus = loadTestCorpus();
const missing = codes.filter((c) => !corpus.includes(c));

if (missing.length > 0) {
  console.error(`[check:error-codes] ${missing.length} code(s) not referenced by any test:`);
  for (const c of missing) console.error(`  - ${c}`);
  process.exit(1);
}
console.log(`[check:error-codes] OK — all ${codes.length} codes are tested.`);
