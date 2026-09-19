import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { read, utils } from 'xlsx'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import { CloudUpload, CheckCircle, Error as ErrorIcon } from '@mui/icons-material'
import { supabase } from '@/lib/supabase'

interface ParsedAlumno {
  apellido: string
  nombre: string
  dni: string
  fecha_nac: string
  sexo: string
  valid: boolean
  error?: string
}

type AlumnoField = 'apellido' | 'nombre' | 'dni' | 'fecha_nac' | 'sexo'

const COLUMN_MAP: Record<string, AlumnoField> = {
  apellido: 'apellido',
  apellidos: 'apellido',
  nombre: 'nombre',
  nombres: 'nombre',
  dni: 'dni',
  documento: 'dni',
  'nro documento': 'dni',
  'numero documento': 'dni',
  'fecha de nacimiento': 'fecha_nac',
  'fecha nacimiento': 'fecha_nac',
  'fecha_nac': 'fecha_nac',
  'fec. nac.': 'fecha_nac',
  nacimiento: 'fecha_nac',
  sexo: 'sexo',
  genero: 'sexo',
  género: 'sexo',
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().replace(/[_.-]/g, ' ').replace(/\s+/g, ' ')
}

function parseDate(val: unknown): string {
  if (!val) return ''
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000))
    return d.toISOString().split('T')[0]
  }
  const s = String(val).trim()
  const ddmmyyyy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/)
  if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  return ''
}

function hasMojibake(s: string): boolean {
  return /[ÃÂ]/.test(s)
}

function parseSexo(val: unknown): string {
  if (!val) return ''
  const s = String(val).trim().toUpperCase()
  if (s === 'M' || s === 'MASCULINO' || s === 'VARON' || s === 'VARÓN') return 'M'
  if (s === 'F' || s === 'FEMENINO' || s === 'MUJER') return 'F'
  if (s === 'X' || s === 'NO BINARIO') return 'X'
  return ''
}

interface Props {
  open: boolean
  onClose: () => void
  cicloId: string
}

