import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  transpilePackages: ['mapbox-gl'],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'react-map-gl/mapbox': path.resolve('./node_modules/react-map-gl/dist/mapbox.cjs'),
    }
    return config
  },
}

export default nextConfig
