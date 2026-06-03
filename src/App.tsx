import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AudioEngine } from './audio/AudioEngine';
import { EMPTY_SIGNALS } from './audio/audioBands';
import { MidiManager } from './midi/MidiManager';
import { P5Canvas, type P5RuntimeState } from './p5/P5Canvas';
import { sketches } from './sketches/registry';
import { AnalyzerPanel } from './ui/AnalyzerPanel';
import { ParameterControls } from './ui/ParameterControls';
import { SignalRouter } from './ui/SignalRouter';
import { SignalRouterUI } from './ui/SignalRouterUI';
import { Transport } from './ui/Transport';
import { SourceNode } from './ui/SourceNode';
import { TargetNode } from './ui/TargetNode';
import { PipelineEditor } from './ui/PipelineEditor';
import type {
  NumericRecord,
  ReactiveSignals,
  SketchParams,
  SketchParamValue,
} from './core/types';

const MIDI_SOURCE_KEYS = Array.from(
  { length: 128 },
  (_, index) => `cc${index}`,
);

function numericSignals(signals: ReactiveSignals): NumericRecord {
  return Object.fromEntries(
    Object.entries(signals).filter(
      ([key, value]) => key !== 'nyquist' && typeof value === 'number',
    ),
  ) as NumericRecord;
}

function defaultParamsForSketch(sketchId: string): SketchParams {
  const sketch = sketches.find((item) => item.id === sketchId) ?? sketches[0];
  return Object.fromEntries(
    sketch.params.map((param) => [param.key, param.defaultValue]),
  );
}

function wrapDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

