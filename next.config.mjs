/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // recharts ships a mix of CJS/ESM; transpiling it avoids interop errors in the
  // App Router bundle.
  transpilePackages: ["recharts"],
};

export default nextConfig;
