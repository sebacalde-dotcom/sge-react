import { formatFecha, formatNum, renderTexto } from './carta'
import type { NotificacionItem } from './useNotificaciones'

export interface InstitucionCarta {
  nombre?: string
  direccion?: string
  telefono?: string
  email?: string
  logoUrl?: string | null
  director?: string
  firmaDirectorUrl?: string | null
}

export const ESTILOS_CARTA = `
  @page { size: A4 portrait; margin: 0; }
  .hoja { width: 210mm; min-height: 296mm; box-sizing: border-box; padding: 16mm 20mm; background: #fff;
    margin: 0 auto 16px; box-shadow: 0 2px 12px rgba(0,0,0,.18); display: flex; flex-direction: column;
    font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 11pt; line-height: 1.5;
    break-after: page; page-break-after: always; }
  .hoja:last-child { break-after: auto; page-break-after: auto; }
  .hoja table { border-collapse: collapse; width: 100%; }
  .hoja th, .hoja td { border: 1px solid #444; padding: 3px 8px; text-align: left; }
  .hoja th { background: #f1f5f9; font-weight: 700; }
  .hoja .num { text-align: center; }
`

const lineaFirma = { display: 'flex', alignItems: 'flex-end', gap: 6, marginTop: 10, fontSize: '10pt' } as const
const rayaFirma = { flex: 1, borderBottom: '1px solid #111', height: 14 } as const

export function CartaHoja({
  item,
  institucion,
  texto,
  textoNoRegular,
  incluirDetalle,
}: {
  item: NotificacionItem
  institucion: InstitucionCarta | undefined
  texto: string
  textoNoRegular: string
  incluirDetalle: boolean
}) {
  const d = item.datos
  const emision = item.registro ? item.registro.emitida_at : new Date().toISOString()
  const esNoRegular = item.tipo === 'no_regular'
  const cuerpo = renderTexto(esNoRegular ? textoNoRegular : texto, {
    alumno: `${item.nombre} ${item.apellido}`,
    dni: item.dni ?? '—',
    curso: d.curso || '—',
    desde: d.no_regular_desde ? formatFecha(d.no_regular_desde) : '—',
    limite: formatNum(d.regla_limite ?? item.limite),
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
          {(d.regla_periodo ?? item.periodo) !== 'ciclo' && (
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
