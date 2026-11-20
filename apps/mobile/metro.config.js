const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Redirect stale expo/AppEntry bundle requests to expo-router/entry
const originalRewriteUrl = config.server.rewriteRequestUrl;
config.server.rewriteRequestUrl = (url) => {
  if (url.includes('/node_modules/expo/AppEntry')) {
    url = url.replace('/node_modules/expo/AppEntry', '/node_modules/expo-router/entry');
  }
  return originalRewriteUrl ? originalRewriteUrl(url) : url;
};

// Force react / react-dom to always resolve from mobile (React 19), not root (React 18, used by Next.js apps)
const FORCE_LOCAL = ['react', 'react-dom'];
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (FORCE_LOCAL.some(m => moduleName === m || moduleName.startsWith(m + '/'))) {
    try {
      const filePath = require.resolve(moduleName, { paths: [projectRoot] });
      return { filePath, type: 'sourceFile' };
    } catch {
      return context.resolveRequest(context, moduleName, platform);
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
