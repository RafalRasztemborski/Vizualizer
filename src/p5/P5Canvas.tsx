import { MutableRefObject, useEffect, useRef } from 'react';
import p5 from 'p5';
import type { NumericRecord, P5SketchModule, ReactiveSignals, SketchParams } from '../core/types';

export type P5RuntimeState = {
  params: SketchParams;
  routedParams: NumericRecord;
  signals: ReactiveSignals;
  midi: NumericRecord;
};

type Props = {
  sketch: P5SketchModule;
  runtimeRef: MutableRefObject<P5RuntimeState>;
};

export function P5Canvas({ sketch, runtimeRef }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;

    let previousMs = performance.now();
    const instance = new p5((p) => {
      p.setup = () => sketch.setup(p);
      p.draw = () => {
        const now = performance.now();
        const latest = runtimeRef.current;
        sketch.draw({
          p,
          params: latest.params,
          routedParams: latest.routedParams,
          signals: latest.signals,
          midi: latest.midi,
          deltaMs: now - previousMs,
          timeMs: now,
        });
        previousMs = now;
      };
      p.windowResized = () => sketch.windowResized?.(p);
    }, hostRef.current);

    return () => {
      sketch.dispose?.();
      instance.remove();
    };
  }, [sketch]);

  return <div className="canvasHost" ref={hostRef} />;
}
