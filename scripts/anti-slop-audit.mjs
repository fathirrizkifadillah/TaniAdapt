import fs from 'node:fs';
import path from 'node:path';

const SRC_DIR = path.resolve('src');

const BANNED_PATTERNS = [
  {
    regex: /(?:bg-gradient-to-[a-z]+\s+from-(?:purple|indigo|violet)-\d{3})/i,
    name: 'Generic Purple/Indigo Gradient Slop',
    penalty: 'Use earthy moss, clay, or tactile solid surfaces instead of generic AI purple meshes.'
  },
  {
    regex: /(?:#6366f1|#4f46e5|indigo-(?:500|600))/i,
    name: 'Default Tailwind Indigo Accent Slop',
    penalty: 'Use branded agricultural tokens (moss-700, clay-600, field-border).'
  },
  {
    regex: /[✨🚀🔥🤖]/gu,
    name: 'Raw Decorative Emoji Slop',
    penalty: 'Use clean 1.5px monoline Lucide SVG icons instead of raw emojis in UI buttons/badges.'
  },
  {
    regex: /(?:revolutionary\s+ai|unlock\s+your\s+potential|game-changer|99\.9%\s+accuracy|delve\s+into)/i,
    name: 'Vague AI Marketing Slop Phrasing',
    penalty: 'Use factual agronomic terms and grounded evidence from literature.'
  }
];

function getAllFiles(dir, exts = ['.tsx', '.ts', '.jsx', '.js', '.css']) {
  let files = [];
  if (!fs.existsSync(dir)) return files;
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getAllFiles(fullPath, exts));
    } else if (exts.includes(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

console.log('🔍 Running TaniAdapt Anti-AI-Slop Frontend Audit...');
const files = getAllFiles(SRC_DIR);
let violations = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(process.cwd(), file);

  // Skip audit script itself or test files if they reference the regex
  if (relPath.includes('anti-slop-audit') || relPath.includes('.test.')) continue;

  for (const rule of BANNED_PATTERNS) {
    const match = content.match(rule.regex);
    if (match) {
      violations.push({
        file: relPath,
        rule: rule.name,
        snippet: match[0],
        fix: rule.penalty
      });
    }
  }
}

if (violations.length === 0) {
  console.log('✅ AUDIT PASSED: 0 AI-Slop tropes detected. UI complies with field-grade agritech design standard.');
  process.exit(0);
} else {
  console.error(`❌ AUDIT FAILED: Found ${violations.length} AI-Slop violation(s):`);
  for (const v of violations) {
    console.error(`  - [${v.rule}] in ${v.file}: "${v.snippet}" -> ${v.fix}`);
  }
  process.exit(1);
}