export function App() {
  const [selectedSketchId, setSelectedSketchId] = useState(sketches[0].id);
  const selectedSketch = useMemo(
    () =>
      sketches.find((sketch) => sketch.id === selectedSketchId) ?? sketches[0],
    [selectedSketchId],
  );
  const initialParams = useMemo(
    () => defaultParamsForSketch(selectedSketchId),
    [],
  );
  const [params, setParams] = useState<SketchParams>(initialParams);
  const [signals, setSignals] = useState<ReactiveSignals>({ ...EMPTY_SIGNALS });
  const [midi, setMidi] = useState<NumericRecord>({});
  const [routedParams, setRoutedParams] = useState<NumericRecord>({});

  const [signalRouters, setSignalRouters] = useState<SignalRouter[]>(() => {
    const router = new SignalRouter();
    const src = new SourceNode('anchor-source', 'bass');
    const tgt = new TargetNode('anchor-target', 'audioDepth');
    router.addNode(src);
    router.addNode(tgt);
    return [router];
  });

  const addSignalRouter = () => {
    const router = new SignalRouter();
    const trackId = crypto.randomUUID().slice(0, 8);
    router.addNode(
      new SourceNode(`anchor-source-${trackId}`, sourceKeys[0] || 'bass'),
    );
    router.addNode(
      new TargetNode(`anchor-target-${trackId}`, targetKeys[0] || 'audioDepth'),
    );
    setSignalRouters((prev) => [...prev, router]);
    setRouterVersion((v) => v + 1);
  };

  const removeSignalRouter = (index: number) => {
    if (signalRouters.length <= 1) return;
    const next = [...signalRouters];
    next.splice(index, 1);
    setSignalRouters(next);
    setRouterVersion((v) => v + 1);
  };

  const toggleSignalRouter = (index: number) => {
    const router = signalRouters[index];
    if (!router) return;
    router.setEnabled(!router.isEnabled());
    setRouterVersion((v) => v + 1);
  };

  const duplicateSignalRouter = (index: number) => {
    const router = signalRouters[index];
    if (!router) return;
    setSignalRouters((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, router.clone());
      return next;
    });
    setRouterVersion((v) => v + 1);
  };

  const branchSignalRouter = (index: number, nodeId: string) => {
    const router = signalRouters[index];
    if (!router) return;
    const branch = router.branchFromNode(nodeId, targetKeys[0] || 'audioDepth');
    if (!branch) return;
    setSignalRouters((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, branch);
      return next;
    });
    setRouterVersion((v) => v + 1);
  };

  const exportSignalRouters = () =>
    JSON.stringify(
      {
        version: 1,
        exportedAt: new Date().toISOString(),
        routers: signalRouters.map((router) => router.toJSON()),
      },
      null,
      2,
    );

  const importSignalRouters = (json: string) => {
    const parsed = JSON.parse(json) as { routers?: unknown };
    if (!Array.isArray(parsed.routers)) {
      throw new Error('Router file does not contain a routers array.');
    }

    const nextRouters = parsed.routers.map((router) =>
      SignalRouter.fromJSON(router as Parameters<typeof SignalRouter.fromJSON>[0]),
    );
    if (!nextRouters.length) {
      throw new Error('Router file does not contain any signal paths.');
    }

    setSignalRouters(nextRouters);
    setRouterVersion((v) => v + 1);
  };

  const [, setRouterVersion] = useState(0);
  const [fps, setFps] = useState(0);
  const [audioVersion, setAudioVersion] = useState(0);
  const audioRef = useRef(new AudioEngine());
  const midiRef = useRef(new MidiManager());
  const fpsRef = useRef({
    frames: 0,
    lastSample: performance.now(),
  });
  const runtimeRef = useRef<P5RuntimeState>({
    params: initialParams,
    routedParams: {},
    signals: { ...EMPTY_SIGNALS },
    midi: {},
  });

  useEffect(() => {
    const nextParams = defaultParamsForSketch(selectedSketchId);
    setParams(nextParams);
    setRoutedParams({});
    runtimeRef.current = {
      ...runtimeRef.current,
      params: nextParams,
      routedParams: {},
    };
  }, [selectedSketchId]);

  useEffect(() => {
    runtimeRef.current = {
      ...runtimeRef.current,
      params,
    };
  }, [params]);

  useEffect(() => {
    let raf = 0;
    let lastUiUpdate = 0;
    const tick = () => {
      const nextSignals = audioRef.current.update();
      const nextMidi = midiRef.current.currentValues;
      const sources = { ...numericSignals(nextSignals), ...nextMidi };
      const nextRouted: NumericRecord = {};

      // Przetwarzanie wszystkich grafów sygnałów
      for (const router of signalRouters) {
        if (!router.isEnabled()) continue;

        router.update(sources);

        // Pobranie wartości z TargetNode i dodanie ich do parametrów zsumowanych
        const currentNodes = router.getNodes();
        for (const node of currentNodes) {
          if (node instanceof TargetNode) {
            const val = node.inputs.in.value;
            if (typeof val === 'number') {
              nextRouted[node.targetParam] =
                (nextRouted[node.targetParam] ?? 0) + val;
            }
          }
        }
      }

      runtimeRef.current = {
        params: runtimeRef.current.params,
        signals: nextSignals,
        midi: nextMidi,
        routedParams: nextRouted,
      };

      const now = performance.now();
      fpsRef.current.frames += 1;
      if (now - fpsRef.current.lastSample >= 500) {
        setFps(
          (fpsRef.current.frames * 1000) / (now - fpsRef.current.lastSample),
        );
        fpsRef.current = {
          frames: 0,
          lastSample: now,
        };
      }

      if (now - lastUiUpdate > 50) {
        setSignals(nextSignals);
        setMidi(nextMidi);
        setRoutedParams(nextRouted);
        lastUiUpdate = now;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [params, signalRouters]);

  useEffect(() => () => audioRef.current.dispose(), []);

  const handleConfigChange = useCallback((key: string, value: number) => {
    audioRef.current.setConfigValue(key, value);
    setAudioVersion((version) => version + 1);
  }, []);

  const sourceKeys = useMemo(() => {
    const signalKeys = Object.keys(numericSignals(signals)).sort();
    const extraMidiKeys = Object.keys(midi)
      .filter((key) => !/^cc\d+$/.test(key))
      .sort();
    return [...new Set([...signalKeys, ...MIDI_SOURCE_KEYS, ...extraMidiKeys])];
  }, [signals, midi]);

  const targetKeys = useMemo(
    () =>
      selectedSketch.params
        .filter((param) => param.type === 'number')
        .map((param) => param.key),
    [selectedSketch],
  );
  const supportsDragRotate = useMemo(
    () =>
      selectedSketch.params.some((param) => param.key === 'X_ROTATE') &&
      selectedSketch.params.some((param) => param.key === 'Y_ROTATE'),
    [selectedSketch],
  );

  return (
    <main className="appShell">
      <P5Canvas
        key={selectedSketch.id}
        sketch={selectedSketch}
        runtimeRef={runtimeRef}
        onRotateDrag={
          supportsDragRotate
            ? (deltaX, deltaY) => {
                const sensitivity = 0.35;
                setParams((current) => ({
                  ...current,
                  X_ROTATE: wrapDegrees(
                    Number(current.X_ROTATE ?? 0) + deltaY * sensitivity,
                  ),
                  Y_ROTATE: wrapDegrees(
                    Number(current.Y_ROTATE ?? 0) + deltaX * sensitivity,
                  ),
                }));
              }
            : undefined
        }
      />

      <AnalyzerPanel
        config={audioRef.current.config}
        signals={signals}
        fps={fps}
        onConfigChange={handleConfigChange}
      />

      <aside className="sidebar">
        <section className="panel">
          <h1>p5 Reactive Runtime</h1>
          <label className="control">
            <span>Sketch</span>
            <select
              value={selectedSketchId}
              onChange={(event) => setSelectedSketchId(event.target.value)}
            >
              {sketches.map((sketch) => (
                <option key={sketch.id} value={sketch.id}>
                  {sketch.name}
                </option>
              ))}
            </select>
          </label>
        </section>

        <Transport
          sourceKind={audioRef.current.sourceKind}
          audioElement={audioRef.current.element}
          onMic={() => {
            void audioRef.current
              .useMicrophone()
              .then(() => setAudioVersion((version) => version + 1));
          }}
          onMidi={() => {
            void midiRef.current.connect();
          }}
          onFile={(file) => {
            void audioRef.current
              .useFile(file)
              .then(() => setAudioVersion((version) => version + 1));
          }}
        />

        <ParameterControls
          sketch={selectedSketch}
          params={params}
          routedParams={routedParams}
          onChange={(key: string, value: SketchParamValue) => {
            setParams((current) => ({ ...current, [key]: value }));
          }}
        />
      </aside>

      <PipelineEditor
        routers={signalRouters}
        sourceKeys={sourceKeys}
        targetKeys={targetKeys}
        onUpdate={() => setRouterVersion((v) => v + 1)}
        onAddRoute={addSignalRouter}
        onRemoveRoute={removeSignalRouter}
        onToggleRoute={toggleSignalRouter}
        onDuplicateRoute={duplicateSignalRouter}
        onBranchRoute={branchSignalRouter}
        onExportRoutes={exportSignalRouters}
        onImportRoutes={importSignalRouters}
      />
    </main>
  );
}
