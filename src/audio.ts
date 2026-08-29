export function pcmToBase64(pcmData: Float32Array): string {
  const buffer = new ArrayBuffer(pcmData.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < pcmData.length; i++) {
    // Convert Float32 (-1.0 to 1.0) to Int16 (-32768 to 32767)
    let s = Math.max(-1, Math.min(1, pcmData[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  
  // Convert ArrayBuffer to Base64
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function playAudioChunk(audioCtx: AudioContext, base64Audio: string, nextStartTimeRef: { current: number }, activeSources: AudioBufferSourceNode[]) {
  const binaryString = atob(base64Audio);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Live API returns 24kHz 16-bit PCM little-endian
  const numSamples = bytes.byteLength / 2;
  const audioBuffer = audioCtx.createBuffer(1, numSamples, 24000);
  const channelData = audioBuffer.getChannelData(0);

  const dataView = new DataView(bytes.buffer);
  for (let i = 0; i < numSamples; i++) {
    const int16 = dataView.getInt16(i * 2, true);
    channelData[i] = int16 / 32768.0;
  }

  const source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioCtx.destination);

  // Gapless playback scheduling
  if (nextStartTimeRef.current < audioCtx.currentTime) {
    nextStartTimeRef.current = audioCtx.currentTime;
  }
  
  source.start(nextStartTimeRef.current);
  nextStartTimeRef.current += audioBuffer.duration;
  
  activeSources.push(source);
  source.onended = () => {
    const index = activeSources.indexOf(source);
    if (index > -1) {
      activeSources.splice(index, 1);
    }
  };
  
  return source;
}
