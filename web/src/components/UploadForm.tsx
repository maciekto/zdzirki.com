import { useCallback, useRef, useState, type FormEvent } from 'react'
import { savePassword, uploadClip, type Category, type Config } from '../api'
import { formatMB } from '../format'
import { MEMBERS } from '../members'
import { TrimEditor, type Trim, type TrimStatus } from './TrimEditor'

type Message = { kind: 'ok' | 'err' | 'info'; text: string }

type Props = {
  category: Category
  config: Config
  hidden: boolean
  password: string
  onPasswordChange: (pw: string) => void
  onUploaded: () => void
}

export function UploadForm({ category, config, hidden, password, onPasswordChange, onUploaded }: Props) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [pickId, setPickId] = useState(0)
  const [remember, setRemember] = useState(true)
  const [trim, setTrim] = useState<Trim | null>(null)
  const [trimStatus, setTrimStatus] = useState<TrimStatus>('loading')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [message, setMessage] = useState<Message | null>(null)

  const maxBytes = config.max_upload_mb * 1024 * 1024

  const onTrimChange = useCallback((next: Trim | null, status: TrimStatus) => {
    setTrim(next)
    setTrimStatus(status)
  }, [])

  function clearFile() {
    setFile(null)
    setTrim(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  function pickFile(picked: File | null) {
    setMessage(null)
    setTrim(null)
    setTrimStatus('loading')
    if (picked && picked.size > maxBytes) {
      clearFile()
      setMessage({
        kind: 'err',
        text: `Plik ma ${formatMB(picked.size)} — limit to ${config.max_upload_mb} MB. Nagraj krótszy albo w niższej jakości.`,
      })
      return
    }
    setFile(picked)
    setPickId((id) => id + 1)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    if (!file) return setMessage({ kind: 'err', text: 'Wybierz plik z klipem.' })
    if (!title.trim()) return setMessage({ kind: 'err', text: 'Daj jakiś tytuł.' })
    if (!password) return setMessage({ kind: 'err', text: 'Podaj hasło ekipy.' })
    if (trimStatus === 'loading') return setMessage({ kind: 'info', text: 'Chwila, wczytuję podgląd klipa...' })
    if (trim && trim.end - trim.start > config.max_duration_s + 0.2) {
      return setMessage({ kind: 'err', text: `Fragment może mieć max ${config.max_duration_s} s.` })
    }

    const wholeClip = !trim || (trim.start <= 0.05 && trim.end >= trim.duration - 0.05)
    setBusy(true)
    setProgress(0)
    setMessage({ kind: 'info', text: 'Wysyłam... nie zamykaj karty.' })
    try {
      await uploadClip(
        file,
        {
          category,
          title: title.trim(),
          author,
          trim_start: wholeClip ? 0 : trim.start,
          trim_end: wholeClip ? null : trim.end,
        },
        password,
        (done, total) => setProgress(total ? done / total : 0),
      )
      savePassword(remember ? password : null)
      setMessage({ kind: 'ok', text: 'Wrzucone! 🎉 Serwer kompresuje do 1080p60 — klip pojawi się na liście za chwilę.' })
      setTitle('')
      clearFile()
      onUploaded()
    } catch (err) {
      setMessage({ kind: 'err', text: `❌ ${err instanceof Error ? err.message : 'Coś poszło nie tak.'}` })
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  const percent = progress === null ? 0 : Math.round(progress * 100)

  return (
    <form className="upload-form" hidden={hidden} onSubmit={submit} noValidate>
      <div className="row2">
        <label className="field">
          Tytuł akcji
          <input
            type="text"
            value={title}
            maxLength={120}
            placeholder={category === 'fame' ? 'np. pentakill na Yasuo' : 'np. flash w ścianę'}
            onChange={(e) => setTitle(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className="field">
          Kto?
          <select value={author} onChange={(e) => setAuthor(e.target.value)} disabled={busy}>
            <option value="">— cała ekipa —</option>
            {MEMBERS.map((m) => (
              <option key={m.name} value={m.name}>{m.name}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="field">
        Klip (max {config.max_upload_mb} MB · max {config.max_duration_s} s — dłuższy przytniesz niżej)
        <input
          ref={fileInput}
          type="file"
          accept="video/*"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          disabled={busy}
        />
      </label>

      {file && <TrimEditor key={pickId} file={file} maxLen={config.max_duration_s} onChange={onTrimChange} />}

      <div className="row2">
        <label className="field">
          Hasło ekipy
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => onPasswordChange(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className="remember">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          zapamiętaj hasło na tym komputerze
        </label>
      </div>

      {progress !== null && (
        <div className="progress" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
          <div className="bar" style={{ width: `${percent}%` }} />
          <span className="pct">{percent}%</span>
        </div>
      )}

      <div className="form-actions">
        <button type="submit" className="btn" disabled={busy}>{busy ? 'WYSYŁAM...' : 'WYŚLIJ ⇪'}</button>
        {message && <p className={`form-msg ${message.kind}`} role="status">{message.text}</p>}
      </div>
    </form>
  )
}
