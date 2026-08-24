import type { Metadata } from "next";

import { AuthForm } from "@/modules/auth";

export const metadata: Metadata = { title: "Crear cuenta · Relay" };

export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
