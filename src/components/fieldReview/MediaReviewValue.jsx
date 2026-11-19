import { mediaKinds, mediaFileName } from './media';

export default function MediaReviewValue({ value }) {
  // Older audit entries can contain only a bounded summary of the gallery.
  // They cannot establish that it was empty or recreate the missing files.
  if (!value || !mediaKinds.every(kind => Array.isArray(value[kind]))) return <span>Full media snapshot unavailable.</span>;
  const files = mediaKinds.flatMap(kind => value[kind].map(url => ({ kind, url })));
  if (!files.length) return <span>No media uploaded</span>;
  return <div className="fr-media-preview">{files.map(({ kind, url }) => {
    const name = mediaFileName(url), safe = /^https?:\/\//i.test(url);
    return <div className="fr-media-file" key={kind + url}>
      {safe && kind === 'images' && <a href={url} target="_blank" rel="noopener noreferrer" aria-label={'Open ' + name}><img src={url} alt={name} loading="lazy" /></a>}
      {safe && kind === 'videos' && <video src={url} controls preload="metadata" aria-label={name} />}
      {safe ? <a href={url} target="_blank" rel="noopener noreferrer">{name}</a> : <span>{name} · link unavailable</span>}
    </div>;
  })}</div>;
}
