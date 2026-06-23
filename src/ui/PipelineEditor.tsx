import React, { useRef, useState } from 'react';
import { SignalRouter } from './SignalRouter';
import { INode } from './types';
import { SourceNode } from './SourceNode';
import { TargetNode } from './TargetNode';
import { SmoothingNode } from './SmoothingNode';
import { SignalStrengthNode } from './SignalStrengthNode';
import { LerpNode } from './LerpNode';
import { ClampNode } from './ClampNode';
import { BounceNode } from './BounceNode';
import { CurveNode } from './CurveNode';
import { InverterNode } from './InverterNode';
import { OffsetNode } from './OffsetNode';
import { RemapNode } from './RemapNode';
import { WaveTransformNode } from './WaveTransformNode';
import {
  SignalStrengthenerProNode,
  StrengthenerMode,
} from './SignalStrengthenerProNode';
import {
  chainSourceKeysForTrack,
  formatChainSourceLabel,
} from './chainSources';

const PROCESSOR_OPTIONS = [
  { type: 'lerp', label: 'Lerp' },
  { type: 'inverter', label: 'Inverter' },
  { type: 'offset', label: 'Zero Offset' },
  { type: 'bounce', label: 'Bounce' },
  { type: 'smoothing', label: 'Smoothing' },
  { type: 'strength', label: 'Strength' },
  { type: 'clamp', label: 'Clamp' },
  { type: 'curve', label: 'Curve' },
  { type: 'remap', label: 'Remap' },
  { type: 'wave', label: 'Wave Transform' },
  { type: 'strengthener_pro', label: 'Strengthener PRO' },
];

