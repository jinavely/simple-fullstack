import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">404</h1>
      <p className="mt-2 text-sm text-muted-foreground">Page not found.</p>
      <Link to="/" className="mt-4 inline-block text-sm underline">
        Go home
      </Link>
    </div>
  )
}
