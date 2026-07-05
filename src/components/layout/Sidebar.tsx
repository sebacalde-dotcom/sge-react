import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { ROLES } from '@/lib/constants'
import { getInitials } from '@/lib/utils'

interface NavSection {
  label: string
  items: { to: string; icon: string; label: string }[]
}

const NAV: NavSection[] = [
  {
    label: '',
    items: [
      { to: '/alumnos', icon: 'school', label: 'Alumnos' },
    ],
  },
  {
    label: 'Inasistencias',
    items: [
      { to: '/inasistencias', icon: 'event_busy', label: 'Planilla' },
      { to: '/inasistencias/boletin', icon: 'description', label: 'Boletín' },
    ],
  },
  {
    label: 'Sanciones',
    items: [
      { to: '/sanciones', icon: 'gavel', label: 'Carga' },
      { to: '/sanciones/boletin', icon: 'description', label: 'Boletín' },
    ],
  },
  {
    label: 'Configuración',
    items: [
      { to: '/config/institucion', icon: 'apartment', label: 'Institución' },
      { to: '/ciclo', icon: 'event_note', label: 'Ciclo Lectivo' },
      { to: '/personal', icon: 'badge', label: 'Personal' },
      { to: '/materias', icon: 'menu_book', label: 'Materias' },
      { to: '/config/inasistencias', icon: 'tune', label: 'Cfg. Inasistencias' },
      { to: '/config/sanciones', icon: 'tune', label: 'Cfg. Sanciones' },
      { to: '/config/notas', icon: 'tune', label: 'Cfg. Calificaciones' },
    ],
  },
]

export function Sidebar() {
  const { personal, signOut } = useAuth()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const toggle = (label: string) =>
    setExpanded(prev => ({ ...prev, [label]: !prev[label] }))

  const rol = personal ? ROLES[personal.rol] : null

  return (
    <aside
      className="flex flex-col h-full w-56 flex-shrink-0 overflow-y-auto"
      style={{
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--sidebar-border)',
      }}
    >
      {/* Logo / Brand */}
      <div className="px-4 py-5" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
        <div className="text-lg font-bold" style={{ color: 'var(--topbar-title)' }}>SGE</div>
        <div className="text-xs" style={{ color: 'var(--sidebar-section-label)' }}>Sistema de Gestión Escolar</div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 px-2">
        {NAV.map((section) => (
          <div key={section.label || '_top'} className="mb-1">
            {section.label && (
              <button
                onClick={() => toggle(section.label)}
                className="flex items-center justify-between w-full px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider cursor-pointer rounded"
                style={{ color: 'var(--sidebar-section-label)' }}
              >
                {section.label}
                <span
                  className="material-symbols-outlined text-sm transition-transform"
                  style={{ transform: expanded[section.label] === false ? 'rotate(-90deg)' : 'rotate(0)' }}
                >
                  expand_more
                </span>
              </button>
            )}
            {(expanded[section.label] !== false) && section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium no-underline transition-colors"
                style={({ isActive }) => ({
                  color: isActive ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)',
                  background: isActive ? 'var(--sidebar-item-active-bg)' : 'transparent',
                  borderLeft: isActive ? '3px solid var(--sidebar-item-active-border)' : '3px solid transparent',
                })}
              >
                <span className="material-symbols-outlined text-lg">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User */}
      {personal && (
        <div
          className="px-3 py-3 flex items-center gap-2"
          style={{ borderTop: '1px solid var(--sidebar-border)' }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 overflow-hidden"
            style={{ background: '#B5D4F4', color: '#0C447C' }}
          >
            {personal.foto_url
              ? <img src={personal.foto_url} className="w-full h-full object-cover" alt="" />
              : getInitials(personal.nombre, personal.apellido)
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
              {personal.apellido}, {personal.nombre}
            </div>
            {rol && (
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                style={{ background: rol.bg, color: rol.color }}
              >
                {rol.label}
              </span>
            )}
          </div>
          <button
            onClick={signOut}
            className="p-1 rounded cursor-pointer border-none bg-transparent"
            style={{ color: 'var(--text-tertiary)' }}
            title="Cerrar sesión"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
          </button>
        </div>
      )}
    </aside>
  )
}
