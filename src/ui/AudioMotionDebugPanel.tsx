import { useEffect, useMemo, useRef, useState } from 'react';
import AudioMotionAnalyzer, {
  type FrequencyScale,
} from 'audiomotion-analyzer';
import type { ReactiveSignals } from '../core/types';
import type { AudioEngine } from '../audio/AudioEngine';

type Props = {
  audioEngine: AudioEngine;
  signals: ReactiveSignals;
  version: number;
  onMonitorSignals?: (signals: AudioMotionMonitorSignals) => void;
};

export const AUDIO_MOTION_SIGNAL_KEYS = [
  'audioMotionBass',
  'audioMotionLowMid',
  'audioMotionMid',
  'audioMotionHighMid',
  'audioMotionTreble',
  'audioMotionOverall',
  'audioMotionPeak',
  'audioMotionKick',
  'audioMotionSnare',
] as const;

type ViewMode = 'bars' | 'graph' | 'radial' | 'mirror' | 'octave';

export type AudioMotionMonitorSignals = Record<
  (typeof AUDIO_MOTION_SIGNAL_KEYS)[number],
  number
>;

export const EMPTY_AUDIO_MOTION_SIGNALS: AudioMotionMonitorSignals =
  Object.fromEntries(AUDIO_MOTION_SIGNAL_KEYS.map((key) => [key, 0])) as
    AudioMotionMonitorSignals;

const VIEW_MODES: { value: ViewMode; label: string }[] = [
  { value: 'bars', label: 'Spectrum bars' },
  { value: 'graph', label: 'Line / area graph' },
  { value: 'radial', label: 'Radial spectrum' },
  { value: 'mirror', label: 'Mirrored view' },
  { value: 'octave', label: 'Octave bands' },
];

const GRADIENTS = ['classic', 'prism', 'rainbow', 'orangered', 'steelblue'];

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function signalPeak(...values: number[]) {
  return clamp01(Math.max(...values.map((value) => value || 0)));
}

function StatusMeter({
  label,
  value,
  active,
}: {
  label: string;
  value: number;
  active?: boolean;
}) {
  const clamped = clamp01(value);

  return (
    <div className={`debugMeter${active ? ' is-active' : ''}`}>
      <span>{label}</span>
      <div>
        <i style={{ transform: `scaleX(${clamped})` }} />
      </div>
      <b>{clamped.toFixed(3)}</b>
    </div>
  );
}

