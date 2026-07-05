interface TopbarProps {
  institutionName: string
}

export function Topbar({ institutionName }: TopbarProps) {
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
    </header>
  )
}
