import { writeFile } from 'node:fs/promises';
import { PRODUCTS } from '../server/products.js';

await writeFile(new URL('../server/catalog.json', import.meta.url), `${JSON.stringify({
  version: 1, currency: 'SGD', benchmarkPolicy: 'Demo values for gameplay; not verified retail prices.',
  imagePolicy: 'Illustrative images, not verified SKU photography.', products: PRODUCTS,
}, null, 2)}\n`);
console.log(`Exported ${PRODUCTS.length} items to server/catalog.json`);
