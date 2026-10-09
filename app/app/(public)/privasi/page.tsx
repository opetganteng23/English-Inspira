import { Legal } from "@/components/Legal";
import { publicInfo } from "@/lib/public-info";

export const metadata = { title: "Privacy Policy | English Inspira" };
export const dynamic = "force-dynamic";

export default async function Privasi() {
  const info = await publicInfo();
  return (
    <Legal title="Privacy Policy">
      <h2>Data we collect</h2>
      <p>Email, name, phone number, institution, level and scores, test history and answers, learning activity, conversations with the AI Counselor, and coaching session notes. For official ITP test registration: national ID/passport number, date of birth, gender, ID card/passport photo, and a passport photo.</p>
      <h2>Purpose of use</h2>
      <p>Running the test and analysis services, giving study advice, setting your level and coaching quota, reporting group results to your institution, registering official tests, and sending service notifications by email.</p>
      <h2>Protection of sensitive data</h2>
      <p>National ID numbers are encrypted in the database. Identity photos can only be opened by the owner and authorized admins, and every admin access is recorded. We do not record your camera or microphone during tests; we only record activity such as switching tabs.</p>
      <h2>Third parties</h2>
      <p>Questions to the AI Counselor are processed by an AI model provider; the data sent is limited to the context needed to answer. Official identity data (national ID, photos) is never sent to the AI provider.</p>
      <h2>Retensi</h2>
      <p>Identity documents are kept for at most {info.idRetentionDays} days after the related test is finished, unless the law requires otherwise.</p>
      <h2>Your rights</h2>
      <p>You can download all your personal data and request data deletion from the Profile menu. The admin processes requests through a recorded procedure.</p>
    </Legal>
  );
}
