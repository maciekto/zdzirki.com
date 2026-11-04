import { useEffect, useRef, useState } from 'react'

/** Litery do przytrzymania naraz. */
const LETTERS = ['z', 'd', 'r', 'k', 'i']
/** Zapasowo fizyczne pozycje (US QWERTY), gdy e.key nie daje litery. */
const CODE_LETTER: Record<string, string> = { KeyZ: 'z', KeyD: 'd', KeyR: 'r', KeyK: 'k', KeyI: 'i' }
export const HOLD_MS = 3000

/**
 * Litera klawisza: najpierw to, co klawisz wpisuje (e.key — działa też na QWERTZ, gdzie
 * „Z” leży na pozycji KeyY), potem fizyczna pozycja (e.code — gdy e.key to np. „Dead”).
 */
function letterOf(e: KeyboardEvent): string | null {
  const char = e.key.length === 1 ? e.key.toLowerCase() : ''
  if (LETTERS.includes(char)) return char
  return CODE_LETTER[e.code] ?? null
}

/**
 * Przytrzymanie wszystkich liter LETTERS naraz przez HOLD_MS wywołuje `onTrigger`.
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
    // fizyczny klawisz (e.code) -> litera; keyup kasujemy po e.code, bo e.key może się zmienić
    const pressed = new Map<string, string>()
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
      const letter = letterOf(e)
      if (!letter) return
      pressed.set(e.code, letter)
      const held = new Set(pressed.values())
      if (armed && timer === undefined && LETTERS.every((l) => held.has(l))) {
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
      if (!pressed.has(e.code)) return
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
