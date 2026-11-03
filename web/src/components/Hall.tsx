import { useState } from 'react'
import { deleteClip, loadPassword, type Category, type Clip, type Config } from '../api'
import { ClipCard } from './ClipCard'
import { UploadForm } from './UploadForm'

const COPY: Record<Category, { title: string; sub: string; empty: string }> = {
  fame: {
    title: '🏆 HALL OF FAME 🏆',
    sub: 'najlepsze zagrywki ekipy — tu się chwalimy',
    empty: 'Jeszcze nikt się nie popisał... czekamy na pentakilla 👀',
  },
  shame: {
    title: '💩 HALL OF SHAME 💩',
    sub: 'najgorsze akcje, za które do dziś się wstydzimy',
    empty: 'Czysto. Podejrzanie czysto... 🤨',
  },
}

type Props = {
  category: Category
  active: boolean
  /** tryb ekipy: widać wgrywanie i kosze */
  admin: boolean
  clips: Clip[]
  config: Config
  loadError: string
  onChanged: () => void
}

export function Hall({ category, active, admin, clips, config, loadError, onChanged }: Props) {
  const [formOpen, setFormOpen] = useState(false)
  const [password, setPassword] = useState(loadPassword)
  const [notice, setNotice] = useState('')
  const copy = COPY[category]

  async function remove(clip: Clip) {
    if (!password) {
      setNotice('Żeby usuwać, wpisz hasło ekipy w formularzu (+ WRZUĆ KLIPA).')
      setFormOpen(true)
      return
    }
    if (!window.confirm(`Usunąć klip „${clip.title}”?`)) return
    try {
      await deleteClip(clip.id, password)
      setNotice('')
      onChanged()
    } catch (err) {
      setNotice(`❌ ${err instanceof Error ? err.message : 'Nie udało się usunąć.'}`)
    }
  }

  return (
    <section className={`view hall ${category}${active ? ' active' : ''}`} role="tabpanel" aria-label={copy.title}>
      <div className="hall-inner">
        <header className="hall-head">
          <h2 className="hall-title">{copy.title}</h2>
          <p className="hall-sub">{copy.sub}</p>
          {admin &&
            (config.upload_enabled ? (
              <button type="button" className="btn" aria-expanded={formOpen} onClick={() => setFormOpen((open) => !open)}>
                {formOpen ? '✖ ZWIŃ FORMULARZ' : '+ WRZUĆ KLIPA'}
              </button>
            ) : (
              <p className="hall-note">wgrywanie wyłączone (brak hasła na serwerze)</p>
            ))}
        </header>

        {config.upload_enabled && (
          <UploadForm
            category={category}
            config={config}
            hidden={!admin || !formOpen}
            password={password}
            onPasswordChange={setPassword}
            onUploaded={onChanged}
          />
        )}

        {admin && notice && <p className="form-msg err hall-notice">{notice}</p>}
        {loadError && <p className="form-msg err hall-notice">❌ {loadError}</p>}

        {clips.length > 0 ? (
          <div className="clips">
            {clips.map((clip) => (
              <ClipCard key={clip.id} clip={clip} onDelete={admin ? () => void remove(clip) : undefined} />
            ))}
          </div>
        ) : (
          !loadError && <p className="empty">{copy.empty}</p>
        )}
      </div>
    </section>
  )
}
