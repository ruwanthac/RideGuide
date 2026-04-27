import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

export interface PcmFrame {
  dataBase64: string;
  sampleRate: number;
  channels: number;
  sequence: number;
  timestamp: number;
}

export interface PcmCaptureController {
  stop: () => Promise<void>;
}

function pcmBytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode(...sub);
  }
  return btoa(binary);
}

function downsampleTo16k(input: Float32Array, inputRate: number): Int16Array {
  if (inputRate === 16000) {
    const same = new Int16Array(input.length);
    for (let i = 0; i < input.length; i += 1) {
      const s = Math.max(-1, Math.min(1, input[i]));
      same[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return same;
  }
  const ratio = inputRate / 16000;
  const outLength = Math.max(1, Math.floor(input.length / ratio));
  const out = new Int16Array(outLength);
  for (let i = 0; i < outLength; i += 1) {
    const idx = Math.floor(i * ratio);
    const s = Math.max(-1, Math.min(1, input[idx] || 0));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

async function startWebPcmCapture(onFrame: (frame: PcmFrame) => void): Promise<PcmCaptureController> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      noiseSuppression: true,
      echoCancellation: true,
      autoGainControl: true,
    },
  });
  const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
  const context = new AudioCtx();
  const source = context.createMediaStreamSource(stream);
  const processor = context.createScriptProcessor(1024, 1, 1);
  let sequence = 0;
  source.connect(processor);
  processor.connect(context.destination);
  processor.onaudioprocess = (event: AudioProcessingEvent) => {
    const channel = event.inputBuffer.getChannelData(0);
    const pcm16 = downsampleTo16k(channel, context.sampleRate);
    const bytes = new Uint8Array(pcm16.buffer);
    onFrame({
      dataBase64: pcmBytesToBase64(bytes),
      sampleRate: 16000,
      channels: 1,
      sequence: sequence++,
      timestamp: Date.now(),
    });
  };
  return {
    stop: async () => {
      processor.disconnect();
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      await context.close();
    },
  };
}

export async function startPcmCapture(
  onFrame: (frame: PcmFrame) => void
): Promise<PcmCaptureController> {
  if (Platform.OS === 'web') {
    return startWebPcmCapture(onFrame);
  }

  const nativeModule = (NativeModules as any)?.PcmCaptureModule;
  if (!nativeModule) {
    throw new Error('Native PCM capture module unavailable on this build.');
  }

  const emitter = new NativeEventEmitter(nativeModule);
  const sub = emitter.addListener('pcmFrame', (payload: any) => {
    if (!payload?.dataBase64) return;
    onFrame({
      dataBase64: String(payload.dataBase64),
      sampleRate: Number(payload.sampleRate || 16000),
      channels: Number(payload.channels || 1),
      sequence: Number(payload.sequence || 0),
      timestamp: Number(payload.timestamp || Date.now()),
    });
  });

  await nativeModule.start({
    sampleRate: 16000,
    channels: 1,
    frameMs: 30,
  });

  return {
    stop: async () => {
      sub.remove();
      await nativeModule.stop();
    },
  };
}
