import React, { useState } from 'react';
import { SignalRouter } from './SignalRouter';
import { SmoothingNode } from './SmoothingNode';
import { SourceNode } from './SourceNode';
import { TargetNode } from './TargetNode';
import { WaveTransformNode } from './WaveTransformNode';
import { INode, IPort } from './types';

interface Props {
  router: SignalRouter;
  sourceKeys: string[];
  targetKeys: string[];
  onUpdate: () => void; // Wywoływane, gdy struktura grafu się zmienia
}

export const SignalRouterUI: React.FC<Props> = ({
  router,
  sourceKeys,
  targetKeys,
  onUpdate,
}) => {
  const [nodes, setNodes] = useState<INode[]>(router.getNodes());
  const [connections, setConnections] = useState(router.getConnections());

  const refresh = () => {
    setNodes(router.getNodes());
    setConnections(router.getConnections());
    onUpdate();
  };

  const addSource = (key: string) => {
    router.addNode(new SourceNode(crypto.randomUUID(), key));
    refresh();
  };

  const addTarget = (key: string) => {
    router.addNode(new TargetNode(crypto.randomUUID(), key));
    refresh();
  };

  const addSmoothing = () => {
    router.addNode(new SmoothingNode(crypto.randomUUID()));
    refresh();
  };

  const addWaveTransform = () => {
    router.addNode(new WaveTransformNode(crypto.randomUUID()));
    refresh();
  };

  const removeNode = (id: string) => {
    router.removeNode(id);
    refresh();
  };

  return (
    <section className="signal-router-ui panel">
      <div className="panelHeader">
        <h2>Signal Pipeline</h2>
        <div className="add-node-buttons">
          <select onChange={(e) => addSource(e.target.value)} value="">
            <option value="">+ Source</option>
            {sourceKeys.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <select onChange={(e) => addTarget(e.target.value)} value="">
            <option value="">+ Target</option>
            {targetKeys.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <button onClick={addSmoothing}>+ Smooth</button>
          <button onClick={addWaveTransform}>+ Wave</button>
        </div>
      </div>

      <div className="node-list">
        {nodes.map((node) => (
          <div key={node.id} className={`node-card type-${node.type}`}>
            <div className="node-header">
              <strong>{node.name}</strong>
              <button className="btn-small" onClick={() => removeNode(node.id)}>
                ×
              </button>
            </div>

            <div className="node-ports">
              <div className="ports-in">
                {Object.values(node.inputs).map((p) => (
                  <div key={p.id} className="port-label">
                    ● IN: {p.name}
                  </div>
                ))}
              </div>
              <div className="ports-out">
                {Object.values(node.outputs).map((p) => (
                  <div key={p.id} className="port-label">
                    OUT: {p.name} ●
                  </div>
                ))}
              </div>
            </div>

            {node instanceof SmoothingNode && (
              <div className="node-params">
                <label>
                  Factor: {node.factor.toFixed(2)}
                  <input
                    type="range"
                    min="0.01"
                    max="0.99"
                    step="0.01"
                    value={node.factor}
                    onChange={(e) => {
                      node.factor = parseFloat(e.target.value);
                      onUpdate();
                    }}
                  />
                </label>
              </div>
            )}

            {node instanceof WaveTransformNode && (
              <div className="node-params">
                <label>
                  Function:
                  <select
                    value={node.mode}
                    onChange={(e) => {
                      node.mode = e.target.value as 'sine' | 'cosine';
                      onUpdate();
                    }}
                  >
                    <option value="sine">Sine</option>
                    <option value="cosine">Cosine</option>
                  </select>
                </label>
                <label>
                  Density: {node.density.toFixed(2)}
                  <input
                    type="range"
                    min="-10"
                    max="10"
                    step="0.01"
                    value={node.density}
                    onChange={(e) => {
                      node.density = parseFloat(e.target.value);
                      onUpdate();
                    }}
                  />
                </label>
                <label>
                  Phase: {node.phase.toFixed(2)}
                  <input
                    type="range"
                    min="-3.14"
                    max="3.14"
                    step="0.01"
                    value={node.phase}
                    onChange={(e) => {
                      node.phase = parseFloat(e.target.value);
                      onUpdate();
                    }}
                  />
                </label>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="connection-editor">
        <h3>Connections</h3>
        <ConnectionCreator
          nodes={nodes}
          onConnect={(fs, fp, ts, tp) => {
            router.connect(fs, fp, ts, tp);
            refresh();
          }}
        />

        <div className="connection-list">
          {connections.map((c, i) => (
            <div key={i} className="connection-item">
              {router.getNodes().find((n) => n.id === c.fromNodeId)?.name}
              <span>→</span>
              {router.getNodes().find((n) => n.id === c.toNodeId)?.name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const ConnectionCreator: React.FC<{
  nodes: INode[];
  onConnect: (fn: string, fp: string, tn: string, tp: string) => void;
}> = ({ nodes, onConnect }) => {
  const [from, setFrom] = useState({ n: '', p: '' });
  const [to, setTo] = useState({ n: '', p: '' });

  return (
    <div className="connection-creator">
      <div className="conn-row">
        <select onChange={(e) => setFrom({ ...from, n: e.target.value })}>
          <option value="">From Node</option>
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </select>
        <select onChange={(e) => setFrom({ ...from, p: e.target.value })}>
          <option value="">Port</option>
          {nodes.find((n) => n.id === from.n) &&
            Object.keys(nodes.find((n) => n.id === from.n)!.outputs).map(
              (k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ),
            )}
        </select>
      </div>
      <div className="conn-row">
        <select onChange={(e) => setTo({ ...to, n: e.target.value })}>
          <option value="">To Node</option>
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </select>
        <select onChange={(e) => setTo({ ...to, p: e.target.value })}>
          <option value="">Port</option>
          {nodes.find((n) => n.id === to.n) &&
            Object.keys(nodes.find((n) => n.id === to.n)!.inputs).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
        </select>
      </div>
      <button
        disabled={!from.p || !to.p}
        onClick={() => onConnect(from.n, from.p, to.n, to.p)}
      >
        Connect
      </button>
    </div>
  );
};
