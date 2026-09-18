import { z } from 'zod'

export const exampleItemSchema = z.object({
  id: z.number(),
  title: z.string(),
})
export type ExampleItem = z.infer<typeof exampleItemSchema>

export const exampleListSchema = z.array(exampleItemSchema)
