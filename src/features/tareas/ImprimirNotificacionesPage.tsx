import { useEffect } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import { ArrowBack, Print, CheckCircle } from '@mui/icons-material'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useConfig } from '@/hooks/useConfig'
import { DEFAULT_TEXTO_CARTA, formatFecha, formatNum, renderTexto } from './carta'
import type { NotificacionItem } from './useNotificacionesPendientes'

interface InstitucionData {
  nombre?: string
  direccion?: string
  telefono?: string
  email?: string
  logoUrl?: string | null
  director?: string
  firmaDirectorUrl?: string | null
}

interface ConfigCarta {
  carta?: { texto?: string; incluir_detalle?: boolean }
}

const ESTILOS = `
  @page { size: A4 portrait; margin: 0; }
  .pantalla-carta { background: #e5e7eb; min-height: 100vh; padding: 16px 0 40px; }
  .hoja { width: 210mm; min-height: 296mm; box-sizing: border-box; padding: 16mm 20mm; background: #fff;
    margin: 0 auto 16px; box-shadow: 0 2px 12px rgba(0,0,0,.18); display: flex; flex-direction: column;
    font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 11pt; line-height: 1.5;
    break-after: page; page-break-after: always; }
  .hoja:last-child { break-after: auto; page-break-after: auto; }
  .hoja table { border-collapse: collapse; width: 100%; }
  .hoja th, .hoja td { border: 1px solid #444; padding: 3px 8px; text-align: left; }
  .hoja th { background: #f1f5f9; font-weight: 700; }
  .hoja .num { text-align: center; }
  @media print {
    .no-print { display: none !important; }
    .pantalla-carta { background: #fff !important; padding: 0 !important; min-height: 0 !important; }
    .hoja { margin: 0 !important; box-shadow: none !important; }
  }
`

const lineaFirma = { display: 'flex', alignItems: 'flex-end', gap: 6, marginTop: 10, fontSize: '10pt' } as const
const rayaFirma = { flex: 1, borderBottom: '1px solid #111', height: 14 } as const

