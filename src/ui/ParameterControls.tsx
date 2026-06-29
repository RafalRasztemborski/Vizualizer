import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import type {
  P5SketchModule,
  SketchParamDefinition,
  SketchParams,
  SketchParamValue,
} from '../core/types';

const LINKED_ARCH_KEYS = new Set([
  'frontBackArch',
  'leftRightArch',
  'topBottomArch',
]);

type Props = {
  sketch: P5SketchModule;
  params: SketchParams;
  routedParams: Record<string, number>;
  onChange: (key: string, value: SketchParamValue) => void;
};

type NumericSliderProps = {
  definition: Extract<SketchParamDefinition, { type: 'number' }>;
  params: SketchParams;
  value: SketchParamValue;
  routed?: number;
  onChange: (key: string, value: SketchParamValue) => void;
};

function progressPercent(value: number, min: number, max: number) {
  if (max <= min) return 0;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

function NumericParameterSlider({
  definition,
  params,
  value,
  routed,
  onChange,
}: NumericSliderProps) {
  const baseValue = Number(value);
  const automationValue = typeof routed === 'number' ? routed : 0;
  const isAutomated = Math.abs(automationValue) > 0.0001;
  const effectiveValue = baseValue + automationValue;
  const previousAutomationRef = useRef(automationValue);
  const [isChanging, setIsChanging] = useState(false);

  const min = useMemo(() => {
    const linkedArchValue =
      params.archMasterLink && LINKED_ARCH_KEYS.has(definition.key)
        ? Math.min(definition.min, baseValue)
        : definition.min;

    return isAutomated ? Math.min(linkedArchValue, effectiveValue) : linkedArchValue;
  }, [
    baseValue,
    definition.key,
    definition.min,
    effectiveValue,
    isAutomated,
    params.archMasterLink,
  ]);

  const max = useMemo(() => {
    const linkedArchValue =
      params.archMasterLink && LINKED_ARCH_KEYS.has(definition.key)
        ? Math.max(definition.max, baseValue)
        : definition.max;

    return isAutomated ? Math.max(linkedArchValue, effectiveValue) : linkedArchValue;
  }, [
    baseValue,
    definition.key,
    definition.max,
    effectiveValue,
    isAutomated,
    params.archMasterLink,
  ]);

  useEffect(() => {
    const previous = previousAutomationRef.current;
    previousAutomationRef.current = automationValue;

    if (!isAutomated || Math.abs(previous - automationValue) < 0.0005) {
      return;
    }

    setIsChanging(true);
    const timeout = window.setTimeout(() => setIsChanging(false), 180);
    return () => window.clearTimeout(timeout);
  }, [automationValue, isAutomated]);

  const sliderStyle = {
    '--base-progress': `${progressPercent(baseValue, min, max)}%`,
    '--automation-progress': `${progressPercent(effectiveValue, min, max)}%`,
  } as CSSProperties;

  return (
    <label
      className={`control paramControl${isAutomated ? ' is-automated' : ''}${
        isChanging ? ' is-changing' : ''
      }`}
    >
      <span>
        {definition.label}
        <strong>
          {isAutomated
            ? `${baseValue.toFixed(2)} + ${automationValue.toFixed(
                2,
              )} = ${effectiveValue.toFixed(2)}`
            : baseValue.toFixed(2)}
        </strong>
      </span>
      <div className="paramSliderWrap" style={sliderStyle}>
        <input
          type="range"
          min={min}
          max={max}
          step={definition.step}
          value={baseValue}
          onChange={(event) => onChange(definition.key, Number(event.target.value))}
        />
      </div>
    </label>
  );
}

export function ParameterControls({
  sketch,
  params,
  routedParams,
  onChange,
}: Props) {
  return (
    <section className="panel">
      <h2>Sketch Params</h2>
      <div className="controlList">
        {sketch.params.map((definition) => {
          const routed = routedParams[definition.key];
          const value = params[definition.key] ?? definition.defaultValue;

          if (definition.type === 'boolean') {
            return (
              <label className="toggle" key={definition.key}>
                <span>{definition.label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(value)}
                  onChange={(event) => onChange(definition.key, event.target.checked)}
                />
              </label>
            );
          }

          if (definition.type === 'select') {
            return (
              <label className="control" key={definition.key}>
                <span>{definition.label}</span>
                <select
                  value={String(value)}
                  onChange={(event) => onChange(definition.key, event.target.value)}
                >
                  {definition.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            );
          }

          return (
            <NumericParameterSlider
              key={definition.key}
              definition={definition}
              params={params}
              value={value}
              routed={routed}
              onChange={onChange}
            />
          );
        })}
      </div>
    </section>
  );
}
