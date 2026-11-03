import { useEffect, useState, type RefObject } from 'react'

export function MusicBox({ audioRef }: { audioRef: RefObject<HTMLAudioElement | null> }) {
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = 0.6
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    return () => {
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
    }
  }, [audioRef])

  function toggle() {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) audio.play().catch(() => {})
    else audio.pause()
  }

  return (
    <div className="music-box">
      <div className="blink">♫ NOW PLAYING ♫</div>
      <div className="track">zdzirki.mp3</div>
      <button type="button" onClick={toggle}>{playing ? '⏸ PAUSE' : '▶ PLAY'}</button>
    </div>
  )
}
