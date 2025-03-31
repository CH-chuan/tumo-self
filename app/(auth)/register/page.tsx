import { RegisterForm } from "@/components/auth/register-form";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Register | TUMO",
  description: "Create a new TUMO account",
};

export default function RegisterPage() {
  return <RegisterForm />;
}
