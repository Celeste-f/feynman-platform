// 浏览器录音 -> 16k 单声道 PCM（百度短语音识别要求的格式）
// 供 FeynmanRecordPage / KnowledgePointFormPage 共用

export const TARGET_RATE = 16000;

// 把任意采样率的 Float32 波形线性重采样到 16k
export function resampleTo16k(samples, fromRate) {
  if (fromRate === TARGET_RATE) return samples;
  const ratio = fromRate / TARGET_RATE;
  const newLength = Math.floor(samples.length / ratio);
  const out = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const pos = i * ratio;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const a = samples[idx] ?? 0;
    const b = samples[idx + 1] ?? a;
    out[i] = a + (b - a) * frac;
  }
  return out;
}

// Float32 -> 16bit PCM，返回 Blob
export function toPcmBlob(samples, sampleRate) {
  const resampled = resampleTo16k(samples, sampleRate);
  const buffer = new ArrayBuffer(resampled.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < resampled.length; i++) {
    const s = Math.max(-1, Math.min(1, resampled[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([view], { type: 'application/octet-stream' });
}

// 把多段录音数据合并成一整段 Float32Array
export function mergeChunks(chunks) {
  const totalLength = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;
  chunks.forEach((c) => {
    merged.set(c, offset);
    offset += c.length;
  });
  return merged;
}