export const PipelineEditor = React.memo<{
  routers: SignalRouter[];
  sourceKeys: string[];
  targetKeys: string[];
  onUpdate: () => void;
  onAddRoute: () => void;
  onRemoveRoute: (index: number) => void;
  onToggleRoute: (index: number) => void;
  onDuplicateRoute: (index: number) => void;
  onBranchRoute: (index: number, nodeId: string) => void;
  onExportRoutes: () => string;
  onImportRoutes: (json: string) => void;
}>(
  ({
    routers,
    sourceKeys,
    targetKeys,
    onUpdate,
    onAddRoute,
    onRemoveRoute,
    onToggleRoute,
    onDuplicateRoute,
    onBranchRoute,
    onExportRoutes,
    onImportRoutes,
  }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedTrack, setSelectedTrack] = useState(0);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    // State przechowujący pozycję: [indexŚcieżki, indexGdzieWstawić]
    const [selectorPos, setSelectorPos] = useState<[number, number] | null>(
      null,
    );

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
        case 'inverter':
          node = new InverterNode(id);
          break;
        case 'offset':
          node = new OffsetNode(id);
          break;
        case 'bounce':
          node = new BounceNode(id);
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
        case 'wave':
          node = new WaveTransformNode(id);
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

    const handleSaveRoutes = () => {
      const json = onExportRoutes();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `signal-router-${new Date()
        .toISOString()
        .replace(/[:.]/g, '-')}.json`;
      link.click();
      URL.revokeObjectURL(url);
    };

    const handleLoadRoutes = (file: File | undefined) => {
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        try {
          onImportRoutes(String(reader.result ?? ''));
          setSelectorPos(null);
          setSelectedTrack(0);
          onUpdate();
        } catch (error) {
          window.alert(
            error instanceof Error
              ? error.message
              : 'Could not load router JSON.',
          );
        }
      };
      reader.readAsText(file);
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
              <>
                <button
                  className="btn-small"
                  title="Save all signal paths to JSON"
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    handleSaveRoutes();
                  }}
                >
                  Save JSON
                </button>
                <button
                  className="btn-small"
                  title="Load signal paths from JSON"
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  Load JSON
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="router-file-input"
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    handleLoadRoutes(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </>
            )}
            {!isCollapsed && (
              <button
                className="btn-small"
                title="Duplicate selected signal path"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  onDuplicateRoute(selectedTrack);
                }}
                disabled={!routers[selectedTrack]}
              >
                Copy Selected
              </button>
            )}
            {!isCollapsed && (
              <button
                className="btn-small"
                title="Add a new signal path"
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
                title={
                  isExpanded ? 'Restore to normal' : 'Expand to half screen'
                }
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
            zIndex: selectorPos ? 20 : 1,
          }}
        >
          {!isCollapsed &&
            routers.map((router, trackIdx) => {
              const routeEnabled = router.isEnabled();
              const isSelected = selectedTrack === trackIdx;

              return (
              <div
                key={trackIdx}
                className={`pipeline-track-container ${isSelected ? 'is-selected' : ''} ${!routeEnabled ? 'is-disabled' : ''}`}
                onClick={() => setSelectedTrack(trackIdx)}
                style={{
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
                    {!routeEnabled ? ' / Muted' : ''}
                  </span>
                  <div className="path-actions">
                    <button
                      className={`btn-small path-power-btn ${routeEnabled ? 'is-on' : 'is-off'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleRoute(trackIdx);
                      }}
                      title={
                        routeEnabled
                          ? 'Disable this signal path'
                          : 'Enable this signal path'
                      }
                    >
                      {routeEnabled ? 'On' : 'Off'}
                    </button>
                    <button
                      className="btn-small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTrack(trackIdx);
                        onDuplicateRoute(trackIdx);
                      }}
                      title="Duplicate this signal path"
                    >
                      Copy
                    </button>
                    {routers.length > 1 && (
                    <button
                      className="btn-small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveRoute(trackIdx);
                        setSelectedTrack((current) =>
                          Math.max(0, Math.min(current, routers.length - 2)),
                        );
                      }}
                      style={{
                        color: '#ff4d4d',
                        border: '1px solid rgba(255,77,77,0.3)',
                      }}
                    >
                      Remove Path
                    </button>
                    )}
                  </div>
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
                        sourceKeys={[
                          ...sourceKeys,
                          ...chainSourceKeysForTrack(routers, trackIdx),
                        ]}
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
                        onBranch={() => {
                          onBranchRoute(trackIdx, node.id);
                          setSelectedTrack(trackIdx + 1);
                        }}
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
                              <div className="node-selector-dropdown">
                                {PROCESSOR_OPTIONS.map((option) => (
                                  <button
                                    key={option.type}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAddNode(
                                        option.type,
                                        trackIdx,
                                        i + 1,
                                      );
                                    }}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                                <div className="divider" />
                                <button
                                  className="cancel"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectorPos(null);
                                  }}
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
              );
            })}
        </div>
      </div>
    );
  },
);

// Wyodrębniamy Monitor VU do osobnego, memoizowanego komponentu,
// aby zmiany wartości nie wymuszały przerysowania całej karty (przycisków, selectów)
const VUMonitor = React.memo(
  ({
    inputVal,
    outputVal,
    isPro,
    type,
  }: {
    inputVal: number;
    outputVal: number;
    isPro: boolean;
    type: string;
  }) => {
    let barWidth = type === 'source' ? outputVal * 100 : inputVal * 100;
    if (isPro) barWidth = outputVal; // Pro scale 1-100

    return (
      <div className="node-monitor">
        <div className="pipeline-vu">
          <div className="vu-bar">
            <div
              className="vu-level"
              style={{
                width: `${Math.max(0, Math.min(100, barWidth))}%`,
                transition: 'none',
              }}
            />
          </div>
          <div className="vu-values">
            <span>{inputVal.toFixed(2)}</span>
            {type !== 'target' && (
              <b style={{ color: '#60a5fa' }}>
                → {isPro ? Math.round(outputVal) : outputVal.toFixed(2)}
              </b>
            )}
          </div>
        </div>
      </div>
    );
  },
);

const PipelineNodeCard = React.memo<{
  node: INode;
  sourceKeys: string[];
  targetKeys: string[];
  onRemove: () => void;
  onMove: (dir: number) => void;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: () => void;
  onBranch: () => void;
}>(
  ({
    node,
    sourceKeys,
    targetKeys,
    onRemove,
    onMove,
    isFirst,
    isLast,
    onUpdate,
    onBranch,
  }) => {
    const inputVal = Object.values(node.inputs)[0]?.value ?? 0;
    const outputVal = Object.values(node.outputs)[0]?.value ?? inputVal;
    const isPro = node.name.includes('PRO') || node.id.includes('pro');
    const isEnabled = (node as any).enabled !== false;

    const isAnchor = node.id.startsWith('anchor');

    return (
      <div
        className={`pipeline-card type-${node.type} ${isAnchor ? 'is-anchor' : ''} ${!isEnabled ? 'is-bypassed' : ''}`}
        style={{
          position: 'relative',
          opacity: isEnabled ? 1 : 0.7,
          transition: 'opacity 0.2s',
        }}
      >
        {!isAnchor && (
          <button
            className={`node-active-toggle ${isEnabled ? 'is-on' : 'is-off'}`}
            onClick={() => {
              (node as any).enabled = !isEnabled;
              onUpdate();
            }}
            title={
              isEnabled
                ? 'Node Active - Click to bypass'
                : 'Node Bypassed - Click to enable'
            }
          />
        )}
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
                  {node.type !== 'target' && (
                    <button
                      onClick={onBranch}
                      title="Branch output to a new path"
                      style={{ padding: '0 5px', minHeight: '18px' }}
                    >
                      ⎇
                    </button>
                  )}
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
                  {k.startsWith('path') ? formatChainSourceLabel(k) : k}
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

        <VUMonitor
          inputVal={inputVal}
          outputVal={outputVal}
          isPro={isPro}
          type={node.type}
        />

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

        {node instanceof OffsetNode && (
          <div className="node-settings">
            <input
              type="number"
              className="compact-input"
              step="0.0001"
              value={node.offset}
              onChange={(e) => {
                node.offset = parseFloat(e.target.value) || 0;
                onUpdate();
              }}
              style={{ width: '100%', fontSize: '9px', marginBottom: '4px' }}
            />
            <input
              type="range"
              min="-10"
              max="10"
              step="0.0001"
              value={Math.max(-10, Math.min(10, node.offset))}
              onChange={(e) => {
                node.offset = parseFloat(e.target.value);
                onUpdate();
              }}
            />
            <span className="setting-label" style={{ fontSize: '9px' }}>
              Zero at: {node.offset.toFixed(4)}
            </span>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '9px',
                marginTop: '6px',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={node.returnOnSilence}
                onChange={(e) => {
                  node.returnOnSilence = e.target.checked;
                  onUpdate();
                }}
              />
              Return to zero on silence
            </label>
            {node.returnOnSilence && (
              <div style={{ display: 'flex', flexDirection: 'column', marginTop: '4px' }}>
                <span style={{ fontSize: '8px', opacity: 0.7 }}>
                  Return speed: {node.returnSpeed.toFixed(3)}
                </span>
                <input
                  type="range"
                  min="0.005"
                  max="0.25"
                  step="0.001"
                  value={node.returnSpeed}
                  onChange={(e) => {
                    node.returnSpeed = parseFloat(e.target.value);
                    onUpdate();
                  }}
                />
              </div>
            )}
          </div>
        )}

        {node instanceof BounceNode && (
          <div
            className="node-settings"
            style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
          >
            <span
              style={{
                fontSize: '8px',
                color: '#39d2c0',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Detection
            </span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '8px', opacity: 0.7 }}>
                Attack sens: {node.attackSensitivity.toFixed(3)}
              </span>
              <input
                type="range"
                min="0.005"
                max="0.15"
                step="0.001"
                value={node.attackSensitivity}
                onChange={(e) => {
                  node.attackSensitivity = parseFloat(e.target.value);
                  onUpdate();
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '8px', opacity: 0.7 }}>
                Decay sens: {node.decaySensitivity.toFixed(3)}
              </span>
              <input
                type="range"
                min="0.005"
                max="0.15"
                step="0.001"
                value={node.decaySensitivity}
                onChange={(e) => {
                  node.decaySensitivity = parseFloat(e.target.value);
                  onUpdate();
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '8px', opacity: 0.7 }}>
                Min amplitude: {node.minAmplitude.toFixed(2)}
              </span>
              <input
                type="range"
                min="0.02"
                max="0.8"
                step="0.01"
                value={node.minAmplitude}
                onChange={(e) => {
                  node.minAmplitude = parseFloat(e.target.value);
                  onUpdate();
                }}
              />
            </div>

            <span
              style={{
                fontSize: '8px',
                color: '#39d2c0',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginTop: '2px',
              }}
            >
              Bounce
            </span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '8px', opacity: 0.7 }}>
                Depth: {node.bounceDepth.toFixed(2)}
              </span>
              <input
                type="range"
                min="0.05"
                max="1"
                step="0.01"
                value={node.bounceDepth}
                onChange={(e) => {
                  node.bounceDepth = parseFloat(e.target.value);
                  onUpdate();
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '8px', opacity: 0.7 }}>
                Speed: {node.bounceSpeed.toFixed(2)}
              </span>
              <input
                type="range"
                min="0.02"
                max="0.35"
                step="0.01"
                value={node.bounceSpeed}
                onChange={(e) => {
                  node.bounceSpeed = parseFloat(e.target.value);
                  onUpdate();
                }}
              />
            </div>
            <select
              className="compact-select"
              value={node.bounceCurve}
              onChange={(e) => {
                node.bounceCurve = e.target.value as 'linear' | 'exponential';
                onUpdate();
              }}
            >
              <option value="linear">Curve: Linear</option>
              <option value="exponential">Curve: Exponential</option>
            </select>
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

        {node instanceof WaveTransformNode && (
          <div className="node-settings">
            <select
              className="compact-select"
              value={node.mode}
              onChange={(e) => {
                node.mode = e.target.value as 'sine' | 'cosine';
                onUpdate();
              }}
              style={{ marginBottom: '4px' }}
            >
              <option value="sine">Sine</option>
              <option value="cosine">Cosine</option>
            </select>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '8px', opacity: 0.7 }}>
                Density: {node.density.toFixed(2)}
              </span>
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
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '8px', opacity: 0.7 }}>
                Phase: {node.phase.toFixed(2)}
              </span>
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
  },
);
