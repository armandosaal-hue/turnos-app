import { useEffect, useState } from 'react'
import { loadVisionSettings, MODELS, saveVisionSettings, type VisionSettings } from '../visionSettings'
import { emptyState, ensureMe } from '../domain/state'
import type { AppState, Rules, ShiftCode } from '../domain/types'
import { clearState, downloadJson } from '../store'
import { CodeChip, normalize, PersonPicker } from './common'
import { CodeKindFields } from './ImportView'

type Tab = 'yo' | 'reglas' | 'leyenda' | 'companeros' | 'imagenes' | 'datos'

export function SettingsView({ state, setState }: { state: AppState; setState: (s: AppState) => void }) {
  const [tab, setTab] = useState<Tab>(state.meId ? 'reglas' : 'yo')
  return (
    <div className="view">
      <div className="seg wrap">
        {(
          [
            ['yo', 'Yo'],
            ['reglas', 'Reglas'],
            ['leyenda', 'Leyenda'],
            ['companeros', 'Compañeros'],
            ['imagenes', 'Imágenes'],
            ['datos', 'Datos'],
          ] as [Tab, string][]
        ).map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'yo' && <MeTab state={state} setState={setState} />}
      {tab === 'reglas' && <RulesTab rules={state.rules} setRules={(rules) => setState({ ...state, rules })} legend={state.legend} />}
      {tab === 'leyenda' && <LegendTab state={state} setState={setState} />}
      {tab === 'companeros' && <PeopleTab state={state} setState={setState} />}
      {tab === 'imagenes' && <VisionTab />}
      {tab === 'datos' && <DataTab state={state} setState={setState} />}
    </div>
  )
}

function MeTab({ state, setState }: { state: AppState; setState: (s: AppState) => void }) {
  const me = state.meId ? state.persons[state.meId] : undefined
  const [name, setName] = useState('')
  return (
    <div className="card">
      <h2>¿Quién eres?</h2>
      <p>{me ? <b>{me.name}</b> : 'Sin elegir.'}</p>
      <p className="hint">
        Elige tu nombre tal como aparece en la plantilla. Si todavía no apareces, elige a un compañero para probar y cámbialo cuando salgas.
      </p>
      {Object.keys(state.persons).length ? (
        <PersonPicker persons={state.persons} value={state.meId} onChange={(id) => setState({ ...state, meId: id })} />
      ) : (
        <p className="hint">Todavía no hay plantilla cargada.</p>
      )}
      <h2>¿Todavía no apareces?</h2>
      <p className="hint">
        Escribe tu nombre tal como saldrá en la plantilla (APELLIDOS, NOMBRE) y mete tus turnos a mano en Calendario → Mis turnos. Cuando salgas en una
        plantilla, tus días se unen solos.
      </p>
      <div className="row">
        <input id="mi-nombre-ajustes" value={name} onChange={(e) => setName(e.target.value)} placeholder="APELLIDOS, NOMBRE" />
        <button className="primary" disabled={!name.includes(',')} onClick={() => setState(ensureMe(state, name))}>
          Guardar
        </button>
      </div>
    </div>
  )
}

