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

export interface INode {
  id: string;
  name: string;
  type: string;
  inputs: Record<string, IPort>;
  outputs: Record<string, IPort>;

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
