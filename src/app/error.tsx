"use client";

/**
 * Global error boundary rendered when a route segment throws.
 */
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main className="container mx-auto flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="text-muted-foreground">{error.message || "Unexpected error"}</p>
          <button
            type="button"
            onClick={reset}
            className="rounded-md border px-4 py-2 hover:bg-accent"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
