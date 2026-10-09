const prod = process.env.NODE_ENV === "production";

// CSP sengaja longgar pada script/frame agar popup Midtrans Snap dan embed YouTube tetap berfungsi;
// yang dikunci: pembingkaian halaman ini, <object>, base URI. Pengetatan lanjutan ada di TODO.
const csp = ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'"].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Paket server-only yang tidak boleh di-bundle webpack.
  experimental: {
    // Font bawaan pdfkit dibaca lewat fs saat runtime.
    outputFileTracingIncludes: { "/api/**/*": ["./node_modules/pdfkit/js/data/**/*"] },
    serverComponentsExternalPackages: ["mongodb-memory-server", "mongoose", "pdfkit", "exceljs", "qrcode", "music-metadata", "pdf-parse"],
  },
  async headers() {
    return [{
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
