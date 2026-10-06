/** @type {import('next').NextConfig} */
const nextConfig = {
  // Paket server-only yang tidak boleh di-bundle webpack.
  experimental: { serverComponentsExternalPackages: ["mongodb-memory-server", "mongoose", "pdfkit", "exceljs", "qrcode", "midtrans-client", "music-metadata"] },
};

export default nextConfig;
