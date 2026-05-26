import type { NumericRecord } from '../core/types';

type MidiAccess = MIDIAccess & {
  inputs: Map<string, MIDIInput>;
};

type MidiMessageEvent = Event & {
  data: Uint8Array;
};

export class MidiManager {
  private access?: MidiAccess;
  private values: NumericRecord = {};
  private connected = false;

  get currentValues() {
    return this.values;
  }

  get isConnected() {
    return this.connected;
  }

  async connect() {
    if (!('requestMIDIAccess' in navigator)) {
      throw new Error('Web MIDI is not available in this browser.');
    }

    this.access = (await navigator.requestMIDIAccess()) as MidiAccess;
    this.connected = true;
    this.bindInputs();
    this.access.onstatechange = () => this.bindInputs();
  }

  private bindInputs() {
    this.access?.inputs.forEach((input) => {
      input.onmidimessage = (event) => this.handleMessage(event as MidiMessageEvent);
    });
  }

  private handleMessage(event: MidiMessageEvent) {
    const [status, data1, data2] = event.data;
    const command = status & 0xf0;
    const channel = status & 0x0f;

    if (command === 0xb0) {
      this.values = {
        ...this.values,
        [`midi.cc.${channel}.${data1}`]: data2 / 127,
        [`cc${data1}`]: data2 / 127,
      };
    }

    if (command === 0x90) {
      this.values = {
        ...this.values,
        [`midi.note.${channel}.${data1}`]: data2 / 127,
        [`note${data1}`]: data2 / 127,
      };
    }

    if (command === 0x80 || (command === 0x90 && data2 === 0)) {
      this.values = {
        ...this.values,
        [`midi.note.${channel}.${data1}`]: 0,
        [`note${data1}`]: 0,
      };
    }
  }
}
