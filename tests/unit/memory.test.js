import { describe, it, expect, beforeEach } from 'vitest';
import { makeSandbox } from '../setup.mjs';

describe('buildMemoryInjection', () => {
  let sb;
  beforeEach(() => { sb = makeSandbox(); });

  it('全空 → 空字符串注入', () => {
    const r = sb.buildMemoryInjection({ agentKey: 'researcher' });
    expect(r.text).toBe('');
    expect(r.totalTokens).toBe(0);
    expect(r.breakdown).toEqual([]);
  });

  it('只有项目上下文 → 注入 1 块', () => {
    sb.state.memory.projectContext = '我是 SaaS 创业者';
    const r = sb.buildMemoryInjection({ agentKey: 'researcher' });
    expect(r.breakdown).toHaveLength(1);
    expect(r.breakdown[0].key).toBe('projectContext');
    expect(r.text).toContain('我是 SaaS 创业者');
  });

  it('5 源齐全 → 5 块按优先级排序', () => {
    sb.state.memory.projectContext = '项目上下文';
    sb.state.memory.userProfile.learnedFacts = [{ text: '用户画像事实', ts: Date.now() }];
    sb.state.memory.settings.enableAgentMemory = true;
    sb.state.memory.agentMemories.researcher = 'Agent 自己的记忆';
    const r = sb.buildMemoryInjection({
      agentKey: 'researcher',
      includedTask: { sceneName: '测试', userText: '过往任务', result: '过往结果' },
      kbChunks: [{ text: '知识库内容' }],
    });
    expect(r.breakdown.length).toBe(5);
    const keys = r.breakdown.map(b => b.key);
    expect(keys).toEqual(['projectContext', 'userProfile', 'includedTask', 'knowledgeBase', 'agentMemory']);
  });

  it('开关关闭后该源不注入', () => {
    sb.state.memory.projectContext = '项目上下文';
    sb.state.memory.settings.enableProjectContext = false;
    const r = sb.buildMemoryInjection({ agentKey: 'researcher' });
    expect(r.breakdown).toHaveLength(0);
  });

  it('超大输入按 per-source cap 截断', () => {
    sb.state.memory.projectContext = '我'.repeat(3000);
    const cap = sb.state.memory.settings.budgetPerSource.projectContext;
    const r = sb.buildMemoryInjection({ agentKey: 'researcher' });
    const pc = r.breakdown.find(b => b.key === 'projectContext');
    expect(pc.tokens).toBeLessThanOrEqual(cap);
    expect(r.text).toContain('已截断');
  });

  it('总 budget 满后丢低优先级', () => {
    sb.state.memory.settings.budgetTokens = 50;  // 卡死
    sb.state.memory.projectContext = '高优先级保留';
    sb.state.memory.userProfile.learnedFacts = [{ text: '用户画像将被丢', ts: Date.now() }];
    sb.state.memory.settings.enableAgentMemory = true;
    sb.state.memory.agentMemories.researcher = '最低优先级';
    const r = sb.buildMemoryInjection({ agentKey: 'researcher' });
    expect(r.droppedCount).toBeGreaterThan(0);
    expect(r.breakdown[0].key).toBe('projectContext');  // 最高优先级保留
  });
});

describe('jaccardSim', () => {
  let sb;
  beforeEach(() => { sb = makeSandbox(); });

  it('完全相同 → 1.0', () => {
    expect(sb.jaccardSim('简洁输出', '简洁输出')).toBe(1);
  });
  it('完全不同 → 0', () => {
    expect(sb.jaccardSim('abc', 'xyz')).toBe(0);
  });
  it('部分重叠 → 0 < sim < 1', () => {
    const s = sb.jaccardSim('用户喜欢简洁', '用户喜欢简短');
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(1);
  });
  it('空字符串 → 0', () => {
    expect(sb.jaccardSim('', '任意')).toBe(0);
  });
});

describe('detectFactConflict', () => {
  let sb;
  beforeEach(() => { sb = makeSandbox(); });

  it('一正一反 + 核心词重叠 → true', () => {
    const c = sb.detectFactConflict('用户喜欢简洁', '用户不喜欢简洁');
    expect(c).toBe(true);
  });
  it('完全无关 → false', () => {
    expect(sb.detectFactConflict('喜欢咖啡', '关注 SaaS')).toBe(false);
  });
  it('都是肯定 → false', () => {
    expect(sb.detectFactConflict('喜欢简洁', '喜欢简短')).toBe(false);
  });
});

describe('runMemoryHygiene', () => {
  let sb;
  beforeEach(() => { sb = makeSandbox(); });

  it('过期事实被清', () => {
    sb.state.memory.userProfile.learnedFacts = [
      { text: '新事实', ts: Date.now() },
      { text: '100 天前事实', ts: Date.now() - 100 * 24 * 3600_000 },
    ];
    const r = sb.runMemoryHygiene({ silent: true });
    expect(r.expired).toBe(1);
    expect(sb.state.memory.userProfile.learnedFacts.length).toBe(1);
  });

  it('高相似度的事实被去重', () => {
    const now = Date.now();
    sb.state.memory.userProfile.learnedFacts = [
      { text: '简洁简短偏好的用户', ts: now },
      { text: '简洁简短偏好的用户', ts: now },  // 完全相同
    ];
    const r = sb.runMemoryHygiene({ silent: true });
    expect(r.deduped).toBeGreaterThanOrEqual(1);
  });

  it('空 facts 不抛错', () => {
    expect(() => sb.runMemoryHygiene({ silent: true })).not.toThrow();
  });
});

describe('chunkText (RAG 分块)', () => {
  let sb;
  beforeEach(() => { sb = makeSandbox(); });

  it('短文本一块', () => {
    const chunks = sb.chunkText('简短的一段', 400);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe('简短的一段');
  });

  it('多段落按段落切', () => {
    const text = '第一段\n\n第二段\n\n第三段';
    const chunks = sb.chunkText(text, 400);
    expect(chunks.length).toBe(3);
  });

  it('超长段落按大小切', () => {
    const long = 'X'.repeat(1500);
    const chunks = sb.chunkText(long, 400);
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(chunks.every(c => c.length <= 400)).toBe(true);
  });
});

describe('findRelatedHistory', () => {
  let sb;
  beforeEach(() => {
    sb = makeSandbox();
    sb.state.memory.settings.enableAutoRelate = true;
    sb.state.history = [
      { id: 'h1', sceneId: 'writing', userText: '帮我写技术周报', result: '周报内容', ts: Date.now() },
      { id: 'h2', sceneId: 'analysis', userText: '分析竞品 React Vue', result: '分析结果', ts: Date.now() },
      { id: 'h3', sceneId: 'decision', userText: '该选 React 还是 Vue', result: '选 React', ts: Date.now() },
    ];
  });

  it('查询相关任务能命中', () => {
    const r = sb.findRelatedHistory('React 框架对比', null, 3);
    expect(r.length).toBeGreaterThan(0);
  });

  it('开关关闭 → 空数组', () => {
    sb.state.memory.settings.enableAutoRelate = false;
    expect(sb.findRelatedHistory('任意查询')).toEqual([]);
  });

  it('完全无关 → 空数组', () => {
    expect(sb.findRelatedHistory('烹饪美食菜谱').length).toBe(0);
  });
});
