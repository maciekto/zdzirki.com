export type Member = {
  name: string
  /** Riot ID (Nick#TAG) do linku op.gg — serwer: EUNE */
  riotId: string
  photo: string
  /** kolory placeholdera, gdy zdjęcie się nie wczyta */
  colors: [string, string]
  /** kolor neonowej ramki */
  frame: string
}

/** Kolejność = układ równoległoboku: dwa u góry, dwa przesunięte u dołu. */
export const MEMBERS: Member[] = [
  { name: 'G2 Joshuens', riotId: 'G2 Joshuens#EUNE', photo: '/g2joshuens.jpg', colors: ['#ff00ff', '#00ffff'], frame: '#ffff00' },
  { name: 'ajayoxleywannabe', riotId: 'ajayoxleywannabe#1060', photo: '/ajayoxleywannabe.jpg', colors: ['#00ff66', '#ffcc00'], frame: '#ff00ff' },
  { name: 'makeover', riotId: 'makeover#EUNE', photo: '/makeover.jpg', colors: ['#ff3366', '#33ccff'], frame: '#00ffff' },
  { name: 'theduddin', riotId: 'theduddin#dudd', photo: '/theduddin.jpg', colors: ['#ffcc00', '#9933ff'], frame: '#00ff00' },
]

/** "Nick#TAG" -> https://op.gg/lol/summoners/eune/Nick-TAG */
export function opggUrl(riotId: string): string {
  const [gameName, tag = 'EUNE'] = riotId.split('#')
  return `https://op.gg/lol/summoners/eune/${encodeURIComponent(gameName)}-${encodeURIComponent(tag)}`
}
