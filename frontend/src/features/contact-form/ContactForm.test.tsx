import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ContactForm } from './ContactForm'

describe('ContactForm', () => {
  it('shows validation errors when submitted empty', async () => {
    const user = userEvent.setup()
    render(<ContactForm />)

    await user.click(screen.getByRole('button', { name: /submit/i }))

    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(screen.getByText('Invalid email address')).toBeInTheDocument()
  })
})
