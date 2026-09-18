import { Button } from '@/components/ui/button'
import { useCounterStore } from '@/store/useCounterStore'
import { ExampleList } from '@/features/example/ExampleList'
import { ContactForm } from '@/features/contact-form/ContactForm'

export function HomePage() {
  const { count, increment, decrement } = useCounterStore()

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Frontend Stack Playground</h1>

      <section className="flex items-center gap-3">
        <Button variant="outline" onClick={decrement}>
          -
        </Button>
        <span className="min-w-8 text-center text-sm font-medium">{count}</span>
        <Button variant="outline" onClick={increment}>
          +
        </Button>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Examples</h2>
        <ExampleList />
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Contact</h2>
        <ContactForm />
      </section>
    </div>
  )
}
