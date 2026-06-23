import { SignalRouter } from './SignalRouter';
import { TargetNode } from './TargetNode';

export function chainSourceKey(pathIndex: number, targetParam: string) {
  return `path${pathIndex + 1}:${targetParam}`;
}

export function chainSourceKeysForTrack(
  routers: SignalRouter[],
  trackIndex: number,
): string[] {
  const keys: string[] = [];
  for (let i = 0; i < trackIndex; i++) {
    const router = routers[i];
    if (!router) continue;
    for (const node of router.getNodes()) {
      if (node instanceof TargetNode) {
        keys.push(chainSourceKey(i, node.targetParam));
      }
    }
  }
  return keys;
}

export function formatChainSourceLabel(key: string) {
  const match = key.match(/^path(\d+):(.+)$/);
  if (!match) return key;
  return `Path ${match[1]} → ${match[2]}`;
}

export function collectChainSources(
  router: SignalRouter,
  pathIndex: number,
): Record<string, number> {
  const chainSources: Record<string, number> = {};
  for (const node of router.getNodes()) {
    if (node instanceof TargetNode) {
      const val = node.inputs.in.value;
      if (typeof val === 'number') {
        chainSources[chainSourceKey(pathIndex, node.targetParam)] = val;
      }
    }
  }
  return chainSources;
}
