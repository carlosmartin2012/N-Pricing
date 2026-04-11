/**
 * Build script for Supabase Edge Function pricing bundle.
 *
 * Bundles the pure pricing engine logic into a single file
 * compatible with Deno runtime (used by Supabase Edge Functions).
 *
 * Usage: node supabase/functions/pricing/build.mjs
 *
 * No global esbuild install needed — uses npx.
 *
 * Output: supabase/functions/pricing/pricingBundle.js
 * This file can be imported by index.ts in the Edge Function.
 *
 * Exports: calculatePricing, batchReprice, PricingContext (type)
 */

import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../../..');

const entryPoint = resolve(projectRoot, 'utils/pricingEngine.ts');
const outfile = resolve(__dirname, 'pricingBundle.js');

const args = [
  'esbuild',
  entryPoint,
  '--bundle',
  `--outfile=${outfile}`,
  '--format=esm',
  '--platform=neutral',
  '--target=esnext',
  '--external:@supabase/supabase-js',
  '--external:https://deno.land/*',
  '--external:https://esm.sh/*',
  '--tree-shaking=true',
  '--minify=false',
  '--sourcemap',
  '--define:import.meta.env.PROD=true',
  '--define:import.meta.env.DEV=false',
];

try {
  execFileSync('npx', args, {
    cwd: projectRoot,
    stdio: 'inherit',
  });
  console.log('✓ Edge Function pricing bundle built: supabase/functions/pricing/pricingBundle.js');
  console.log('  Exports: calculatePricing, batchReprice, PricingContext (type)');
} catch (err) {
  console.error('✗ Bundle build failed:', err.message);
  process.exit(1);
}
