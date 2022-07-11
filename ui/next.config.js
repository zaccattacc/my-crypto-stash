/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    BASE_URL: process.env.BASE_URL,
  },
  webpack: function (config, { buildId, dev, isServer, defaultLoaders, webpack }){
    if (!isServer) {
      config.resolve.fallback.fs = false;
    }

        config.resolve.fallback = {
            fs: false,
            stream: false,
            crypto: false,
            os: false,
            readline: false,
            ejs: false,
            assert: require.resolve("assert"),
            path: false
        }

        return config;
},
};

module.exports = nextConfig;