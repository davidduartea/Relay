import type { Metadata } from "next";

import { AuthForm } from "@/modules/auth/auth-form";

export const metadata: Metadata = { title: "Entrar · Relay" };

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
