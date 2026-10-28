import type { AppState } from '../domain/types'
import { Icon, type IconName } from './icons'
import { ImportView } from './ImportView'
import { MyShotImport } from './MyShotImport'
import { SettingsView, type SettingsSection } from './SettingsView'

export type MoreSection = 'cargar' | 'myshot' | SettingsSection

const ITEMS: { group: string; items: [MoreSection, IconName, string, string][] }[] = [
  {
    group: 'Datos de turnos',
    items: [
      ['cargar', 'upload', 'Cargar plantilla', 'Excel, CSV o fotos de la plantilla de la unidad'],
      ['myshot', 'image', 'Captura de mi app de turnos', 'Actualiza solo tus turnos'],
    ],
  },
  {
    group: 'Ajustes',
    items: [
      ['yo', 'user', 'Yo', 'Quién eres en la plantilla'],
      ['reglas', 'rules', 'Reglas', 'Descanso tras noche, 24 h, secuencias'],
      ['leyenda', 'tag', 'Leyenda', 'Qué significa cada código'],
      ['companeros', 'users', 'Compañeros', 'Quién entra como candidato'],
      ['imagenes', 'chat', 'Lectura de imágenes', 'Clave de API y modelo'],
      ['datos', 'database', 'Copia y borrado', 'Copia de seguridad, restaurar, borrar todo'],
    ],
  },
]

export function MoreView({
  state,
  setState,
  section,
  setSection,
}: {
  state: AppState
  setState: (s: AppState) => void
  section: MoreSection | null
  setSection: (s: MoreSection | null) => void
}) {
  if (section) {
    const title = ITEMS.flatMap((g) => g.items).find((i) => i[0] === section)?.[2]
    return (
      <>
        <button className="link back" onClick={() => setSection(null)}>
          <Icon name="left" size={18} /> Más
        </button>
        <h2>{title}</h2>
        {section === 'cargar' && <ImportView state={state} setState={setState} />}
        {section === 'myshot' && (
          <div className="view">
            <MyShotImport state={state} setState={setState} onClose={() => setSection(null)} />
          </div>
        )}
        {section !== 'cargar' && section !== 'myshot' && <SettingsView state={state} setState={setState} section={section} />}
      </>
    )
  }
  return (
    <div className="view">
      {ITEMS.map((g) => (
        <section key={g.group}>
          <p className="section-title">{g.group}</p>
          <div className="menu">
            {g.items.map(([k, icon, label, sub]) => (
              <button key={k} className="menu-item" onClick={() => setSection(k)}>
                <span className="source-ico">
                  <Icon name={icon} size={20} />
                </span>
                <span className="source-text">
                  <b>{label}</b>
                  <small>{sub}</small>
                </span>
                <Icon name="right" size={18} className="chev-r" />
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
