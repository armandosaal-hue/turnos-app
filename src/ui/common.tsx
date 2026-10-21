import { useMemo, useState } from 'react'
import { displayCode, kindOf } from '../domain/legend'
import type { Legend, Person } from '../domain/types'

export function CodeChip({ code, legend, small }: { code: string | undefined; legend: Legend; small?: boolean }) {
  if (code === undefined) return <span className={`chip k-none${small ? ' sm' : ''}`}>–</span>
  const kind = kindOf(legend, code)
  return (
    <span className={`chip k-${kind}${small ? ' sm' : ''}`} title={legend[code]?.name ?? 'sin definir'}>
      {displayCode(code)}
    </span>
  )
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
      .filter((p) => !n || normalize(p.name).includes(n))
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
