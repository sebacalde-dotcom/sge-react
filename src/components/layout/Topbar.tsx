import { useTheme } from '@/hooks/useTheme'

interface TopbarProps {
  institutionName: string
}

export function Topbar({ institutionName }: TopbarProps) {
  const { theme, toggle } = useTheme()

  return (
    <header
      className="flex items-center px-5 h-14 flex-shrink-0"
      style={{
        background: 'var(--topbar-bg)',
        borderBottom: '1px solid var(--topbar-border)',
      }}
    >
      <h1 className="text-base font-bold m-0" style={{ color: 'var(--topbar-title)' }}>
        {institutionName || 'SGE'}
      </h1>

      <button
        type="button"
        onClick={toggle}
        className="ml-auto flex items-center justify-center w-9 h-9 rounded-lg cursor-pointer bg-transparent border-0 transition-colors"
        style={{ color: 'var(--topbar-title)' }}
        title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      >
        <span className="material-symbols-outlined text-xl">
          {theme === 'dark' ? 'light_mode' : 'dark_mode'}
        </span>
      </button>
    </header>
  )
}
