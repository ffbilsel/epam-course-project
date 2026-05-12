import { RegisterForm } from "@/components/forms/register-form";

/**
 * Public self-registration page.
 */
export default function RegisterPage(): JSX.Element {
  return (
    <main className="mx-auto max-w-sm px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Create your account</h1>
      <RegisterForm />
    </main>
  );
}
