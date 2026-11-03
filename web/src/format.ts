export function formatMB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toLocaleString('pl-PL', { maximumFractionDigits: 1 })} MB`
}

/** 75.34 → "1:15,3" */
export function formatTime(seconds: number): string {
  const s = Math.max(0, seconds)
  const m = Math.floor(s / 60)
  const rest = (s - m * 60).toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return `${m}:${(s - m * 60) < 10 ? '0' : ''}${rest}`
}

export function formatSeconds(seconds: number): string {
  return `${seconds.toLocaleString('pl-PL', { maximumFractionDigits: 1 })} s`
}
