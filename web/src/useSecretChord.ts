import { useEffect, useRef, useState } from 'react'

/** Fizyczne klawisze Z D R K I (e.code — działa niezależnie od Shift/Caps Lock). */
const CHORD = ['KeyZ', 'KeyD', 'KeyR', 'KeyK', 'KeyI']
export const HOLD_MS = 3000

/**
 * Przytrzymanie wszystkich klawiszy CHORD naraz przez HOLD_MS wywołuje `onTrigger`.
 * Zwraca `true`, dopóki trwa przytrzymanie (do pokazania paska postępu).
 * Po wyzwoleniu trzeba puścić wszystkie klawisze, zanim kombinacja zadziała ponownie —
 * inaczej auto-powtarzanie klawiatury przełączałoby tryb co 3 s.
 */
export function useSecretChord(onTrigger: () => void): boolean {
  const [holding, setHolding] = useState(false)
  const triggerRef = useRef(onTrigger)

  useEffect(() => {
    triggerRef.current = onTrigger
  })

  useEffect(() => {
    const pressed = new Set<string>()
    let timer: number | undefined
    let armed = true

    const cancel = () => {
      if (timer === undefined) return
      clearTimeout(timer)
      timer = undefined
      setHolding(false)
    }
    const reset = () => {
      pressed.clear()
      armed = true
      cancel()
    }

    function onDown(e: KeyboardEvent) {
      // Cmd/Ctrl/Alt: macOS gubi keyup innych klawiszy przy wciśniętym Cmd → zaczynamy od zera
      if (e.metaKey || e.ctrlKey || e.altKey) {
        reset()
        return
      }
      if (!CHORD.includes(e.code)) return
      pressed.add(e.code)
      if (armed && timer === undefined && CHORD.every((key) => pressed.has(key))) {
        setHolding(true)
        timer = window.setTimeout(() => {
          timer = undefined
          armed = false
          setHolding(false)
          triggerRef.current()
        }, HOLD_MS)
      }
    }

    function onUp(e: KeyboardEvent) {
      if (e.key === 'Meta' || e.key === 'Control' || e.key === 'Alt') {
        reset()
        return
      }
      if (!CHORD.includes(e.code)) return
      pressed.delete(e.code)
      cancel()
      if (pressed.size === 0) armed = true
    }

    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', reset) // np. Cmd+Tab — keyup nigdy nie przyjdzie
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', reset)
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [])

  return holding
}
