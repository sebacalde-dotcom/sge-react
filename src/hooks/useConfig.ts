import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useConfig<T = Record<string, unknown>>(key: string) {
  return useQuery({
    queryKey: ['config', key],
    queryFn: async (): Promise<T> => {
      const { data, error } = await supabase
        .from('config')
        .select('value')
        .eq('key', key)
        .single()
      if (error) throw error
      return (data?.value ?? {}) as T
    },
  })
}

export function useConfigMutation(key: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (value: Record<string, unknown>) => {
      const { error } = await supabase
        .from('config')
        .upsert({ key, value })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config', key] })
    },
  })
}
