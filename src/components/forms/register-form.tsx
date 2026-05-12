"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RegisterSchema, type RegisterInput } from "@/lib/validation/auth";
import { errorMessages } from "@/lib/errors/error-messages";
import type { ErrorCode } from "@/lib/errors/codes";

/**
 * Self-registration form. Calls `/api/auth/register` then signs the
 * user in via the Credentials provider on success.
 */
export function RegisterForm(): JSX.Element {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(RegisterSchema) });

  async function onSubmit(values: RegisterInput): Promise<void> {
    setSubmitting(true);
    setErr(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = (await res.json()) as { error?: { code?: ErrorCode; message?: string } };
      setErr(body.error?.message ?? "Registration failed");
      setSubmitting(false);
      return;
    }
    const signed = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });
    setSubmitting(false);
    if (!signed || signed.error) {
      router.push("/login");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="displayName">Display name</Label>
        <Input
          id="displayName"
          autoComplete="name"
          {...register("displayName")}
          aria-invalid={!!errors.displayName}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          {...register("email")}
          aria-invalid={!!errors.email}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          {...register("password")}
          aria-invalid={!!errors.password}
        />
        <p className="text-xs text-muted-foreground">{errorMessages.USER_PASSWORD_POLICY}</p>
      </div>
      {err && (
        <p className="text-sm text-destructive" role="alert">
          {err}
        </p>
      )}
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Creating…" : "Create account"}
      </Button>
    </form>
  );
}
