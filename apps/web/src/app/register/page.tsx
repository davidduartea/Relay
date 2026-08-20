import type { Metadata } from "next";

import { AuthForm } from "@/modules/auth/auth-form";

export const metadata: Metadata = { title: "Crear cuenta · Relay" };

export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
