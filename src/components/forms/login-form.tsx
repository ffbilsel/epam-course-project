"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoginSchema, type LoginInput } from "@/lib/validation/auth";
import { errorMessages } from "@/lib/errors/error-messages";

interface Props {
  callbackUrl: string;
  initialError: string | null;
}

/**
 * Email + password sign-in form (Credentials provider).
 */
export function LoginForm({ callbackUrl, initialError }: Props): JSX.Element {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(
    initialError ? errorMessages.AUTH_INVALID_CREDENTIALS : null,
  );
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(LoginSchema) });

  async function onSubmit(values: LoginInput): Promise<void> {
    setSubmitting(true);
    setErr(null);
    const res = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
      callbackUrl,
    });
    setSubmitting(false);
    if (!res || res.error) {
      setErr(errorMessages.AUTH_INVALID_CREDENTIALS);
      return;
    }
    router.push(res.url ?? callbackUrl);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          {...register("email")}
          aria-invalid={!!errors.email}
        />
        {errors.email && <p className="text-sm text-destructive">Enter a valid email.</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register("password")}
        />
      </div>
      {err && (
        <p className="text-sm text-destructive" role="alert">
          {err}
        </p>
      )}
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
