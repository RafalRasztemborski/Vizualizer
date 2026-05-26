import type { P5SketchModule, SketchParams, SketchParamValue } from '../core/types';

type Props = {
  sketch: P5SketchModule;
  params: SketchParams;
  routedParams: Record<string, number>;
  onChange: (key: string, value: SketchParamValue) => void;
};

export function ParameterControls({ sketch, params, routedParams, onChange }: Props) {
  return (
    <section className="panel">
      <h2>Sketch Params</h2>
      <div className="controlList">
        {sketch.params.map((definition) => {
          const routed = routedParams[definition.key];
          const value = params[definition.key] ?? definition.defaultValue;

          if (definition.type === 'boolean') {
            return (
              <label className="toggle" key={definition.key}>
                <span>{definition.label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(value)}
                  onChange={(event) => onChange(definition.key, event.target.checked)}
                />
              </label>
            );
          }

          if (definition.type === 'select') {
            return (
              <label className="control" key={definition.key}>
                <span>{definition.label}</span>
                <select
                  value={String(value)}
                  onChange={(event) => onChange(definition.key, event.target.value)}
                >
                  {definition.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            );
          }

          return (
            <label className="control" key={definition.key}>
              <span>
                {definition.label}
                <strong>
                  {typeof routed === 'number'
                    ? `${Number(value).toFixed(2)} + ${routed.toFixed(2)}`
                    : Number(value).toFixed(2)}
                </strong>
              </span>
              <input
                type="range"
                min={definition.min}
                max={definition.max}
                step={definition.step}
                value={Number(value)}
                onChange={(event) => onChange(definition.key, Number(event.target.value))}
              />
            </label>
          );
        })}
      </div>
    </section>
  );
}
