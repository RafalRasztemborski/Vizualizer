import type { AnalyzerConfig, ReactiveSignals } from '../core/types';
import { inferConfigControls } from '../audio/audioBands';

type Props = {
  config: AnalyzerConfig;
  signals: ReactiveSignals;
  onConfigChange: (key: string, value: number) => void;
};

export function AnalyzerPanel({ config, signals, onConfigChange }: Props) {
  return (
    <section className="panel">
      <h2>Analyzer</h2>
      <div className="controlList">
        {inferConfigControls(config).map((control) => (
          <label className="control" key={control.key}>
            <span>
              {control.label}
              <strong>{Number(config[control.key]).toFixed(control.step < 0.01 ? 3 : 2)}</strong>
            </span>
            <input
              type="range"
              min={control.min}
              max={control.max}
              step={control.step}
              value={config[control.key]}
              onChange={(event) => onConfigChange(control.key, Number(event.target.value))}
            />
          </label>
        ))}
      </div>

      <h3>Signals</h3>
      <div className="meters">
        {Object.entries(signals)
          .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]))
          .map(([key, value]) => (
            <div className="meter" key={key}>
              <span>{key}</span>
              <div>
                <i style={{ transform: `scaleX(${Math.max(0, Math.min(1, value))})` }} />
              </div>
              <b>{value.toFixed(3)}</b>
            </div>
          ))}
      </div>
    </section>
  );
}
