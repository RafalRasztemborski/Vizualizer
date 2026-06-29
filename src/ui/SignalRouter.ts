import { INode, IConnection, SignalValue } from './types';
import {
  ADSREnvelopeNode,
  ADSRCurveShape,
  ADSRGateMode,
  ADSRTriggerMode,
} from './ADSREnvelopeNode';
import { AttackReleaseFollowerNode } from './AttackReleaseFollowerNode';
import { ClampNode } from './ClampNode';
import { BounceNode } from './BounceNode';
import { CurveNode } from './CurveNode';
import { InverterNode } from './InverterNode';
import { LerpNode } from './LerpNode';
import { OffsetNode } from './OffsetNode';
import { PeakHoldDecayNode } from './PeakHoldDecayNode';
import { RemapNode } from './RemapNode';
import { SignalStrengthNode } from './SignalStrengthNode';
import {
  SignalStrengthenerProNode,
  StrengthenerMode,
} from './SignalStrengthenerProNode';
import { SmoothingNode } from './SmoothingNode';
import { SourceNode } from './SourceNode';
import { TargetNode } from './TargetNode';
import { WaveTransformNode } from './WaveTransformNode';

type SerializedNode = {
  id: string;
  kind: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
};

export type SerializedSignalRouter = {
  enabled: boolean;
  nodes: SerializedNode[];
};

function nextNodeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function cloneNode(node: INode, id = nextNodeId(node.type)) {
  let clone: INode;

  if (node instanceof SourceNode) {
    clone = new SourceNode(id, node.sourceKey);
  } else if (node instanceof TargetNode) {
    clone = new TargetNode(id, node.targetParam);
  } else if (node instanceof SmoothingNode) {
    const next = new SmoothingNode(id);
    next.factor = node.factor;
    clone = next;
  } else if (node instanceof SignalStrengthNode) {
    const next = new SignalStrengthNode(id);
    next.multiplier = node.multiplier;
    next.offset = node.offset;
    clone = next;
  } else if (node instanceof LerpNode) {
    const next = new LerpNode(id);
    next.factor = node.factor;
    clone = next;
  } else if (node instanceof InverterNode) {
    clone = new InverterNode(id);
  } else if (node instanceof OffsetNode) {
    const next = new OffsetNode(id);
    next.offset = node.offset;
    next.returnOnSilence = node.returnOnSilence;
    next.returnSpeed = node.returnSpeed;
    clone = next;
  } else if (node instanceof BounceNode) {
    const next = new BounceNode(id);
    next.attackSensitivity = node.attackSensitivity;
    next.decaySensitivity = node.decaySensitivity;
    next.minAmplitude = node.minAmplitude;
    next.bounceDepth = node.bounceDepth;
    next.bounceSpeed = node.bounceSpeed;
    next.bounceCurve = node.bounceCurve;
    clone = next;
  } else if (node instanceof ClampNode) {
    const next = new ClampNode(id);
    next.min = node.min;
    next.max = node.max;
    clone = next;
  } else if (node instanceof CurveNode) {
    const next = new CurveNode(id);
    next.mode = node.mode;
    next.exponent = node.exponent;
    next.intensity = node.intensity;
    clone = next;
  } else if (node instanceof RemapNode) {
    const next = new RemapNode(id);
    next.inMin = node.inMin;
    next.inMax = node.inMax;
    next.outMin = node.outMin;
    next.outMax = node.outMax;
    clone = next;
  } else if (node instanceof WaveTransformNode) {
    const next = new WaveTransformNode(id);
    next.mode = node.mode;
    next.density = node.density;
    next.phase = node.phase;
    clone = next;
  } else if (node instanceof SignalStrengthenerProNode) {
    const next = new SignalStrengthenerProNode(id);
    next.mode = node.mode as StrengthenerMode;
    next.p = node.p;
    next.b = node.b;
    next.d = node.d;
    next.lowExponent = node.lowExponent;
    next.highExponent = node.highExponent;
    clone = next;
  } else if (node instanceof AttackReleaseFollowerNode) {
    const next = new AttackReleaseFollowerNode(id);
    next.attackCoef = node.attackCoef;
    next.releaseCoef = node.releaseCoef;
    next.gain = node.gain;
    next.clampEnabled = node.clampEnabled;
    next.minOutput = node.minOutput;
    next.maxOutput = node.maxOutput;
    next.bypass = node.bypass;
    clone = next;
  } else if (node instanceof PeakHoldDecayNode) {
    const next = new PeakHoldDecayNode(id);
    next.decayFactor = node.decayFactor;
    next.peakHoldTimeMs = node.peakHoldTimeMs;
    next.gain = node.gain;
    next.threshold = node.threshold;
    next.autoNormalize = node.autoNormalize;
    next.bypass = node.bypass;
    clone = next;
  } else if (node instanceof ADSREnvelopeNode) {
    const next = new ADSREnvelopeNode(id);
    next.attackMs = node.attackMs;
    next.decayMs = node.decayMs;
    next.sustain = node.sustain;
    next.releaseMs = node.releaseMs;
    next.peakLevel = node.peakLevel;
    next.triggerMode = node.triggerMode;
    next.gateMode = node.gateMode;
    next.curveShape = node.curveShape;
    next.velocitySensitivity = node.velocitySensitivity;
    next.syncToBpm = node.syncToBpm;
    next.bpmMultiplier = node.bpmMultiplier;
    next.gain = node.gain;
    next.bypass = node.bypass;
    clone = next;
  } else {
    throw new Error(`Unsupported node clone type: ${node.type}`);
  }

  (clone as any).enabled = (node as any).enabled !== false;
  return clone;
}

