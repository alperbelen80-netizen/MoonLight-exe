import * as fs from 'fs';
import * as path from 'path';

/**
 * V2.6-1 — Bundle-safe config path resolver.
 *
 * The backend traditionally read YAML / JSON config from
 *   `path.join(process.cwd(), 'src', ...)`
 * which breaks the moment the process is spawned from a different CWD
 * (eg. when bundled into the Electron app and launched by Electron's
 * main process). This helper walks a short prioritised list of candidate
 * roots and returns the first one that actually exists:
 *
 *   1. `MOONLIGHT_CONFIG_DIR` env var  (explicit override)
 *   2. `<process.cwd()>/src/<...>`     (dev / yarn start)
 *   3. `<__dirname>/../../../src/<...>`(nest dist — src sibling of dist)
 *   4. `<__dirname>/../../../../backend/src/<...>` (bundled — bundle
 *      lives in dist-bundle/ sibling of backend/)
 *   5. `<electronResources>/backend-bundle/src/<...>` (packaged app)
 *
 * If none resolve, we still return candidate #2 so the caller can
 * `readFileSync` and produce a clear, actionable ENOENT error.
 */

function candidateRoots(): string[] {
  const roots: string[] = [];
  if (process.env.MOONLIGHT_CONFIG_DIR) {
    roots.push(process.env.MOONLIGHT_CONFIG_DIR);
  }
  // Dev / yarn start
  roots.push(path.join(process.cwd(), 'src'));
  // Nest dist: this file ends up in dist/backend/src/shared/utils — so
  // the real src/ lives three levels up.
  roots.push(path.join(__dirname, '..', '..', '..', 'src'));
  roots.push(path.join(__dirname, '..', '..', '..', '..', 'backend', 'src'));
  // Packaged Electron app: backend bundle lives under resources/.
  const resourcesPath = (process as unknown as { resourcesPath?: string }).resourcesPath;
  if (resourcesPath) {
    roots.push(path.join(resourcesPath, 'backend-bundle', 'src'));
  }
  // Also accept the raw bundle dir (bundle copied as-is during packaging
  // without the `src` prefix).
  roots.push(path.join(process.cwd(), 'backend', 'src'));
  return roots;
}

/**
 * Resolve a relative config path (e.g. `['config', 'policy.yaml']`) to an
 * absolute file path that actually exists. Falls back to the CWD-based
 * candidate so the caller gets a clear ENOENT if nothing is found.
 */
export function resolveConfigPath(...segments: string[]): string {
  const roots = candidateRoots();
  for (const root of roots) {
    const candidate = path.join(root, ...segments);
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      /* fall through */
    }
  }
  return path.join(roots[0] ?? process.cwd(), ...segments);
}

/** Same as resolveConfigPath but returns the first existing DIRECTORY. */
export function resolveConfigDir(...segments: string[]): string {
  const roots = candidateRoots();
  for (const root of roots) {
    const candidate = path.join(root, ...segments);
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        return candidate;
      }
    } catch {
      /* fall through */
    }
  }
  return path.join(roots[0] ?? process.cwd(), ...segments);
}
