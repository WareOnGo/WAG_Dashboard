import { useRef, useState } from 'react';
import { warehouseService } from '../services/warehouseService';
import './VoiceNotesList.css';

const duration = ms => {
  const seconds = Math.floor((ms || 0) / 1000);
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
};
function NotePlayer({ note, index, recordId, onRemove, disabled }) {
  const player = useRef(null);
  const position = useRef(0);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [playRequested, setPlayRequested] = useState(false);
  const load = async () => {
    if (loading) return;
    position.current = player.current?.currentTime || 0;
    setLoading(true);
    setError('');
    try {
      const result = await warehouseService.getVoiceNotePlayback(recordId, note.id);
      setPlayRequested(true);
      setUrl(result.url);
    } catch (failure) { setError(failure?.response?.data?.message || failure.message || 'Could not load the recording. Please retry.'); }
    finally { setLoading(false); }
  };
  return (
    <article className="saved-voice-note" aria-label={'Voice note ' + (index + 1)}>
      <div className="saved-voice-note__heading"><strong>Voice note {index + 1}</strong><span>{duration(note.durationMs)}</span></div>
      {url ? <audio controls ref={player} src={url} preload="metadata" aria-label={'Play voice note ' + (index + 1)}
        onLoadedMetadata={() => {
          if (Number.isFinite(player.current?.duration)) player.current.currentTime = Math.min(position.current, player.current.duration);
          if (playRequested) { setPlayRequested(false); player.current?.play()?.catch(() => {}); }
        }}
        onPlay={event => document.querySelectorAll('audio').forEach(other => { if (other !== event.target) other.pause(); })}
        onError={() => setError('Audio could not load or its link expired. Reload to continue.')} /> :
        <button type="button" onClick={load} disabled={loading} className="saved-voice-note__listen">{loading ? 'Loading recording…' : 'Listen to recording'}</button>}
      {error && <div className="saved-voice-note__error" role="alert">{error}
        <button type="button" onClick={load} disabled={loading}>Reload audio</button>
      </div>}
      {onRemove && <button type="button" className="saved-voice-note__remove" onClick={onRemove} disabled={disabled}
        aria-label={'Delete voice note ' + (index + 1)}>Delete</button>}
    </article>
  );
}
export default function VoiceNotesList({ notes = [], recordId, onChange, disabled = false }) {
  const [removed, setRemoved] = useState(null);
  if (!notes?.length && !removed) return null;
  return (
    <div className="saved-voice-notes" aria-label="Scout voice notes">
      {notes.map((note, index) => <NotePlayer key={String(recordId) + ':' + note.id} note={note} index={index} recordId={recordId}
        disabled={disabled} onRemove={onChange ? () => {
          setRemoved({ note, index });
          onChange(notes.filter(item => item.id !== note.id));
        } : null} />)}
      {removed && onChange && <div className="saved-voice-note__undo" role="status">Voice note removed from this edit.
        <button type="button" disabled={disabled} onClick={() => {
          const next = [...notes]; next.splice(removed.index, 0, removed.note);
          onChange(next); setRemoved(null);
        }}>Undo</button>
      </div>}
    </div>
  );
}
