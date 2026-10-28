import { useMemo, useState, type ReactNode } from 'react'
import { Icon, type IconName } from './icons'
import { displayCode, visualKind } from '../domain/legend'
import type { Legend, Person } from '../domain/types'

export function CodeChip({ code, legend, small, prev }: { code: string | undefined; legend: Legend; small?: boolean; prev?: string }) {
  if (code === undefined) return <span className={`chip v-none${small ? ' sm' : ''}`}>–</span>
  return (
    <span className={`chip v-${visualKind(legend, code, prev)}${small ? ' sm' : ''}`} title={legend[code]?.name ?? 'sin definir'}>
      {displayCode(code)}
    </span>
  )
}

// En mi calendario: el diurno y la noche se escriben enteros, en amarillo y en negro.
export function ShiftPill({ code, legend, prev }: { code: string | undefined; legend: Legend; prev?: string }) {
  const vk = visualKind(legend, code, prev)
  if (vk === 'diurno') return <span className="pill-shift p-diurno">Diurno</span>
  if (vk === 'noche') return <span className="pill-shift p-noche">Nocturno</span>
  return <CodeChip code={code} legend={legend} prev={prev} small />
}

export function PersonPicker({
  persons,
  value,
  onChange,
  placeholder = 'Buscar por nombre…',
}: {
  persons: Record<string, Person>
  value?: string
  onChange: (id: string) => void
  placeholder?: string
}) {
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const n = normalize(q)
    return Object.values(persons)
      .filter((p) => !n || normalize(`${p.name} ${p.puesto}`).includes(n))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 30)
  }, [persons, q])
  return (
    <div className="picker">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} />
      <div className="picker-list">
        {list.map((p) => (
          <button key={p.id} className={`picker-item${p.id === value ? ' sel' : ''}`} onClick={() => onChange(p.id)}>
            {p.name}
            {p.puesto && <small> · puesto {p.puesto}</small>}
            {p.note && <small> · {p.note}</small>}
          </button>
        ))}
      </div>
    </div>
  )
}

export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export function shortName(p: Person | undefined): string {
  if (!p) return '¿?'
  const [surname, given] = p.name.split(',').map((s) => s.trim())
  return given ? `${given} ${surname.split(' ')[0]}` : p.name
}

export function initials(p: Person | undefined): string {
  if (!p) return '?'
  const [surname, given] = p.name.split(',').map((x) => x.trim())
  return `${(given ?? '').charAt(0)}${(surname ?? '').charAt(0)}`.toUpperCase() || '?'
}

// Avatar con iniciales; el tono sale del nombre para que cada persona tenga siempre el mismo.
export function Avatar({ p, size = 40 }: { p: Person | undefined; size?: number }) {
  let h = 0
  for (const ch of p?.name ?? '') h = (h * 31 + ch.charCodeAt(0)) % 360
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38, ['--hue' as string]: h }}>
      {initials(p)}
    </span>
  )
}

export function Empty({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-ico">
        <Icon name={icon} size={30} />
      </span>
      {children}
    </div>
  )
}

// Fila del Excel de una persona en el mes de esa fecha (o la de otro mes si en ese no sale).
export function excelRow(p: Person | undefined, date: string): number | undefined {
  if (!p?.rows) return undefined
  return p.rows[date.slice(0, 7)] ?? Object.values(p.rows)[0]
}

export function rowLabel(p: Person | undefined, date: string): string {
  const r = excelRow(p, date)
  return [r ? `fila ${r}` : '', p?.puesto ? `puesto ${p.puesto}` : ''].filter(Boolean).join(' · ')
}
