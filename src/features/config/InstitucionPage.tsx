import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { useConfig, useConfigMutation } from '@/hooks/useConfig'
import { PhotoUpload } from '@/components/shared/PhotoUpload'

// La forma de los datos institucionales que guardamos en config
interface InstitucionData {
  nombre: string
  cuit: string
  telefono: string
  direccion: string
  email: string
  logoUrl: string | null
  darkMode?: boolean
}

const VACIO: InstitucionData = {
  nombre: '',
  cuit: '',
  telefono: '',
  direccion: '',
  email: '',
  logoUrl: null,
}

export function InstitucionPage() {
  const { data, isLoading } = useConfig<InstitucionData>('institucional')
  const mutation = useConfigMutation('institucional')

  const { register, handleSubmit, reset } = useForm<InstitucionData>({ defaultValues: VACIO })
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  // Cuando llegan los datos de Supabase, llenamos el formulario
  useEffect(() => {
    if (data) {
      reset({ ...VACIO, ...data })
      setLogoUrl(data.logoUrl ?? null)
    }
  }, [data, reset])

  async function onSubmit(values: InstitucionData) {
    try {
      await mutation.mutateAsync({
        ...data,           // conserva otras claves (ej. darkMode)
        ...values,
        logoUrl,
      })
      toast.success('Datos de la institución guardados')
    } catch (e) {
      toast.error('Error al guardar: ' + (e as Error).message)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64" style={{ color: 'var(--text-tertiary)' }}>
        <div className="animate-spin w-6 h-6 border-2 border-current border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold m-0" style={{ color: 'var(--text-primary)' }}>Institución</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
          Datos generales de la institución y logo.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div
          className="rounded-xl p-6 flex gap-8"
          style={{ background: 'var(--surface-base)', border: '1px solid var(--border-default)' }}
        >
          {/* Logo */}
          <div className="flex flex-col items-center gap-2 flex-shrink-0">
            <PhotoUpload
              bucket="logos"
              currentUrl={logoUrl}
              onUploaded={setLogoUrl}
              shape="square"
              size={120}
              placeholder="image"
            />
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Logo</span>
          </div>

          {/* Campos */}
          <div className="flex-1 grid grid-cols-2 gap-4">
            <Campo label="Nombre" full>
              <input className="sge-input" {...register('nombre')} placeholder="Nombre de la institución" />
            </Campo>
            <Campo label="CUIT">
              <input className="sge-input" {...register('cuit')} placeholder="30-12345678-9" />
            </Campo>
            <Campo label="Teléfono">
              <input className="sge-input" {...register('telefono')} placeholder="—" />
            </Campo>
            <Campo label="Email">
              <input className="sge-input" type="email" {...register('email')} placeholder="—" />
            </Campo>
            <Campo label="Dirección">
              <input className="sge-input" {...register('direccion')} placeholder="—" />
            </Campo>
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-5 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50"
            style={{ background: 'var(--color-primary)' }}
          >
            {mutation.isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  )
}

// Pequeño componente para etiquetar un campo del formulario
function Campo({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-tertiary)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}
