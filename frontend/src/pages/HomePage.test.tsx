import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { HomePage } from './HomePage'
import { ROUTES } from '@/routes/paths'

describe('HomePage', () => {
  it('renders links to the board and the write page', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: '게시판 보기' })).toHaveAttribute(
      'href',
      ROUTES.POSTS,
    )
    expect(screen.getByRole('link', { name: '글쓰기' })).toHaveAttribute(
      'href',
      ROUTES.POST_NEW,
    )
  })
})
