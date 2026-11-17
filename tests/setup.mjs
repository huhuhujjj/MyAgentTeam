/**
 * tests/setup.mjs (ESM)
 * 在 Node 里加载浏览器 app.js，通过 vm 沙盒拿到所有顶层 const / function / class。
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_PATH = path.resolve(__dirname, '..', 'app.js');
const APP_CODE = fs.readFileSync(APP_PATH, 'utf8');
const INDEX_PATH = path.resolve(__dirname, '..', 'index.html');
const INDEX_HTML = fs.readFileSync(INDEX_PATH, 'utf8');
const MODULE_SCRIPTS = Array.from(INDEX_HTML.matchAll(/<script\s+src="(src\/[^"]+)"/g))
  .map((m) => m[1].split('?')[0]);

function makeStorage() {
  const data = {};
  return {
    _data: data,
    getItem(k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem(k, v) { data[k] = String(v); },
    removeItem(k) { delete data[k]; },
    clear() { for (const k of Object.keys(data)) delete data[k]; },
    get length() { return Object.keys(data).length; },
    key(i) { return Object.keys(data)[i] || null; },
  };
}

function makeFakeDOM() {
  const noopEl = {
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    appendChild() {}, removeChild() {}, prepend() {}, remove() {}, insertBefore() {},
    addEventListener() {}, removeEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    setAttribute() {}, getAttribute: () => null, removeAttribute() {},
    style: {}, dataset: {},
    innerHTML: '', textContent: '', value: '', checked: false, className: '',
    children: [], parentElement: null, firstChild: null, lastChild: null,
    click() {}, focus() {}, blur() {}, scrollIntoView() {},
    getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0 }),
  };
  const el = () => ({ ...noopEl });
  return {
    addEventListener() {},
    removeEventListener() {},
    getElementById: () => el(),
    querySelector: () => el(),
    querySelectorAll: () => [],
    createElement: () => el(),
    body: el(),
    documentElement: el(),
  };
}

export function makeSandbox() {
  const localStorage = makeStorage();
  const sessionStorage = makeStorage();
  const documentObj = makeFakeDOM();
  const sandbox = {
    window: {},
    document: documentObj,
    localStorage,
    sessionStorage,
    console: { log() {}, warn() {}, error() {}, info() {} },
    setTimeout, clearTimeout, setInterval, clearInterval,
    crypto: webcrypto,
    indexedDB: undefined,
    fetch: () => Promise.reject(new Error('fetch not available in sandbox')),
    Promise, JSON, Math, Date, Number, String, Boolean, Array, Object, Set, Map, RegExp, Error,
    TextEncoder, TextDecoder,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    AbortController: class { constructor() { this.signal = { aborted: false }; } abort() { this.signal.aborted = true; } },
    DOMException: class DOMException extends Error {},
    Blob: class Blob { constructor() {} },
    URL: { createObjectURL: () => '', revokeObjectURL: () => {} },
    FileReader: class FileReader { readAsDataURL() {} },
    DOMPurify: { sanitize: x => x },
    marked: { parse: x => x },
    Buffer,
    location: { href: 'http://localhost/', reload() {} },
    navigator: { clipboard: { writeText: () => Promise.resolve() } },
    performance: { now: () => Date.now() },
    scrollTo() {}, scroll() {}, alert() {}, confirm: () => true, prompt: () => null,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);

  sandbox._moduleErrors = [];
  for (const rel of MODULE_SCRIPTS) {
    const full = path.resolve(__dirname, '..', rel);
    try {
      vm.runInContext(fs.readFileSync(full, 'utf8'), sandbox, { filename: rel });
    } catch (e) {
      sandbox._moduleErrors.push({ file: rel, error: e });
    }
  }

  try {
    vm.runInContext(APP_CODE, sandbox, { filename: 'app.js' });
  } catch (e) {
    sandbox._loadError = e;
  }

  require('./globals').exposeGlobals(sandbox);

  return sandbox;
}
