/** Kolorowy placeholder 1:1 (inline SVG), gdy zdjęcie gracza się nie wczyta. */
export function placeholder(label: string, c1: string, c2: string): string {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
    `<stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>` +
    '</linearGradient></defs>' +
    '<rect width="400" height="400" fill="url(#g)"/>' +
    '<rect x="14" y="14" width="372" height="372" fill="none" stroke="#000" stroke-width="6" stroke-dasharray="14 10"/>' +
    '<text x="200" y="180" font-family="Impact, sans-serif" font-size="44" fill="#000" text-anchor="middle">FOTO</text>' +
    `<text x="200" y="240" font-family="Comic Sans MS, cursive" font-size="22" fill="#000" text-anchor="middle">${label}</text>` +
    '<text x="200" y="300" font-family="Comic Sans MS, cursive" font-size="15" fill="#000" text-anchor="middle">[ wrzuc tu zdjecie 1:1 ]</text>' +
    '</svg>'
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}
