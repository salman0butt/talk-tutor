class MicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetFrames = Math.max(128, Math.round(sampleRate * 0.02));
    this.pending = new Float32Array(this.targetFrames);
    this.pendingOffset = 0;
  }

  process(inputs) {
    const input = inputs[0];
    const channelData = input?.[0];
    if (!channelData?.length) return true;

    let sourceOffset = 0;

    while (sourceOffset < channelData.length) {
      const remainingTarget = this.targetFrames - this.pendingOffset;
      const remainingSource = channelData.length - sourceOffset;
      const copyLength = Math.min(remainingTarget, remainingSource);

      this.pending.set(
        channelData.subarray(sourceOffset, sourceOffset + copyLength),
        this.pendingOffset,
      );

      this.pendingOffset += copyLength;
      sourceOffset += copyLength;

      if (this.pendingOffset === this.targetFrames) {
        const pcm = this.pending;
        this.port.postMessage(pcm, [pcm.buffer]);
        this.pending = new Float32Array(this.targetFrames);
        this.pendingOffset = 0;
      }
    }

    return true;
  }
}

registerProcessor("mic-processor", MicProcessor);
