const prod = process.env.NODE_ENV === "production";

// CSP sengaja longgar pada script/frame agar popup Midtrans Snap dan embed YouTube tetap berfungsi;
// yang dikunci: pembingkaian halaman ini, <object>, base URI. Pengetatan lanjutan ada di TODO.
const csp = ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'"].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Paket server-only yang tidak boleh di-bundle webpack.
  experimental: {
    // Wajib di Next 14 agar instrumentation.ts (penjadwal dalam-proses untuk PM2) dijalankan.
    instrumentationHook: true,
    // Font bawaan pdfkit dibaca lewat fs saat runtime.
    outputFileTracingIncludes: { "/api/**/*": ["./node_modules/pdfkit/js/data/**/*"] },
    serverComponentsExternalPackages: ["mongodb-memory-server", "mongoose", "pdfkit", "exceljs", "qrcode", "music-metadata", "pdf-parse", "node-cron", "mongodb-memory-server-core"],
  },
  // URL lama berbahasa Indonesia (tautan di email/notifikasi lama) dialihkan permanen ke URL bahasa Inggris.
  async redirects() {
    return [
      {source: "/admin/materi/baru", destination: "/admin/materials/new", permanent: true},
      {source: "/tes/persiapan", destination: "/tests/prepare", permanent: true},
      {source: "/tes/persiapan/:path*", destination: "/tests/prepare/:path*", permanent: true},
      {source: "/admin/bank-soal", destination: "/admin/question-bank", permanent: true},
      {source: "/admin/bank-soal/:path*", destination: "/admin/question-bank/:path*", permanent: true},
      {source: "/admin/institusi", destination: "/admin/institutions", permanent: true},
      {source: "/admin/institusi/:path*", destination: "/admin/institutions/:path*", permanent: true},
      {source: "/admin/jadwal-itp", destination: "/admin/itp-schedule", permanent: true},
      {source: "/admin/jadwal-itp/:path*", destination: "/admin/itp-schedule/:path*", permanent: true},
      {source: "/admin/konselor-ai", destination: "/admin/ai-counselor", permanent: true},
      {source: "/admin/konselor-ai/:path*", destination: "/admin/ai-counselor/:path*", permanent: true},
      {source: "/admin/kursus", destination: "/admin/courses", permanent: true},
      {source: "/admin/kursus/:path*", destination: "/admin/courses/:path*", permanent: true},
      {source: "/admin/materi", destination: "/admin/materials", permanent: true},
      {source: "/admin/materi/:path*", destination: "/admin/materials/:path*", permanent: true},
      {source: "/admin/parameter", destination: "/admin/parameters", permanent: true},
      {source: "/admin/parameter/:path*", destination: "/admin/parameters/:path*", permanent: true},
      {source: "/admin/pengaturan", destination: "/admin/settings", permanent: true},
      {source: "/admin/pengaturan/:path*", destination: "/admin/settings/:path*", permanent: true},
      {source: "/admin/pengguna", destination: "/admin/users", permanent: true},
      {source: "/admin/pengguna/:path*", destination: "/admin/users/:path*", permanent: true},
      {source: "/admin/peserta", destination: "/admin/participants", permanent: true},
      {source: "/admin/peserta/:path*", destination: "/admin/participants/:path*", permanent: true},
      {source: "/admin/tes", destination: "/admin/tests", permanent: true},
      {source: "/admin/tes/:path*", destination: "/admin/tests/:path*", permanent: true},
      {source: "/coach/jadwal", destination: "/coach/schedule", permanent: true},
      {source: "/coach/jadwal/:path*", destination: "/coach/schedule/:path*", permanent: true},
      {source: "/coach/konselor", destination: "/coach/counselor", permanent: true},
      {source: "/coach/konselor/:path*", destination: "/coach/counselor/:path*", permanent: true},
      {source: "/coach/materi", destination: "/coach/materials", permanent: true},
      {source: "/coach/materi/:path*", destination: "/coach/materials/:path*", permanent: true},
      {source: "/coach/peserta", destination: "/coach/participants", permanent: true},
      {source: "/coach/peserta/:path*", destination: "/coach/participants/:path*", permanent: true},
      {source: "/coach/sesi", destination: "/coach/sessions", permanent: true},
      {source: "/coach/sesi/:path*", destination: "/coach/sessions/:path*", permanent: true},
      {source: "/institusi/jadwal", destination: "/institution/schedule", permanent: true},
      {source: "/institusi/jadwal/:path*", destination: "/institution/schedule/:path*", permanent: true},
      {source: "/institusi/laporan", destination: "/institution/reports", permanent: true},
      {source: "/institusi/laporan/:path*", destination: "/institution/reports/:path*", permanent: true},
      {source: "/institusi/materi", destination: "/institution/materials", permanent: true},
      {source: "/institusi/materi/:path*", destination: "/institution/materials/:path*", permanent: true},
      {source: "/institusi/peserta", destination: "/institution/participants", permanent: true},
      {source: "/institusi/peserta/:path*", destination: "/institution/participants/:path*", permanent: true},
      {source: "/institusi", destination: "/institution", permanent: true},
      {source: "/institusi/:path*", destination: "/institution/:path*", permanent: true},
      {source: "/bantuan", destination: "/help", permanent: true},
      {source: "/bantuan/:path*", destination: "/help/:path*", permanent: true},
      {source: "/belajar", destination: "/learn", permanent: true},
      {source: "/belajar/:path*", destination: "/learn/:path*", permanent: true},
      {source: "/beranda", destination: "/home", permanent: true},
      {source: "/beranda/:path*", destination: "/home/:path*", permanent: true},
      {source: "/hasil", destination: "/results", permanent: true},
      {source: "/hasil/:path*", destination: "/results/:path*", permanent: true},
      {source: "/konselor", destination: "/counselor", permanent: true},
      {source: "/konselor/:path*", destination: "/counselor/:path*", permanent: true},
      {source: "/materi", destination: "/materials", permanent: true},
      {source: "/materi/:path*", destination: "/materials/:path*", permanent: true},
      {source: "/profil", destination: "/profile", permanent: true},
      {source: "/profil/:path*", destination: "/profile/:path*", permanent: true},
      {source: "/sertifikat", destination: "/certificates", permanent: true},
      {source: "/sertifikat/:path*", destination: "/certificates/:path*", permanent: true},
      {source: "/tes", destination: "/tests", permanent: true},
      {source: "/tes/:path*", destination: "/tests/:path*", permanent: true},
      {source: "/unggah-hasil", destination: "/upload-result", permanent: true},
      {source: "/unggah-hasil/:path*", destination: "/upload-result/:path*", permanent: true},
      {source: "/masuk", destination: "/sign-in", permanent: true},
      {source: "/masuk/:path*", destination: "/sign-in/:path*", permanent: true},
      {source: "/persetujuan", destination: "/consent", permanent: true},
      {source: "/persetujuan/:path*", destination: "/consent/:path*", permanent: true},
      {source: "/privasi", destination: "/privacy", permanent: true},
      {source: "/privasi/:path*", destination: "/privacy/:path*", permanent: true},
      {source: "/syarat", destination: "/terms", permanent: true},
      {source: "/syarat/:path*", destination: "/terms/:path*", permanent: true},
      {source: "/verifikasi", destination: "/verify", permanent: true},
      {source: "/verifikasi/:path*", destination: "/verify/:path*", permanent: true},
      {source: "/ruang-tes", destination: "/test-room", permanent: true},
      {source: "/ruang-tes/:path*", destination: "/test-room/:path*", permanent: true},
    ];
  },
  async headers() {
    return [
      // Font untuk iframe materi (origin buram) wajib CORS terbuka.
      { source: "/fonts/:file*", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }, { key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      {
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: csp },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
        ...(prod ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
      ],
    }];
  },
};

export default nextConfig;
