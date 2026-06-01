import { INode, IPort, PortDirection } from './types';

export class SourceNode implements INode {
  id: string;
  name = 'Audio Source';
  type = 'source';
  inputs: Record<string, IPort> = {};
  outputs: Record<string, IPort>;

  sourceKey: string;

  constructor(id: string, sourceKey: string) {
    this.id = id;
    this.sourceKey = sourceKey;
    this.outputs = {
      out: {
        id: 'out',
        name: sourceKey,
        direction: PortDirection.OUTPUT,
        nodeId: id,
        value: 0,
      },
    };
  }

  process(_state: any, globalSources: Record<string, number>) {
    this.outputs.out.value = globalSources[this.sourceKey] ?? 0;
  }
}
