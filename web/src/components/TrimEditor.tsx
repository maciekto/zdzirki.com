import { useEffect, useRef, useState } from 'react'
import { formatSeconds, formatTime } from '../format'

export type Trim = { start: number; end: number; duration: number }
export type TrimStatus = 'loading' | 'ok' | 'unknown'

const MIN_LEN = 0.5
const round = (v: number) => Math.round(v * 10) / 10

type Props = {
  file: File
  maxLen: number
  onChange: (trim: Trim | null, status: TrimStatus) => void
}

/**
 * Podgląd klipa z wyborem fragmentu (max `maxLen` s). Przeciągnięcie końca poza
 * limit przesuwa początek razem z nim — okno „jedzie” po osi czasu.
 */
export function TrimEditor({ file, maxLen, onChange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const onChangeRef = useRef(onChange)
  const previewEnd = useRef<number | null>(null)
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<TrimStatus>('loading')
  const [duration, setDuration] = useState(0)
  const [range, setRange] = useState<[number, number]>([0, 0])
  const [time, setTime] = useState(0)

  useEffect(() => {
    onChangeRef.current = onChange
  })

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  // przeglądarka nie zna formatu (np. HEVC w .mkv) → zdajemy się na serwer
  useEffect(() => {
    if (status !== 'loading') return
    const timer = setTimeout(() => setStatus('unknown'), 10000)
    return () => clearTimeout(timer)
  }, [status])

  useEffect(() => {
    onChangeRef.current(status === 'ok' ? { start: range[0], end: range[1], duration } : null, status)
  }, [status, range, duration])

  function handleMetadata() {
    const d = videoRef.current?.duration ?? NaN
    if (!Number.isFinite(d) || d <= 0) {
      setStatus('unknown')
      return
    }
    setDuration(d)
    setRange([0, Math.min(d, maxLen)])
    setStatus('ok')
  }

  function seek(t: number) {
    const video = videoRef.current
    if (!video) return
    video.currentTime = t
    setTime(t)
  }

  function changeStart(value: number) {
    const start = Math.min(Math.max(0, value), Math.max(0, duration - MIN_LEN))
    let end = range[1]
    if (end - start > maxLen) end = start + maxLen
    if (end - start < MIN_LEN) end = Math.min(duration, start + MIN_LEN)
    setRange([round(start), round(end)])
    seek(start)
  }

  function changeEnd(value: number) {
    const end = Math.max(Math.min(duration, value), MIN_LEN)
    let start = range[0]
    if (end - start > maxLen) start = end - maxLen
    if (end - start < MIN_LEN) start = Math.max(0, end - MIN_LEN)
    setRange([round(start), round(end)])
    seek(end)
  }

  function preview() {
    const video = videoRef.current
    if (!video) return
    seek(range[0])
    previewEnd.current = range[1]
    video.play().catch(() => {})
  }

  function handleTimeUpdate() {
    const video = videoRef.current
    if (!video) return
    setTime(video.currentTime)
    if (previewEnd.current !== null && video.currentTime >= previewEnd.current) {
      video.pause()
      previewEnd.current = null
    }
  }

  const length = range[1] - range[0]
  const pct = (t: number) => (duration ? (t / duration) * 100 : 0)

  let headline = 'wczytuję podgląd...'
  if (status === 'ok') {
    headline = duration > maxLen
      ? `klip ma ${formatSeconds(duration)} — wybierz max ${maxLen} s`
      : 'możesz przyciąć (opcjonalnie)'
  } else if (status === 'unknown') {
    headline = 'brak podglądu'
  }

  return (
    <div className="trim">
      <div className="trim-head">
        <span>✂ EDYTOR — {headline}</span>
        {status === 'ok' && (
          <span className="trim-len">
            {formatTime(range[0])} → {formatTime(range[1])} · {formatSeconds(round(length))}
          </span>
        )}
      </div>

      <video
        ref={videoRef}
        src={url || undefined}
        controls
        playsInline
        preload="metadata"
        onLoadedMetadata={handleMetadata}
        onError={() => setStatus('unknown')}
        onTimeUpdate={handleTimeUpdate}
      />

      {status === 'ok' && (
        <>
          <div className="trim-track">
            <div className="trim-rail" />
            <div className="trim-window" style={{ left: `${pct(range[0])}%`, width: `${pct(length)}%` }} />
            <div className="trim-playhead" style={{ left: `${pct(time)}%` }} />
            <input
              type="range"
              aria-label="Początek fragmentu"
              min={0}
              max={duration}
              step={0.1}
              value={range[0]}
              onChange={(e) => changeStart(Number(e.target.value))}
            />
            <input
              type="range"
              aria-label="Koniec fragmentu"
              min={0}
              max={duration}
              step={0.1}
              value={range[1]}
              onChange={(e) => changeEnd(Number(e.target.value))}
            />
          </div>
          <div className="trim-actions">
            <button type="button" className="btn small" onClick={preview}>▶ PODGLĄD FRAGMENTU</button>
            <button type="button" className="btn small" onClick={() => changeStart(videoRef.current?.currentTime ?? 0)}>
              ⇤ START = TERAZ
            </button>
            <button type="button" className="btn small" onClick={() => changeEnd(videoRef.current?.currentTime ?? 0)}>
              KONIEC = TERAZ ⇥
            </button>
          </div>
        </>
      )}

      {status === 'unknown' && (
        <p className="form-msg info">
          Przeglądarka nie umie pokazać podglądu tego formatu — serwer sam sprawdzi długość (max {maxLen} s).
        </p>
      )}
    </div>
  )
}