function serializeNode(node: INode): SerializedNode {
  const serialized: SerializedNode = {
    id: node.id,
    kind: node.constructor.name,
    enabled: (node as any).enabled !== false,
    config: {},
  };

  if (node instanceof SourceNode) {
    serialized.config = { sourceKey: node.sourceKey };
  } else if (node instanceof TargetNode) {
    serialized.config = { targetParam: node.targetParam };
  } else if (node instanceof SmoothingNode) {
    serialized.config = { factor: node.factor };
  } else if (node instanceof SignalStrengthNode) {
    serialized.config = { multiplier: node.multiplier, offset: node.offset };
  } else if (node instanceof LerpNode) {
    serialized.config = { factor: node.factor };
  } else if (node instanceof InverterNode) {
    serialized.config = {};
  } else if (node instanceof OffsetNode) {
    serialized.config = {
      offset: node.offset,
      returnOnSilence: node.returnOnSilence,
      returnSpeed: node.returnSpeed,
    };
  } else if (node instanceof BounceNode) {
    serialized.config = {
      attackSensitivity: node.attackSensitivity,
      decaySensitivity: node.decaySensitivity,
      minAmplitude: node.minAmplitude,
      bounceDepth: node.bounceDepth,
      bounceSpeed: node.bounceSpeed,
      bounceCurve: node.bounceCurve,
    };
  } else if (node instanceof ClampNode) {
    serialized.config = { min: node.min, max: node.max };
  } else if (node instanceof CurveNode) {
    serialized.config = {
      mode: node.mode,
      exponent: node.exponent,
      intensity: node.intensity,
    };
  } else if (node instanceof RemapNode) {
    serialized.config = {
      inMin: node.inMin,
      inMax: node.inMax,
      outMin: node.outMin,
      outMax: node.outMax,
    };
  } else if (node instanceof WaveTransformNode) {
    serialized.config = {
      mode: node.mode,
      density: node.density,
      phase: node.phase,
    };
  } else if (node instanceof SignalStrengthenerProNode) {
    serialized.config = {
      mode: node.mode,
      p: node.p,
      b: node.b,
      d: node.d,
      lowExponent: node.lowExponent,
      highExponent: node.highExponent,
    };
  } else if (node instanceof AttackReleaseFollowerNode) {
    serialized.config = {
      attackCoef: node.attackCoef,
      releaseCoef: node.releaseCoef,
      gain: node.gain,
      clampEnabled: node.clampEnabled,
      minOutput: node.minOutput,
      maxOutput: node.maxOutput,
      bypass: node.bypass,
    };
  } else if (node instanceof PeakHoldDecayNode) {
    serialized.config = {
      decayFactor: node.decayFactor,
      peakHoldTimeMs: node.peakHoldTimeMs,
      gain: node.gain,
      threshold: node.threshold,
      autoNormalize: node.autoNormalize,
      bypass: node.bypass,
    };
  } else if (node instanceof ADSREnvelopeNode) {
    serialized.config = {
      attackMs: node.attackMs,
      decayMs: node.decayMs,
      sustain: node.sustain,
      releaseMs: node.releaseMs,
      peakLevel: node.peakLevel,
      triggerMode: node.triggerMode,
      gateMode: node.gateMode,
      curveShape: node.curveShape,
      velocitySensitivity: node.velocitySensitivity,
      syncToBpm: node.syncToBpm,
      bpmMultiplier: node.bpmMultiplier,
      gain: node.gain,
      bypass: node.bypass,
    };
  } else {
    throw new Error(`Unsupported node serialize type: ${node.type}`);
  }

  return serialized;
}

