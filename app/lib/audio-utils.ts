import { Slide } from "./types";

export function audioBufferToWav(buffer: AudioBuffer): Uint8Array {
  const numCh = Math.min(buffer.numberOfChannels, 2);
  const sr = buffer.sampleRate;
  const len = buffer.length;
  const dataSize = len * numCh * 2;
  const ab = new ArrayBuffer(44 + dataSize);
  const v = new DataView(ab);

  const s = (off: number, str: string) => {
    for (let i = 0; i < str.length; i++) v.setUint8(off + i, str.charCodeAt(i));
  };

  s(0, "RIFF");
  v.setUint32(4, 36 + dataSize, true);
  s(8, "WAVE");
  s(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, numCh, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * numCh * 2, true);
  v.setUint16(32, numCh * 2, true);
  v.setUint16(34, 16, true);
  s(36, "data");
  v.setUint32(40, dataSize, true);

  let off = 44;
  for (let i = 0; i < len; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      v.setInt16(off, sample * 0x7fff, true);
      off += 2;
    }
  }

  return new Uint8Array(ab);
}

// Mix all slide audio into a single WAV buffer using OfflineAudioContext.
// Returns null if no slides have audio.
export async function mixSlidesAudio(slides: Slide[]): Promise<Uint8Array | null> {
  if (!slides.some((s) => s.audio)) return null;

  const sampleRate = 44100;
  const totalDuration = slides.reduce((acc, s) => acc + s.duration, 0);
  const ctx = new OfflineAudioContext(
    2,
    Math.ceil(totalDuration * sampleRate),
    sampleRate
  );

  let t = 0;
  for (const slide of slides) {
    if (slide.audio) {
      try {
        const ab = await fetch(slide.audio).then((r) => r.arrayBuffer());
        const buf = await ctx.decodeAudioData(ab);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(t);
        src.stop(t + slide.duration);
      } catch {
        // skip undecodable audio
      }
    }
    t += slide.duration;
  }

  const rendered = await ctx.startRendering();
  return audioBufferToWav(rendered);
}
