/** Popup wejścia — kliknięcie to gest użytkownika, więc przeglądarka pozwala puścić muzykę. */
export function EnterOverlay({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="enter-overlay" onClick={onEnter}>
      <div className="enter-title">ZDZIRKI.COM</div>
      <div className="enter-sub blink">♪ ♫ ♪ kliknij aby wejść ♪ ♫ ♪</div>
      <button className="enter-btn" type="button">✦ ENTER ✦</button>
      <div className="enter-note">( najlepiej z muzyką 🔊 )</div>
    </div>
  )
}
