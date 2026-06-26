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
describe('native module imports are lazy', () => {
  it('no file statically imports react-native-webview', () => {
    let matches = '';
    try {
      // grep exits 1 when there are no matches — that's the success case.
      matches = execSync(
        "grep -rn \"from 'react-native-webview'\" app components " +
          "--include='*.ts' --include='*.tsx' || true",
        { cwd: process.cwd(), encoding: 'utf8' }
      ).trim();
    } catch {
      matches = '';
    }
    // Allow `import type { ... } from 'react-native-webview'` (types are erased).
    const offending = matches
      .split('\n')
      .filter((l) => l && !/import\s+type\b/.test(l));

    expect(offending).toEqual([]);
  });
});
