import type { NumericRecord, RouteMapping, SketchParams } from '../core/types';

export const getRouteStateKey = (routeId: string, key: string) =>
  `__route:${routeId}:${key}`;

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
    gatewayMode: 'none',
    gatewayThreshold: 0,
    gatewayDecay: 0.05,
    smoothingActive: false,
    smoothWeightPrev: 0.8,
    smoothWeightNew: 0.2,
    lerpActive: false,
    lerpAmount: 0.1,
  };
}

function processRoute(
  route: RouteMapping,
  sourceValue: number,
  mappedValue: number,
  previous: NumericRecord,
) {
  const valueKey = getRouteStateKey(route.id, 'value');
  const velocityKey = getRouteStateKey(route.id, 'velocity');
  const sourceKey = getRouteStateKey(route.id, 'source');

  // Sprawdź czy mamy poprzednią wartość w stanie
  const hasPrev = typeof previous[valueKey] === 'number';
  // Jeśli nie ma poprzedniej wartości, zacznij od aktualnej docelowej
  const prev = hasPrev ? (previous[valueKey] as number) : mappedValue;

  if (route.processor === 'raw') {
    return mappedValue;
  }

  if (route.processor === 'envelope') {
    const prevSource = previous[sourceKey] ?? 0;
    const envelope = previous[getRouteStateKey(route.id, 'envelope')] ?? 0;
    const attack = Math.max(0.001, route.attack);
    const decay = Math.max(0.001, route.decay);
    const sustain = Math.max(0, Math.min(1, route.sustain));
    const isRising = sourceValue > prevSource || sourceValue > envelope;
    const targetEnvelope = isRising ? sourceValue : sourceValue * sustain;
    const nextEnvelope =
      envelope + (targetEnvelope - envelope) * (isRising ? attack : decay);

    previous[getRouteStateKey(route.id, 'envelope')] = Number.isFinite(
      nextEnvelope,
    )
      ? nextEnvelope
      : envelope;
    previous[sourceKey] = sourceValue;
    return route.min + nextEnvelope * route.amount * (route.max - route.min);
  }

  if (route.processor === 'spring') {
    const stiffness = Math.max(0.001, route.attack);
    const damping = 1 - Math.max(0, Math.min(0.98, route.decay));
    const velocity = previous[velocityKey] ?? 0;
    const nextVelocity =
      (velocity + (mappedValue - prev) * stiffness) * damping;
    previous[velocityKey] = Number.isFinite(nextVelocity) ? nextVelocity : 0;
    return prev + nextVelocity;
  }

  // Default: lerp (smoothing)
  if (!hasPrev) return mappedValue;
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
    let gatedSourceValue = sourceValue;

    // Wykonaj logikę bramki tylko jeśli jest aktywna
    if (route.gatewayMode === 'active') {
      const threshold = route.gatewayThreshold ?? 0;
      const decay = route.gatewayDecay ?? 1;
      const gateKey = getRouteStateKey(route.id, 'gateState');
      let gateState = previous[gateKey] ?? 0;

      if (sourceValue > threshold) {
        gateState = 1.0;
      } else {
        gateState = Math.max(0, gateState - decay);
      }
      previous[gateKey] = gateState;

      // Sygnał jest przepuszczany tylko jeśli bramka jest otwarta (gateState > 0)
      gatedSourceValue = sourceValue * (gateState > 0 ? 1 : 0);
    }

    const mappedValue =
      route.min + gatedSourceValue * route.amount * (route.max - route.min);
    const next = processRoute(route, gatedSourceValue, mappedValue, previous);
    let safeNext = Number.isFinite(next) ? next : 0;

    // Opcjonalny etap wygładzania (Smoothing)
    if (route.smoothingActive) {
      const smoothKey = getRouteStateKey(route.id, 'smoothedValue');
      const prevSmooth = previous[smoothKey] ?? safeNext;
      const p = route.smoothWeightPrev ?? 0.8;
      const r = route.smoothWeightNew ?? 0.2;
      safeNext = prevSmooth * p + safeNext * r;
      previous[smoothKey] = safeNext;
    }

    // NOWE: Etap Post-Lerp (current += (target - current) * amount)
    if (route.lerpActive) {
      const lerpKey = getRouteStateKey(route.id, 'lerpState');
      const prevLerp = previous[lerpKey] ?? safeNext;
      const amt = route.lerpAmount ?? 0.1;
      safeNext = prevLerp + (safeNext - prevLerp) * amt;
      previous[lerpKey] = safeNext;
    }

    const stateKey = getRouteStateKey(route.id, 'value');

    // Zapisujemy w obu obiektach:
    // previous (trwały stan między klatkami) i routed (wynik dla skeczu i UI)
    previous[stateKey] = safeNext;
    routed[stateKey] = safeNext;

    routed[route.target] = (routed[route.target] ?? 0) + safeNext;
  }

  return routed;
}
