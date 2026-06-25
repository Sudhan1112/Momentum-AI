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

    // Resolve the whole scoped package namespace from the hoisted root copy.
    // This avoids resolution failures when a workspace-local `@tiptap` folder exists
    // without every nested package being materialized under `apps/web/node_modules`.
    config.resolve.alias['@tiptap'] = path.resolve(root, '@tiptap')

    // Force ALL tiptap package references to resolve to the same root copy
    // This prevents "duplicate @tiptap/core" issues causing canInsertNode errors
    const tiptapPackages = [
      '@tiptap/core',
      '@tiptap/pm',
      '@tiptap/react',
      '@tiptap/starter-kit',
      '@tiptap/y-tiptap',
      '@tiptap/extension-collaboration',
      '@tiptap/extension-collaboration-cursor',
      '@tiptap/extension-text-style',
    ]

    tiptapPackages.forEach((pkg) => {
      config.resolve.alias[pkg] = path.resolve(root, pkg)
    })

    return config
  },
}

export default nextConfig