function Carta({
  item,
  institucion,
  texto,
  incluirDetalle,
}: {
  item: NotificacionItem
  institucion: InstitucionData | undefined
  texto: string
  incluirDetalle: boolean
}) {
  const d = item.datos
  const emision = item.registro ? item.registro.emitida_at : new Date().toISOString()
  const cuerpo = renderTexto(texto, {
    alumno: `${item.nombre} ${item.apellido}`,
    dni: item.dni ?? '—',
    curso: d.curso || '—',
    limite: formatNum(item.limite),
    cantidad: formatNum(d.periodo.total),
    periodo: d.periodo_texto,
    fecha: formatFecha(emision),
  })
  const contacto = [institucion?.direccion, institucion?.telefono, institucion?.email].filter(Boolean).join(' · ')

  return (
    <section className="hoja">
      <header style={{ display: 'flex', alignItems: 'center', gap: '6mm', borderBottom: '2px solid #111', paddingBottom: '4mm' }}>
        {institucion?.logoUrl && (
          <img src={institucion.logoUrl} alt="" style={{ height: '22mm', maxWidth: '40mm', objectFit: 'contain' }} />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '16pt', fontWeight: 700, lineHeight: 1.2 }}>{institucion?.nombre ?? ''}</div>
          {contacto && <div style={{ fontSize: '9pt', color: '#444' }}>{contacto}</div>}
        </div>
        <div style={{ fontSize: '10pt', textAlign: 'right' }}>Fecha: {formatFecha(emision)}</div>
      </header>

      <h1 style={{ textAlign: 'center', fontSize: '15pt', margin: '10mm 0 6mm', letterSpacing: '0.04em' }}>
        NOTIFICACIÓN DE INASISTENCIAS
      </h1>

      <table style={{ marginBottom: '6mm' }}>
        <tbody>
          <tr>
            <th style={{ width: '25%' }}>Alumno/a</th>
            <td>{item.apellido}, {item.nombre}</td>
          </tr>
          <tr>
            <th>DNI</th>
            <td>{item.dni ?? '—'}</td>
          </tr>
          <tr>
            <th>Curso</th>
            <td>{d.curso || '—'}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ textAlign: 'justify' }}>
        {cuerpo.split(/\n{2,}/).map((p, i) => (
          <p key={i} style={{ margin: '0 0 4mm', whiteSpace: 'pre-line' }}>{p}</p>
        ))}
      </div>

      <table style={{ margin: '2mm 0 6mm' }}>
        <thead>
          <tr>
            <th>Detalle de inasistencias</th>
            <th className="num">Total</th>
            <th className="num">Justificadas</th>
            <th className="num">Injustificadas</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>En {d.periodo_texto}</td>
            <td className="num">{formatNum(d.periodo.total)}</td>
            <td className="num">{formatNum(d.periodo.justificadas)}</td>
            <td className="num">{formatNum(d.periodo.injustificadas)}</td>
          </tr>
          {item.periodo !== 'ciclo' && (
            <tr>
              <td>Acumulado en el ciclo lectivo {d.anio ?? ''}</td>
              <td className="num">{formatNum(d.ciclo.total)}</td>
              <td className="num">{formatNum(d.ciclo.justificadas)}</td>
              <td className="num">{formatNum(d.ciclo.injustificadas)}</td>
            </tr>
          )}
        </tbody>
      </table>

      {incluirDetalle && d.fechas.length > 0 && (
        <table style={{ fontSize: '9pt', marginBottom: '6mm' }}>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th className="num">Valor</th>
              <th className="num">Justificada</th>
            </tr>
          </thead>
          <tbody>
            {d.fechas.map((f, i) => (
              <tr key={i}>
                <td>{formatFecha(f.fecha)}</td>
                <td>{f.tipo}</td>
                <td className="num">{formatNum(f.valor)}</td>
                <td className="num">{f.justificada ? 'Sí' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: 'auto', display: 'flex', gap: '14mm', paddingTop: '10mm', breakInside: 'avoid' }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ height: '22mm', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            {institucion?.firmaDirectorUrl && (
              <img src={institucion.firmaDirectorUrl} alt="" style={{ maxHeight: '22mm', maxWidth: '55mm', objectFit: 'contain' }} />
            )}
          </div>
          <div style={{ borderTop: '1px solid #111', paddingTop: 2, fontSize: '10pt', minHeight: '5mm' }}>
            {institucion?.director}
          </div>
          <div style={{ fontSize: '9pt', color: '#444' }}>Director/a</div>
        </div>
        <div style={{ flex: 1.3 }}>
          <div style={{ fontSize: '10pt', fontWeight: 700 }}>Tomé conocimiento (padre / madre / tutor)</div>
          <div style={lineaFirma}>Firma: <span style={rayaFirma} /></div>
          <div style={lineaFirma}>Aclaración: <span style={rayaFirma} /></div>
          <div style={lineaFirma}>DNI: <span style={rayaFirma} /></div>
          <div style={lineaFirma}>Fecha de recepción: <span style={rayaFirma} /></div>
        </div>
      </div>
    </section>
  )
}

export function ImprimirNotificacionesPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { personal } = useAuth()
  const items = (location.state as { items?: NotificacionItem[] } | null)?.items
  const { data: institucion, isLoading: cargandoInstitucion } = useConfig<InstitucionData>('institucional')
  const { data: config, isLoading: cargandoConfig } = useConfig<ConfigCarta>('inasistencias')

  useEffect(() => {
    const anterior = document.title
    document.title = 'Notificaciones de inasistencias'
    return () => {
      document.title = anterior
    }
  }, [])

  const nuevas = (items ?? []).filter((i) => !i.registro)

  const registrarMutation = useMutation({
    mutationFn: async () => {
      const filas = nuevas.map((i) => ({
        persona_id: i.persona_id,
        ciclo_id: i.ciclo_id,
        limite: i.limite,
        periodo: i.periodo,
        periodo_desde: i.periodo_desde,
        estado: 'impresa',
        datos: i.datos,
        emitida_por: personal?.id ?? null,
      }))
      const { error } = await supabase
        .from('notificaciones_inasistencia')
        .upsert(filas, { onConflict: 'persona_id,ciclo_id,limite,periodo,periodo_desde', ignoreDuplicates: true })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Cartas registradas como impresas')
      queryClient.invalidateQueries({ queryKey: ['tareas'] })
      navigate('/tareas')
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  if (!items || items.length === 0) return <Navigate to="/tareas" replace />

  const texto = config?.carta?.texto?.trim() ? config.carta.texto : DEFAULT_TEXTO_CARTA
  const incluirDetalle = config?.carta?.incluir_detalle ?? false

  return (
    <div className="pantalla-carta">
      <style>{ESTILOS}</style>

      <div className="no-print" style={{ width: '210mm', margin: '0 auto 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button startIcon={<ArrowBack />} onClick={() => navigate('/tareas')}>Volver</Button>
          <Button variant="contained" startIcon={<Print />} onClick={() => window.print()}>
            Imprimir ({items.length} {items.length === 1 ? 'carta' : 'cartas'})
          </Button>
          {nuevas.length > 0 && (
            <Button
              variant="outlined"
              color="success"
              startIcon={registrarMutation.isPending ? <CircularProgress size={18} /> : <CheckCircle />}
              disabled={registrarMutation.isPending}
              onClick={() => registrarMutation.mutate()}
            >
              Ya imprimí: marcar {nuevas.length} como impresas
            </Button>
          )}
        </div>
        {nuevas.length > 0 && (
          <Alert severity="info">
            Primero imprimí. Cuando las hojas salgan bien, confirmá con "Ya imprimí" para que pasen a "Para entregar". Si no
            confirmás, siguen apareciendo en "Por imprimir".
          </Alert>
        )}
      </div>

      {cargandoInstitucion || cargandoConfig ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><CircularProgress /></div>
      ) : (
        items.map((item) => (
          <Carta key={item.key} item={item} institucion={institucion} texto={texto} incluirDetalle={incluirDetalle} />
        ))
      )}
    </div>
  )
}
