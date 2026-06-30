import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')
const projectName = path.basename(projectRoot)
const root = path.resolve(__dirname, '../../node_modules')
const externalDistDir = path.relative(__dirname, path.join(os.tmpdir(), `${projectName}-next-web`))
// Keep Next build artifacts outside OneDrive on local Windows.
// The temp path is repo-specific to avoid stale artifacts from other projects.
const useExternalDistDir =
  process.platform === 'win32' && !process.env.VERCEL && process.env.GUVI_EXTERNAL_NEXT_DISTDIR !== '0'
const useMemoryWebpackCache = process.platform === 'win32' && !process.env.VERCEL

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep Next build artifacts outside the OneDrive workspace locally on Windows,
  // but let Vercel use the default `.next` directory so deployment can find its manifests.
  ...(useExternalDistDir ? { distDir: externalDistDir } : {}),
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config) => {
    // Preserve Next's defaults, but also allow resolving from the hoisted root install.
    config.resolve.modules = Array.from(
      new Set([
        ...(config.resolve.modules ?? []),
        path.resolve(__dirname, 'node_modules'),
        root,
      ])
    )

    // Windows local dev can fail to atomically rename webpack cache files in Temp/OneDrive-adjacent setups,
    // which leads to stale chunks and intermittent ChunkLoadError in the browser.
    if (useMemoryWebpackCache && process.env.NODE_ENV === 'development') {
      config.cache = { type: 'memory' }
    }

    return config
  },
}

export default nextConfig
