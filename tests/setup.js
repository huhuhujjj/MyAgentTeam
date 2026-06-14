/**
 * tests/setup.js
 * 在 Node 里加载浏览器 app.js，通过 vm 沙盒拿到所有顶层 const / function / class。
 * 用法：
 *   const sb = require('./setup').makeSandbox();
 *   sb.routeScene('帮我写周报');
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APP_PATH = path.resolve(__dirname, '..', 'app.js');
const APP_CODE = fs.readFileSync(APP_PATH, 'utf8');

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
  // 极简 DOM 桩，供 app.js 加载期不抛错
  const noopEl = {
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    appendChild() {}, removeChild() {}, prepend() {}, remove() {},
    addEventListener() {}, removeEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    setAttribute() {}, getAttribute: () => null,
    style: {}, dataset: {},
    innerHTML: '', textContent: '', value: '',
    children: [], parentElement: null,
    click() {}, focus() {}, blur() {},
  };
  return {
    addEventListener() {},
    removeEventListener() {},
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => Object.assign({}, noopEl),
    body: Object.assign({}, noopEl),
    documentElement: Object.assign({}, noopEl),
  };
}

function makeSandbox() {
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
    crypto: require('crypto').webcrypto,
    indexedDB: undefined,            // IDB 单测里跳过，由 e2e 验
    fetch: () => Promise.reject(new Error('fetch not available in sandbox')),
    Promise,
    JSON, Math, Date, Number, String, Boolean, Array, Object, Set, Map, RegExp, Error,
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
  };
  sandbox.window = sandbox;  // self-ref
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);
  try {
    vm.runInContext(APP_CODE, sandbox, { filename: 'app.js' });
  } catch (e) {
    // app.js 在沙盒里 init 可能因 DOM 缺失抛错，但顶层函数 / 常量已挂载，可继续测
    sandbox._loadError = e;
  }
  return sandbox;
}

module.exports = { makeSandbox };
