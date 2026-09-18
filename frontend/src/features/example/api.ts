import { apiClient } from '@/lib/api-client'
import { exampleListSchema } from './schema'

export async function fetchExamples() {
  const { data } = await apiClient.get('/examples')
  return exampleListSchema.parse(data)
}
