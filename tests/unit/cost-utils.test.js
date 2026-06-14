import { describe, it, expect, beforeAll } from 'vitest';
import { makeSandbox } from '../setup.mjs';

let sb;
beforeAll(() => { sb = makeSandbox(); });

describe('tokensFromText', () => {
  it('空字符串 → 0', () => {
    expect(sb.tokensFromText('')).toBe(0);
  });

  it('中文按 1.5 字/token 估算', () => {
    const t = sb.tokensFromText('你好世界');  // 4 字
    expect(t).toBe(6);
  });

  it('英文按 4 字符/token', () => {
    const t = sb.tokensFromText('hello');  // 5 字符
    expect(t).toBeGreaterThanOrEqual(1);
    expect(t).toBeLessThanOrEqual(3);
  });

  it('中英混合', () => {
    const t = sb.tokensFromText('你好 hello');
    expect(t).toBeGreaterThan(0);
  });
});

describe('calcCost', () => {
  it('GPT-4o-mini 1M 输入 = $0.15', () => {
    const c = sb.calcCost(1_000_000, 0, 'gpt-4o-mini');
    expect(c).toBeCloseTo(0.15, 4);
  });

  it('GPT-4o-mini 1M 输出 = $0.60', () => {
    const c = sb.calcCost(0, 1_000_000, 'gpt-4o-mini');
    expect(c).toBeCloseTo(0.60, 4);
  });

  it('未知模型 fallback 到 gpt-4o-mini', () => {
    const c = sb.calcCost(1_000_000, 0, '__nonexistent__');
    expect(c).toBeCloseTo(0.15, 4);
  });

  it('Claude 3.5 Sonnet 价格不同', () => {
    const c = sb.calcCost(1_000_000, 1_000_000, 'claude-3-5-sonnet-latest');
    // 3 + 15 = 18 USD
    expect(c).toBeCloseTo(18, 2);
  });
});

describe('escapeHtml', () => {
  it('转义 < > & " \'', () => {
    expect(sb.escapeHtml('<img src="x" onerror=\'a\'>')).toBe('&lt;img src=&quot;x&quot; onerror=&#39;a&#39;&gt;');
  });
  it('普通字符串原样', () => {
    expect(sb.escapeHtml('hello 世界')).toBe('hello 世界');
  });
});

describe('maskKey', () => {
  it('短 key 显示 sk-…', () => {
    expect(sb.maskKey('sk-1')).toBe('sk-…');
  });
  it('长 key 显示 sk-…xxxx', () => {
    const k = sb.maskKey('sk-1234567890abcdefghij');
    expect(k).toMatch(/^sk-…[a-z0-9]{4}$/);
  });
  it('空 key 返回空', () => {
    expect(sb.maskKey('')).toBe('');
    expect(sb.maskKey(null)).toBe('');
  });
});

describe('fmtUsd', () => {
  it('fmtUsd 4 位小数', () => {
    expect(sb.fmtUsd(0.001234)).toBe('$0.0012');
  });
  it('fmtUsdShort 2 位小数', () => {
    expect(sb.fmtUsdShort(1.235)).toBe('$1.24');
  });
});

describe('fmtRelativeTime', () => {
  it('< 60s → "N 秒前"', () => {
    expect(sb.fmtRelativeTime(Date.now() - 5000)).toMatch(/秒前$/);
  });
  it('1 hour → "N 分钟前"', () => {
    expect(sb.fmtRelativeTime(Date.now() - 30 * 60_000)).toMatch(/分钟前$/);
  });
  it('1 day → "N 小时前"', () => {
    expect(sb.fmtRelativeTime(Date.now() - 5 * 3600_000)).toMatch(/小时前$/);
  });
});

describe('MODEL_PRICING 完整性', () => {
  it('6 厂商全部存在', () => {
    const vendors = new Set(Object.values(sb.MODEL_PRICING).map(v => v.vendor));
    expect(vendors.size).toBe(6);
    expect(vendors).toContain('openai');
    expect(vendors).toContain('anthropic');
    expect(vendors).toContain('qwen');
    expect(vendors).toContain('deepseek');
    expect(vendors).toContain('doubao');
    expect(vendors).toContain('gemini');
  });

  it('每个模型都有 in/out/ctx/vendor 4 字段', () => {
    for (const [model, meta] of Object.entries(sb.MODEL_PRICING)) {
      expect(meta).toHaveProperty('in');
      expect(meta).toHaveProperty('out');
      expect(meta).toHaveProperty('ctx');
      expect(meta).toHaveProperty('vendor');
      expect(typeof meta.in).toBe('number');
    }
  });
});
