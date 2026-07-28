"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/forms/form-field";
import { isStrongPassword } from "@/utils/validation";

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [touched, setTouched] = useState(false);

  const passwordError =
    touched && password && !isStrongPassword(password)
      ? "Password must contain Capital, small letter, number and symbols"
      : undefined;

  const confirmError =
    touched && confirmPassword && confirmPassword !== password
      ? "Passwords do not match"
      : undefined;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    // TODO(backend-integration): call
    // auth.service.ts#resetPassword({ password, confirmPassword, token })
    // using the token read from the URL's search params.
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormField
        label="Enter new password"
        name="password"
        type="password"
        placeholder="enter password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={passwordError}
        autoComplete="new-password"
        required
      />
      <FormField
        label="Confirm password"
        name="confirmPassword"
        type="password"
        placeholder="confirm password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        error={confirmError}
        autoComplete="new-password"
        required
      />

      <Button type="submit" className="mt-3 w-full">
        Reset Password
      </Button>
    </form>
  );
}
