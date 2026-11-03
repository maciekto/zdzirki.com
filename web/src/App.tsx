import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Category } from './api'
import { Crew } from './components/Crew'
import { DvdStar, Sparkles, useNoRightClick, VisitorCounter } from './components/Effects'
import { EnterOverlay } from './components/EnterOverlay'
import { Hall } from './components/Hall'
import { MusicBox } from './components/MusicBox'
import { useClips } from './useClips'

type View = 'crew' | Category
const VIEWS: View[] = ['crew', 'fame', 'shame']

function viewFromHash(): View {
  const hash = window.location.hash.slice(1)
  return (VIEWS as string[]).includes(hash) ? (hash as View) : 'crew'
}

export default function App() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [entered, setEntered] = useState(false)
  const [view, setView] = useState<View>(viewFromHash)
  const { clips, config, loadError, refresh } = useClips()
  useNoRightClick()

  useEffect(() => {
    const onHash = () => setView(viewFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // gdy leci klip, muzyka w tle cichnie
  useEffect(() => {
    const onPlay = (e: Event) => {
      if (e.target instanceof HTMLVideoElement) audioRef.current?.pause()
    }
    document.addEventListener('play', onPlay, true)
    return () => document.removeEventListener('play', onPlay, true)
  }, [])

  function go(next: View) {
    setView(next)
    const url = next === 'crew' ? window.location.pathname + window.location.search : `#${next}`
    window.history.replaceState(null, '', url)
  }

  function enter() {
    audioRef.current?.play().catch(() => {})
    setEntered(true)
  }

  const fame = clips.filter((c) => c.category === 'fame')
  const shame = clips.filter((c) => c.category === 'shame')
  // „HALL OF ” chowa się na telefonie (.tab-long), żeby zakładki zmieściły się w jednej linii
  const tabs: { id: View; label: ReactNode; count?: number }[] = [
    { id: 'crew', label: '★ EKIPA ★' },
    { id: 'fame', label: <>🏆 <span className="tab-long">HALL OF </span>FAME</>, count: fame.length },
    { id: 'shame', label: <>💩 <span className="tab-long">HALL OF </span>SHAME</>, count: shame.length },
  ]

  return (
    <>
      {!entered && <EnterOverlay onEnter={enter} />}

      <div className="marquee">
        <span>
          ✩ ✪ ✩ WELCOME TO ZDZIRKI.COM ✩ ✪ ✩ &nbsp;&nbsp; NAJLEPSZA STRONA W CAŁYM INTERNECIE &nbsp;&nbsp;
          ★ WITAMY THEDUDDIN W EKIPIE ★ &nbsp;&nbsp; ✰ SIGN MY GUESTBOOK ✰ &nbsp;&nbsp; ★彡 enjoy ur stay 彡★
        </span>
      </div>

      <h1 className="wordart">ZDZIRKI.COM</h1>
      <div className="subtitle">
        <span className="blink">★</span> best viewed in Netscape Navigator 4.0 @ 800x600 <span className="blink">★</span>
      </div>

      <audio ref={audioRef} src="/zdzirki.mp3" loop preload="auto" />
      <MusicBox audioRef={audioRef} />

      <nav className="tabs" role="tablist" aria-label="Sekcje strony">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            className={`tab ${tab.id}`}
            aria-selected={view === tab.id}
            onClick={() => go(tab.id)}
          >
            {tab.label}
            {tab.count !== undefined && <span className="count"> ({tab.count})</span>}
          </button>
        ))}
      </nav>

      <main className="stage">
        <Crew active={view === 'crew'} />
        <Hall category="fame" active={view === 'fame'} clips={fame} config={config} loadError={loadError} onChanged={refresh} />
        <Hall category="shame" active={view === 'shame'} clips={shame} config={config} loadError={loadError} onChanged={refresh} />
      </main>

      <footer className="footer">
        <div>You are visitor # <VisitorCounter /></div>
        <div>
          <span className="badge">Made with Notepad</span>
          <span className="badge">HTML 4.01</span>
          <span className="badge">© 2003 ZDZIRKI INC.</span>
          <span className="badge">No© Right Click</span>
        </div>
        <div className="blink">·:*¨༺ thanx 4 visiting ༻¨*:·</div>
      </footer>

      <DvdStar />
      <Sparkles />
    </>
  )
}
