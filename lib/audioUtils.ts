export function createPCMBlob(data: Float32Array, sampleRate: number) {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new RangeError("PCM sample rate must be a positive number.");
  }

  const int16 = new Int16Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const element = Math.max(-1, Math.min(1, data[i]));
    int16[i] = element < 0 ? element * 32768 : element * 32767;
  }

  return {
    data: arrayBufferToBase64(int16),
    mimeType: `audio/pcm;rate=${sampleRate}`,
  };
}

export function getAudioLevel(samples: ArrayLike<number>) {
  if (!samples.length) return 0;

  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }

  return Math.min(1, Math.sqrt(sum / samples.length) * 4);
}

function arrayBufferToBase64(data: Int16Array) {
  const bytes = new Uint8Array(data.buffer);

  let str = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    str += String.fromCharCode(bytes[i]);
  }

  return btoa(str);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
