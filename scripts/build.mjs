import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const parts = ['data', 'core', 'ui'].map(name => {
  const source = readFileSync(resolve(root, `src/${name}.jsxinc`), 'utf8');
  return `\n// ---- ${name} ----\n${source}`;
});
const header = `/*\n * MapCtrl for AE v1.0.0\n * Copyright (c) 2026 MapCtrl contributors. MIT License.\n * Map data: us-atlas, Copyright 2013-2019 Michael Bostock, ISC License.\n * Source and full license notices: https://github.com/EddyTheDesigner/MapCtrl-for-AE\n * Built with node scripts/build.mjs. Install this one file in ScriptUI Panels.\n */\n`;
const notices = readFileSync(resolve(root, 'THIRD_PARTY_NOTICES.md'), 'utf8');
const license = readFileSync(resolve(root, 'LICENSE'), 'utf8');
const bundle = header + '\n/*\n' + license + '\n' + notices.replace(/\*\//g, '* /') + '\n*/\n' +
  '#target aftereffects\n(function (thisObj) {\n' + parts.join('\n') +
  '\nMapCtrlUI(thisObj);\n})(this);\n';
new vm.Script(bundle.replace(/^#target.*$/m, ''), { filename: 'MapCtrl.jsx' });
mkdirSync(resolve(root, 'dist'), { recursive: true });
writeFileSync(resolve(root, 'dist/MapCtrl.jsx'), bundle);
console.log(`Built dist/MapCtrl.jsx (${Buffer.byteLength(bundle).toLocaleString()} bytes).`);
