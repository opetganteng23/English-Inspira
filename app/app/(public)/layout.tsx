// Halaman publik selalu bertema terang (warna merek tetap), terlepas dari preferensi mode gelap.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="theme-light min-h-screen">{children}</div>;
}
