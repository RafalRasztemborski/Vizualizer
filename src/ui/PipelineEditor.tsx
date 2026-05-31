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
import {
  SignalStrengthenerProNode,
  StrengthenerMode,
} from './SignalStrengthenerProNode';

export const PipelineEditor: React.FC<{
  routers: SignalRouter[];
  sourceKeys: string[];
  targetKeys: string[];
  onUpdate: () => void;
  onAddRoute: () => void;
  onRemoveRoute: (index: number) => void;
}> = ({
  routers,
  sourceKeys,
  targetKeys,
  onUpdate,
  onAddRoute,
  onRemoveRoute,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  // State przechowujący pozycję: [indexŚcieżki, indexGdzieWstawić]
  const [selectorPos, setSelectorPos] = useState<[number, number] | null>(null);

  const handleAddNode = (
    type: string,
    trackIndex: number,
    nodeIndex: number,
  ) => {
    const router = routers[trackIndex];
    if (!router) return;

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
      case 'strengthener_pro':
        node = new SignalStrengthenerProNode(id);
        break;
      default:
        return;
    }

    router.addNode(node, nodeIndex);
    setSelectorPos(null);
    onUpdate();
  };

  return (
    <div
      className={`pipeline-container ${isCollapsed ? 'collapsed' : ''}`}
      style={{
        overflow: 'hidden',
        // Zarządzamy wysokością całego okna w zależności od 3 stanów:
        height: isCollapsed ? '40px' : isExpanded ? '50vh' : '300px',
        transition: 'height 0.3s ease-in-out',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        className="pipeline-header"
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{
          position: 'relative',
          zIndex: 10, // Nagłówek ma stały poziom
          cursor: 'pointer',
        }}
      >
        <h2>Signal Flow Pipeline Explorer</h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {!isCollapsed && (
            <button
              className="btn-small"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                onAddRoute();
              }}
              style={{
                background: '#39d2c0',
                color: '#1a1a1a',
                fontWeight: 'bold',
              }}
            >
              + Add Path
            </button>
          )}
          {!isCollapsed && (
            <button
              className="btn-small"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              style={{ fontSize: '14px', minWidth: '30px', color: '#39d2c0' }}
              title={isExpanded ? 'Restore to normal' : 'Expand to half screen'}
            >
              {isExpanded ? '▼' : '▲'}
            </button>
          )}
          <button
            className="btn-small"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              setIsCollapsed(!isCollapsed);
            }}
            style={{ fontSize: '14px', minWidth: '30px' }}
          >
            {isCollapsed ? '□' : '−'}
          </button>
        </div>
      </div>
      <div
        className="pipeline-editor-body"
        style={{
          display: isCollapsed ? 'none' : 'flex',
          flexDirection: 'column',
          gap: '30px',
          padding: '10px',
          flex: 1, // Wypełnia resztę wysokości kontenera
          overflowY: 'auto',
          position: 'relative',
          zIndex: selectorPos ? 20 : 1, // Podbijamy body nad header tylko gdy menu jest otwarte
        }}
      >
        {routers.map((router, trackIdx) => (
          <div
            key={trackIdx}
            className="pipeline-track-container"
            style={{
              borderLeft: '2px solid rgba(57, 210, 192, 0.2)',
              paddingLeft: '15px',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: '4px',
              position: 'relative',
              zIndex: selectorPos?.[0] === trackIdx ? 100 : 1,
              overflow: 'visible', // Zapobiega ucinaniu dropdownu przez kontener ścieżki
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 0',
              }}
            >
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 'bold',
                  color: '#39d2c0',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}
              >
                Signal Path #{trackIdx + 1}
              </span>
              {routers.length > 1 && (
                <button
                  className="btn-small"
                  onClick={() => onRemoveRoute(trackIdx)}
                  style={{
                    color: '#ff4d4d',
                    border: '1px solid rgba(255,77,77,0.3)',
                  }}
                >
                  Remove Path
                </button>
              )}
            </div>
            <div
              className="pipeline-track"
              style={{
                overflow: 'visible',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {router.getNodes().map((node, i, nodes) => (
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
                    <div
                      className="pipeline-connector"
                      style={{
                        position: 'relative',
                        zIndex:
                          selectorPos?.[0] === trackIdx &&
                          selectorPos?.[1] === i + 1
                            ? 200 // Wyżej niż karty noda
                            : 1,
                      }}
                    >
                      <div className="connector-line" />
                      <div className="pulse" />
                      <button
                        className="add-mid-btn"
                        onClick={() => setSelectorPos([trackIdx, i + 1])}
                        title="Insert Processor"
                      >
                        +
                      </button>
                      {selectorPos?.[0] === trackIdx &&
                        selectorPos?.[1] === i + 1 && (
                          <div
                            className="node-selector-dropdown"
                            style={{
                              zIndex: 1000,
                              position: 'absolute',
                              top: '25px', // Gwarantuje, że otworzy się pod przyciskiem +
                              left: '0',
                            }}
                          >
                            <button
                              onClick={() =>
                                handleAddNode('lerp', trackIdx, i + 1)
                              }
                            >
                              Lerp
                            </button>
                            <button
                              onClick={() =>
                                handleAddNode('smoothing', trackIdx, i + 1)
                              }
                            >
                              Smoothing
                            </button>
                            <button
                              onClick={() =>
                                handleAddNode('strength', trackIdx, i + 1)
                              }
                            >
                              Strength
                            </button>
                            <button
                              onClick={() =>
                                handleAddNode('clamp', trackIdx, i + 1)
                              }
                            >
                              Clamp
                            </button>
                            <button
                              onClick={() =>
                                handleAddNode('curve', trackIdx, i + 1)
                              }
                            >
                              Curve
                            </button>
                            <button
                              onClick={() =>
                                handleAddNode('remap', trackIdx, i + 1)
                              }
                            >
                              Remap
                            </button>
                            <button
                              onClick={() =>
                                handleAddNode(
                                  'strengthener_pro',
                                  trackIdx,
                                  i + 1,
                                )
                              }
                            >
                              Strengthener PRO
                            </button>
                            <div className="divider" />
                            <button
                              className="cancel"
                              onClick={() => setSelectorPos(null)}
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
          </div>
        ))}
      </div>
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
  const inputVal = Object.values(node.inputs)[0]?.value ?? 0;
  const outputVal = Object.values(node.outputs)[0]?.value ?? inputVal;

  // Strengthening PRO wypuszcza zakres 1-100, musimy to uwzględnić w VU meterze
  const isPro = node instanceof SignalStrengthenerProNode;

  let barWidth = 0;
  if (node.type === 'source') {
    barWidth = outputVal * 100;
  } else if (isPro) {
    // Skalujemy wyjście 1-100 na procenty paska (100 = 100%)
    barWidth = outputVal;
  } else {
    // Standardowy procesor 0.0 - 1.0
    barWidth = inputVal * 100;
  }

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
              style={{ width: `${Math.max(0, Math.min(100, barWidth))}%` }}
            />
          </div>
          <div className="vu-values">
            <span>{inputVal.toFixed(3)}</span>
            {node.type !== 'target' && (
              <b style={{ color: '#60a5fa' }}>
                → {isPro ? Math.round(outputVal) : outputVal.toFixed(3)}
              </b>
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

      {node instanceof SignalStrengthenerProNode && (
        <div
          className="node-settings"
          style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
        >
          <select
            className="compact-select"
            value={node.mode}
            onChange={(e) => {
              node.mode = e.target.value as StrengthenerMode;
              onUpdate();
            }}
          >
            <option value={StrengthenerMode.POWER}>Mode: Power</option>
            <option value={StrengthenerMode.DUAL_RANGE}>
              Mode: Dual Range
            </option>
          </select>

          {node.mode === StrengthenerMode.POWER ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '8px', opacity: 0.7 }}>
                  Exponent (p): {node.p.toFixed(2)}
                </span>
                <input
                  type="range"
                  min="0.1"
                  max="5"
                  step="0.05"
                  value={node.p}
                  onChange={(e) => {
                    node.p = parseFloat(e.target.value);
                    onUpdate();
                  }}
                />
              </div>
            </>
          ) : (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '8px', opacity: 0.7 }}>
                    Break (b): {node.b}
                  </span>
                  <input
                    type="range"
                    min="0.05"
                    max="0.95"
                    step="0.01"
                    value={node.b}
                    onChange={(e) => {
                      node.b = parseFloat(e.target.value);
                      onUpdate();
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '8px', opacity: 0.7 }}>
                    Blend (d): {node.d}
                  </span>
                  <input
                    type="range"
                    min="0.01"
                    max="0.4"
                    step="0.01"
                    value={node.d}
                    onChange={(e) => {
                      node.d = parseFloat(e.target.value);
                      onUpdate();
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '8px', opacity: 0.7 }}>
                    Low Exp: {node.lowExponent}
                  </span>
                  <input
                    type="range"
                    min="0.1"
                    max="3"
                    step="0.05"
                    value={node.lowExponent}
                    onChange={(e) => {
                      node.lowExponent = parseFloat(e.target.value);
                      onUpdate();
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '8px', opacity: 0.7 }}>
                    High Exp: {node.highExponent}
                  </span>
                  <input
                    type="range"
                    min="1"
                    max="8"
                    step="0.1"
                    value={node.highExponent}
                    onChange={(e) => {
                      node.highExponent = parseFloat(e.target.value);
                      onUpdate();
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          <div
            className="pro-indicator"
            style={{
              fontSize: '8px',
              background: 'rgba(57, 210, 192, 0.1)',
              padding: '2px 4px',
              borderRadius: '2px',
              color: '#39d2c0',
              border: '1px solid rgba(57, 210, 192, 0.2)',
              textAlign: 'center',
            }}
          >
            Output: 1 - 100
          </div>
        </div>
      )}
    </div>
  );
};
