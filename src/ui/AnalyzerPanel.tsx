import React, { useState } from 'react';
import type { ReactiveSignals } from '../core/types';
import type { AudioEngineConfig } from '../audio/AudioEngine';
import { AUDIO_ENGINE_CONTROLS } from '../audio/AudioEngine';

type Props = {
  config: AudioEngineConfig;
  signals: ReactiveSignals;
  fps: number;
  onConfigChange: (key: keyof AudioEngineConfig, value: number) => void;
};

function fpsTone(fps: number) {
  if (fps >= 50) return 'good';
  if (fps >= 30) return 'warn';
  return 'bad';
}

const SignalMeter = React.memo(
  ({ label, value }: { label: string; value: number }) => (
    <div className="meter compactMeter">
      <span>{label}</span>
      <div>
        <i
          style={{
            transform: `scaleX(${Math.max(0, Math.min(1, value))})`,
            transition: 'none',
          }}
        />
      </div>
      <b>{value.toFixed(3)}</b>
    </div>
  ),
);

export const AnalyzerPanel = React.memo(
  ({ config, signals, fps, onConfigChange }: Props) => {
    const [showSignals, setShowSignals] = useState(true);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const signalEntries = [
      ['centroid', signals.centroid],
      ['flux', signals.flux],
      ['onset', signals.onset],
      ['beatPhase', signals.beatPhase ?? 0],
      ['band0', signals.band0],
      ['band1', signals.band1],
      ['band2', signals.band2],
      ['band3', signals.band3],
      ['band4', signals.band4],
      ['band5', signals.band5],
    ] as const;

    return (
      <section className="analyzerOverlay" aria-label="Audio analyzer">
        <header className="analyzerTopBar futuristic">
          <h2>Futuristic Analyzer</h2>
          <div className="topRight">
            <div className={`fpsReadout ${fpsTone(fps)}`}>
              <strong>{Math.round(fps)}</strong>
              <span>FPS</span>
            </div>
            <div className="waveIndicator" aria-hidden>
              <svg width="60" height="30" viewBox="0 0 60 30">
                <path
                  d="M0 20 Q15 5 30 20 T60 20"
                  stroke="#6ff"
                  strokeWidth="1.5"
                  fill="none"
                  opacity="0.6"
                />
              </svg>
            </div>
          </div>
        </header>

        <div className="analyzerSegments">
          <section className="analyzerSegment advancedSummary">
            <button
              className="segmentToggle"
              type="button"
              onClick={() => setShowAdvanced(true)}
            >
              <span>Advanced Audio</span>
              <b>Open</b>
            </button>
            <div className="advancedHint">
              Configure temporal smoothing, lookahead and onset detection.
            </div>
          </section>

          <section className="analyzerSegment">
            <button
              className="segmentToggle"
              type="button"
              aria-expanded={showSignals}
              onClick={() => setShowSignals((current) => !current)}
            >
              <span>Signals</span>
              <b>{showSignals ? 'Hide' : 'Show'}</b>
            </button>

            {showSignals ? (
              <div className="analyzerControlList">
                {signalEntries.map(([label, value]) => (
                  <SignalMeter key={label} label={label} value={value ?? 0} />
                ))}
              </div>
            ) : null}
          </section>
        </div>

        {showAdvanced ? (
          <div className="advancedOverlay" role="dialog" aria-modal="true">
            <div className="advancedDrawer">
              <header className="advancedHeader">
                <div>
                  <h3>Advanced Audio Config</h3>
                  <p>Tune temporal analyzer parameters here.</p>
                </div>
                <button
                  className="segmentToggle"
                  type="button"
                  onClick={() => setShowAdvanced(false)}
                >
                  Close
                </button>
              </header>
              <div className="analyzerControlList">
                {Object.entries(config).map(([key, value]) => {
                  const control =
                    AUDIO_ENGINE_CONTROLS[key as keyof AudioEngineConfig];
                  return (
                    <label className="control compactControl" key={key}>
                      <span>
                        {control?.label ?? key}
                        <strong>{Number(value).toFixed(3)}</strong>
                      </span>
                      <input
                        type="range"
                        min={control?.min ?? 0}
                        max={control?.max ?? Number(value) * 2}
                        step={control?.step ?? 0.01}
                        value={value}
                        onChange={(event) =>
                          onConfigChange(
                            key as keyof AudioEngineConfig,
                            Number(event.target.value),
                          )
                        }
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </section>
    );
  },
);
