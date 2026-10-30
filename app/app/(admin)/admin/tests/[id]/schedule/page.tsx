import { redirect } from "next/navigation";

// Jadwal kini tab di halaman tes; alamat lama tetap berfungsi.
export default function OldSchedule({ params }: { params: { id: string } }) {
  redirect(`/admin/tests/${params.id}?tab=schedule`);
}
