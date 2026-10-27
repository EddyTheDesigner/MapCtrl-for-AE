import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const bundle = readFileSync(new URL('../dist/MapCtrl.jsx', import.meta.url), 'utf8');
test('single-file distribution parses and embeds its data and licenses', () => {
  assert.equal((bundle.match(/^#target aftereffects$/gm) || []).length, 1);
  assert.doesNotMatch(bundle, /^#include/m);
  assert.match(bundle, /Copyright 2013-2019 Michael Bostock/);
  assert.match(bundle, /MapCtrlUI\(thisObj\)/);
  assert.ok(new vm.Script(bundle.replace(/^#target.*$/m, '')));
});

test('UI uses exported core functions', () => {
  const core = readFileSync(new URL('../src/core.jsxinc', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../src/ui.jsxinc', import.meta.url), 'utf8');
  const data = readFileSync(new URL('../src/data.jsxinc', import.meta.url), 'utf8');
  const context = vm.createContext({});
  vm.runInContext(data + '\n' + core, context);
  for (const [, name] of ui.matchAll(/MapCtrlCore\.([A-Za-z]+)\s*\(/g)) {
    assert.equal(typeof context.MapCtrlCore[name], 'function', `Missing backend action: ${name}`);
  }
});
