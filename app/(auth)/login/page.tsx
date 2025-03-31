import { LoginForm } from "@/components/auth/login-form";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login | TUMO",
  description: "Login to your TUMO account",
};

export default function LoginPage() {
  return <LoginForm />;
}
