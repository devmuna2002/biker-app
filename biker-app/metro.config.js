const { getDefaultConfig } = require('expo/metro-config');
const { fileURLToPath } = require('url');
const path = require('path');

const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

// Ensure we pick up TypeScript first, but keep all default extensions (png, svg, etc)
config.resolver.sourceExts = ['tsx', 'ts', ...config.resolver.sourceExts];

module.exports = config;