function numberConfig(
  config: Record<string, unknown> | undefined,
  key: string,
  fallback: number,
) {
  const value = config?.[key];
  return typeof value === 'number' ? value : fallback;
}

function stringConfig(
  config: Record<string, unknown> | undefined,
  key: string,
  fallback: string,
) {
  const value = config?.[key];
  return typeof value === 'string' ? value : fallback;
}

function booleanConfig(
  config: Record<string, unknown> | undefined,
  key: string,
  fallback: boolean,
) {
  const value = config?.[key];
  return typeof value === 'boolean' ? value : fallback;
}

function deserializeNode(serialized: SerializedNode) {
  const config = serialized.config;
  const id = serialized.id || nextNodeId(serialized.kind || 'node');
  let node: INode;

  switch (serialized.kind) {
    case 'SourceNode':
      node = new SourceNode(id, stringConfig(config, 'sourceKey', 'bass'));
      break;
    case 'TargetNode':
      node = new TargetNode(
        id,
        stringConfig(config, 'targetParam', 'audioDepth'),
      );
      break;
    case 'SmoothingNode': {
      const next = new SmoothingNode(id);
      next.factor = numberConfig(config, 'factor', next.factor);
      node = next;
      break;
    }
    case 'SignalStrengthNode': {
      const next = new SignalStrengthNode(id);
      next.multiplier = numberConfig(config, 'multiplier', next.multiplier);
      next.offset = numberConfig(config, 'offset', next.offset);
      node = next;
      break;
    }
    case 'LerpNode': {
      const next = new LerpNode(id);
      next.factor = numberConfig(config, 'factor', next.factor);
      node = next;
      break;
    }
    case 'InverterNode':
      node = new InverterNode(id);
      break;
    case 'OffsetNode': {
      const next = new OffsetNode(id);
      next.offset = numberConfig(config, 'offset', next.offset);
      next.returnOnSilence = config?.returnOnSilence === true;
      next.returnSpeed = numberConfig(config, 'returnSpeed', next.returnSpeed);
      node = next;
      break;
    }
    case 'BounceNode': {
      const next = new BounceNode(id);
      next.attackSensitivity = numberConfig(
        config,
        'attackSensitivity',
        next.attackSensitivity,
      );
      next.decaySensitivity = numberConfig(
        config,
        'decaySensitivity',
        next.decaySensitivity,
      );
      next.minAmplitude = numberConfig(
        config,
        'minAmplitude',
        next.minAmplitude,
      );
      next.bounceDepth = numberConfig(config, 'bounceDepth', next.bounceDepth);
      next.bounceSpeed = numberConfig(config, 'bounceSpeed', next.bounceSpeed);
      const curve = stringConfig(config, 'bounceCurve', next.bounceCurve);
      next.bounceCurve = curve === 'linear' ? 'linear' : 'exponential';
      node = next;
      break;
    }
    case 'ClampNode': {
      const next = new ClampNode(id);
      next.min = numberConfig(config, 'min', next.min);
      next.max = numberConfig(config, 'max', next.max);
      node = next;
      break;
    }
    case 'CurveNode': {
      const next = new CurveNode(id);
      const mode = stringConfig(config, 'mode', next.mode);
      next.mode = mode === 'log' ? 'log' : 'power';
      next.exponent = numberConfig(config, 'exponent', next.exponent);
      next.intensity = numberConfig(config, 'intensity', next.intensity);
      node = next;
      break;
    }
    case 'RemapNode': {
      const next = new RemapNode(id);
      next.inMin = numberConfig(config, 'inMin', next.inMin);
      next.inMax = numberConfig(config, 'inMax', next.inMax);
      next.outMin = numberConfig(config, 'outMin', next.outMin);
      next.outMax = numberConfig(config, 'outMax', next.outMax);
      node = next;
      break;
    }
    case 'WaveTransformNode': {
      const next = new WaveTransformNode(id);
      const mode = stringConfig(config, 'mode', next.mode);
      next.mode = mode === 'cosine' ? 'cosine' : 'sine';
      next.density = numberConfig(config, 'density', next.density);
      next.phase = numberConfig(config, 'phase', next.phase);
      node = next;
      break;
    }
    case 'SignalStrengthenerProNode': {
      const next = new SignalStrengthenerProNode(id);
      const mode = stringConfig(config, 'mode', next.mode);
      next.mode =
        mode === StrengthenerMode.DUAL_RANGE
          ? StrengthenerMode.DUAL_RANGE
          : StrengthenerMode.POWER;
      next.p = numberConfig(config, 'p', next.p);
      next.b = numberConfig(config, 'b', next.b);
      next.d = numberConfig(config, 'd', next.d);
      next.lowExponent = numberConfig(
        config,
        'lowExponent',
        next.lowExponent,
      );
      next.highExponent = numberConfig(
        config,
        'highExponent',
        next.highExponent,
      );
      node = next;
      break;
    }
    case 'AttackReleaseFollowerNode': {
      const next = new AttackReleaseFollowerNode(id);
      next.attackCoef = numberConfig(config, 'attackCoef', next.attackCoef);
      next.releaseCoef = numberConfig(config, 'releaseCoef', next.releaseCoef);
      next.gain = numberConfig(config, 'gain', next.gain);
      next.clampEnabled = booleanConfig(
        config,
        'clampEnabled',
        next.clampEnabled,
      );
      next.minOutput = numberConfig(config, 'minOutput', next.minOutput);
      next.maxOutput = numberConfig(config, 'maxOutput', next.maxOutput);
      next.bypass = booleanConfig(config, 'bypass', next.bypass);
      node = next;
      break;
    }
    case 'PeakHoldDecayNode': {
      const next = new PeakHoldDecayNode(id);
      next.decayFactor = numberConfig(config, 'decayFactor', next.decayFactor);
      next.peakHoldTimeMs = numberConfig(
        config,
        'peakHoldTimeMs',
        next.peakHoldTimeMs,
      );
      next.gain = numberConfig(config, 'gain', next.gain);
      next.threshold = numberConfig(config, 'threshold', next.threshold);
      next.autoNormalize = booleanConfig(
        config,
        'autoNormalize',
        next.autoNormalize,
      );
      next.bypass = booleanConfig(config, 'bypass', next.bypass);
      node = next;
      break;
    }
    case 'ADSREnvelopeNode': {
      const next = new ADSREnvelopeNode(id);
      next.attackMs = numberConfig(config, 'attackMs', next.attackMs);
      next.decayMs = numberConfig(config, 'decayMs', next.decayMs);
      next.sustain = numberConfig(config, 'sustain', next.sustain);
      next.releaseMs = numberConfig(config, 'releaseMs', next.releaseMs);
      next.peakLevel = numberConfig(config, 'peakLevel', next.peakLevel);
      next.triggerMode = stringConfig(
        config,
        'triggerMode',
        next.triggerMode,
      ) as ADSRTriggerMode;
      next.gateMode = stringConfig(
        config,
        'gateMode',
        next.gateMode,
      ) as ADSRGateMode;
      next.curveShape = stringConfig(
        config,
        'curveShape',
        next.curveShape,
      ) as ADSRCurveShape;
      next.velocitySensitivity = numberConfig(
        config,
        'velocitySensitivity',
        next.velocitySensitivity,
      );
      next.syncToBpm = booleanConfig(config, 'syncToBpm', next.syncToBpm);
      next.bpmMultiplier = stringConfig(
        config,
        'bpmMultiplier',
        next.bpmMultiplier,
      );
      next.gain = numberConfig(config, 'gain', next.gain);
      next.bypass = booleanConfig(config, 'bypass', next.bypass);
      node = next;
      break;
    }
    default:
      throw new Error(`Unsupported node import type: ${serialized.kind}`);
  }

  (node as any).enabled = serialized.enabled !== false;
  return node;
}