export function AlumnoImportDialog({ open, onClose, cicloId }: Props) {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ParsedAlumno[]>([])
  const [fileName, setFileName] = useState('')
  const [mappedCols, setMappedCols] = useState<string[]>([])
  const [cursoId, setCursoId] = useState('')

  const { data: cursos = [] } = useQuery({
    queryKey: ['cursos', cicloId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cursos')
        .select('id, nombre, division')
        .eq('ciclo_id', cicloId)
        .order('nombre')
      if (error) throw error
      return data as { id: string; nombre: string; division: string | null }[]
    },
    enabled: !!cicloId,
  })

  const validRows = rows.filter((r) => r.valid)
  const invalidRows = rows.filter((r) => !r.valid)

  const importMutation = useMutation({
    mutationFn: async () => {
      const CHUNK = 50
      let inserted = 0

      for (let i = 0; i < validRows.length; i += CHUNK) {
        const chunk = validRows.slice(i, i + CHUNK)

        const personasToInsert = chunk.map((r) => ({
          apellido: r.apellido,
          nombre: r.nombre,
          dni: r.dni || null,
          fecha_nac: r.fecha_nac || null,
          sexo: r.sexo || null,
          tipo: 'alumno' as const,
        }))

        const { data: personas, error: pError } = await supabase
          .from('personas')
          .insert(personasToInsert)
          .select('id')
        if (pError) throw pError

        const alumnosDatos = personas.map((p) => ({
          persona_id: p.id,
          ciclo_id: cicloId,
          curso_id: cursoId || null,
          estado: 'activo',
        }))

        const { error: adError } = await supabase.from('alumno_datos').insert(alumnosDatos)
        if (adError) throw adError

        inserted += chunk.length
      }
      return inserted
    },
    onSuccess: (count) => {
      toast.success(`${count} alumnos importados correctamente`)
      queryClient.invalidateQueries({ queryKey: ['alumnos'] })
      handleClose()
    },
    onError: (e) => {
      const msg = e.message
      if (msg.includes('duplicate key') || msg.includes('unique')) {
        toast.error('Algunos alumnos ya existen (DNI duplicado). Revisá el archivo.')
      } else {
        toast.error('Error al importar: ' + msg)
      }
    },
  })

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)

    const isCSV = file.name.toLowerCase().endsWith('.csv')
    const reader = new FileReader()
    reader.onload = (ev) => {
      let workbook
      if (isCSV) {
        workbook = read(ev.target!.result as string, { type: 'string' })
      } else {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer)
        workbook = read(data, { type: 'array' })
      }
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const json = utils.sheet_to_json<Record<string, unknown>>(sheet)

      if (json.length === 0) {
        toast.error('El archivo está vacío')
        return
      }

      const headers = Object.keys(json[0])
      const colMap: Record<string, AlumnoField> = {}
      const mapped: string[] = []

      for (const h of headers) {
        const norm = normalizeHeader(h)
        const field = COLUMN_MAP[norm]
        if (field) {
          colMap[h] = field
          mapped.push(`${h} → ${field}`)
        }
      }

      setMappedCols(mapped)

      const parsed: ParsedAlumno[] = json.map((row) => {
        const alumno: ParsedAlumno = {
          apellido: '',
          nombre: '',
          dni: '',
          fecha_nac: '',
          sexo: '',
          valid: true,
        }

        for (const [header, field] of Object.entries(colMap)) {
          const val = row[header]
          if (field === 'fecha_nac') {
            alumno.fecha_nac = parseDate(val)
          } else if (field === 'sexo') {
            alumno.sexo = parseSexo(val)
          } else {
            alumno[field] = String(val ?? '').trim()
          }
        }

        if (!alumno.apellido || !alumno.nombre) {
          alumno.valid = false
          alumno.error = 'Faltan apellido o nombre'
        } else if (hasMojibake(alumno.apellido) || hasMojibake(alumno.nombre)) {
          alumno.valid = false
          alumno.error = 'Posible error de codificación (tildes/ñ rotas) — guardá el archivo como UTF-8'
        }

        return alumno
      })

      setRows(parsed)
    }
    if (isCSV) {
      reader.readAsText(file, 'UTF-8')
    } else {
      reader.readAsArrayBuffer(file)
    }
  }

  function handleClose() {
    setRows([])
    setFileName('')
    setMappedCols([])
    setCursoId('')
    if (fileRef.current) fileRef.current.value = ''
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Carga masiva de alumnos</DialogTitle>
      <DialogContent>
        {rows.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFile}
              style={{ display: 'none' }}
            />
            <Button
              variant="outlined"
              size="large"
              startIcon={<CloudUpload />}
              onClick={() => fileRef.current?.click()}
              sx={{ mb: 3 }}
            >
              Seleccionar archivo Excel o CSV
            </Button>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              El archivo debe tener columnas con estos nombres (no importan mayúsculas ni tildes):
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Chip label="Apellido" color="primary" size="small" />
              <Chip label="Nombre" color="primary" size="small" />
              <Chip label="DNI" size="small" variant="outlined" />
              <Chip label="Fecha de Nacimiento" size="small" variant="outlined" />
              <Chip label="Sexo" size="small" variant="outlined" />
            </Box>
            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 2 }}>
              Apellido y Nombre son obligatorios. El resto es opcional.
            </Typography>
          </Box>
        ) : (
          <>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Archivo: <strong>{fileName}</strong>
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                {mappedCols.map((c) => (
                  <Chip key={c} label={c} size="small" color="success" variant="outlined" />
                ))}
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Chip
                  icon={<CheckCircle />}
                  label={`${validRows.length} válidos`}
                  color="success"
                  size="small"
                />
                {invalidRows.length > 0 && (
                  <Chip
                    icon={<ErrorIcon />}
                    label={`${invalidRows.length} con errores`}
                    color="error"
                    size="small"
                  />
                )}
              </Box>
            </Box>

            <TextField
              select
              label="Asignar curso (opcional)"
              value={cursoId}
              onChange={(e) => setCursoId(e.target.value)}
              sx={{ mb: 2 }}
              fullWidth
              helperText="Todos los alumnos importados se asignarán a este curso"
            >
              <MenuItem value="">Sin asignar</MenuItem>
              {cursos.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.nombre}{c.division ? ` ${c.division}` : ''}
                </MenuItem>
              ))}
            </TextField>

            {invalidRows.length > 0 && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Las filas con errores no se importarán.
              </Alert>
            )}

            <TableContainer sx={{ maxHeight: 350 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Apellido</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Nombre</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>DNI</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Fecha Nac.</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Sexo</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Estado</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.slice(0, 100).map((r, i) => (
                    <TableRow key={i} sx={{ opacity: r.valid ? 1 : 0.5, bgcolor: r.valid ? 'inherit' : 'error.light' }}>
                      <TableCell>{r.apellido}</TableCell>
                      <TableCell>{r.nombre}</TableCell>
                      <TableCell>{r.dni}</TableCell>
                      <TableCell>{r.fecha_nac}</TableCell>
                      <TableCell>{r.sexo}</TableCell>
                      <TableCell>
                        {r.valid ? (
                          <CheckCircle color="success" sx={{ fontSize: 18 }} />
                        ) : (
                          <Typography variant="caption" color="error">{r.error}</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {rows.length > 100 && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Mostrando las primeras 100 de {rows.length} filas
              </Typography>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose}>Cancelar</Button>
        {rows.length > 0 && (
          <>
            <Button onClick={() => { setRows([]); setFileName(''); if (fileRef.current) fileRef.current.value = '' }}>
              Cambiar archivo
            </Button>
            <Button
              variant="contained"
              disabled={validRows.length === 0 || importMutation.isPending}
              startIcon={importMutation.isPending ? <CircularProgress size={18} /> : <CloudUpload />}
              onClick={() => importMutation.mutate()}
            >
              {importMutation.isPending ? 'Importando…' : `Importar ${validRows.length} alumnos`}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}
