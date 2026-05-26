import type { NumericRecord, RouteMapping } from '../core/types';

type Props = {
  routes: RouteMapping[];
  sourceKeys: string[];
  sourceValues: NumericRecord;
  targetKeys: string[];
  onAdd: () => void;
  onChange: (route: RouteMapping) => void;
  onRemove: (id: string) => void;
};

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
              <output>{(sourceValues[route.source] ?? 0).toFixed(3)}</output>
            </div>

            <div className="routeControls">
              <label>
                <span>Amount</span>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.01"
                  value={route.amount}
                  onChange={(event) => onChange({ ...route, amount: Number(event.target.value) })}
                />
              </label>
              <label>
                <span>Smooth</span>
                <input
                  type="range"
                  min="0.01"
                  max="1"
                  step="0.01"
                  value={route.smoothing}
                  onChange={(event) => onChange({ ...route, smoothing: Number(event.target.value) })}
                />
              </label>
              <label>
                <span>Min</span>
                <input
                  type="number"
                  value={route.min}
                  onChange={(event) => onChange({ ...route, min: Number(event.target.value) })}
                />
              </label>
              <label>
                <span>Max</span>
                <input
                  type="number"
                  value={route.max}
                  onChange={(event) => onChange({ ...route, max: Number(event.target.value) })}
                />
              </label>
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
