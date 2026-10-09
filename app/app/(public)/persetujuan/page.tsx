import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { ConsentForm } from "./ConsentForm";

export const metadata = { title: "Data Consent | English Inspira" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const u = await getCurrentUser();
  if (!u) redirect("/masuk");
  if (u.status !== "invited") redirect("/");
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col gap-6 p-4 sm:p-8">
      <Logo />
      <ConsentForm email={u.email} initialName={u.name ?? ""} initialPhone={u.phone ?? ""} />
    </main>
  );
}
