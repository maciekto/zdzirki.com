import { useEffect, useRef, useState } from 'react'

const SPARKS = ['✨', '⭐', '💖', '🌟', '✦', '❄']

/** Iskrzący kursor. */
export function Sparkles() {
  useEffect(() => {
    let last = 0
    function onMove(e: MouseEvent) {
      const now = Date.now()
      if (now - last < 45) return
      last = now
      const spark = document.createElement('div')
      spark.className = 'spark'
      spark.textContent = SPARKS[Math.floor(Math.random() * SPARKS.length)]
      spark.style.left = `${e.clientX}px`
      spark.style.top = `${e.clientY}px`
      document.body.appendChild(spark)
      setTimeout(() => spark.remove(), 800)
    }
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [])
  return null
}

/** Odbijająca się gwiazdka (DVD bounce). */
export function DvdStar() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let x = 40
    let y = 90
    let vx = 2.4
    let vy = 2.0
    let frame = 0
    const step = () => {
      const el = ref.current
      if (el) {
        const w = window.innerWidth - el.offsetWidth
        const h = window.innerHeight - el.offsetHeight
        x += vx
        y += vy
        if (x <= 0 || x >= w) { vx = -vx; x = Math.max(0, Math.min(x, w)) }
        if (y <= 0 || y >= h) { vy = -vy; y = Math.max(0, Math.min(y, h)) }
        el.style.transform = `translate(${x}px, ${y}px)`
      }
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [])
  return <div className="dvd" ref={ref} aria-hidden="true">🌟</div>
}

/** Retro licznik odwiedzin, nabija do 001337. */
export function VisitorCounter() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    let value = 0
    const timer = setInterval(() => {
      value = Math.min(1337, value + Math.floor(Math.random() * 7) + 1)
      setCount(value)
      if (value >= 1337) clearInterval(timer)
    }, 40)
    return () => clearInterval(timer)
  }, [])
  return <span className="counter">{String(count).padStart(6, '0')}</span>
}

/** Żart z 2003: blokada prawego kliku (poza polami formularza i wideo). */
export function useNoRightClick() {
  useEffect(() => {
    function onContext(e: MouseEvent) {
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, select, video')) return
      e.preventDefault()
    }
    document.addEventListener('contextmenu', onContext)
    return () => document.removeEventListener('contextmenu', onContext)
  }, [])
}
