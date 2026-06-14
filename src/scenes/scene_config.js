/* ============================================================
   MyAgentTeam · F+13 Sprint 1.5 / Phase D Wave 2
   src/scenes/scene_config.js — 场景配置 helper

   职责：
   - SCENE_AGENT_LIST（场景 → Agent keys 映射）
   - buildBuiltinTeamForScene（场景 → customTeam-shape 对象）
   - resolveAgentModel（按 sceneConfigs 覆盖 + 全局默认）
   - sceneIsCustomized（场景是否被改过，决定 ✨ 标记）
   依赖：state.config.model / state.sceneConfigs / SCENE_FLOWS（agents.js）/ AGENTS
   ============================================================ */

window.MAT_SCENE_CONFIG = (function() {
  "use strict";

  // 6 内置场景中每个用到的 Agent key 列表（用于配置面板渲染）
  const SCENE_AGENT_LIST = {
    // 写作 Pipeline 4 工序
    writing:  ['writing_planner', 'writing_drafter', 'writing_polisher', 'writing_proofreader'],
    analysis: ['analyst', 'industry'],
    planning: ['pm', 'advisor'],
    learning: ['teacher', 'student'],
    creative: ['creative', 'reviewer'],
    decision: ['infoA', 'infoB', 'infoC', 'coordinator'],
    dossier:  ['dossierA', 'dossierB', 'dossierC', 'archivist'],
  };
  
  /**
   * 把一个内置场景（writing/planning/creative）转成 customTeam 形状的对象，
   * 复用 runTeamPipeline / runTeamReflection 等通用 orchestrator。
   * - 模型优先用 state.sceneConfigs[sceneId][agentKey]，否则用全局默认
   * - role 字段按 SCENE_FLOWS 的 creator/critic 配置注入
   */
  function buildBuiltinTeamForScene(sceneId) {
    const flow = SCENE_FLOWS[sceneId];
    const cfg = state.sceneConfigs[sceneId] || {};
    const pickModel = (k) => cfg[k] || state.config.model;
    // F+ 强制工具：场景声明 forceTools 且 Tavily Key 已配置时，给每个 Agent 注入 toolsEnabled
    const toolsForBuiltin = !!(flow.forceTools && hasTavilyKey());
    const enrichAgent = (k, extra = {}) => ({
      ...AGENTS[k],
      model: pickModel(k),
      toolsEnabled: toolsForBuiltin || undefined,
      ...extra,
    });
    if (flow.mode === 'pipeline') {
      // Pipeline 场景：启动前的 forceTools 警告（撑住"没 Key 就警告"原则）
      if (flow.forceTools && !hasTavilyKey()) {
        renderSystemMsg(`⚠️ 「${sceneId}」场景未配置 Tavily Search Key —— Agent 将凭训练数据下结论，存在事实失真风险。建议到设置面板配置 Tavily Key（免费 1000 次/月）后重试。`);
      } else if (toolsForBuiltin) {
        renderSystemMsg(`🔧 F+ 强制启用 web_search · 「${sceneId}」场景对事实必须严格 → 流水线 ${flow.agents.length} 道工序都会主动搜证。`);
      }
      const keys = [...new Set(flow.agents)];
      return {
        mode: 'pipeline',
        rounds: 0,
        agents: keys.map(k => enrichAgent(k)),
      };
    }
    if (flow.mode === 'reflection') {
      return {
        mode: 'reflection',
        rounds: flow.rounds || 3,
        agents: [
          enrichAgent(flow.creator, { role: 'creator' }),
          enrichAgent(flow.critic,  { role: 'critic'  }),
        ],
      };
    }
    // sequential / 其他：返回 null，外面走 runGroupChat 原路径
    return null;
  }
  
  /** 解析某场景某 Agent 应使用的模型；null = 用全局默认 */
  function resolveAgentModel(sceneId, agentKey) {
    const cfg = state.sceneConfigs[sceneId];
    return (cfg && cfg[agentKey]) || null;
  }
  
  /** 该场景是否已被自定义过任何 Agent 的模型或身份？*/
  function sceneIsCustomized(sceneId) {
    const cfg = state.sceneConfigs[sceneId];
    const sp = state.scenePrompts[sceneId];
    const hasModel = cfg && Object.values(cfg).some(v => v && v.length);
    const hasPrompt = sp && Object.values(sp).some(v => v && v.trim().length);
    return hasModel || hasPrompt;
  }
  
  /* ====================== 团队库 CRUD ====================== */

  return {
    SCENE_AGENT_LIST,
    buildBuiltinTeamForScene, resolveAgentModel, sceneIsCustomized,
  };
})();
