'use client'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="font-bold text-4xl">Something went wrong</h1>
      <p className="mt-2 text-gray-500">{error.message}</p>
      <button
        className="mt-4 rounded-md bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-800"
        onClick={reset}
        type="button"
      >
        Try again
      </button>
    </main>
  )
}
