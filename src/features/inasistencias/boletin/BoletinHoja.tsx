import { formatFecha, formatNum } from '../notificaciones/carta'
import type { InstitucionCarta } from '../notificaciones/CartaHoja'
import { etiquetaTurno, type Extracto, type FilaResumen } from '../boletin'
import { MINIMO_ASISTENCIA_MATERIA, type AsistenciaMateriaConNombre } from '../useAsistenciaPorMateria'

export interface AlumnoBoletin {
  persona_id: string
  apellido: string
  nombre: string
  dni: string | null
  curso: string
}

const lineaFirma = { display: 'flex', alignItems: 'flex-end', gap: 6, marginTop: 10, fontSize: '10pt' } as const
const rayaFirma = { flex: 1, borderBottom: '1px solid #111', height: 14 } as const
const subtitulo = { fontSize: '11pt', fontWeight: 700, margin: '0 0 2mm' } as const

export function BoletinHoja({
  alumno,
  anio,
  institucion,
  resumen,
  movimientos,
  materias,
}: {
  alumno: AlumnoBoletin
  anio: number | null
  institucion: InstitucionCarta | undefined
  resumen: FilaResumen[]
  movimientos: Extracto
  /** Null si no se incluye la asistencia por materia. */
  materias: AsistenciaMateriaConNombre[] | null
}) {
  const contacto = [institucion?.direccion, institucion?.telefono, institucion?.email].filter(Boolean).join(' · ')
  const hoy = new Date().toISOString()

  return (
    <section className="hoja">
      <header style={{ display: 'flex', alignItems: 'center', gap: '6mm', borderBottom: '2px solid #111', paddingBottom: '4mm' }}>
        {institucion?.logoUrl && (
          <img src={institucion.logoUrl} alt="" style={{ height: '20mm', maxWidth: '40mm', objectFit: 'contain' }} />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '16pt', fontWeight: 700, lineHeight: 1.2 }}>{institucion?.nombre ?? ''}</div>
          {contacto && <div style={{ fontSize: '9pt', color: '#444' }}>{contacto}</div>}
        </div>
        <div style={{ fontSize: '10pt', textAlign: 'right' }}>Fecha: {formatFecha(hoy)}</div>
      </header>

      <h1 style={{ textAlign: 'center', fontSize: '15pt', margin: '7mm 0 5mm', letterSpacing: '0.04em' }}>
        BOLETÍN DE INASISTENCIAS {anio ?? ''}
      </h1>

      <table style={{ marginBottom: '5mm' }}>
        <tbody>
          <tr>
            <th style={{ width: '25%' }}>Alumno/a</th>
            <td>{alumno.apellido}, {alumno.nombre}</td>
          </tr>
          <tr>
            <th>DNI</th>
            <td>{alumno.dni ?? '—'}</td>
          </tr>
          <tr>
            <th>Curso</th>
            <td>{alumno.curso || '—'}</td>
          </tr>
        </tbody>
      </table>

      <p style={subtitulo}>Resumen por cuatrimestre</p>
      <table style={{ marginBottom: '5mm' }}>
        <thead>
          <tr>
            <th>Período</th>
            <th className="num">Justificadas</th>
            <th className="num">Injustificadas</th>
            <th className="num">Total del período</th>
            <th className="num">Acumulado del ciclo</th>
          </tr>
        </thead>
        <tbody>
          {resumen.map((r) => (
            <tr key={r.cuatrimestre.numero}>
              <td>
                {r.cuatrimestre.nombre}
                <span style={{ fontSize: '8.5pt', color: '#555' }}>
                  {' '}({formatFecha(r.cuatrimestre.desde)} al {formatFecha(r.cuatrimestre.hasta)})
                </span>
              </td>
              <td className="num">{formatNum(r.justificadas)}</td>
              <td className="num">{formatNum(r.injustificadas)}</td>
              <td className="num">{formatNum(r.total)}</td>
              <td className="num" style={{ fontWeight: 700 }}>{formatNum(r.acumulado)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {materias && materias.length > 0 && (
        <>
          <p style={subtitulo}>Asistencia por materia (mínimo {MINIMO_ASISTENCIA_MATERIA}%)</p>
          <table style={{ fontSize: '9pt', marginBottom: '5mm' }}>
            <thead>
              <tr>
                <th>Materia</th>
                <th className="num">Módulos dictados</th>
                <th className="num">Módulos ausente</th>
                <th className="num">Asistencia</th>
              </tr>
            </thead>
            <tbody>
              {[...materias].sort((a, b) => a.nombre.localeCompare(b.nombre)).map((m) => (
                <tr key={m.materia_id}>
                  <td>{m.nombre}</td>
                  <td className="num">{m.modulos_totales}</td>
                  <td className="num">{m.modulos_perdidos}</td>
                  <td className="num" style={{ fontWeight: m.porcentaje < MINIMO_ASISTENCIA_MATERIA ? 700 : 400 }}>
                    {formatNum(m.porcentaje)}%{m.porcentaje < MINIMO_ASISTENCIA_MATERIA ? ' *' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <p style={subtitulo}>Detalle de inasistencias</p>
      {movimientos.movimientos.length === 0 ? (
        <p style={{ fontSize: '10pt', margin: '0 0 5mm' }}>No registra inasistencias.</p>
      ) : (
        <table style={{ fontSize: '9pt', marginBottom: '5mm' }}>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo de inasistencia</th>
              <th className="num">Justificada</th>
              <th className="num">Valor</th>
              <th className="num">Total acumulado</th>
            </tr>
          </thead>
          <tbody>
            {movimientos.movimientos.map((m, i) => (
              <tr key={i} style={{ breakInside: 'avoid' }}>
                <td>{formatFecha(m.fecha)}</td>
                <td>{m.tipo}{etiquetaTurno(m.turno) ? ` (${etiquetaTurno(m.turno)})` : ''}</td>
                <td className="num">{m.justificada ? 'Sí' : 'No'}</td>
                <td className="num">{formatNum(Number(m.valor))}</td>
                <td className="num">{formatNum(m.acumulado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: 'auto', paddingTop: '8mm', display: 'flex', justifyContent: 'flex-end', breakInside: 'avoid' }}>
        <div style={{ width: '60%' }}>
          <div style={{ fontSize: '10pt', fontWeight: 700 }}>Tomé conocimiento (adulto responsable)</div>
          <div style={lineaFirma}>Firma: <span style={rayaFirma} /></div>
          <div style={lineaFirma}>Aclaración: <span style={rayaFirma} /></div>
          <div style={lineaFirma}>DNI: <span style={rayaFirma} /></div>
          <div style={lineaFirma}>Fecha: <span style={rayaFirma} /></div>
        </div>
      </div>
    </section>
  )
}
