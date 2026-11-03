const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const backendDir = __dirname;

console.log('Bundling backend serverless API with esbuild...');

try {
  esbuild.buildSync({
    entryPoints: [path.join(backendDir, 'src/serverless.ts')],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    footer: {
      js: 'module.exports = serverless_default; module.exports.default = serverless_default;',
    },
    external: ['pg-native'],
    outfile: path.join(backendDir, 'index.js'),
  });

  // Copy bundled index.js to app.js, backend/api/index.js, and root api/index.js
  fs.copyFileSync(path.join(backendDir, 'index.js'), path.join(backendDir, 'app.js'));

  fs.mkdirSync(path.join(backendDir, 'api'), { recursive: true });
  fs.copyFileSync(path.join(backendDir, 'index.js'), path.join(backendDir, 'api', 'index.js'));

  fs.mkdirSync(path.join(rootDir, 'api'), { recursive: true });
  fs.copyFileSync(path.join(backendDir, 'index.js'), path.join(rootDir, 'api', 'index.js'));

  console.log('Backend bundled successfully to index.js, app.js, and api/index.js!');
} catch (error) {
  console.error('Failed to bundle backend:', error);
  process.exit(1);
}

