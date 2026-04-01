/**
 * Build script for Supabase Edge Function pricing bundle.
 *
 * Bundles the pure pricing engine logic into a single file
 * compatible with Deno runtime (used by Supabase Edge Functions).
 *
 * Usage: node supabase/functions/pricing/build.mjs
 *
 * Prerequisites: npm install -D esbuild
 *
 * Output: supabase/functions/pricing/pricingBundle.js
 * This file can be imported by index.ts in the Edge Function.
 */

import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../../..');

await build({
  entryPoints: [resolve(projectRoot, 'utils/pricingEngine.ts')],
  bundle: true,
  outfile: resolve(__dirname, 'pricingBundle.js'),
  format: 'esm',
  platform: 'neutral', // works in both Node and Deno
  target: 'es2022',
  external: [
    '@supabase/supabase-js',
    'https://deno.land/*',
    'https://esm.sh/*',
  ],
  // Replace browser-only APIs with stubs
  define: {
    'import.meta.env.PROD': 'true',
    'import.meta.env.DEV': 'false',
  },
  // Tree-shake unused code
  treeShaking: true,
  minify: false, // keep readable for debugging
  sourcemap: true,
});

console.log('✓ Edge Function pricing bundle built: supabase/functions/pricing/pricingBundle.js');
