import { describe, it, expect, beforeAll } from 'vitest';
import { makeSandbox } from '../setup.mjs';

let sb;
beforeAll(() => { sb = makeSandbox(); });

describe('routeScene', () => {
  it('"帮我写一份技术周报" → writing unique', () => {
    const r = sb.routeScene('帮我写一份技术周报');
    expect(r.state).toBe('unique');
    expect(r.primary.id).toBe('writing');
  });

  it('"分析这个产品的竞品" → analysis unique', () => {
    const r = sb.routeScene('分析这个产品的竞品');
    expect(r.state).toBe('unique');
    expect(r.primary.id).toBe('analysis');
  });

  it('"规划一个上线方案" → planning unique', () => {
    const r = sb.routeScene('规划一个上线方案');
    expect(r.state).toBe('unique');
    expect(r.primary.id).toBe('planning');
  });

  it('"解释下量子计算原理" → learning unique', () => {
    const r = sb.routeScene('解释下量子计算原理');
    expect(r.state).toBe('unique');
    expect(r.primary.id).toBe('learning');
  });

  it('"帮我想一个 slogan" → creative unique', () => {
    const r = sb.routeScene('帮我想一个 slogan');
    expect(r.state).toBe('unique');
    expect(r.primary.id).toBe('creative');
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
