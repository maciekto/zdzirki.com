import type { Clip } from '../api'
import { formatMB, formatSeconds } from '../format'

export function ClipCard({ clip, onDelete }: { clip: Clip; onDelete: () => void }) {
  const meta = [`by ${clip.author || 'ekipa'}`, new Date(clip.created).toLocaleDateString('pl-PL')]
  if (clip.duration) meta.push(formatSeconds(clip.duration))
  if (clip.status === 'ready' && clip.size && clip.original_size) {
    meta.push(`${formatMB(clip.original_size)} → ${formatMB(clip.size)}`)
  }

  return (
    <article className={`clip clip-${clip.status}`}>
      <div className="clip-media">
        {clip.status === 'ready' && clip.video ? (
          <video src={clip.video} poster={clip.poster ?? undefined} controls preload="none" playsInline />
        ) : clip.status === 'processing' ? (
          <div className="clip-wait">
            <span className="blink">⏳ KOMPRESUJĘ...</span>
            <small>serwer mieli piksele, chwilka</small>
          </div>
        ) : (
          <div className="clip-wait clip-err">💥 {clip.error || 'Coś poszło nie tak.'}</div>
        )}
      </div>
      <h3 className="clip-title">{clip.title}</h3>
      <p className="clip-meta">{meta.join(' · ')}</p>
      <button type="button" className="clip-del" title="Usuń klip" aria-label={`Usuń klip ${clip.title}`} onClick={onDelete}>
        🗑
      </button>
    </article>
  )
}
