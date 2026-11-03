import { useState } from 'react'
import { MEMBERS, type Member } from '../members'
import { placeholder } from '../placeholder'

function MemberCard({ member, delay }: { member: Member; delay: number }) {
  const [src, setSrc] = useState(member.photo)
  return (
    <figure className="card">
      <div className="frame" style={{ borderColor: member.frame, animationDelay: `${delay}s` }}>
        <img
          src={src}
          alt={member.name}
          onError={() => setSrc(placeholder(member.name, member.colors[0], member.colors[1]))}
        />
      </div>
      <figcaption className="caption">{member.name}</figcaption>
    </figure>
  )
}

/** Ekipa w równoległoboku: dwa u góry, dwa niżej przesunięte w prawo. */
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
