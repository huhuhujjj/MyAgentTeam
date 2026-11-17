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
const INDEX_PATH = path.resolve(__dirname, '..', 'index.html');
const INDEX_HTML = fs.readFileSync(INDEX_PATH, 'utf8');

// 按 index.html 中的真实脚本顺序提取 src/ 模块（去掉 ?v= 版本号）
// 这样测试沙盒与生产加载顺序一致，避免 MAT_XXX / 顶层 const 未初始化
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
  // 极简 DOM 桩，供 app.js 加载期与渲染函数（如 renderSystemMsg 的 appendChild）不抛错
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
  // getElementById 返回通用元素桩（而非 null），避免 $('discussion').appendChild 之类抛错
  const el = () => Object.assign({}, noopEl);
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
    scrollTo() {}, scroll() {}, alert() {}, confirm: () => true, prompt: () => null,
  };
  sandbox.window = sandbox;  // self-ref
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);

  // 先按生产顺序加载所有 src/ IIFE 模块（mat_*.js），建立 window.MAT_XXX 命名空间
  sandbox._moduleErrors = [];
  for (const rel of MODULE_SCRIPTS) {
    const full = path.resolve(__dirname, '..', rel);
    try {
      vm.runInContext(fs.readFileSync(full, 'utf8'), sandbox, { filename: rel });
    } catch (e) {
      sandbox._moduleErrors.push({ file: rel, error: e });
    }
  }

  // 再加载 app.js（依赖上面的 MAT_XXX 与顶层 const）
  try {
    vm.runInContext(APP_CODE, sandbox, { filename: 'app.js' });
  } catch (e) {
    // app.js 在沙盒里 init 可能因 DOM 缺失抛错，但顶层函数 / 常量已挂载，可继续测
    sandbox._loadError = e;
  }

  // 对齐测试期望：平铺 MAT_* 命名空间 + 提取 app.js 顶层词法常量为裸名
  require('./globals').exposeGlobals(sandbox);

  return sandbox;
}

module.exports = { makeSandbox };