export function AudioMotionDebugPanel({
  audioEngine,
  signals,
  version,
  onMonitorSignals,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const analyzerRef = useRef<AudioMotionAnalyzer | null>(null);
  const previousEnergyRef = useRef({ bass: 0, snareBand: 0 });
  const [enabled, setEnabled] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('bars');
  const [frequencyScale, setFrequencyScale] = useState<FrequencyScale>('log');
  const [gradient, setGradient] = useState('prism');
  const [ledBars, setLedBars] = useState(false);
  const [lumiBars, setLumiBars] = useState(false);
  const [showPeaks, setShowPeaks] = useState(true);

  const modeOptions = useMemo(() => {
    const isGraph = viewMode === 'graph';
    const isRadial = viewMode === 'radial';
    const isMirror = viewMode === 'mirror';
    const isOctave = viewMode === 'octave';

    return {
      mode: isGraph ? 10 : isOctave ? 6 : 0,
      radial: isRadial,
      mirror: isMirror ? 1 : 0,
      frequencyScale: isOctave ? 'log' : frequencyScale,
      ledBars: !isGraph && !isRadial && ledBars,
      lumiBars: !isGraph && !isRadial && lumiBars,
      fillAlpha: isGraph ? 0.35 : 0.95,
      lineWidth: isGraph ? 2 : 0,
      reflexRatio: isMirror ? 0.28 : 0,
    };
  }, [frequencyScale, ledBars, lumiBars, viewMode]);

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const monitorNode = audioEngine.audioMonitorNode;
    const audioContext = audioEngine.audioContext;

    if (!monitorNode || !audioContext) return;

    const analyzer = new AudioMotionAnalyzer(containerRef.current, {
      audioCtx: audioContext,
      source: monitorNode,
      connectSpeakers: false,
      height: 260,
      fftSize: 8192,
      maxFPS: 60,
      minFreq: 20,
      maxFreq: Math.min(20000, audioContext.sampleRate / 2),
      minDecibels: -85,
      maxDecibels: -25,
      smoothing: 0.65,
      bgAlpha: 0.88,
      gradient,
      colorMode: 'bar-level',
      showScaleX: true,
      showScaleY: false,
      showPeaks,
      overlay: false,
      ...modeOptions,
    });

    analyzerRef.current = analyzer;
    analyzer.start();

    let raf = 0;
    const publishMonitorSignals = () => {
      const bass = analyzer.getEnergy('bass') ?? 0;
      const lowMid = analyzer.getEnergy('lowMid') ?? 0;
      const mid = analyzer.getEnergy('mid') ?? 0;
      const highMid = analyzer.getEnergy('highMid') ?? 0;
      const treble = analyzer.getEnergy('treble') ?? 0;
      const overall = analyzer.getEnergy() ?? 0;
      const peak = analyzer.getEnergy('peak') ?? 0;
      const snareBand = Math.max(mid, highMid);
      const previous = previousEnergyRef.current;
      const kick = clamp01(Math.max(0, bass - previous.bass) * 4 + peak * 0.15);
      const snare = clamp01(
        Math.max(0, snareBand - previous.snareBand) * 3 + highMid * 0.35,
      );

      previousEnergyRef.current = { bass, snareBand };

      onMonitorSignals?.({
        audioMotionBass: clamp01(bass),
        audioMotionLowMid: clamp01(lowMid),
        audioMotionMid: clamp01(mid),
        audioMotionHighMid: clamp01(highMid),
        audioMotionTreble: clamp01(treble),
        audioMotionOverall: clamp01(overall),
        audioMotionPeak: clamp01(peak),
        audioMotionKick: kick,
        audioMotionSnare: snare,
      });

      raf = requestAnimationFrame(publishMonitorSignals);
    };

    raf = requestAnimationFrame(publishMonitorSignals);

    return () => {
      cancelAnimationFrame(raf);
      analyzerRef.current = null;
      previousEnergyRef.current = { bass: 0, snareBand: 0 };
      onMonitorSignals?.(EMPTY_AUDIO_MOTION_SIGNALS);
      analyzer.destroy();
    };
  }, [
    audioEngine,
    enabled,
    gradient,
    modeOptions,
    onMonitorSignals,
    showPeaks,
    version,
  ]);

  useEffect(() => {
    const analyzer = analyzerRef.current;
    if (!analyzer) return;

    analyzer.setOptions({
      gradient,
      showPeaks,
      ...modeOptions,
    });
  }, [gradient, modeOptions, showPeaks]);

  const hasMonitorSource = Boolean(audioEngine.audioMonitorNode);
  const overallEnergy = signalPeak(
    signals.bass,
    signals.mid,
    signals.high,
    signals.flux,
    signals.onset,
  );
  const beatPhase = clamp01(signals.beatPhase ?? 0);
  const kick = signalPeak(signals.kick, signals.kickEnergy, signals.detectedKick);
  const snare = signalPeak(signals.band3, signals.band4, signals.onset * 0.65);

  return (
    <section className="audioMotionPanel" aria-label="Audio signal monitor">
      <header className="audioMotionHeader">
        <div>
          <h2>Audio Signal Monitor</h2>
          <p>{enabled ? 'AudioMotion Debug View' : 'standby'}</p>
        </div>
        <button
          type="button"
          className={enabled ? 'isActive' : ''}
          onClick={() => setEnabled((current) => !current)}
        >
          {enabled ? 'Disable' : 'Enable'}
        </button>
      </header>

      {enabled ? (
        <>
          <div className="audioMotionCanvas" ref={containerRef}>
            {!hasMonitorSource ? (
              <div className="audioMotionEmpty">No audio source</div>
            ) : null}
          </div>

          <div className="debugMeters">
            <StatusMeter label="Bass energy" value={signals.bass} />
            <StatusMeter label="Mid energy" value={signals.mid} />
            <StatusMeter label="Treble energy" value={signals.high} />
            <StatusMeter label="Overall energy" value={overallEnergy} />
            <StatusMeter label="BPM beat phase" value={beatPhase} />
            <StatusMeter label="Kick indicator" value={kick} active={kick > 0.08} />
            <StatusMeter
              label="Snare indicator"
              value={snare}
              active={snare > 0.12}
            />
          </div>

          <div className="audioMotionControls">
            <label className="control compactControl">
              <span>View mode</span>
              <select
                value={viewMode}
                onChange={(event) => setViewMode(event.target.value as ViewMode)}
              >
                {VIEW_MODES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="control compactControl">
              <span>Frequency scale</span>
              <select
                value={frequencyScale}
                onChange={(event) =>
                  setFrequencyScale(event.target.value as FrequencyScale)
                }
                disabled={viewMode === 'octave'}
              >
                <option value="log">Log</option>
                <option value="linear">Linear</option>
                <option value="mel">Mel</option>
                <option value="bark">Bark</option>
              </select>
            </label>

            <label className="control compactControl">
              <span>Gradient</span>
              <select
                value={gradient}
                onChange={(event) => setGradient(event.target.value)}
              >
                {GRADIENTS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="toggle compactToggle">
              <input
                type="checkbox"
                checked={ledBars}
                onChange={(event) => setLedBars(event.target.checked)}
                disabled={viewMode === 'graph' || viewMode === 'radial'}
              />
              <span>LED bars</span>
            </label>

            <label className="toggle compactToggle">
              <input
                type="checkbox"
                checked={lumiBars}
                onChange={(event) => setLumiBars(event.target.checked)}
                disabled={viewMode === 'graph' || viewMode === 'radial'}
              />
              <span>Lumi bars</span>
            </label>

            <label className="toggle compactToggle">
              <input
                type="checkbox"
                checked={showPeaks}
                onChange={(event) => setShowPeaks(event.target.checked)}
              />
              <span>Peaks</span>
            </label>
          </div>
        </>
      ) : null}
    </section>
  );
}
