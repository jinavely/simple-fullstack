import type { ReactElement } from 'react'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { ExampleList } from './ExampleList'

vi.mock('./api', () => ({
  fetchExamples: vi.fn().mockResolvedValue([
    { id: 1, title: 'First example' },
    { id: 2, title: 'Second example' },
  ]),
}))

function renderWithQueryClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('ExampleList', () => {
  it('renders the fetched examples', async () => {
    renderWithQueryClient(<ExampleList />)

    expect(await screen.findByText('First example')).toBeInTheDocument()
    expect(screen.getByText('Second example')).toBeInTheDocument()
  })
})
