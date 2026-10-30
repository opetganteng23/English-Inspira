// Menu admin yang menampung beberapa halaman sebagai tab. Peran dibatasi seperti menu (lihat ALLOWED di layout admin).
export const ADMIN_SECTIONS = {
  content: [{ href: "/admin/question-bank", label: "Questions" }, { href: "/admin/audio", label: "Audio" }, { href: "/admin/media", label: "Images & media" }],
  settings: [{ href: "/admin/settings", label: "General & features" }, { href: "/admin/parameters", label: "Rules & parameters" }, { href: "/admin/scoring", label: "Scoring profiles" }],
  people: [{ href: "/admin/participants", label: "Participants" }, { href: "/admin/users", label: "Coaches & admins" }],
};
export const ROLE_PAGES: Record<string, string[]> = {
  academic_admin: ["/admin", "/admin/participants", "/admin/external-results", "/admin/classes", "/admin/question-bank", "/admin/audio", "/admin/media", "/admin/tests", "/admin/courses", "/admin/materials", "/admin/scoring", "/admin/data-quality"],
  content_editor: ["/admin/question-bank", "/admin/audio", "/admin/media"],
};
