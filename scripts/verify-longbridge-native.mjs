#!/usr/bin/env node
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const args = new Set(process.argv.slice(2));
const required = args.has('--required');

function detectLibc() {
  if (process.platform !== 'linux') return undefined;
  const report = typeof process.report?.getReport === 'function' ? process.report.getReport() : undefined;
  return report?.header?.glibcVersionRuntime ? 'gnu' : 'musl';
}

function detectGlibcVersion() {
  if (process.platform !== 'linux') return undefined;
  const report = typeof process.report?.getReport === 'function' ? process.report.getReport() : undefined;
  return report?.header?.glibcVersionRuntime;
}

function expectedNativePackage() {
  const { platform, arch } = process;
  if (platform === 'darwin' && arch === 'arm64') return 'longbridge-darwin-arm64';
  if (platform === 'darwin' && arch === 'x64') return 'longbridge-darwin-x64';
  if (platform === 'linux' && arch === 'arm64') return 'longbridge-linux-arm64-gnu';
  if (platform === 'linux' && arch === 'x64') return detectLibc() === 'musl'
    ? 'longbridge-linux-x64-musl'
    : 'longbridge-linux-x64-gnu';
  if (platform === 'win32' && arch === 'x64') return 'longbridge-win32-x64-msvc';
  return undefined;
}

function resolvePackage(pkgName) {
  if (!pkgName) return null;
  try {
    return require.resolve(`${pkgName}/package.json`);
  } catch {
    return null;
  }
}

function collectErrorChain(error) {
  const chain = [];
  let current = error;
  const seen = new Set();
  while (current && !seen.has(current)) {
    seen.add(current);
    chain.push({
      name: current.name,
      code: current.code,
      message: current.message || String(current),
    });
    current = current.cause;
  }
  return chain;
}

function tryRequireExpectedPackage(pkgName) {
  if (!pkgName) return { attempted: false };
  try {
    require(pkgName);
    return { attempted: true, ok: true };
  } catch (error) {
    return {
      attempted: true,
      ok: false,
      error: error?.message || String(error),
      errorChain: collectErrorChain(error),
    };
  }
}

const expectedPackage = expectedNativePackage();
const expectedPackageJson = resolvePackage(expectedPackage);
const result = {
  ok: false,
  platform: process.platform,
  arch: process.arch,
  libc: detectLibc(),
  glibcVersion: detectGlibcVersion(),
  expectedPackage,
  expectedPackagePresent: Boolean(expectedPackageJson),
  expectedPackageJson,
  directExpectedPackageLoad: tryRequireExpectedPackage(expectedPackage),
  imported: false,
  error: null,
  errorChain: [],
};

try {
  await import('longbridge');
  result.imported = true;
  result.ok = true;
} catch (error) {
  result.error = error?.message || String(error);
  result.errorChain = collectErrorChain(error);
}

console.log(JSON.stringify(result, null, 2));

if (required && !result.ok) {
  const hint = [
    '[longbridge-native] Native binding check failed.',
    expectedPackage ? `Expected package: ${expectedPackage}` : 'Expected package: unsupported platform/arch',
    'Cloud Run images must be built with npm ci --include=optional and without copying host node_modules into the image.',
  ].join('\n');
  console.error(hint);
  process.exit(1);
}
