import { execSync } from 'child_process';

/**
 * Guard against statically importing native modules that may be absent from the
 * running binary (dev client / older build). A static
 * `import { WebView } from 'react-native-webview'` throws at module-eval with
 * "RNCWebViewModule could not be found", which crashes every screen that
 * imports the module — see InvoiceViewerModal / OsmMap, which both require it
 * lazily inside a try/catch instead.
 *
 * If you need a webview, copy the lazy pattern:
 *   let WebView: any = null;
 *   try { WebView = require('react-native-webview').WebView; } catch { WebView = null; }
 */
// Native modules that are NOT guaranteed to be in every binary (dev client /
// older build). A static top-level import of any of these throws at
// module-eval when the native side is missing, crashing the whole screen tree.
// They must be lazily `require()`d inside a try/catch instead.
const NATIVE_ONLY_MODULES = [
  'react-native-webview',
  '@react-native-firebase/messaging',
  'expo-apple-authentication',
];

const grepStaticImport = (mod: string): string[] => {
  let matches = '';
  try {
    // grep exits 1 when there are no matches — that's the success case.
    matches = execSync(
      `grep -rn "from '${mod}'" app components services lib hooks contexts ` +
        "--include='*.ts' --include='*.tsx' || true",
      { cwd: process.cwd(), encoding: 'utf8' }
    ).trim();
  } catch {
    matches = '';
  }
  // Allow `import type { ... }` (erased at compile time, never runs natively).
  return matches.split('\n').filter((l) => l && !/import\s+type\b/.test(l));
};

describe('native module imports are lazy', () => {
  it.each(NATIVE_ONLY_MODULES)('no file statically imports %s', (mod) => {
    expect(grepStaticImport(mod)).toEqual([]);
  });
});
