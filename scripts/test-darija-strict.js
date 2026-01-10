#!/usr/bin/env node

const SAMPLE_SRT = `1
00:00:00,000 --> 00:00:03,200
هذا مثال سوف نبدأ به.

2
00:00:03,200 --> 00:00:06,000
يجب أن ننتبه لأن ذلك مهم.

3
00:00:06,000 --> 00:00:09,000
غادي نشرح شنو واقع دابا.`;

const FORBIDDEN = [
  'سوف', 'يجب', 'لذلك', 'هذا', 'هذه', 'الذي', 'التي', 'إن', 'قد', 'لن', 'لم',
  'ليس', 'حيث', 'بينما', 'كذلك', 'وبالتالي', 'من أجل', 'على الرغم'
];

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

function cleanText(text) {
  let cleaned = text.replace(/[A-Za-z]/g, '');
  for (const term of FORBIDDEN) {
    const pattern = new RegExp(term, 'g');
    cleaned = cleaned.replace(pattern, '');
  }
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

const originalBlocks = parseSRT(SAMPLE_SRT);
const cleanedBlocks = originalBlocks.map(block => ({
  ...block,
  text: cleanText(block.text)
}));

const output = formatSRT(cleanedBlocks);
console.log(output);

const timestampsUnchanged = originalBlocks.every((block, idx) => block.start === cleanedBlocks[idx].start && block.end === cleanedBlocks[idx].end);
const forbiddenGone = FORBIDDEN.every(term => !output.includes(term));

if (!timestampsUnchanged) {
  console.error('❌ Timestamps changed');
  process.exit(1);
}

if (!forbiddenGone) {
  console.error('❌ Forbidden words still present');
  process.exit(1);
}

console.log('✅ Darija strict test passed');
