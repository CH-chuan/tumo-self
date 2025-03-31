import { SetupForm } from "@/components/auth/setup-form";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Setup Admin | TUMO",
  description: "Set up the first admin user for TUMO",
};

export default function SetupPage() {
  return <SetupForm />;
}