function RulesTab({ rules, setRules, legend }: { rules: Rules; setRules: (r: Rules) => void; legend: AppState['legend'] }) {
  const [from, setFrom] = useState('N')
  const [to, setTo] = useState('')
  const HardSoft = ({ hard, onChange }: { hard: boolean; onChange: (h: boolean) => void }) => (
    <select value={hard ? 'dura' : 'blanda'} onChange={(e) => onChange(e.target.value === 'dura')}>
      <option value="dura">Dura (descarta)</option>
      <option value="blanda">Blanda (solo resta puntos)</option>
    </select>
  )
  const codes = Object.keys(legend).sort()
  return (
    <>
      <div className="card">
        <label className="check">
          <input
            type="checkbox"
            checked={rules.restAfterNight.enabled}
            onChange={(e) => setRules({ ...rules, restAfterNight: { ...rules.restAfterNight, enabled: e.target.checked } })}
          />
          <b>Descanso tras noche intocable</b>
        </label>
        <p className="hint">
          Nadie puede trabajar el {rules.restAfterNight.restCode} que va justo después de una {rules.restAfterNight.nightCode}. Los siguientes sí.
        </p>
      </div>

      <div className="card">
        <label className="check">
          <input
            type="checkbox"
            checked={rules.maxContinuousHours.enabled}
            onChange={(e) => setRules({ ...rules, maxContinuousHours: { ...rules.maxContinuousHours, enabled: e.target.checked } })}
          />
          <b>Horas seguidas prohibidas</b>
        </label>
        <div className="row">
          <label className="field">
            <span>A partir de (h)</span>
            <input
              type="number"
              min={1}
              value={rules.maxContinuousHours.hours}
              onChange={(e) => setRules({ ...rules, maxContinuousHours: { ...rules.maxContinuousHours, hours: Number(e.target.value) || 24 } })}
            />
          </label>
          <HardSoft hard={rules.maxContinuousHours.hard} onChange={(h) => setRules({ ...rules, maxContinuousHours: { ...rules.maxContinuousHours, hard: h } })} />
        </div>
        <p className="hint">Con 24: prohíbe diurno + noche el mismo día y noche + diurno al día siguiente.</p>
      </div>

      <div className="card">
        <label className="check">
          <input
            type="checkbox"
            checked={rules.forbiddenSequences.enabled}
            onChange={(e) => setRules({ ...rules, forbiddenSequences: { ...rules.forbiddenSequences, enabled: e.target.checked } })}
          />
          <b>Secuencias prohibidas (día → día siguiente)</b>
        </label>
        <HardSoft hard={rules.forbiddenSequences.hard} onChange={(h) => setRules({ ...rules, forbiddenSequences: { ...rules.forbiddenSequences, hard: h } })} />
        {rules.forbiddenSequences.items.map((it, i) => (
          <div key={i} className="row between">
            <span>
              <CodeChip code={it.from} legend={legend} /> → <CodeChip code={it.to} legend={legend} />
            </span>
            <button
              className="link"
              onClick={() =>
                setRules({ ...rules, forbiddenSequences: { ...rules.forbiddenSequences, items: rules.forbiddenSequences.items.filter((_, j) => j !== i) } })
              }
            >
              Quitar
            </button>
          </div>
        ))}
        <div className="row">
          <select value={from} onChange={(e) => setFrom(e.target.value)}>
            {codes.map((c) => (
              <option key={c} value={c}>{c === '' ? '(vacío) diurno' : c}</option>
            ))}
          </select>
          →
          <select value={to} onChange={(e) => setTo(e.target.value)}>
            {codes.map((c) => (
              <option key={c} value={c}>{c === '' ? '(vacío) diurno' : c}</option>
            ))}
          </select>
          <button
            onClick={() =>
              setRules({ ...rules, forbiddenSequences: { ...rules.forbiddenSequences, items: [...rules.forbiddenSequences.items, { from, to }] } })
            }
          >
            Añadir
          </button>
        </div>
      </div>

      {(
        [
          ['maxConsecutiveWorkDays', 'Máximo de días de trabajo seguidos'],
          ['maxConsecutiveNights', 'Máximo de noches seguidas'],
        ] as const
      ).map(([k, label]) => (
        <div key={k} className="card">
          <label className="check">
            <input type="checkbox" checked={rules[k].enabled} onChange={(e) => setRules({ ...rules, [k]: { ...rules[k], enabled: e.target.checked } })} />
            <b>{label}</b>
          </label>
          <div className="row">
            <input
              type="number"
              min={1}
              value={rules[k].value}
              onChange={(e) => setRules({ ...rules, [k]: { ...rules[k], value: Number(e.target.value) || 1 } })}
            />
            <HardSoft hard={rules[k].hard} onChange={(h) => setRules({ ...rules, [k]: { ...rules[k], hard: h } })} />
          </div>
        </div>
      ))}
      <div className="card">
        <label className="check">
          <input
            type="checkbox"
            checked={rules.preferChains?.enabled !== false}
            onChange={(e) => setRules({ ...rules, preferChains: { enabled: e.target.checked } })}
          />
          <b>Priorizar encadenar turnos y no partir libres</b>
        </label>
        <p className="hint">
          Ordena primero a quien el turno le queda pegado a otros turnos y deja al final a quien le partiría sus días libres. Solo cambia el orden: no descarta a
          nadie.
        </p>
      </div>
      <p className="hint">Los solapes entre turnos de una misma persona siempre se descartan.</p>
    </>
  )
}

function LegendTab({ state, setState }: { state: AppState; setState: (s: AppState) => void }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [newCode, setNewCode] = useState('')
  const set = (code: string, patch: Partial<ShiftCode>) =>
    setState({ ...state, legend: { ...state.legend, [code]: { ...state.legend[code], ...patch } } })
  const list = Object.values(state.legend)
    .filter((c) => !q || normalize(c.code + ' ' + c.name).includes(normalize(q)))
    .sort((a, b) => a.code.localeCompare(b.code))
  return (
    <>
      <div className="card row">
        <input value={newCode} onChange={(e) => setNewCode(e.target.value.trim())} placeholder="Nuevo código" />
        <button
          disabled={!newCode || !!state.legend[newCode]}
          onClick={() => {
            set(newCode, { code: newCode, name: 'Sin descripción', kind: 'ausencia', confirmed: true })
            setOpen(newCode)
            setNewCode('')
          }}
        >
          Añadir
        </button>
      </div>
      <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar código o descripción…" />
      {list.map((c) => (
        <div key={c.code} className="card">
          <div className="row between" onClick={() => setOpen(open === c.code ? null : c.code)}>
            <span>
              <CodeChip code={c.code} legend={state.legend} /> {c.name}
              {c.start && (
                <small>
                  {' '}
                  · {c.start}–{c.end}
                </small>
              )}
            </span>
            <span className="chev">{open === c.code ? '▴' : '▾'}</span>
          </div>
          {open === c.code && (
            <>
              <label className="field">
                <span>Descripción</span>
                <input value={c.name} onChange={(e) => set(c.code, { name: e.target.value })} />
              </label>
              <CodeKindFields def={c} onChange={(p) => set(c.code, p)} />
            </>
          )}
        </div>
      ))}
    </>
  )
}

