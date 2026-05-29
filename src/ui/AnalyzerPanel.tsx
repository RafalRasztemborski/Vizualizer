import { useState } from 'react';
import type { AnalyzerConfig, ReactiveSignals } from '../core/types';
import { inferConfigControls } from '../audio/audioBands';

type Props = {
  config: AnalyzerConfig;
  signals: ReactiveSignals;
  fps: number;
  onConfigChange: (key: string, value: number) => void;
};

function fpsTone(fps: number) {
  if (fps >= 50) return 'good';
  if (fps >= 30) return 'warn';
  return 'bad';
}

export function AnalyzerPanel({ config, signals, fps, onConfigChange }: Props) {
  const [showControls, setShowControls] = useState(true);
  const [showSignals, setShowSignals] = useState(true);

  return (
    <section className="analyzerOverlay" aria-label="Audio analyzer">
      <header className="analyzerTopBar">
        <h2>Analyzer</h2>
        <output className={`fpsReadout ${fpsTone(fps)}`}>
          {Math.round(fps)}
          <span>fps</span>
        </output>
      </header>

      <div className="analyzerSegments">
        <section className="analyzerSegment">
          <button
            className="segmentToggle"
            type="button"
            aria-expanded={showControls}
            onClick={() => setShowControls((current) => !current)}
          >
            <span>Sliders</span>
            <b>{showControls ? 'Hide' : 'Show'}</b>
          </button>

          {showControls ? (
            <div className="analyzerControlList">
              {inferConfigControls(config).map((control) => (
                <label className="control compactControl" key={control.key}>
                  <span>
                    {control.label}
                    <strong>
                      {Number(config[control.key]).toFixed(
                        control.step < 0.01 ? 3 : 2,
                      )}
                    </strong>
                  </span>
                  <input
                    type="range"
                    min={control.min}
                    max={control.max}
                    step={control.step}
                    value={config[control.key]}
                    onChange={(event) =>
                      onConfigChange(control.key, Number(event.target.value))
                    }
                  />
                </label>
              ))}
            </div>
          ) : null}
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
            <div className="meters compactMeters">
              {Object.entries(signals)
                .filter(
                  (entry): entry is [string, number] =>
                    typeof entry[1] === 'number' && Number.isFinite(entry[1]),
                )
                .map(([key, value]) => (
                  <div className="meter compactMeter" key={key}>
                    <span>{key}</span>
                    <div>
                      <i
                        style={{
                          transform: `scaleX(${Math.max(
                            0,
                            Math.min(1, value),
                          )})`,
                        }}
                      />
                    </div>
                    <b>{value.toFixed(3)}</b>
                  </div>
                ))}
            </div>
          ) : null}
        </section>
      </div>
    </section>
  );
}
