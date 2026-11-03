import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_CONFIG, getClips, getConfig, type Clip, type Config } from './api'

/** Lista klipów + konfiguracja; odpytuje serwer, dopóki coś się kompresuje. */
export function useClips() {
  const [clips, setClips] = useState<Clip[]>([])
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG)
  const [loadError, setLoadError] = useState('')

  const refresh = useCallback(async () => {
    try {
      setClips(await getClips())
      setLoadError('')
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Nie udało się pobrać klipów.')
    }
  }, [])

  useEffect(() => {
    getConfig().then(setConfig).catch(() => {})
    void refresh()
  }, [refresh])

  const processing = clips.some((c) => c.status === 'processing')
  useEffect(() => {
    if (!processing) return
    const timer = setInterval(() => void refresh(), 4000)
    return () => clearInterval(timer)
  }, [processing, refresh])

  return { clips, config, loadError, refresh }
}
