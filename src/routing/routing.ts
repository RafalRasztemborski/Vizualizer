import type { NumericRecord, RouteMapping, SketchParams } from '../core/types';

const stateKey = (route: RouteMapping, key: string) => `__route:${route.id}:${key}`;

export function createRoute(source: string, target: string): RouteMapping {
  return {
    id: crypto.randomUUID(),
    source,
    target,
    processor: 'lerp',
    amount: 1,
    smoothing: 0.25,
    attack: 0.35,
    decay: 0.18,
    sustain: 0,
    min: 0,
    max: 100,
    enabled: true,
  };
}

function processRoute(route: RouteMapping, sourceValue: number, mappedValue: number, previous: NumericRecord) {
  const valueKey = stateKey(route, 'value');
  const velocityKey = stateKey(route, 'velocity');
  const sourceKey = stateKey(route, 'source');
  const prev = previous[valueKey] ?? 0;

  if (route.processor === 'raw') {
    return mappedValue;
  }

  if (route.processor === 'envelope') {
    const prevSource = previous[sourceKey] ?? 0;
    const envelope = previous[stateKey(route, 'envelope')] ?? 0;
    const attack = Math.max(0.001, route.attack);
    const decay = Math.max(0.001, route.decay);
    const sustain = Math.max(0, Math.min(1, route.sustain));
    const isRising = sourceValue > prevSource || sourceValue > envelope;
    const targetEnvelope = isRising ? sourceValue : sourceValue * sustain;
    const nextEnvelope = envelope + (targetEnvelope - envelope) * (isRising ? attack : decay);

    previous[stateKey(route, 'envelope')] = Number.isFinite(nextEnvelope) ? nextEnvelope : envelope;
    previous[sourceKey] = sourceValue;
    return route.min + nextEnvelope * route.amount * (route.max - route.min);
  }

  if (route.processor === 'spring') {
    const stiffness = Math.max(0.001, route.attack);
    const damping = 1 - Math.max(0, Math.min(0.98, route.decay));
    const velocity = previous[velocityKey] ?? 0;
    const nextVelocity = (velocity + (mappedValue - prev) * stiffness) * damping;
    previous[velocityKey] = Number.isFinite(nextVelocity) ? nextVelocity : 0;
    return prev + nextVelocity;
  }

  return prev + (mappedValue - prev) * route.smoothing;
}

export function applyRouting(
  baseParams: SketchParams,
  routes: RouteMapping[],
  sources: NumericRecord,
  previous: NumericRecord,
) {
  const routed: NumericRecord = {};

  for (const route of routes) {
    if (!route.enabled) continue;

    const sourceValue = sources[route.source] ?? 0;
    const mappedValue = route.min + sourceValue * route.amount * (route.max - route.min);
    const next = processRoute(route, sourceValue, mappedValue, previous);
    const safeNext = Number.isFinite(next) ? next : 0;

    previous[stateKey(route, 'value')] = safeNext;
    routed[route.target] = (routed[route.target] ?? 0) + safeNext;
  }

  for (const [key, value] of Object.entries(previous)) {
    if (key.startsWith('__route:')) {
      routed[key] = value;
    }
  }

  return routed;
}
