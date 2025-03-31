import Link from "next/link";
import { auth, signOut } from "@/lib/auth";

export async function AuthNav() {
  const session = await auth();

  return (
    <div className="flex items-center gap-4">
      {session?.user ? (
        <>
          <Link href="/profile" className="text-sm font-medium hover:underline">
            Profile
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut();
            }}
          >
            <button
              type="submit"
              className="rounded-md bg-gray-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
            >
              Sign Out
            </button>
          </form>
        </>
      ) : (
        <>
          <Link href="/login" className="text-sm font-medium hover:underline">
            Sign In
          </Link>
          <Link
            href="/register"
            className="rounded-md bg-gray-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
          >
            Sign Up
          </Link>
        </>
      )}
    </div>
  );
}
