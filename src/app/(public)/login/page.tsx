import { LoginForm } from "@/components/forms/login-form";

interface PageProps {
  searchParams: { callbackUrl?: string; error?: string };
}

/**
 * Public login page.
 */
export default function LoginPage({ searchParams }: PageProps): JSX.Element {
  return (
    <main className="mx-auto max-w-sm px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Sign in to InnovatEPAM</h1>
      <LoginForm
        callbackUrl={searchParams.callbackUrl ?? "/"}
        initialError={searchParams.error ?? null}
      />
      <p className="mt-4 text-sm text-muted-foreground">
        New here?{" "}
        <a href="/register" className="underline">
          Create an account
        </a>
      </p>
    </main>
  );
}
