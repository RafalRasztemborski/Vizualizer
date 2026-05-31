import { INode, IConnection, SignalValue } from './types';

export class SignalRouter {
  private nodes: Map<string, INode> = new Map();
  private connections: IConnection[] = [];
  private executionOrder: string[] = [];
  private nodeStates: Map<string, Record<string, any>> = new Map();
  private pipeline: string[] = []; // Przechowuje kolejność ID dla widoku poziomego

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
    if (nodeId === 'anchor-source' || nodeId === 'anchor-target') return;
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
        const outPorts = Object.keys(current.outputs);
        const inPorts = Object.keys(next.inputs);

        // Auto-connect tylko gdy mamy sytuację 1-to-1
        if (outPorts.length === 1 && inPorts.length === 1) {
          this.connect(current.id, outPorts[0], next.id, inPorts[0]);
        }
      }
    }
    this.invalidateOrder();
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
}
