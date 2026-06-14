import { describe, it, expect, beforeAll } from 'vitest';
import { makeSandbox } from '../setup.mjs';

let sb;
beforeAll(() => { sb = makeSandbox(); });

describe('SCENE_FLOWS 完整性', () => {
  it('6 个场景全在', () => {
    expect(Object.keys(sb.SCENE_FLOWS).sort()).toEqual(
      ['analysis', 'creative', 'decision', 'learning', 'planning', 'writing']
    );
  });

  it('每个场景都有 mode 字段', () => {
    for (const [id, flow] of Object.entries(sb.SCENE_FLOWS)) {
      expect(flow.mode).toBeDefined();
    }
  });

  it('5 种模式被覆盖', () => {
    const modes = new Set(Object.values(sb.SCENE_FLOWS).map(f => f.mode));
    expect(modes.has('pipeline')).toBe(true);     // writing
    expect(modes.has('reflection')).toBe(true);   // planning, creative
    expect(modes.has('sequential')).toBe(true);   // analysis, learning
    expect(modes.has('multi-phase')).toBe(true);  // decision
  });
});

describe('buildBuiltinTeamForScene', () => {
  it('writing → Pipeline 4 工序', () => {
    const team = sb.buildBuiltinTeamForScene('writing');
    expect(team).not.toBeNull();
    expect(team.mode).toBe('pipeline');
    expect(team.agents).toHaveLength(4);
    const keys = team.agents.map(a => a.key);
    expect(keys).toContain('writing_planner');
    expect(keys).toContain('writing_drafter');
    expect(keys).toContain('writing_polisher');
    expect(keys).toContain('writing_proofreader');
  });

  it('planning → Reflection (PM + 顾问)', () => {
    const team = sb.buildBuiltinTeamForScene('planning');
    expect(team.mode).toBe('reflection');
    expect(team.agents).toHaveLength(2);
    expect(team.agents.find(a => a.role === 'creator')).toBeDefined();
    expect(team.agents.find(a => a.role === 'critic')).toBeDefined();
  });

  it('creative → Reflection (创意 + 评审)', () => {
    const team = sb.buildBuiltinTeamForScene('creative');
    expect(team.mode).toBe('reflection');
    expect(team.agents).toHaveLength(2);
  });

  it('sequential 场景返回 null（走 runGroupChat）', () => {
    expect(sb.buildBuiltinTeamForScene('analysis')).toBe(null);
    expect(sb.buildBuiltinTeamForScene('learning')).toBe(null);
  });

  it('decision 返回 null（走 runDecisionScene）', () => {
    expect(sb.buildBuiltinTeamForScene('decision')).toBe(null);
  });

  it('Agent 模型可被 sceneConfigs 覆盖', () => {
    sb.state.sceneConfigs.writing = { writing_drafter: 'qwen-turbo' };
    const team = sb.buildBuiltinTeamForScene('writing');
    const drafter = team.agents.find(a => a.key === 'writing_drafter');
    expect(drafter.model).toBe('qwen-turbo');
  });
});

describe('AGENTS 完整性', () => {
  it('writing pipeline 的 4 个新 Agent 存在', () => {
    expect(sb.AGENTS.writing_planner).toBeDefined();
    expect(sb.AGENTS.writing_drafter).toBeDefined();
    expect(sb.AGENTS.writing_polisher).toBeDefined();
    expect(sb.AGENTS.writing_proofreader).toBeDefined();
  });

  it('每个 Agent 都有 4 个核心字段', () => {
    for (const [k, a] of Object.entries(sb.AGENTS)) {
      expect(a.key).toBe(k);
      expect(a.name).toBeTruthy();
      expect(a.system).toBeTruthy();
      expect(a.cls).toMatch(/^agent-/);
    }
  });
});

describe('PRESET_TEAMS', () => {
  it('11 套预设全在', () => {
    expect(sb.PRESET_TEAMS.length).toBe(11);
  });

  it('每种模式至少有 1 套预设', () => {
    const modes = new Set(sb.PRESET_TEAMS.map(p => p.mode || 'sequential'));
    expect(modes.has('sequential')).toBe(true);
    expect(modes.has('pipeline')).toBe(true);
    expect(modes.has('reflection')).toBe(true);
    expect(modes.has('hub-spoke')).toBe(true);
    expect(modes.has('multi-phase')).toBe(true);
  });

  it('每个预设都有 name / tagline / agents', () => {
    for (const p of sb.PRESET_TEAMS) {
      expect(p.name).toBeTruthy();
      expect(p.tagline).toBeTruthy();
      expect(Array.isArray(p.agents)).toBe(true);
      expect(p.agents.length).toBeGreaterThan(0);
    }
  });
});

describe('modeLabel / turnsLabel', () => {
  it('modeLabel 5 种模式都有短名', () => {
    expect(sb.modeLabel('sequential')).toBeTruthy();
    expect(sb.modeLabel('pipeline')).toBe('Pipeline');
    expect(sb.modeLabel('reflection')).toBe('Reflection');
    expect(sb.modeLabel('hub-spoke')).toBe('Hub-Spoke');
    expect(sb.modeLabel('multi-phase')).toBe('多阶段');
  });

  it('turnsLabel 按模式正确', () => {
    expect(sb.turnsLabel({ mode: 'pipeline', agents: [1,2,3,4] })).toMatch(/4 工序/);
    expect(sb.turnsLabel({ mode: 'reflection', rounds: 3 })).toMatch(/3 轮迭代/);
    expect(sb.turnsLabel({ mode: 'multi-phase' })).toMatch(/Phase/);
    expect(sb.turnsLabel({ mode: 'sequential', rounds: 4 })).toMatch(/4 轮/);
  });
});
