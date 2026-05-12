/* eslint-disable no-console */
import { readFileSync } from "node:fs";
import { globSync } from "glob";

/**
 * Quality Gate #11: app/component code MUST use design tokens
 * (Tailwind classes / CSS vars), not raw hex/rgb literals. Failing
 * files are listed and the script exits non-zero.
 */
const HEX_RE = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;
const RGB_RE = /\brgba?\s*\(/;

const targets = globSync("src/**/*.{ts,tsx,css}", {
  ignore: ["src/components/ui/**", "src/app/globals.css"],
});

const offenders: Array<{ file: string; line: number; text: string }> = [];
for (const f of targets) {
  const lines = readFileSync(f, "utf8").split(/\r?\n/);
  lines.forEach((text, i) => {
    if (HEX_RE.test(text) || RGB_RE.test(text)) {
      offenders.push({ file: f, line: i + 1, text: text.trim() });
    }
  });
}

if (offenders.length > 0) {
  console.error(`[check:ui-tokens] ${offenders.length} raw color literal(s) found:`);
  for (const o of offenders) console.error(`  ${o.file}:${o.line}  ${o.text}`);
  process.exit(1);
}
console.log("[check:ui-tokens] OK — no raw color literals outside primitives.");
