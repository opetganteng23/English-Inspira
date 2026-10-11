import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { splitName } from "@/lib/person-name";
import { ConsentForm } from "./ConsentForm";

export const metadata = { title: "Data Consent | English Inspira" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const u = await getCurrentUser();
  if (!u) redirect("/sign-in");
  if (u.status !== "invited") redirect("/");
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col gap-6 p-4 sm:p-8">
      <Logo />
      <ConsentForm email={u.email} initialGivenName={u.givenName ?? splitName(u.name).givenName} initialSurname={u.surname ?? splitName(u.name).surname} initialPhone={u.phone ?? ""} />
    </main>
  );
}
