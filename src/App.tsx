import { useEffect, useMemo, useRef, useState } from 'react';
import { AudioEngine } from './audio/AudioEngine';
import { EMPTY_SIGNALS } from './audio/audioBands';
import { MidiManager } from './midi/MidiManager';
import { P5Canvas, type P5RuntimeState } from './p5/P5Canvas';
import { applyRouting, createRoute } from './routing/routing';
import { sketches } from './sketches/registry';
import { AnalyzerPanel } from './ui/AnalyzerPanel';
import { ParameterControls } from './ui/ParameterControls';
import { RoutingMatrix } from './ui/RoutingMatrix';
import { Transport } from './ui/Transport';
import type { NumericRecord, ReactiveSignals, RouteMapping, SketchParams, SketchParamValue } from './core/types';

const MIDI_SOURCE_KEYS = Array.from({ length: 128 }, (_, index) => `cc${index}`);

function numericSignals(signals: ReactiveSignals): NumericRecord {
  return Object.fromEntries(
    Object.entries(signals).filter(([, value]) => typeof value === 'number'),
  ) as NumericRecord;
}

function defaultParamsForSketch(sketchId: string): SketchParams {
  const sketch = sketches.find((item) => item.id === sketchId) ?? sketches[0];
  return Object.fromEntries(sketch.params.map((param) => [param.key, param.defaultValue]));
}

function defaultRoutesForSketch(sketchId: string): RouteMapping[] {
  if (sketchId === 'dupa') {
    return [
      { ...createRoute('detectedKick', 'X_GAP'), amount: 1, min: 0, max: 55, smoothing: 0.45 },
      { ...createRoute('bass', 'audioDepth'), amount: 1, min: 0, max: 320, smoothing: 0.25 },
    ];
  }

  if (sketchId === 'particle-tunnel') {
    return [
      { ...createRoute('kickEnergy', 'particleSpeed'), amount: 1.2, min: 0, max: 8, smoothing: 0.35 },
      { ...createRoute('cc74', 'hue'), amount: 1, min: 0, max: 360, smoothing: 0.18 },
    ];
  }

  return [
    { ...createRoute('bass', 'wallAmplitude'), amount: 1.4, min: 0, max: 180, smoothing: 0.18 },
    { ...createRoute('high', 'hue'), amount: 1, min: 0, max: 180, smoothing: 0.2 },
  ];
}

function createRouteForTarget(source: string, target: string, sketchId: string): RouteMapping {
  const route = createRoute(source, target);
  const sketch = sketches.find((item) => item.id === sketchId) ?? sketches[0];
  const definition = sketch.params.find((param) => param.key === target);

  if (definition?.type === 'number') {
    route.min = 0;
    route.max = Math.max(definition.step, definition.max - definition.min);
  }

  return route;
}

export function App() {
  const [selectedSketchId, setSelectedSketchId] = useState(sketches[0].id);
  const selectedSketch = useMemo(
    () => sketches.find((sketch) => sketch.id === selectedSketchId) ?? sketches[0],
    [selectedSketchId],
  );
  const initialParams = useMemo(() => defaultParamsForSketch(selectedSketchId), []);
  const [params, setParams] = useState<SketchParams>(initialParams);
  const [signals, setSignals] = useState<ReactiveSignals>({ ...EMPTY_SIGNALS });
  const [midi, setMidi] = useState<NumericRecord>({});
  const [routedParams, setRoutedParams] = useState<NumericRecord>({});
  const [routes, setRoutes] = useState<RouteMapping[]>(() => defaultRoutesForSketch(selectedSketchId));
  const [audioVersion, setAudioVersion] = useState(0);
  const audioRef = useRef(new AudioEngine());
  const midiRef = useRef(new MidiManager());
  const routedRef = useRef<NumericRecord>({});
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
    setRoutes(defaultRoutesForSketch(selectedSketchId));
    routedRef.current = {};
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
      const nextRouted = applyRouting(runtimeRef.current.params, routes, sources, routedRef.current);
      routedRef.current = nextRouted;
      runtimeRef.current = {
        params: runtimeRef.current.params,
        signals: nextSignals,
        midi: nextMidi,
        routedParams: nextRouted,
      };

      const now = performance.now();
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
  }, [params, routes]);

  useEffect(() => () => audioRef.current.dispose(), []);

  const routeSourceValues = useMemo(() => ({ ...numericSignals(signals), ...midi }), [signals, midi]);

  const sourceKeys = useMemo(() => {
    const signalKeys = Object.keys(numericSignals(signals)).sort();
    const extraMidiKeys = Object.keys(midi)
      .filter((key) => !/^cc\d+$/.test(key))
      .sort();
    return [...new Set([...signalKeys, ...MIDI_SOURCE_KEYS, ...extraMidiKeys])];
  }, [signals, midi]);

  const targetKeys = useMemo(
    () => selectedSketch.params.filter((param) => param.type === 'number').map((param) => param.key),
    [selectedSketch],
  );

  return (
    <main className="appShell">
      <P5Canvas
        key={selectedSketch.id}
        sketch={selectedSketch}
        runtimeRef={runtimeRef}
      />

      <aside className="sidebar">
        <section className="panel">
          <h1>p5 Reactive Runtime</h1>
          <label className="control">
            <span>Sketch</span>
            <select value={selectedSketchId} onChange={(event) => setSelectedSketchId(event.target.value)}>
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
            void audioRef.current.useMicrophone().then(() => setAudioVersion((version) => version + 1));
          }}
          onMidi={() => {
            void midiRef.current.connect();
          }}
          onFile={(file) => {
            void audioRef.current.useFile(file).then(() => setAudioVersion((version) => version + 1));
          }}
        />

        <AnalyzerPanel
          key={audioVersion}
          config={audioRef.current.config}
          signals={signals}
          onConfigChange={(key, value) => {
            audioRef.current.setConfigValue(key, value);
            setAudioVersion((version) => version + 1);
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

        <RoutingMatrix
          routes={routes}
          sourceKeys={sourceKeys}
          sourceValues={routeSourceValues}
          targetKeys={targetKeys}
          onAdd={() =>
            setRoutes((current) => [
              ...current,
              createRouteForTarget(sourceKeys[0], targetKeys[0], selectedSketchId),
            ])
          }
          onChange={(route) =>
            setRoutes((current) => current.map((item) => (item.id === route.id ? route : item)))
          }
          onRemove={(id) => setRoutes((current) => current.filter((route) => route.id !== id))}
        />
      </aside>
    </main>
  );
}
