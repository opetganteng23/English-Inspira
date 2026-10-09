import { Legal } from "@/components/Legal";

export const metadata = { title: "Terms & Conditions | English Inspira" };
export const dynamic = "force-dynamic";

export default function Syarat() {
  return (
    <Legal title="Terms & Conditions">
      <h2>1. Layanan</h2>
      <p>English Inspira provides a placement test, TOEFL ITP format simulation tests and exercises, learning materials, AI-based result analysis, an AI Counselor, coaching sessions, and official TOEFL ITP test registration for participants of partner institutions. Simulation tests produce <b>estimated</b> scores, not official scores. Official scores and certificates are only issued by the official test organizer.</p>
      <h2>2. Account</h2>
      <p>You are responsible for the security of the email you use to sign in and for the accuracy of the data you enter. One account per person. Accounts are created through your institution’s invitation; there is no self-registration. The placement test is taken once.</p>
      <h2>3. Akses</h2>
      <p>Access is granted through your institution and is valid for the institution’s contract period. After that your account can no longer be used to sign in, while your data is kept according to the Privacy Policy. There are no payments on this platform.</p>
      <h2>4. Fair use</h2>
      <p>Sharing accounts, copying or distributing questions and audio, using automated tools, or cheating on tests is prohibited. Certain test activity (for example switching tabs) is recorded and may be reviewed by the admin.</p>
      <h2>5. Konselor AI</h2>
      <p>The AI Counselor gives study advice and can make mistakes. Advice does not guarantee scores, passing, or scholarships. Double-check the official requirements of your institution or scholarship before making important decisions.</p>
      <h2>6. Official ITP test registration</h2>
      <p>Your name and identity number must match the ID card/passport you bring on test day and cannot be changed after the registration is submitted. Rescheduling rules are announced by the admin.</p>
      <h2>7. Perubahan</h2>
      <p>These terms may be updated; material changes are announced by email or in the app.</p>
    </Legal>
  );
}
