import { useQuery } from '@tanstack/react-query'
import { fetchExamples } from './api'

export function useExamplesQuery() {
  return useQuery({ queryKey: ['examples'], queryFn: fetchExamples })
}
