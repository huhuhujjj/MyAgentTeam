import { describe, it, expect, beforeAll } from 'vitest';
import { makeSandbox } from '../setup.mjs';

let sb;
beforeAll(() => { sb = makeSandbox(); });

describe('routeScene', () => {
  // F+11/F+12 产品聚焦：自动路由只保留 规划/决策/起底 三个核心场景。
  // writing/analysis/learning/creative 的场景定义与 Agent 仍保留（供自定义团队引用），
  // 但不再参与自动路由 —— 因此这些旧输入现在应返回 unmatched。
  const unrouted = [
    ['帮我写一份技术周报', 'writing'],
    ['分析这个产品的竞品', 'analysis'],
    ['解释下量子计算原理', 'learning'],
    ['帮我想一个 slogan', 'creative'],
  ];
  for (const [text, oldId] of unrouted) {
    it(`"${text}" → 聚焦后不再自动路由（原 ${oldId}）`, () => {
      const r = sb.routeScene(text);
      expect(r.state).toBe('unmatched');
      expect(r.primary).toBe(null);
    });
  }

  it('"规划一个上线方案" → planning unique', () => {
    const r = sb.routeScene('规划一个上线方案');
    expect(r.state).toBe('unique');
    expect(r.primary.id).toBe('planning');
  });

  it('"起底这家公司" → dossier 命中', () => {
    const r = sb.routeScene('起底这家公司');
    expect(r.primary?.id).toBe('dossier');
  });

  it('"该选 React 还是 Vue" → decision unique (含"还是"特殊规则)', () => {
    const r = sb.routeScene('该选 React 还是 Vue');
    expect(r.state).toBe('unique');
    expect(r.primary.id).toBe('decision');
  });

  it('"asdfqwer 无意义" → unmatched', () => {
    const r = sb.routeScene('asdfqwer 无意义');
    expect(r.state).toBe('unmatched');
    expect(r.primary).toBe(null);
  });

  it('空字符串 → unmatched', () => {
    const r = sb.routeScene('');
    expect(r.state).toBe('unmatched');
  });

  it('否定词排除：含 "分析" 应排除 writing', () => {
    const r = sb.routeScene('分析这份周报');
    // writing 含 "周报"，但 "分析" 是 writing 的 negative keyword → 应不命中 writing
    expect(r.primary?.id).not.toBe('writing');
  });

  it('"还是" 二选一 → 强制 decision', () => {
    const r = sb.routeScene('喝咖啡还是喝茶');
    expect(r.primary.id).toBe('decision');
    expect(r.primary.confidence).toBeGreaterThanOrEqual(0.9);
  });
});
