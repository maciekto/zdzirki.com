export type Category = 'fame' | 'shame'

export type Clip = {
  id: string
  category: Category
  title: string
  author: string
  created: string
  status: 'processing' | 'ready' | 'error'
  error?: string
  video?: string
  poster?: string | null
  size?: number
  original_size?: number
  duration?: number
}

export type Config = { max_upload_mb: number; max_duration_s: number; upload_enabled: boolean }

export const DEFAULT_CONFIG: Config = { max_upload_mb: 100, max_duration_s: 30, upload_enabled: true }

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

// Nagłówki HTTP to latin-1 — polskie znaki w haśle kodujemy, serwer robi unquote().
const encodePassword = (pw: string) => encodeURIComponent(pw)

function errorMessage(data: unknown, status: number): string {
  if (data && typeof data === 'object' && 'detail' in data) {
    const detail = (data as { detail: unknown }).detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) return 'Niepoprawne dane w formularzu.'
    if (detail && typeof detail === 'object' && 'message' in detail) {
      return String((detail as { message: unknown }).message)
    }
  }
  if (status === 0) return 'Problem z siecią.'
  if (status === 413) return 'Plik za duży.'
  return `Błąd serwera (${status}).`
}

async function request<T>(method: string, url: string, body?: unknown, pw?: string): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (pw) headers['X-Upload-Password'] = encodePassword(pw)
  let res: Response
  try {
    res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError('Problem z siecią.', 0)
  }
  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    // nie-JSON (np. strona błędu Cloudflare)
  }
  if (!res.ok) throw new ApiError(errorMessage(data, res.status), res.status)
  return data as T
}

export const getConfig = () => request<Config>('GET', '/api/config')
export const getClips = () => request<Clip[]>('GET', '/api/clips')
export const deleteClip = (id: string, pw: string) => request<{ ok: true }>('DELETE', `/api/clips/${id}`, undefined, pw)

function putChunk(id: string, offset: number, blob: Blob, pw: string, onProgress: (loaded: number) => void) {
  // XHR zamiast fetch, bo fetch nie raportuje postępu wysyłania
  return new Promise<{ received: number }>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', `/api/uploads/${id}/chunk?offset=${offset}`)
    xhr.setRequestHeader('X-Upload-Password', encodePassword(pw))
    xhr.setRequestHeader('Content-Type', 'application/octet-stream')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded)
    }
    xhr.onload = () => {
      let data: unknown = null
      try {
        data = JSON.parse(xhr.responseText)
      } catch {
        // ignorujemy
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as { received: number })
      else reject(new ApiError(errorMessage(data, xhr.status), xhr.status))
    }
    xhr.onerror = () => reject(new ApiError('Problem z siecią.', 0))
    xhr.send(blob)
  })
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export type UploadMeta = {
  category: Category
  title: string
  author: string
  trim_start: number
  trim_end: number | null
}

/**
 * Wysyła plik w kawałkach (Cloudflare Free tnie pojedyncze żądanie > 100 MB).
 * Po błędzie sieci dopytuje serwer, ile już dostał, i wznawia od tego miejsca.
 */
export async function uploadClip(
  file: File,
  meta: UploadMeta,
  pw: string,
  onProgress: (done: number, total: number) => void,
): Promise<Clip> {
  const init = await request<{ upload_id: string; chunk_size: number }>(
    'POST', '/api/uploads', { ...meta, size: file.size }, pw,
  )
  let offset = 0
  let failures = 0
  while (offset < file.size) {
    const start = offset
    const end = Math.min(start + init.chunk_size, file.size)
    try {
      const res = await putChunk(init.upload_id, start, file.slice(start, end), pw, (loaded) =>
        onProgress(start + loaded, file.size),
      )
      offset = res.received
      failures = 0
      onProgress(offset, file.size)
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0
      if ([400, 401, 404, 413, 503].includes(status) || ++failures > 5) throw err
      await sleep(1500 * failures)
      const state = await request<{ received: number }>('GET', `/api/uploads/${init.upload_id}`, undefined, pw)
      offset = state.received
    }
  }
  return request<Clip>('POST', `/api/uploads/${init.upload_id}/finish`, undefined, pw)
}

const PASSWORD_KEY = 'zdzirki_pw'

export function loadPassword(): string {
  try {
    return localStorage.getItem(PASSWORD_KEY) ?? ''
  } catch {
    return ''
  }
}

export function savePassword(pw: string | null): void {
  try {
    if (pw) localStorage.setItem(PASSWORD_KEY, pw)
    else localStorage.removeItem(PASSWORD_KEY)
  } catch {
    // brak dostępu do storage (tryb prywatny) — trudno
  }
}
