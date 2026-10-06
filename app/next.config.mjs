/** @type {import('next').NextConfig} */
const nextConfig = {
  // Paket server-only yang tidak boleh di-bundle webpack.
  experimental: { serverComponentsExternalPackages: ["mongodb-memory-server", "mongoose"] },
};

export default nextConfig;
