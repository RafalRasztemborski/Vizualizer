import React, { useState } from 'react';
import { SignalRouter } from './SignalRouter';
import { INode } from './types';
import { SourceNode } from './SourceNode';
import { TargetNode } from './TargetNode';
import { SmoothingNode } from './SmoothingNode';
import { SignalStrengthNode } from './SignalStrengthNode';
import { LerpNode } from './LerpNode';
import { ClampNode } from './ClampNode';
import { CurveNode } from './CurveNode';
import { RemapNode } from './RemapNode';

export const PipelineEditor: React.FC<{
  router: SignalRouter;
  sourceKeys: string[];
  targetKeys: string[];
  onUpdate: () => void;
}> = ({ router, sourceKeys, targetKeys, onUpdate }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectorIndex, setSelectorIndex] = useState<number | null>(null);
  const nodes = router.getNodes();

  const handleAddNode = (type: string, index: number) => {
    const id = crypto.randomUUID();
    let node: INode;

    switch (type) {
      case 'smoothing':
        node = new SmoothingNode(id);
        break;
      case 'strength':
        node = new SignalStrengthNode(id);
        break;
      case 'lerp':
        node = new LerpNode(id);
        break;
      case 'clamp':
        node = new ClampNode(id);
        break;
      case 'curve':
        node = new CurveNode(id);
        break;
      case 'remap':
        node = new RemapNode(id);
        break;
      default:
        return;
    }

    router.addNode(node, index);
    setSelectorIndex(null);
    onUpdate();
  };

  return (
    <div
      className={`pipeline-container ${isCollapsed ? 'collapsed' : ''}`}
      style={{ overflow: isCollapsed ? 'hidden' : 'visible' }}
    >
      <div
        className="pipeline-header"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <h2>Signal Flow Pipeline Explorer</h2>
        <button className="btn-small">
          {isCollapsed ? '↑ Open Engine' : '↓ Hide'}
        </button>
      </div>
      {!isCollapsed && (
        <div className="pipeline-track">
          {nodes.map((node, i) => (
            <React.Fragment key={node.id}>
              <PipelineNodeCard
                node={node}
                sourceKeys={sourceKeys}
                targetKeys={targetKeys}
                onRemove={() => {
                  router.removeNode(node.id);
                  onUpdate();
                }}
                onMove={(dir) => {
                  router.moveNode(i, i + dir);
                  onUpdate();
                }}
                isFirst={i === 0}
                isLast={i === nodes.length - 1}
                onUpdate={onUpdate}
              />
              {i < nodes.length - 1 && (
                <div className="pipeline-connector">
                  <div className="connector-line" />
                  <div className="pulse" />
                  <button
                    className="add-mid-btn"
                    onClick={() => setSelectorIndex(i + 1)}
                    title="Insert Processor"
                  >
                    +
                  </button>
                  {selectorIndex === i + 1 && (
                    <div className="node-selector-dropdown">
                      <button onClick={() => handleAddNode('lerp', i + 1)}>
                        Lerp
                      </button>
                      <button onClick={() => handleAddNode('smoothing', i + 1)}>
                        Smoothing
                      </button>
                      <button onClick={() => handleAddNode('strength', i + 1)}>
                        Strength
                      </button>
                      <button onClick={() => handleAddNode('clamp', i + 1)}>
                        Clamp
                      </button>
                      <button onClick={() => handleAddNode('curve', i + 1)}>
                        Curve
                      </button>
                      <button onClick={() => handleAddNode('remap', i + 1)}>
                        Remap
                      </button>
                      <div className="divider" />
                      <button
                        className="cancel"
                        onClick={() => setSelectorIndex(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

const PipelineNodeCard: React.FC<{
  node: INode;
  sourceKeys: string[];
  targetKeys: string[];
  onRemove: () => void;
  onMove: (dir: number) => void;
  isFirst: boolean;
  isLast: boolean;

  onUpdate: () => void;
}> = ({
  node,
  sourceKeys,
  targetKeys,
  onRemove,
  onMove,
  isFirst,
  isLast,
  onUpdate,
}) => {
  // Pobieramy wartości sygnałów (tutaj uproszczone, router powinien je udostępniać)
  const inputVal = Object.values(node.inputs)[0]?.value ?? 0;
  const outputVal = Object.values(node.outputs)[0]?.value ?? inputVal;

  const isAnchor = node.id.startsWith('anchor');

  return (
    <div
      className={`pipeline-card type-${node.type} ${isAnchor ? 'is-anchor' : ''}`}
    >
      <div className="node-title-area">
        <div
          className="node-title-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '4px',
          }}
        >
          <strong
            className="node-header-title"
            style={{
              fontSize: '10px',
              color: '#39d2c0',
              textTransform: 'uppercase',
            }}
          >
            {node.name}
          </strong>
          <div className="card-controls">
            {!isAnchor && (
              <>
                <button
                  onClick={() => onMove(-1)}
                  title="Move Left"
                  style={{ padding: '0 4px', minHeight: '18px' }}
                >
                  ◂
                </button>
                <button
                  onClick={() => onMove(1)}
                  title="Move Right"
                  style={{ padding: '0 4px', minHeight: '18px' }}
                >
                  ▸
                </button>
                <button
                  className="close-btn"
                  onClick={onRemove}
                  title="Remove"
                  style={{ padding: '0 4px', minHeight: '18px' }}
                >
                  ×
                </button>
              </>
            )}
          </div>
        </div>

        {node instanceof SourceNode ? (
          <select
            className="compact-select"
            value={(node as SourceNode).sourceKey}
            onChange={(e) => {
              (node as SourceNode).sourceKey = e.target.value;
              onUpdate();
            }}
          >
            {sourceKeys.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        ) : node instanceof TargetNode ? (
          <select
            className="compact-select"
            value={(node as TargetNode).targetParam}
            onChange={(e) => {
              (node as TargetNode).targetParam = e.target.value;
              onUpdate();
            }}
          >
            {targetKeys.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="node-monitor">
        <div className="pipeline-vu">
          <div className="vu-bar">
            <div
              className="vu-level"
              style={{ width: `${Math.min(100, inputVal * 100)}%` }}
            />
          </div>
          <div className="vu-values">
            <span>{inputVal.toFixed(2)}</span>
            {node.type !== 'target' && (
              <b style={{ color: '#60a5fa' }}>→ {outputVal.toFixed(2)}</b>
            )}
          </div>
        </div>
      </div>

      {node instanceof SmoothingNode && (
        <div className="node-settings">
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
          <span className="setting-label" style={{ fontSize: '9px' }}>
            Smooth: {node.factor.toFixed(2)}
          </span>
        </div>
      )}

      {node instanceof LerpNode && (
        <div className="node-settings">
          <input
            type="range"
            min="0.001"
            max="1"
            step="0.001"
            value={node.factor}
            onChange={(e) => {
              node.factor = parseFloat(e.target.value);
              onUpdate();
            }}
          />
          <span className="setting-label" style={{ fontSize: '9px' }}>
            Lerp Speed: {node.factor.toFixed(3)}
          </span>
        </div>
      )}

      {node instanceof ClampNode && (
        <div className="node-settings">
          <div style={{ display: 'flex', gap: '4px' }}>
            <input
              type="number"
              className="compact-input"
              value={node.min}
              onChange={(e) => {
                node.min = parseFloat(e.target.value) || 0;
                onUpdate();
              }}
              style={{ width: '45px', fontSize: '9px' }}
            />
            <input
              type="number"
              className="compact-input"
              value={node.max}
              onChange={(e) => {
                node.max = parseFloat(e.target.value) || 0;
                onUpdate();
              }}
              style={{ width: '45px', fontSize: '9px' }}
            />
          </div>
          <span className="setting-label" style={{ fontSize: '9px' }}>
            Min / Max
          </span>
        </div>
      )}

      {node instanceof CurveNode && (
        <div className="node-settings">
          <select
            className="compact-select"
            value={node.mode}
            onChange={(e) => {
              node.mode = e.target.value as 'power' | 'log';
              onUpdate();
            }}
            style={{ marginBottom: '4px' }}
          >
            <option value="power">Power (x^n)</option>
            <option value="log">Log (log10)</option>
          </select>
          {node.mode === 'power' ? (
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.01"
              value={node.exponent}
              onChange={(e) => {
                node.exponent = parseFloat(e.target.value);
                onUpdate();
              }}
            />
          ) : (
            <input
              type="range"
              min="1"
              max="100"
              step="1"
              value={node.intensity}
              onChange={(e) => {
                node.intensity = parseFloat(e.target.value);
                onUpdate();
              }}
            />
          )}
          <span className="setting-label" style={{ fontSize: '9px' }}>
            {node.mode === 'power'
              ? `Exponent: ${node.exponent.toFixed(2)}`
              : `Intensity: ${node.intensity}`}
          </span>
        </div>
      )}

      {node instanceof SignalStrengthNode && (
        <div className="node-settings">
          <input
            type="range"
            min="0.1"
            max="200"
            step="0.1"
            value={node.multiplier}
            onChange={(e) => {
              node.multiplier = parseFloat(e.target.value);
              onUpdate();
            }}
          />
          <span className="setting-label" style={{ fontSize: '9px' }}>
            Mult: {node.multiplier.toFixed(1)}x
          </span>
          {/* ... reszta bez zmian ... */}
        </div>
      )}

      {node instanceof RemapNode && (
        <div className="node-settings">
          <div
            className="remap-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '4px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '8px', opacity: 0.5 }}>In Min</span>
              <input
                type="number"
                className="compact-input"
                step="0.01"
                value={node.inMin}
                onChange={(e) => {
                  node.inMin = parseFloat(e.target.value);
                  onUpdate();
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '8px', opacity: 0.5 }}>In Max</span>
              <input
                type="number"
                className="compact-input"
                step="0.01"
                value={node.inMax}
                onChange={(e) => {
                  node.inMax = parseFloat(e.target.value);
                  onUpdate();
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '8px', opacity: 0.5 }}>Out Min</span>
              <input
                type="number"
                className="compact-input"
                value={node.outMin}
                onChange={(e) => {
                  node.outMin = parseFloat(e.target.value);
                  onUpdate();
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '8px', opacity: 0.5 }}>Out Max</span>
              <input
                type="number"
                className="compact-input"
                value={node.outMax}
                onChange={(e) => {
                  node.outMax = parseFloat(e.target.value);
                  onUpdate();
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
