#!/usr/bin/env node

const SAMPLE_SRT = `1
00:00:00,000 --> 00:00:03,200
هذا مثال سوف نبدأ به، bonjour.

2
00:00:03,200 --> 00:00:06,000
يجب أن ننتبه لأن ذلك مهم hello.

3
00:00:06,000 --> 00:00:09,000
غادي نشرح شنو واقع دابا.`;

const FORBIDDEN = [
  'سوف', 'يجب', 'لذلك', 'هذا', 'هذه', 'الذي', 'التي', 'إن', 'قد', 'لن', 'لم',
  'ليس', 'حيث', 'بينما', 'كذلك', 'وبالتالي', 'من أجل', 'على الرغم'
];

const MIXED_TOKENS = ['bonjour', 'hello'];

function parseSRT(srt) {
  const blocks = [];
  const parts = srt.trim().split(/\n\n+/);
  for (const part of parts) {
    const lines = part.trim().split('\n');
    if (lines.length >= 3) {
      const index = parseInt(lines[0], 10);
      const times = lines[1].split('-->').map(s => s.trim());
      const text = lines.slice(2).join('\n');
      blocks.push({ index, start: times[0], end: times[1], text });
    }
  }
  return blocks;
}

function formatSRT(blocks) {
  return blocks.map((block, i) => `${i + 1}\n${block.start} --> ${block.end}\n${block.text}`).join('\n\n');
}

function cleanMixedText(text) {
  let cleaned = text;
  cleaned = cleaned.replace(/\b(آه+|ممم+|اه+|euh+|uh+)\b/gi, '');
  cleaned = cleaned.replace(/\b(يعني)\s+\1\b/g, '$1');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

function cleanDarijaText(text) {
  let cleaned = text;
  for (const term of FORBIDDEN) {
    const pattern = new RegExp(term, 'g');
    cleaned = cleaned.replace(pattern, '');
  }
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

const originalBlocks = parseSRT(SAMPLE_SRT);
const mixedBlocks = originalBlocks.map(block => ({
  ...block,
  text: cleanMixedText(block.text)
}));
const darijaBlocks = originalBlocks.map(block => ({
  ...block,
  text: cleanDarijaText(block.text)
}));

const mixedOutput = formatSRT(mixedBlocks);
const darijaOutput = formatSRT(darijaBlocks);

const timestampsUnchanged = originalBlocks.every((block, idx) => (
  block.start === mixedBlocks[idx].start && block.end === mixedBlocks[idx].end
));

if (!timestampsUnchanged) {
  console.error('❌ Timestamps changed after cleaning');
  process.exit(1);
}

const mixedPreserved = MIXED_TOKENS.every(token => mixedOutput.includes(token));
if (!mixedPreserved) {
  console.error('❌ Mixed style removed French/English tokens');
  process.exit(1);
}

const forbiddenGone = FORBIDDEN.every(term => !darijaOutput.includes(term));
if (!forbiddenGone) {
  console.error('❌ Darija style did not remove MSA blockers');
  process.exit(1);
}

console.log('✅ Smoke test passed');