export class SignalRouter {
  private nodes: Map<string, INode> = new Map();
  private connections: IConnection[] = [];
  private executionOrder: string[] = [];
  private nodeStates: Map<string, Record<string, any>> = new Map();
  private pipeline: string[] = []; // Przechowuje kolejność ID dla widoku poziomego
  private enabled = true;

  isEnabled() {
    return this.enabled;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  getNodes() {
    return this.pipeline.map((id) => this.nodes.get(id)!).filter(Boolean);
  }

  getConnections() {
    return [...this.connections];
  }

  /**
   * Rejestruje nowy węzeł w systemie
   */
  addNode(node: INode, atIndex?: number) {
    this.nodes.set(node.id, node);
    this.nodeStates.set(node.id, {});
    if (typeof atIndex === 'number') {
      this.pipeline.splice(atIndex, 0, node.id);
    } else {
      this.pipeline.push(node.id);
    }

    this.autoRoutePipeline();
    return this;
  }

  removeNode(nodeId: string) {
    // Nie pozwól usunąć kotwic
    if (nodeId.startsWith('anchor-')) return;
    this.nodes.delete(nodeId);
    this.pipeline = this.pipeline.filter((id) => id !== nodeId);
    this.connections = this.connections.filter(
      (c) => c.fromNodeId !== nodeId && c.toNodeId !== nodeId,
    );
    this.autoRoutePipeline();
  }

  moveNode(fromIndex: number, toIndex: number) {
    const [movedId] = this.pipeline.splice(fromIndex, 1);
    this.pipeline.splice(toIndex, 0, movedId);
    this.autoRoutePipeline();
  }

  /**
   * Inteligentne łączenie dla prostych łańcuchów
   */
  private autoRoutePipeline() {
    this.connections = [];
    for (let i = 0; i < this.pipeline.length - 1; i++) {
      const current = this.nodes.get(this.pipeline[i]);
      const next = this.nodes.get(this.pipeline[i + 1]);

      if (current && next) {
        const outPort =
          this.preferredPort(current.outputs, [
            'out',
            'outputSignal',
            'envelope',
            'normalizedPeak',
          ]) ?? Object.keys(current.outputs)[0];
        const inPort =
          this.preferredPort(next.inputs, ['in', 'inputSignal', 'trigger']) ??
          Object.keys(next.inputs)[0];

        if (outPort && inPort) {
          this.connect(current.id, outPort, next.id, inPort);
        }
      }
    }
    this.invalidateOrder();
  }

  private preferredPort(
    ports: Record<string, unknown>,
    preferredIds: string[],
  ) {
    return preferredIds.find((portId) => Object.prototype.hasOwnProperty.call(ports, portId));
  }

  /**
   * Łączy port wyjściowy jednego węzła z wejściowym drugiego
   */
  connect(
    fromNodeId: string,
    fromPortId: string,
    toNodeId: string,
    toPortId: string,
  ) {
    const conn: IConnection = { fromNodeId, fromPortId, toNodeId, toPortId };
    this.connections.push(conn);
    this.invalidateOrder();
  }

  /**
   * Uruchamia przetwarzanie całego grafu (wywoływane co klatkę)
   */
  update(sources: Record<string, SignalValue>) {
    if (!this.enabled) return;

    // 1. Zaktualizuj wartości wejściowe (Inject sources)
    // W prostej wersji zakładamy nody typu "Source", które czytają z obiektu sources

    // 2. Przetwarzaj nody zgodnie z kolejnością topologiczną
    for (const nodeId of this.executionOrder) {
      const node = this.nodes.get(nodeId);
      if (!node) continue;

      // Przenieś wartości z wyjść poprzedników do wejść tego noda
      this.propagateSignals(nodeId);

      // Wykonaj obliczenia
      node.process(this.nodeStates.get(nodeId)!, sources);
    }
  }

  private propagateSignals(nodeId: string) {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    const incoming = this.connections.filter((c) => c.toNodeId === nodeId);
    for (const conn of incoming) {
      const sender = this.nodes.get(conn.fromNodeId);
      if (sender && sender.outputs[conn.fromPortId]) {
        node.inputs[conn.toPortId].value =
          sender.outputs[conn.fromPortId].value;
      }
    }
  }

  /**
   * Algorytm sortowania topologicznego (Kahn's algorithm)
   * Gwarantuje, że Tool1 wykona się przed Tool2, jeśli Tool2 od niego zależy.
   */
  private invalidateOrder() {
    const order: string[] = [];
    const visited = new Set<string>();
    const tempVisited = new Set<string>();
    const nodes = Array.from(this.nodes.keys());

    const visit = (id: string) => {
      if (tempVisited.has(id)) throw new Error('Graph cycle detected!');
      if (visited.has(id)) return;

      tempVisited.add(id);
      const dependencies = this.connections
        .filter((c) => c.toNodeId === id)
        .map((c) => c.fromNodeId);

      for (const depId of dependencies) {
        visit(depId);
      }

      tempVisited.delete(id);
      visited.add(id);
      order.push(id);
    };

    nodes.forEach((id) => visit(id));
    this.executionOrder = order;
  }

  // Helper do pobierania wartości wyjściowej konkretnego noda (np. do UI lub wizualizacji)
  getOutput(nodeId: string, portId: string = 'out'): SignalValue {
    return this.nodes.get(nodeId)?.outputs[portId]?.value ?? 0;
  }

  clone() {
    const router = new SignalRouter();
    router.setEnabled(this.enabled);
    for (const node of this.getNodes()) {
      router.addNode(cloneNode(node, nextNodeId(node.id)));
    }
    return router;
  }

  branchFromNode(nodeId: string, targetParam: string) {
    const nodes = this.getNodes();
    const branchIndex = nodes.findIndex((node) => node.id === nodeId);
    if (branchIndex < 0) return null;

    const router = new SignalRouter();
    const branchNodes =
      nodes[branchIndex].type === 'target'
        ? nodes.slice(0, branchIndex)
        : nodes.slice(0, branchIndex + 1);

    for (const node of branchNodes) {
      router.addNode(cloneNode(node, nextNodeId(node.id)));
    }
    router.addNode(new TargetNode(nextNodeId('branch-target'), targetParam));
    return router;
  }

  toJSON(): SerializedSignalRouter {
    return {
      enabled: this.enabled,
      nodes: this.getNodes().map(serializeNode),
    };
  }

  static fromJSON(serialized: SerializedSignalRouter) {
    if (!Array.isArray(serialized?.nodes)) {
      throw new Error('Router JSON does not contain a nodes array.');
    }

    const router = new SignalRouter();
    router.setEnabled(serialized.enabled !== false);
    for (const node of serialized.nodes) {
      router.addNode(deserializeNode(node));
    }
    return router;
  }
}
