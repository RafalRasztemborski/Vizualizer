import { MutableRefObject, useEffect, useRef, type PointerEvent } from 'react';
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
  onRotateDrag?: (deltaX: number, deltaY: number) => void;
};

export function P5Canvas({ sketch, runtimeRef, onRotateDrag }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
  } | null>(null);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!onRotateDrag || event.button !== 0) return;

    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.x;
    const deltaY = event.clientY - drag.y;
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };

    onRotateDrag?.(deltaX, deltaY);
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

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

  return (
    <div
      className="canvasHost"
      ref={hostRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    />
  );
}
