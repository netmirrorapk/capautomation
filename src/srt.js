// Minimal SRT reader/writer. Timings are kept in microseconds to match the
// CapCut draft timeline (target_timerange.start / .duration).

const TIMESTAMP = /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/;
const CUE_LINE = new RegExp(`${TIMESTAMP.source}\\s*-->\\s*${TIMESTAMP.source}`);

function timestampToMicros(h, m, s, ms) {
  const millis = (Number(h) * 3600 + Number(m) * 60 + Number(s)) * 1000 + Number(String(ms).padEnd(3, '0'));
  return millis * 1000;
}

function microsToTimestamp(micros) {
  const totalMs = Math.max(0, Math.round(micros / 1000));
  const ms = totalMs % 1000;
  const totalSeconds = Math.floor(totalMs / 1000);
  const s = totalSeconds % 60;
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);
  const pad = (value, len = 2) => String(value).padStart(len, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

// Parse SRT-formatted text (pasted or from a .srt file) into ordered cues.
// Each cue: { start, end, duration } in microseconds, plus the text.
function parseSrt(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('No subtitle text was provided.');
  }

  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n{2,}/);
  const cues = [];

  for (const block of blocks) {
    const lines = block.split('\n');
    const cueLineIndex = lines.findIndex((line) => CUE_LINE.test(line));
    if (cueLineIndex === -1) {
      continue;
    }

    const match = lines[cueLineIndex].match(CUE_LINE);
    const start = timestampToMicros(match[1], match[2], match[3], match[4]);
    const end = timestampToMicros(match[5], match[6], match[7], match[8]);

    if (end <= start) {
      throw new Error(`Subtitle block has a non-positive duration near "${lines[cueLineIndex].trim()}".`);
    }

    const cueText = lines
      .slice(cueLineIndex + 1)
      .join('\n')
      .trim();

    cues.push({ start, end, duration: end - start, text: cueText });
  }

  if (!cues.length) {
    throw new Error('No valid subtitle blocks with timestamps were found. Expected SRT format (e.g. 00:00:01,000 --> 00:00:03,000).');
  }

  cues.sort((a, b) => a.start - b.start);
  return cues;
}

// Build an SRT document from cues shaped as { start, duration, text }
// (microseconds). `end` is derived from start + duration when absent.
function formatSrt(cues) {
  return cues
    .map((cue, index) => {
      const start = cue.start;
      const end = cue.end != null ? cue.end : cue.start + cue.duration;
      const text = (cue.text || '').replace(/\r\n/g, '\n');
      return `${index + 1}\n${microsToTimestamp(start)} --> ${microsToTimestamp(end)}\n${text}`;
    })
    .join('\n\n')
    .concat('\n');
}

module.exports = {
  parseSrt,
  formatSrt,
  timestampToMicros,
  microsToTimestamp
};
