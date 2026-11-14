import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listFiles(join(dir, e.name)) : [join(dir, e.name)],
  );
}

/** Po buildzie generuje dist/sw.js: wersja = skrót wszystkich plików, ASSETS = ich lista. */
function serviceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'app-service-worker',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir;
    },
    closeBundle() {
      const files = listFiles(outDir)
        .filter((f) => !f.endsWith('sw.js'))
        .sort();
      const hash = createHash('sha256');
      for (const f of files) hash.update(relative(outDir, f)).update(readFileSync(f));
      const version = hash.digest('hex').slice(0, 12);
      const assets = ['./', ...files.map((f) => './' + relative(outDir, f).split('\\').join('/'))];
      const sw = readFileSync('src/sw-template.js', 'utf8')
        .replace('__VERSION__', version)
        .replace('__ASSETS__', JSON.stringify(assets));
      writeFileSync(join(outDir, 'sw.js'), sw);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), serviceWorker()],
  test: { include: ['src/**/*.test.ts'] },
} as never);
