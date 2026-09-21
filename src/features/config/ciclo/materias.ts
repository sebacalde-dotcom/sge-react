/** Una materia de un curso tal como se carga: nombre y horas o módulos por semana (si se conocen). */
export interface MateriaCarga {
  nombre: string
  horas_semanales: number | null
}

/** Para comparar nombres sin que importen las mayúsculas, los acentos ni los espacios de más. */
export const normalizarNombre = (nombre: string): string =>
  nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

// "Matemática, 5", "Física; 4", "Lengua y Literatura<TAB>4 hs": el nombre, un separador y las horas o módulos
const LINEA_CON_HORAS = /^(.*?\S)\s*[;\t,]\s*(\d+(?:[.,]\d+)?)\s*(?:hs?\.?|horas?|m[oó]dulos?|mod\.?)?\s*$/i

/**
 * Lee una lista de materias pegada en un cuadro de texto: una por línea, con las horas o módulos por semana
 * opcionales después de una coma, un punto y coma o un tabulador (como sale al copiar dos columnas de una planilla).
 */
export function parsearMateriasEnLote(texto: string): MateriaCarga[] {
  const materias: MateriaCarga[] = []
  for (const linea of texto.split(/\r?\n/)) {
    const limpia = linea.trim()
    if (!limpia) continue
    const conHoras = LINEA_CON_HORAS.exec(limpia)
    if (conHoras) materias.push({ nombre: conHoras[1].trim(), horas_semanales: Number(conHoras[2].replace(',', '.')) })
    else materias.push({ nombre: limpia, horas_semanales: null })
  }
  return materias
}

/**
 * Separa lo que se puede agregar de lo que ya está: una materia no se agrega si el curso ya tiene otra con el mismo
 * nombre, ni si se repite dentro de lo que se está cargando.
 */
export function materiasParaAgregar<T extends MateriaCarga>(
  existentes: { nombre: string }[],
  nuevas: T[],
): { agregar: T[]; repetidas: T[] } {
  const vistos = new Set(existentes.map((e) => normalizarNombre(e.nombre)))
  const agregar: T[] = []
  const repetidas: T[] = []
  for (const materia of nuevas) {
    const clave = normalizarNombre(materia.nombre)
    if (!clave) continue
    if (vistos.has(clave)) repetidas.push(materia)
    else {
      vistos.add(clave)
      agregar.push(materia)
    }
  }
  return { agregar, repetidas }
}

/** Suma de las horas o módulos semanales de las materias que las tienen cargadas. */
export const totalHoras = (materias: { horas_semanales?: number | null }[]): number =>
  materias.reduce((suma, m) => suma + Number(m.horas_semanales ?? 0), 0)

/** Nombre de un curso con su sección, para elegirlo en una lista. */
export const etiquetaCurso = (c: { nombre: string; division: string | null; secciones?: { nombre: string } | null }): string =>
  `${c.secciones?.nombre ? `${c.secciones.nombre} · ` : ''}${c.nombre}${c.division ? ` ${c.division}` : ''}`
