import type { AnalyzerConfig, ReactiveSignals } from '../core/types';

export const DEFAULT_AUDIO_BAND_CONFIG = {
  noiseThreshold: 35,
  kickAttack: 0.7,
  bassSmooth: 0.2,
  midSmooth: 0.3,
  highSmooth: 0.4,
  sidechainDuckFactor: 0.4,
  sidechainThreshold: 0.25,
  kickMinInterval: 120,
  kickThreshold: 0.05,
  kickDecay: 0.85,
} satisfies AnalyzerConfig;

export const EMPTY_SIGNALS: ReactiveSignals = {
  detectedKick: 0,
  kick: 0,
  bassWithoutKick: 0,
  cleanedBass: 0,
  bass: 0,
  mid: 0,
  high: 0,
  lastKickTime: 0,
  kickEnergy: 0,
  nyquist: 22050,
  dataArray: [],
};

export function inferConfigControls(config: AnalyzerConfig) {
  return Object.entries(config).map(([key, value]) => {
    const isMs = key.toLowerCase().includes('interval') || key.toLowerCase().includes('time');
    const isThreshold = key.toLowerCase().includes('threshold');
    const isDecay = key.toLowerCase().includes('decay');

    return {
      key,
      label: key,
      min: isMs ? 0 : 0,
      max: isMs ? 500 : isThreshold && value > 1 ? 255 : 1,
      step: isMs ? 1 : isDecay ? 0.01 : 0.001,
      defaultValue: value,
    };
  });
}

export function processAudioBands(
  dataArray: Uint8Array,
  sampleRate: number,
  currentBands: Partial<ReactiveSignals> = EMPTY_SIGNALS,
  customConfig: Partial<typeof DEFAULT_AUDIO_BAND_CONFIG> = {},
): ReactiveSignals {
  const config = { ...DEFAULT_AUDIO_BAND_CONFIG, ...customConfig };
  const normalizedDataArray = new Array<number>(dataArray.length).fill(0);

  let bassSum = 0;
  let bassCount = 0;
  let midSum = 0;
  let midCount = 0;
  let highSum = 0;
  let highCount = 0;
  let kickLow = 0;
  let kickHigh = 0;
  let kickLowCount = 0;
  let kickHighCount = 0;

  const len = dataArray.length;
  const maxFreq = sampleRate / 2;

  for (let i = 0; i < len; i += 1) {
    const freq = (i * maxFreq) / len;
    const rawValue = dataArray[i] ?? 0;
    const currentThreshold =
      freq < 250 ? Math.floor(config.noiseThreshold * 0.5) : config.noiseThreshold;
    const denominator = 255 - currentThreshold;
    const v =
      rawValue > currentThreshold && denominator > 0
        ? Math.max(0, (rawValue - currentThreshold) / denominator)
        : 0;
    normalizedDataArray[i] = v;

    if (freq >= 40 && freq < 90) {
      kickLow += v;
      kickLowCount += 1;
    }

    if (freq >= 2000 && freq < 5000) {
      kickHigh += v;
      kickHighCount += 1;
    }

    if (freq >= 20 && freq < 50) {
      bassSum += v;
      bassCount += 1;
    } else if (freq >= 110 && freq < 3500) {
      midSum += v;
      midCount += 1;
    } else if (freq >= 3500) {
      highSum += v;
      highCount += 1;
    }
  }

  const low = kickLowCount ? kickLow / kickLowCount : 0;
  const highTransientBand = kickHighCount ? kickHigh / kickHighCount : 0;
  const rawKick = low * 0.6 + highTransientBand * 0.4;
  const rawBass = bassCount ? bassSum / bassCount : 0;
  const rawMid = midCount ? midSum / midCount : 0;
  const rawHigh = highCount ? highSum / highCount : 0;

  const prevKick = currentBands.kick ?? 0;
  const prevBass = currentBands.bass ?? 0;
  const prevMid = currentBands.mid ?? 0;
  const prevHigh = currentBands.high ?? 0;
  const smoothKick = prevKick + (rawKick - prevKick) * config.kickAttack;

  let dynamicBass = rawBass;
  if (smoothKick > config.sidechainThreshold) {
    dynamicBass = Math.max(0, dynamicBass - smoothKick * config.sidechainDuckFactor);
  }

  const now = performance.now();
  const prevKickEnergy = currentBands.kickEnergy ?? 0;
  const lastKickTime = currentBands.lastKickTime ?? 0;
  const kickDelta = Math.max(0, rawKick - prevKick);
  const kickEnergy = Math.max(kickDelta, prevKickEnergy * config.kickDecay);
  const timeSinceLastKick = now - lastKickTime;

  let detectedKick = 0;
  let newLastKickTime = lastKickTime;

  if (kickEnergy > config.kickThreshold && timeSinceLastKick > config.kickMinInterval) {
    detectedKick = kickEnergy;
    newLastKickTime = now;
  }

  return {
    detectedKick,
    kick: kickDelta,
    bassWithoutKick: Math.max(0, rawBass - kickDelta * 1.5),
    cleanedBass: Math.max(0, rawBass - rawKick),
    bass: prevBass + (dynamicBass - prevBass) * config.bassSmooth,
    mid: prevMid + (rawMid - prevMid) * config.midSmooth,
    high: prevHigh + (rawHigh - prevHigh) * config.highSmooth,
    lastKickTime: newLastKickTime,
    kickEnergy,
    nyquist: maxFreq,
    dataArray: normalizedDataArray,
  };
}
