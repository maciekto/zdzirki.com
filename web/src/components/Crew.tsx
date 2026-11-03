import { useState } from 'react'
import { MEMBERS, opggUrl, type Member } from '../members'
import { placeholder } from '../placeholder'

function MemberCard({ member, delay }: { member: Member; delay: number }) {
  const [src, setSrc] = useState(member.photo)
  return (
    <a
      className="card"
      href={opggUrl(member.riotId)}
      target="_blank"
      rel="noopener noreferrer"
      title={`${member.riotId} na op.gg (EUNE)`}
    >
      <div className="frame" style={{ borderColor: member.frame, animationDelay: `${delay}s` }}>
        <img
          src={src}
          alt={member.name}
          onError={() => setSrc(placeholder(member.name, member.colors[0], member.colors[1]))}
        />
        <span className="opgg-badge" aria-hidden="true">OP.GG ↗</span>
      </div>
      <div className="caption">{member.name}</div>
    </a>
  )
}

/** Ekipa w równoległoboku: dwa u góry, dwa niżej przesunięte w prawo. Klik = profil op.gg. */
export function Crew({ active }: { active: boolean }) {
  const rows = [MEMBERS.slice(0, 2), MEMBERS.slice(2, 4)]
  return (
    <section className={`view crew${active ? ' active' : ''}`} role="tabpanel" aria-label="Ekipa">
      {rows.map((row, i) => (
        <div key={i} className={`crew-row ${i === 0 ? 'top' : 'bottom'}`}>
          {row.map((member, j) => (
            <MemberCard key={member.name} member={member} delay={(i * 2 + j) * 0.6} />
          ))}
        </div>
      ))}
    </section>
  )
}
