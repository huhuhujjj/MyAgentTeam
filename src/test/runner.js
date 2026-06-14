/* ============================================================
   MyAgentTeam · F+13 Sprint 1.5 / Phase C
   src/test/runner.js — 浏览器内 mini test framework

   职责：
   - describe / it / expect 简化版（vitest 风格 subset）
   - 异步测试支持
   - console.table + 浮动 panel 输出

   触发方式：
   - URL 加 ?test=1 → app.js 检测后动态加载 runner.js + smoke.js
   - 否则不加载，0 生产影响

   未来 Phase A (ES modules) 完成后可平滑迁移到 vitest：
   - describe / it 接口与 vitest 一致
   - expect 子集兼容 vitest matchers
   ============================================================ */

window.MAT_TEST = (function() {
  'use strict';

  const suites = [];

  function describe(name, fn) {
    const suite = { name, tests: [] };
    suites.push(suite);
    const it = (testName, testFn) => suite.tests.push({ name: testName, fn: testFn });
    fn(it);
  }

  function expect(actual) {
    return {
      toBe(expected) {
        if (actual !== expected) throw new Error(`Expected ${JSON.stringify(actual)} === ${JSON.stringify(expected)}`);
      },
      toEqual(expected) {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          throw new Error(`Expected deep equal:\n  actual:   ${JSON.stringify(actual)}\n  expected: ${JSON.stringify(expected)}`);
        }
      },
      toBeTruthy() {
        if (!actual) throw new Error(`Expected truthy, got ${JSON.stringify(actual)}`);
      },
      toBeFalsy() {
        if (actual) throw new Error(`Expected falsy, got ${JSON.stringify(actual)}`);
      },
      toContain(item) {
        if (!actual || !actual.includes || !actual.includes(item)) {
          throw new Error(`Expected ${JSON.stringify(actual)} to contain ${JSON.stringify(item)}`);
        }
      },
      toBeInstanceOf(cls) {
        if (!(actual instanceof cls)) throw new Error(`Expected instance of ${cls.name}, got ${typeof actual}`);
      },
      toHaveLength(n) {
        if (!actual || actual.length !== n) throw new Error(`Expected length ${n}, got ${actual ? actual.length : 'null'}`);
      },
      toBeGreaterThan(n) {
        if (!(actual > n)) throw new Error(`Expected > ${n}, got ${actual}`);
      },
      toBeOfType(typeStr) {
        if (typeof actual !== typeStr) throw new Error(`Expected typeof ${typeStr}, got ${typeof actual}`);
      },
      toMatch(regex) {
        if (!regex.test(actual)) throw new Error(`Expected ${JSON.stringify(actual)} to match ${regex}`);
      },
    };
  }

  async function run() {
    const t0 = performance.now();
    const results = [];
    for (const suite of suites) {
      for (const test of suite.tests) {
        try {
          const r = test.fn();
          if (r && typeof r.then === 'function') await r;
          results.push({ suite: suite.name, test: test.name, ok: true });
        } catch (e) {
          results.push({ suite: suite.name, test: test.name, ok: false, error: e.message });
        }
      }
    }
    const totalMs = Math.round(performance.now() - t0);
    const passed = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok);

    // 1. console output
    console.log(`%c━━━ MyAgentTeam Smoke Tests · ${passed}/${results.length} passed (${totalMs}ms) ━━━`,
      `color: ${failed.length === 0 ? '#10B981' : '#EF4444'}; font-size: 14px; font-weight: bold`);
    if (failed.length) {
      console.group('%c❌ Failed tests', 'color: #EF4444; font-weight: bold');
      failed.forEach(f => console.error(`  [${f.suite}] ${f.test}: ${f.error}`));
      console.groupEnd();
    }
    // Suite summary table
    const bySuite = {};
    results.forEach(r => {
      if (!bySuite[r.suite]) bySuite[r.suite] = { passed: 0, failed: 0 };
      bySuite[r.suite][r.ok ? 'passed' : 'failed']++;
    });
    console.table(bySuite);

    // 2. floating panel
    renderTestPanel(results, totalMs);

    return { total: results.length, passed, failed: failed.length, totalMs };
  }

  function renderTestPanel(results, totalMs) {
    const passed = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok);
    const bg = failed.length === 0 ? '#10B981' : '#EF4444';

    const panel = document.createElement('div');
    panel.id = 'mat-test-panel';
    panel.style.cssText = `position: fixed; top: 12px; right: 12px; z-index: 99999;
      background: ${bg}; color: white; padding: 14px 18px; border-radius: 10px;
      font: 13px/1.5 system-ui; box-shadow: 0 8px 28px rgba(0,0,0,0.4); max-width: 360px;
      max-height: 80vh; overflow: auto; cursor: pointer`;
    panel.title = '点击关闭';
    panel.onclick = () => panel.remove();

    let html = `<div style="font-weight:700;font-size:14px;margin-bottom:6px">
      🧪 ${passed}/${results.length} passed · ${totalMs}ms</div>`;
    if (failed.length) {
      html += `<div style="margin-top:8px;border-top:1px solid rgba(255,255,255,0.3);padding-top:8px">`;
      failed.slice(0, 10).forEach(f => {
        html += `<div style="margin:4px 0;font-size:12px"><strong>${f.suite}/${f.test}</strong><br/>
          <span style="opacity:0.85">${f.error.slice(0, 200)}</span></div>`;
      });
      if (failed.length > 10) html += `<div style="opacity:0.7">…还有 ${failed.length - 10} 条失败，看 console</div>`;
      html += `</div>`;
    }
    panel.innerHTML = html;
    document.body.appendChild(panel);
  }

  return { describe, expect, run };
})();
