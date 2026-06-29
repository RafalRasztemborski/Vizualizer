export type SignalValue = number; // W przyszłości może to być union: number | string | object

export enum PortDirection {
  INPUT = 'IN',
  OUTPUT = 'OUT',
}

export interface IPort {
  id: string;
  name: string;
  direction: PortDirection;
  nodeId: string;
  value: SignalValue;
}

export interface IConnection {
  fromNodeId: string;
  fromPortId: string;
  toNodeId: string;
  toPortId: string;
}

export type NodeControlKind = 'knob' | 'slider' | 'toggle' | 'dropdown';

export type NodeControlOption = {
  label: string;
  value: string | number | boolean;
};

export type NodeControlDefinition = {
  key: string;
  label: string;
  kind: NodeControlKind;
  min?: number;
  max?: number;
  step?: number;
  options?: NodeControlOption[];
  description?: string;
};

export interface INode {
  id: string;
  name: string;
  type: string;
  inputs: Record<string, IPort>;
  outputs: Record<string, IPort>;
  controls?: NodeControlDefinition[];

  /**
   * Główna logika transformacji sygnału.
   * Pobiera wartości z portów wejściowych i zapisuje do wyjściowych.
   */
  process(
    state: Record<string, any>,
    globalSources?: Record<string, number>,
  ): void;
}

export interface IRoutingExport {
  nodes: any[];
  connections: IConnection[];
}
