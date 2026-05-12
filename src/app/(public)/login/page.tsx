import Link from "next/link";
import { LoginForm } from "@/components/forms/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface PageProps {
  searchParams: { callbackUrl?: string; error?: string };
}

/**
 * Public login page.
 */
export default function LoginPage({ searchParams }: PageProps): JSX.Element {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2">
          <span
            aria-hidden="true"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-base font-bold text-white shadow"
          >
            i
          </span>
          <span className="text-lg font-semibold tracking-tight">InnovatEPAM</span>
        </Link>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Welcome back</CardTitle>
            <CardDescription>Sign in to InnovatEPAM to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm
              callbackUrl={searchParams.callbackUrl ?? "/"}
              initialError={searchParams.error ?? null}
            />
            <p className="mt-4 text-center text-sm text-muted-foreground">
              New here?{" "}
              <Link href="/register" className="font-medium text-primary hover:underline">
                Create an account
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
