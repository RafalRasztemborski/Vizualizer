import React, { useEffect, useRef, useState } from 'react';
import type { AudioEngine, AudioSourceKind } from '../audio/AudioEngine';
import type { MidiManager } from '../midi/MidiManager';

type Props = {
  audioEngine: AudioEngine;
  midiManager: MidiManager;
  onSourceChange: () => void;
};

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function InputPanel({ audioEngine, midiManager, onSourceChange }: Props) {
  const [sourceKind, setSourceKind] = useState<AudioSourceKind>(audioEngine.sourceKind);
  const [isPlaying, setIsPlaying] = useState(!audioEngine.element.paused && !audioEngine.isSpecialPause);
  const [isSpecialPause, setIsSpecialPause] = useState(audioEngine.isSpecialPause);
  const [loopLength, setLoopLength] = useState(audioEngine.specialPauseLength);

  const sliderRef = useRef<HTMLInputElement | null>(null);
  const timeTextRef = useRef<HTMLSpanElement | null>(null);
  const isDraggingRef = useRef(false);

  // Sync state with audioEngine when props change or source updates
  useEffect(() => {
    setSourceKind(audioEngine.sourceKind);
    setIsPlaying(!audioEngine.element.paused && !audioEngine.isSpecialPause);
    setIsSpecialPause(audioEngine.isSpecialPause);
    setLoopLength(audioEngine.specialPauseLength);
  }, [audioEngine.sourceKind, audioEngine.isSpecialPause, audioEngine.specialPauseLength]);

  // Audio element event listeners
  useEffect(() => {
    const element = audioEngine.element;
    const handlePlay = () => {
      setIsPlaying(true);
      setIsSpecialPause(audioEngine.isSpecialPause);
    };
    const handlePause = () => {
      setIsPlaying(false);
      setIsSpecialPause(audioEngine.isSpecialPause);
    };

    element.addEventListener('play', handlePlay);
    element.addEventListener('pause', handlePause);

    return () => {
      element.removeEventListener('play', handlePlay);
      element.removeEventListener('pause', handlePause);
    };
  }, [audioEngine]);

  // Smooth animation frame loop for progress bar
  useEffect(() => {
    let animationFrameId: number;

    const updateLoop = () => {
      if (sourceKind === 'file' && sliderRef.current && !isDraggingRef.current) {
        const cur = audioEngine.element.currentTime;
        const dur = Number.isFinite(audioEngine.element.duration) ? audioEngine.element.duration : 0;

        sliderRef.current.max = String(dur || 1);
        sliderRef.current.value = String(cur);

        const percent = dur > 0 ? (cur / dur) * 100 : 0;
        sliderRef.current.style.setProperty('--progress', `${percent}%`);

        if (timeTextRef.current) {
          timeTextRef.current.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
        }
      }
      animationFrameId = requestAnimationFrame(updateLoop);
    };

    animationFrameId = requestAnimationFrame(updateLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [sourceKind, audioEngine]);

  const handleMic = async () => {
    try {
      await audioEngine.useMicrophone();
      setSourceKind('mic');
      setIsSpecialPause(false);
      onSourceChange();
    } catch (err) {
      console.error('Failed to activate Mic:', err);
    }
  };

  const handleMidi = async () => {
    try {
      await midiManager.connect();
      onSourceChange();
    } catch (err) {
      console.error('Failed to activate MIDI:', err);
    }
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        await audioEngine.useFile(file);
        setSourceKind('file');
        setIsPlaying(false);
        setIsSpecialPause(false);
        onSourceChange();
      } catch (err) {
        console.error('Failed to load MP3:', err);
      }
    }
  };

  const togglePlay = () => {
    if (audioEngine.isSpecialPause) {
      audioEngine.stopSpecialPause(true);
      setIsSpecialPause(false);
      setIsPlaying(true);
    } else {
      if (audioEngine.element.paused) {
        void audioEngine.element.play();
        setIsPlaying(true);
      } else {
        audioEngine.element.pause();
        setIsPlaying(false);
      }
    }
  };

  const toggleSpecialPause = () => {
    if (audioEngine.isSpecialPause) {
      audioEngine.stopSpecialPause(true);
      setIsSpecialPause(false);
      setIsPlaying(true);
    } else {
      audioEngine.startSpecialPause(loopLength);
      setIsSpecialPause(true);
      setIsPlaying(false);
    }
  };

  const handleLoopLengthChange = (value: number) => {
    setLoopLength(value);
    audioEngine.updateSpecialPauseLength(value);
  };

  return (
    <section className="inputOverlay" aria-label="Input control panel">
      <header className="inputPanelHeader">
        <span className="glow-dot" />
        <h2>INPUT SOURCE</h2>
      </header>

      <div className="inputSourceGrid">
        <button
          type="button"
          className={`inputSourceBtn ${sourceKind === 'mic' ? 'active' : ''}`}
          onClick={handleMic}
        >
          <span className="icon">🎤</span>
          <span>Mic</span>
        </button>

        <button
          type="button"
          className="inputSourceBtn"
          onClick={handleMidi}
        >
          <span className="icon">🎹</span>
          <span>MIDI</span>
        </button>

        <label className={`inputSourceBtn fileBtnLabel ${sourceKind === 'file' ? 'active' : ''}`}>
          <span className="icon">🎵</span>
          <span>MP3</span>
          <input
            type="file"
            accept="audio/*"
            onChange={handleFile}
          />
        </label>
      </div>

      {sourceKind === 'file' && (
        <div className="playerSection">
          <div className="playerControls">
            <button
              type="button"
              className={`playBtn ${isPlaying ? 'playing' : ''}`}
              onClick={togglePlay}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? '⏸' : '▶'}
            </button>

            <button
              type="button"
              className={`specialPauseBtn ${isSpecialPause ? 'active' : ''}`}
              onClick={toggleSpecialPause}
              title="Special Pause"
            >
              ⚡ Special Pause
            </button>
          </div>

          <div className="timelineContainer">
            <span ref={timeTextRef} className="timeDisplay">0:00 / 0:00</span>
            <input
              ref={sliderRef}
              type="range"
              min="0"
              max="1"
              step="0.01"
              defaultValue="0"
              className="modernSlider"
              onMouseDown={() => {
                isDraggingRef.current = true;
              }}
              onTouchStart={() => {
                isDraggingRef.current = true;
              }}
              onInput={(e) => {
                if (timeTextRef.current) {
                  const val = Number((e.target as HTMLInputElement).value);
                  const dur = Number.isFinite(audioEngine.element.duration) ? audioEngine.element.duration : 0;
                  timeTextRef.current.textContent = `${formatTime(val)} / ${formatTime(dur)}`;
                  const percent = dur > 0 ? (val / dur) * 100 : 0;
                  (e.target as HTMLInputElement).style.setProperty('--progress', `${percent}%`);
                }
              }}
              onChange={(e) => {
                isDraggingRef.current = false;
                const seekVal = Number(e.target.value);
                audioEngine.seek(seekVal);
              }}
            />
          </div>

          {isSpecialPause && (
            <div className="loopLengthSection">
              <label className="loopLabel">
                <span>Loop Duration:</span>
                <strong>{loopLength.toFixed(2)}s</strong>
              </label>
              <input
                type="range"
                min="0.05"
                max="5.0"
                step="0.05"
                value={loopLength}
                className="modernSlider loopSlider"
                onChange={(e) => handleLoopLengthChange(Number(e.target.value))}
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
