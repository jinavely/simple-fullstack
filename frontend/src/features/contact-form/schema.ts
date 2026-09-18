import { z } from 'zod'

export const contactFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.email('Invalid email address'),
})
export type ContactFormValues = z.infer<typeof contactFormSchema>