function PeopleTab({ state, setState }: { state: AppState; setState: (s: AppState) => void }) {
  const [q, setQ] = useState('')
  const list = Object.values(state.persons)
    .filter((p) => !q || normalize(p.name).includes(normalize(q)))
    .sort((a, b) => a.section.localeCompare(b.section) || a.name.localeCompare(b.name))
  return (
    <>
      <p className="hint">Desmarca a quien no quieras que aparezca como candidato. El personal de turno fijo (mañana y noches) viene desmarcado.</p>
      <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" />
      {list.map((p) => (
        <label key={p.id} className="card check">
          <input
            type="checkbox"
            checked={p.candidate}
            onChange={(e) => setState({ ...state, persons: { ...state.persons, [p.id]: { ...p, candidate: e.target.checked } } })}
          />
          <span>
            {p.name}
            <small>
              {' '}
              · {p.section}
              {p.note && ` · ${p.note}`}
            </small>
          </span>
        </label>
      ))}
    </>
  )
}

function VisionTab() {
  const [s, setS] = useState<VisionSettings | null>(null)
  const [draft, setDraft] = useState('')
  const [msg, setMsg] = useState('')
  useEffect(() => {
    loadVisionSettings().then(setS)
  }, [])
  if (!s) return null
  const save = async (next: VisionSettings, text: string) => {
    await saveVisionSettings(next)
    setS(next)
    setMsg(text)
  }
  return (
    <div className="card">
      <h2>Lectura de fotos</h2>
      <p className="hint">
        Las fotos de la plantilla se leen con la IA de Claude usando tu clave de API de Anthropic. La clave se guarda solo en este dispositivo y no se incluye en
        las copias de seguridad.
      </p>
      <p>{s.apiKey ? `Clave guardada: ${s.apiKey.slice(0, 10)}…${s.apiKey.slice(-4)}` : 'Sin clave.'}</p>
      <label className="field">
        <span>{s.apiKey ? 'Cambiar clave' : 'Clave de API'}</span>
        <input id="api-key-ajustes" type="password" autoComplete="off" value={draft} onChange={(e) => setDraft(e.target.value.trim())} placeholder="sk-ant-…" />
      </label>
      <div className="row">
        <button className="primary" disabled={!draft.startsWith('sk-')} onClick={() => save({ ...s, apiKey: draft }, 'Clave guardada.').then(() => setDraft(''))}>
          Guardar clave
        </button>
        {s.apiKey && (
          <button className="danger" onClick={() => save({ ...s, apiKey: '' }, 'Clave borrada.')}>
            Borrar clave
          </button>
        )}
      </div>
      <label className="field">
        <span>Modelo</span>
        <select id="modelo" value={s.model} onChange={(e) => save({ ...s, model: e.target.value }, 'Modelo guardado.')}>
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </label>
      {msg && <p className="ok">{msg}</p>}
    </div>
  )
}

function DataTab({ state, setState }: { state: AppState; setState: (s: AppState) => void }) {
  const [confirm, setConfirm] = useState(false)
  const [msg, setMsg] = useState('')
  return (
    <div className="card">
      <h2>Tus datos</h2>
      <p className="hint">
        Todo se guarda solo en este dispositivo. Haz copias de vez en cuando: si borras los datos del navegador, se pierden.
      </p>
      <div className="col">
        <button onClick={() => downloadJson(state)}>Descargar copia de seguridad</button>
        <label className="file">
          <input
            type="file"
            id="copia"
            accept=".json,application/json"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              try {
                const s = JSON.parse(await f.text()) as AppState
                if (s.schema !== 1 || !s.grid || !s.legend) throw new Error()
                setState(s)
                setMsg('Copia restaurada.')
              } catch {
                setMsg('El archivo no es una copia válida.')
              }
            }}
          />
          Restaurar copia
        </label>
        {msg && <p>{msg}</p>}
        {confirm ? (
          <div className="row">
            <button onClick={() => setConfirm(false)}>No</button>
            <button
              className="danger"
              onClick={async () => {
                await clearState()
                setState(emptyState())
                setConfirm(false)
              }}
            >
              Sí, borrar todo
            </button>
          </div>
        ) : (
          <button className="danger" onClick={() => setConfirm(true)}>Borrar todos los datos</button>
        )}
      </div>
    </div>
  )
}
