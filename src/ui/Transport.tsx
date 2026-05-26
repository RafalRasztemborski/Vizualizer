import type { AudioSourceKind } from '../audio/AudioEngine';

type Props = {
  sourceKind: AudioSourceKind;
  audioElement: HTMLAudioElement;
  onMic: () => void;
  onMidi: () => void;
  onFile: (file: File) => void;
};

export function Transport({ sourceKind, audioElement, onMic, onMidi, onFile }: Props) {
  const duration = Number.isFinite(audioElement.duration) ? audioElement.duration : 0;

  return (
    <section className="panel">
      <h2>Input</h2>
      <div className="buttonRow">
        <button type="button" onClick={onMic}>Mic</button>
        <button type="button" onClick={onMidi}>MIDI</button>
        <label className="fileButton">
          MP3
          <input
            type="file"
            accept="audio/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onFile(file);
            }}
          />
        </label>
      </div>
      {sourceKind === 'file' && (
        <div className="transport">
          <button type="button" onClick={() => void audioElement.play()}>Play</button>
          <button type="button" onClick={() => audioElement.pause()}>Pause</button>
          <input
            type="range"
            min="0"
            max={duration || 1}
            step="0.01"
            defaultValue="0"
            onChange={(event) => {
              audioElement.currentTime = Number(event.target.value);
            }}
          />
        </div>
      )}
    </section>
  );
}
