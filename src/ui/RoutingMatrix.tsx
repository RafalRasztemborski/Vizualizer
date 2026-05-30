import type {
  NumericRecord,
  RouteMapping,
  RouteProcessor,
} from '../core/types';
import { getRouteStateKey } from '../routing/routing';

const PROCESSORS: RouteProcessor[] = ['raw', 'lerp', 'envelope', 'spring'];
const GATEWAY_MODES = ['none', 'active'] as const;

type RouteControlProps = {
  route: RouteMapping;
  onChange: (route: RouteMapping) => void;
};

type Props = {
  routes: RouteMapping[];
  sourceKeys: string[];
  sourceValues: NumericRecord;
  routeStates: NumericRecord;
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
  routeStates,
  targetKeys,
  onAdd,
  onChange,
  onRemove,
}: Props) {
  return (
    <section className="panel">
      <div className="panelHeader">
        <h2>Routing</h2>
        <button type="button" onClick={onAdd}>
          +
        </button>
      </div>

      <div className="routes">
        {routes.map((route) => {
          const stateKey = getRouteStateKey(route.id, 'value');
          const inputVal = sourceValues[route.source] ?? 0;

          // Próba pobrania wartości: najpierw dedykowany klucz trasy,
          // potem ogólna wartość parametru, na końcu 0.
          // console.log('routeStates', routeStates);
          // console.log('stateKey', stateKey);
          // console.log('routeStates?.[stateKey]', routeStates?.[stateKey]);
          // console.log(
          //   'routeStates?.[route.target]',
          //   routeStates?.[route.target],
          // );
          const outputVal =
            routeStates?.[stateKey] ?? routeStates?.[route.target] ?? 0;

          // Flaga sprawdzająca, czy dane pochodzą z poprawnego obiektu
          const hasLiveState = typeof routeStates?.[stateKey] === 'number';

          const outputPct =
            ((outputVal - route.min) / Math.max(0.01, route.max - route.min)) *
            100;

          return (
            <div className="route" key={route.id}>
              <div className="routeSelects">
                <label>
                  <span>Source</span>
                  <select
                    value={route.source}
                    onChange={(event) =>
                      onChange({ ...route, source: event.target.value })
                    }
                  >
                    {sourceKeys.map((key) => (
                      <option key={key} value={key}>
                        {key}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Target</span>
                  <select
                    value={route.target}
                    onChange={(event) =>
                      onChange({ ...route, target: event.target.value })
                    }
                  >
                    {targetKeys.map((key) => (
                      <option key={key} value={key}>
                        {key}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Tool</span>
                  <select
                    value={route.processor}
                    onChange={(event) =>
                      onChange({
                        ...route,
                        processor: event.target.value as RouteProcessor,
                      })
                    }
                  >
                    {PROCESSORS.map((processor) => (
                      <option key={processor} value={processor}>
                        {processor}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Gate</span>
                  <select
                    value={route.gatewayMode ?? 'none'}
                    onChange={(event) =>
                      onChange({
                        ...route,
                        gatewayMode: event.target.value as 'none' | 'active',
                      })
                    }
                  >
                    {GATEWAY_MODES.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Smooth</span>
                  <select
                    value={route.smoothingActive ? 'on' : 'off'}
                    onChange={(event) =>
                      onChange({
                        ...route,
                        smoothingActive: event.target.value === 'on',
                      })
                    }
                  >
                    <option value="off">Off</option>
                    <option value="on">On</option>
                  </select>
                </label>
                <label>
                  <span>Post-Lerp</span>
                  <select
                    value={route.lerpActive ? 'on' : 'off'}
                    onChange={(event) =>
                      onChange({
                        ...route,
                        lerpActive: event.target.value === 'on',
                      })
                    }
                  >
                    <option value="off">Off</option>
                    <option value="on">On</option>
                  </select>
                </label>
                <div
                  className="routeStatus"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto 1fr',
                    alignItems: 'center',
                    gap: '8px',
                    minWidth: '110px',
                  }}
                >
                  {/* Input Monitor */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                    }}
                  >
                    <output style={{ fontSize: '10px', textAlign: 'center' }}>
                      {inputVal.toFixed(2)}
                    </output>
                    <div
                      className="meter-bg"
                      style={{
                        height: '3px',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '1px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        className="meter-fill"
                        style={{
                          width: `${Math.min(100, inputVal * 100)}%`,
                          height: '100%',
                          backgroundColor:
                            inputVal > 0.9 ? '#ff4d4d' : '#4ade80',
                          transition: 'width 0.05s ease-out',
                        }}
                      />
                    </div>
                  </div>

                  <span style={{ opacity: 0.5, fontSize: '10px' }}>→</span>

                  {/* Output Monitor */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                    }}
                  >
                    <output
                      style={{
                        fontSize: '10px',
                        textAlign: 'center',
                        fontWeight: 'bold',
                        color: '#60a5fa',
                      }}
                    >
                      {outputVal.toFixed(1)}
                    </output>
                    <div
                      className="meter-bg"
                      style={{
                        height: '3px',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '1px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        className="meter-fill"
                        style={{
                          width: `${Math.max(0, Math.min(100, outputPct))}%`,
                          height: '100%',
                          backgroundColor: hasLiveState ? '#60a5fa' : '#94a3b8',
                          boxShadow: hasLiveState ? '0 0 4px #60a5fa' : 'none',
                          transition: 'width 0.05s ease-out',
                        }}
                      />
                    </div>
                  </div>
                </div>
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
                {route.smoothingActive && (
                  <>
                    <RangeControl
                      label="Płynność"
                      min={0}
                      max={1}
                      step={0.01}
                      value={route.smoothWeightPrev ?? 0.8}
                      onChange={(value) =>
                        onChange({ ...route, smoothWeightPrev: value })
                      }
                    />
                    <RangeControl
                      label="Responsywność"
                      min={0}
                      max={1}
                      step={0.01}
                      value={route.smoothWeightNew ?? 0.2}
                      onChange={(value) =>
                        onChange({ ...route, smoothWeightNew: value })
                      }
                    />
                  </>
                )}
                {route.lerpActive && (
                  <RangeControl
                    label="Post-Lerp Amt"
                    min={0.001}
                    max={1}
                    step={0.001}
                    value={route.lerpAmount ?? 0.1}
                    onChange={(value) =>
                      onChange({ ...route, lerpAmount: value })
                    }
                  />
                )}
                {route.gatewayMode === 'active' && (
                  <>
                    <RangeControl
                      label="Gate Thr"
                      min={0}
                      max={1}
                      step={0.01}
                      value={route.gatewayThreshold ?? 0}
                      onChange={(value) =>
                        onChange({ ...route, gatewayThreshold: value })
                      }
                    />
                    <RangeControl
                      label="Gate Decay"
                      min={0.001}
                      max={0.5}
                      step={0.001}
                      value={route.gatewayDecay ?? 0.05}
                      onChange={(value) =>
                        onChange({ ...route, gatewayDecay: value })
                      }
                    />
                  </>
                )}
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
                <button
                  type="button"
                  onClick={() =>
                    onChange({ ...route, enabled: !route.enabled })
                  }
                >
                  {route.enabled ? 'on' : 'off'}
                </button>
                <button type="button" onClick={() => onRemove(route.id)}>
                  x
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
