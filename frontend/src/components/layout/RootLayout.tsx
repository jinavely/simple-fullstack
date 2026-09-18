import { Link, Outlet } from 'react-router'

export function RootLayout() {
  return (
    <div className="mx-auto flex min-h-svh max-w-3xl flex-col">
      <nav className="flex gap-4 border-b p-4">
        <Link to="/" className="text-sm font-medium hover:underline">
          Home
        </Link>
        <Link to="/about" className="text-sm font-medium hover:underline">
          About
        </Link>
      </nav>
      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  )
}
