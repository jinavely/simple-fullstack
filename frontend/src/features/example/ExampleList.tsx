import { useExamplesQuery } from './queries'

export function ExampleList() {
  const { data, isPending, isError } = useExamplesQuery()

  if (isPending) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (isError) return <p className="text-sm text-destructive">Failed to load examples.</p>

  return (
    <ul className="flex flex-col gap-2">
      {data.map((item) => (
        <li key={item.id} className="rounded-md border p-3 text-sm">
          {item.title}
        </li>
      ))}
    </ul>
  )
}
