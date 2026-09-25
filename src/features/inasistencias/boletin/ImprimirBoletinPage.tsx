import { useEffect } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import { ArrowBack, Print } from '@mui/icons-material'
import { CicloProvider, useCiclo } from '@/contexts/CicloContext'
import { useConfig } from '@/hooks/useConfig'
import { ESTILOS_CARTA, type InstitucionCarta } from '../notificaciones/CartaHoja'
import { extracto, resumenPorCuatrimestre } from '../boletin'
import { BoletinHoja } from './BoletinHoja'
import { RUTA_BOLETIN, useBoletinCurso } from './useBoletin'

const ESTILOS_PANTALLA = `
  ${ESTILOS_CARTA}
  .pantalla-carta { background: #e5e7eb; min-height: 100vh; padding: 16px 0 40px; }
  @media print {
    .no-print { display: none !important; }
    .pantalla-carta { background: #fff !important; padding: 0 !important; min-height: 0 !important; }
    .hoja { margin: 0 !important; box-shadow: none !important; }
  }
`

interface EstadoImpresion {
  cursoId: string
  personaIds: string[]
  incluirMaterias: boolean
}

// Está fuera del AppShell (sin barra ni menú) y necesita el ciclo lectivo activo
export function ImprimirBoletinPage() {
  return (
    <CicloProvider>
      <ImprimirBoletin />
    </CicloProvider>
  )
}

function ImprimirBoletin() {
  const location = useLocation()
  const navigate = useNavigate()
  const estado = location.state as EstadoImpresion | null
  const { ciclo } = useCiclo()
  const { data: institucion, isLoading: cargandoInstitucion } = useConfig<InstitucionCarta>('institucional')
  const boletin = useBoletinCurso(estado?.cursoId, !!estado?.incluirMaterias)

  useEffect(() => {
    const anterior = document.title
    document.title = 'Boletín de inasistencias'
    return () => {
      document.title = anterior
    }
  }, [])

  if (!estado || estado.personaIds.length === 0) return <Navigate to={RUTA_BOLETIN} replace />

  const alumnos = boletin.alumnos.filter((a) => estado.personaIds.includes(a.persona_id))

  return (
    <div className="pantalla-carta">
      <style>{ESTILOS_PANTALLA}</style>

      <div className="no-print" style={{ width: '210mm', margin: '0 auto 16px', display: 'flex', gap: 8 }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate(RUTA_BOLETIN)}>Volver</Button>
        <Button variant="contained" startIcon={<Print />} onClick={() => window.print()} disabled={boletin.isLoading}>
          Imprimir ({alumnos.length} {alumnos.length === 1 ? 'boletín' : 'boletines'})
        </Button>
      </div>

      {cargandoInstitucion || boletin.isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><CircularProgress /></div>
      ) : (
        alumnos.map((a) => {
          const faltas = boletin.faltasDe(a.persona_id)
          return (
            <BoletinHoja
              key={a.persona_id}
              alumno={a}
              anio={ciclo?.anio ?? null}
              institucion={institucion}
              resumen={resumenPorCuatrimestre(faltas, ciclo)}
              movimientos={extracto(faltas, ciclo)}
              materias={boletin.materiasDe(a.persona_id)}
            />
          )
        })
      )}
    </div>
  )
}
