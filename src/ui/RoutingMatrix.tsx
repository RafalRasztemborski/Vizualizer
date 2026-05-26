import type { NumericRecord, RouteMapping, RouteProcessor } from '../core/types';

const PROCESSORS: RouteProcessor[] = ['raw', 'lerp', 'envelope', 'spring'];

type RouteControlProps = {
  route: RouteMapping;
  onChange: (route: RouteMapping) => void;
};

type Props = {
  routes: RouteMapping[];
  sourceKeys: string[];
  sourceValues: NumericRecord;
  targetKeys: string[];
  onAdd: () => void;
  onChange: (route: RouteMapping) => void;
  onRemove: (id: string) => void;
};

function RangeControl({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      <span>
        {label}
        <b>{value.toFixed(step < 0.01 ? 3 : 2)}</b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function NumberControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function ProcessorControls({ route, onChange }: RouteControlProps) {
  if (route.processor === 'raw') {
    return null;
  }

  if (route.processor === 'lerp') {
    return (
      <RangeControl
        label="Smooth"
        min={0.01}
        max={1}
        step={0.01}
        value={route.smoothing}
        onChange={(value) => onChange({ ...route, smoothing: value })}
      />
    );
  }

  if (route.processor === 'envelope') {
    return (
      <>
        <RangeControl
          label="Attack"
          min={0.001}
          max={1}
          step={0.001}
          value={route.attack}
          onChange={(value) => onChange({ ...route, attack: value })}
        />
        <RangeControl
          label="Decay"
          min={0.001}
          max={1}
          step={0.001}
          value={route.decay}
          onChange={(value) => onChange({ ...route, decay: value })}
        />
        <RangeControl
          label="Sustain"
          min={0}
          max={1}
          step={0.001}
          value={route.sustain}
          onChange={(value) => onChange({ ...route, sustain: value })}
        />
      </>
    );
  }

  return (
    <>
      <RangeControl
        label="Stiffness"
        min={0.001}
        max={1}
        step={0.001}
        value={route.attack}
        onChange={(value) => onChange({ ...route, attack: value })}
      />
      <RangeControl
        label="Damping"
        min={0}
        max={0.98}
        step={0.001}
        value={route.decay}
        onChange={(value) => onChange({ ...route, decay: value })}
      />
    </>
  );
}

export function RoutingMatrix({
  routes,
  sourceKeys,
  sourceValues,
  targetKeys,
  onAdd,
  onChange,
  onRemove,
}: Props) {
  return (
    <section className="panel">
      <div className="panelHeader">
        <h2>Routing</h2>
        <button type="button" onClick={onAdd}>+</button>
      </div>

      <div className="routes">
        {routes.map((route) => (
          <div className="route" key={route.id}>
            <div className="routeSelects">
              <label>
                <span>Source</span>
                <select
                  value={route.source}
                  onChange={(event) => onChange({ ...route, source: event.target.value })}
                >
                  {sourceKeys.map((key) => (
                    <option key={key} value={key}>{key}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Target</span>
                <select
                  value={route.target}
                  onChange={(event) => onChange({ ...route, target: event.target.value })}
                >
                  {targetKeys.map((key) => (
                    <option key={key} value={key}>{key}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Tool</span>
                <select
                  value={route.processor}
                  onChange={(event) =>
                    onChange({ ...route, processor: event.target.value as RouteProcessor })
                  }
                >
                  {PROCESSORS.map((processor) => (
                    <option key={processor} value={processor}>{processor}</option>
                  ))}
                </select>
              </label>
              <output>{(sourceValues[route.source] ?? 0).toFixed(3)}</output>
            </div>

            <div className="routeControls">
              <RangeControl
                label="Amount"
                min={0}
                max={2}
                step={0.01}
                value={route.amount}
                onChange={(value) => onChange({ ...route, amount: value })}
              />
              <ProcessorControls route={route} onChange={onChange} />
              <NumberControl
                label="Min"
                value={route.min}
                onChange={(value) => onChange({ ...route, min: value })}
              />
              <NumberControl
                label="Max"
                value={route.max}
                onChange={(value) => onChange({ ...route, max: value })}
              />
              <button type="button" onClick={() => onChange({ ...route, enabled: !route.enabled })}>
                {route.enabled ? 'on' : 'off'}
              </button>
              <button type="button" onClick={() => onRemove(route.id)}>x</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
