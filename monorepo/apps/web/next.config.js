/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@file-manager/ui', '@file-manager/types', '@file-manager/config'],
};

module.exports = nextConfig; 