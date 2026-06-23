import { INode, IPort, PortDirection } from './types';

export type BounceCurve = 'linear' | 'exponential';

type BouncePhase = 'idle' | 'rising' | 'decaying';

export type BounceNodeState = {
  envelope: number;
  prevEnvelope: number;
  peak: number;
  phase: BouncePhase;
  bouncePhase: number;
  bouncing: boolean;
  triggerPeak: number;
  refractory: number;
  smoothedOutput: number;
};

const ENVELOPE_ATTACK = 0.65;
const ENVELOPE_RELEASE = 0.12;
const OUTPUT_SMOOTH = 0.28;
const REFRACTORY_FRAMES = 10;

function bounceWave(
  phase: number,
  depth: number,
  curve: BounceCurve,
): number {
  if (phase <= 0 || phase >= 1) return 0;

  if (curve === 'linear') {
    return -depth * Math.sin(Math.PI * phase);
  }

  // Exponential: szybsze zejście, wolniejszy powrót (phase warp)
  const warped = Math.pow(phase, 0.55);
  return -depth * Math.sin(Math.PI * warped);
}

export class BounceNode implements INode {
  id: string;
  name = 'Bounce';
  type = 'processor';
  inputs: Record<string, IPort>;
  outputs: Record<string, IPort>;
  enabled: boolean = true;

  attackSensitivity: number = 0.025;
  decaySensitivity: number = 0.018;
  minAmplitude: number = 0.12;
  bounceDepth: number = 0.45;
  bounceSpeed: number = 0.1;
  bounceCurve: BounceCurve = 'exponential';

  constructor(id: string) {
    this.id = id;
    this.inputs = {
      in: {
        id: 'in',
        name: 'Input',
        direction: PortDirection.INPUT,
        nodeId: id,
        value: 0,
      },
    };
    this.outputs = {
      out: {
        id: 'out',
        name: 'Output',
        direction: PortDirection.OUTPUT,
        nodeId: id,
        value: 0,
      },
    };
  }

  process(state: BounceNodeState) {
    const input = Math.max(0, Math.min(1, this.inputs.in.value));

    if (this.enabled === false) {
      state.envelope = input;
      state.prevEnvelope = input;
      state.smoothedOutput = input;
      state.bouncing = false;
      state.bouncePhase = 0;
      state.phase = 'idle';
      state.peak = 0;
      state.refractory = 0;
      this.outputs.out.value = input;
      return;
    }

    if (state.envelope === undefined) state.envelope = input;
    if (state.prevEnvelope === undefined) state.prevEnvelope = input;
    if (state.smoothedOutput === undefined) state.smoothedOutput = input;
    if (state.phase === undefined) state.phase = 'idle';
    if (state.peak === undefined) state.peak = 0;
    if (state.bouncing === undefined) state.bouncing = false;
    if (state.bouncePhase === undefined) state.bouncePhase = 0;
    if (state.triggerPeak === undefined) state.triggerPeak = 0;
    if (state.refractory === undefined) state.refractory = 0;

    // Envelope follower
    const followRate =
      input > state.envelope ? ENVELOPE_ATTACK : ENVELOPE_RELEASE;
    state.envelope += (input - state.envelope) * followRate;

    const delta = state.envelope - state.prevEnvelope;
    state.prevEnvelope = state.envelope;

    // Impulse detection (attack → decay)
    if (state.refractory > 0) {
      state.refractory -= 1;
    } else if (delta > this.attackSensitivity) {
      state.phase = 'rising';
      state.peak = state.envelope;
    } else if (state.phase === 'rising') {
      state.peak = Math.max(state.peak, state.envelope);
      if (delta < -this.decaySensitivity * 0.35) {
        state.phase = 'decaying';
      }
    } else if (state.phase === 'decaying') {
      if (
        delta < -this.decaySensitivity &&
        state.peak >= this.minAmplitude
      ) {
        state.bouncing = true;
        state.bouncePhase = 0;
        state.triggerPeak = state.peak;
        state.refractory = REFRACTORY_FRAMES;
        state.phase = 'idle';
        state.peak = 0;
      } else if (state.envelope < 0.03) {
        state.phase = 'idle';
        state.peak = 0;
      }
    }

    if (state.phase === 'idle' && state.envelope < 0.02 && delta >= 0) {
      state.peak = 0;
    }

    // Negative bounce layer
    let bounce = 0;
    if (state.bouncing) {
      state.bouncePhase += this.bounceSpeed;
      if (state.bouncePhase >= 1) {
        state.bouncing = false;
        state.bouncePhase = 0;
      } else {
        const depth = this.bounceDepth * Math.min(1, state.triggerPeak || 1);
        bounce = bounceWave(state.bouncePhase, depth, this.bounceCurve);
      }
    }

    const raw = state.envelope + bounce;
    state.smoothedOutput +=
      (raw - state.smoothedOutput) * OUTPUT_SMOOTH;
    this.outputs.out.value = state.smoothedOutput;
  }
}
