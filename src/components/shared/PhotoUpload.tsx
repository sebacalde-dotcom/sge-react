import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface PhotoUploadProps {
  bucket: 'avatars' | 'logos'
  currentUrl: string | null
  onUploaded: (url: string) => void
  /** Shape of the preview */
  shape?: 'circle' | 'square'
  size?: number
  /** Ancho del recuadro si difiere del alto (por ejemplo, una firma) */
  width?: number
  /** 'contain' muestra la imagen completa sin recortarla */
  fit?: 'cover' | 'contain'
  placeholder?: string
}

export function PhotoUpload({
  bucket,
  currentUrl,
  onUploaded,
  shape = 'circle',
  size = 96,
  width,
  fit = 'cover',
  placeholder = 'add_a_photo',
}: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('El archivo debe ser una imagen')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no puede superar los 5 MB')
      return
    }

    setUploading(true)
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${crypto.randomUUID()}.${ext}`

    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })

    if (error) {
      toast.error('Error al subir la imagen: ' + error.message)
      setUploading(false)
      return
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    onUploaded(data.publicUrl)
    setUploading(false)
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="relative overflow-hidden cursor-pointer border-2 border-dashed flex items-center justify-center transition-colors bg-transparent"
        style={{
          width: width ?? size,
          height: size,
          borderRadius: shape === 'circle' ? '50%' : 'var(--radius-md)',
          borderColor: 'var(--border-strong)',
          color: 'var(--text-tertiary)',
        }}
        title="Subir imagen"
      >
        {uploading ? (
          <div className="animate-spin w-6 h-6 border-2 border-current border-t-transparent rounded-full" />
        ) : currentUrl ? (
          <img
            src={currentUrl}
            className={`absolute inset-0 w-full h-full ${fit === 'contain' ? 'object-contain' : 'object-cover'}`}
            alt=""
          />
        ) : (
          <span className="material-symbols-outlined text-3xl">{placeholder}</span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}
