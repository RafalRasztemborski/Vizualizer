import type { NumericRecord, RouteMapping, SketchParams } from '../core/types';

export function createRoute(source: string, target: string): RouteMapping {
  return {
    id: crypto.randomUUID(),
    source,
    target,
    amount: 1,
    smoothing: 0.25,
    min: 0,
    max: 100,
    enabled: true,
  };
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
    const prev = previous[route.target] ?? 0;
    const next = prev + (mappedValue - prev) * route.smoothing;
    routed[route.target] = Number.isFinite(next) ? next : prev;
  }

  return routed;
}
