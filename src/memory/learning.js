/* ============================================================
   MyAgentTeam · F+22.3 Sprint 4 模块化精细化
   src/memory/learning.js — 长程记忆注入 + 后台自学

   职责（4 个函数）：
   - buildMemoryInjection(opts)        构造记忆 system prompt 注入文本块
                                       优先级裁剪：项目上下文 > 用户画像 > 引用任务 > KB > Agent 记忆
   - takeMemoryOpts(agentKey)          按当前任务的 opts 取记忆选项
   - autoUpdateAgentMemories(task,final) 任务结束后后台总结到 Agent 个体记忆
   - autoLearnUserProfile(task,final)  任务结束后 LLM 自动总结"关于用户的新事实"

   依赖（全局）：
   - state / MEMORY_DEFAULT_BUDGET / MEMORY_MAX_PROFILE_FACTS
   - MEMORY_FACT_EXPIRE_DAYS / MEMORY_DEDUP_JACCARD_THRESHOLD
   - AGENTS / callLLM / saveMemory
   - getProjectMemory (F+11 项目隔离记忆)

   ⚠ 留在 app.js（未搬）：
   - runMemoryHygiene（跟 saveActiveTask 等耦合）
   - findRelatedHistory（跟项目逻辑耦合）
   ============================================================ */

window.MAT_LEARNING = (function() {
  'use strict';

function buildMemoryInjection(opts = {}) {
  const m = state.memory;
  const pm = getProjectMemory();  // F+11 项目隔离的 memory（projectContext / userProfile / agentMemories）
  const settings = m.settings || {};
  const budget = Math.max(0, settings.budgetTokens || MEMORY_DEFAULT_BUDGET);
  const perCap = settings.budgetPerSource || {};

  // 工具：按字符上限粗截断文本（不破坏多字节）
  const truncateToTokens = (txt, maxTokens) => {
    if (!maxTokens) return txt;
    const cur = tokensFromText(txt);
    if (cur <= maxTokens) return txt;
    // 按比例截字
    const ratio = maxTokens / cur;
    const targetLen = Math.max(50, Math.floor(txt.length * ratio) - 10);
    return txt.slice(0, targetLen) + '…（已截断）';
  };

  const parts = [];

  // #2 项目上下文（F+11 按项目隔离）
  if (settings.enableProjectContext && pm.projectContext?.trim()) {
    let block = '【用户长期上下文】\n' + pm.projectContext.trim();
    block = truncateToTokens(block, perCap.projectContext);
    parts.push({ key: 'projectContext', name: '项目上下文', text: block, priority: 1 });
  }
  // #4 用户画像（F+11 按项目隔离）
  if (settings.enableUserProfile && pm.userProfile?.learnedFacts?.length) {
    const facts = pm.userProfile.learnedFacts.slice(-10).map(f => '- ' + f.text).join('\n');
    let block = '【关于用户已知的事实（自动学习，可能不全面）】\n' + facts;
    block = truncateToTokens(block, perCap.userProfile);
    parts.push({ key: 'userProfile', name: '用户画像', text: block, priority: 2 });
  }
  // #3 引用过往任务
  if (opts.includedTask) {
    const t = opts.includedTask;
    const summary = (t.result || '').slice(0, 800);
    let block = `【引用的过往任务（${t.sceneName || '任务'}）】\n原始请求：${t.userText}\n核心结论：${summary}`;
    block = truncateToTokens(block, perCap.includedTask);
    parts.push({ key: 'includedTask', name: '引用任务', text: block, priority: 3 });
  }
  // #8 知识库召回
  if (settings.enableKnowledgeBase && opts.kbChunks?.length) {
    let block = '【知识库相关内容】\n' + opts.kbChunks.map((c, i) => `[${i + 1}] ${c.text}`).join('\n---\n');
    block = truncateToTokens(block, perCap.knowledgeBase);
    parts.push({ key: 'knowledgeBase', name: '知识库', text: block, priority: 4 });
  }
  // #7 Agent 自己的记忆（F+11 按项目隔离）
  if (settings.enableAgentMemory && opts.agentKey && pm.agentMemories?.[opts.agentKey]) {
    let block = `【你（${opts.agentKey}）之前任务的回顾】\n` + pm.agentMemories[opts.agentKey].slice(0, 600);
    block = truncateToTokens(block, perCap.agentMemory);
    parts.push({ key: 'agentMemory', name: 'Agent 记忆', text: block, priority: 5 });
  }

  // 总 budget 二轮裁剪：从低优先级扔
  const sorted = [...parts].sort((a, b) => a.priority - b.priority);
  const kept = [];
  let used = 0;
  for (const p of sorted) {
    const cost = tokensFromText(p.text);
    if (used + cost > budget) continue;
    kept.push({ ...p, tokens: cost });
    used += cost;
  }
  kept.sort((a, b) => a.priority - b.priority);

  const text = kept.length
    ? '【你拥有以下背景记忆，请在回答时合理利用】\n' + kept.map(k => k.text).join('\n\n') + '\n\n--- 以上为背景记忆，以下是当前任务 ---\n'
    : '';

  return {
    text,
    breakdown: kept.map(k => ({ key: k.key, name: k.name, tokens: k.tokens, cap: perCap[k.key] || 0 })),
    totalTokens: used,
    totalBudget: budget,
    droppedCount: parts.length - kept.length,
  };
}

/**
 * 对运行时的"引用任务"和"KB chunks"做选择，存储到 state.task 上，
 * 让每次 runAgent 都能共享同一份记忆（避免每个 Agent 各自决定，造成不一致）。
 */
function takeMemoryOpts(agentKey) {
  return {
    agentKey,
    includedTask: state.task?._includedTask || null,
    kbChunks: state.task?._kbChunks || null,
  };
}

/**
 * #4 用户画像自动学习：任务结束后后台 LLM 摘要
 * 失败静默（不阻塞主流程，不影响结果显示）
 */
/**
 * #7 Per-Agent 记忆更新：每位发言过的 Agent 学到了什么，追加到自己的 memory blob
 * 滚动摘要：旧 memory + 新发言 → LLM 摘要 → 替换
 */
async function autoUpdateAgentMemories(task, final) {
  if (!anyKeyConfigured()) return;
  const cheapModel = state.config.openaiKey ? 'gpt-4o-mini'
    : state.config.qwenKey ? 'qwen-turbo'
    : state.config.deepseekKey ? 'deepseek-chat'
    : state.config.geminiKey ? 'gemini-2.0-flash-lite'
    : 'claude-3-5-haiku-latest';

  // 抓每个发言过的 Agent 的最后一次发言
  const speeches = {};
  (final.history || []).forEach(h => {
    if (h.role !== 'assistant') return;
    const m = (h.content || '').match(/^\[([^\]]+)\]/);
    const name = m?.[1] || 'unknown';
    speeches[name] = (h.content || '').slice(0, 800);
  });
  // 对应回 agentKey（自定义 Agent 用 name 兜底）
  for (const [name, content] of Object.entries(speeches)) {
    const agentKey = Object.keys(AGENTS).find(k => AGENTS[k].name === name);
    if (!agentKey) continue;
    const prev = getProjectMemory().agentMemories[agentKey] || '';
    const prompt = `你是 ${name}。请把"既往记忆"和"本次任务的关键学习"合并、去重、压缩为不超过 300 字的滚动笔记。仅保留对未来任务有用的事实/偏好/技巧。

【既往记忆】
${prev || '（无）'}

【本次任务用户请求】
${task.userText}

【你的发言】
${content}

请输出新的"滚动笔记"（直接输出文本，无前缀）：`;
    try {
      const res = await callLLM({
        system: '你是 Agent 自己的记忆摘要助手。简洁、去冗余、保留有用信息。',
        userMsg: prompt,
        history: [],
        modelOverride: cheapModel,
      });
      const newMem = (res.text || '').trim().slice(0, 800);
      if (newMem) getProjectMemory().agentMemories[agentKey] = newMem;
    } catch (e) { console.warn('agent memory update failed', name, e); }
  }
  saveMemory();
  saveProjectMemory();  // F+11
}

async function autoLearnUserProfile(task, final) {
  if (!state.memory.settings.autoSummarizeAfterTask) return;
  if (!anyKeyConfigured()) return;  // 无真实 LLM 跳过
  // 找一个"便宜的"模型
  const cheapModel = state.config.openaiKey ? 'gpt-4o-mini'
    : state.config.anthropicKey ? 'claude-3-5-haiku-latest'
    : state.config.qwenKey ? 'qwen-turbo'
    : state.config.deepseekKey ? 'deepseek-chat'
    : state.config.geminiKey ? 'gemini-2.0-flash-lite'
    : null;
  if (!cheapModel) return;

  const recentDialogue = (final.history || []).slice(-6).map(h => h.content.slice(0, 300)).join('\n');
  const finalResult = (buildFinalResult(task.sceneId, final) || '').slice(0, 600);
  const summarizerPrompt = `你是用户画像学习者。读完用户和 AI 团队的一次任务交互后，提取 **0-3 条** 关于用户的新认识（偏好、领域、关注点、风格等）。
若没有新认识，输出空。
每条 ≤ 30 字，一行一条，不要编号，不要总结性废话。
不要重复已知事实：${(getProjectMemory().userProfile.learnedFacts || []).slice(-10).map(f => f.text).join(' / ') || '（无）'}`;

  const userMsg = `任务场景：${SCENE_RULES.find(s => s.id === task.sceneId)?.name || task.sceneId}
用户原始请求：${task.userText}
近 6 条对话：${recentDialogue}
最终结果（节选）：${finalResult}

请提取关于该用户的新认识：`;

  try {
    const oldModel = state.config.model;
    const tmpAgent = { system: summarizerPrompt };
    const res = await callLLM({
      system: summarizerPrompt,
      userMsg,
      history: [],
      modelOverride: cheapModel,
    });
    const lines = res.text.split('\n').map(l => l.trim().replace(/^[-•·*\d.、]+\s*/, '')).filter(l => l && l.length > 4 && l.length < 60);
    const pm = getProjectMemory();  // F+11 写入当前项目的 memory
    lines.forEach(t => {
      pm.userProfile.learnedFacts.push({ text: t, ts: Date.now(), source: task.id || task.userText.slice(0, 20) });
    });
    // FIFO cap
    if (pm.userProfile.learnedFacts.length > MEMORY_MAX_PROFILE_FACTS) {
      pm.userProfile.learnedFacts = pm.userProfile.learnedFacts.slice(-MEMORY_MAX_PROFILE_FACTS);
    }
    if (lines.length) {
      saveProjectMemory();
      toast(`📚 学到 ${lines.length} 条新画像（${state.projects.find(p => p.id === getActiveProjectId())?.name || '默认'} 项目）`, 'ok', 2500);
    }
  } catch (e) {
    console.warn('autoLearnUserProfile failed', e);
  }
}

  // 向后兼容：双暴露
  window.buildMemoryInjection = buildMemoryInjection;
  window.takeMemoryOpts = takeMemoryOpts;
  window.autoUpdateAgentMemories = autoUpdateAgentMemories;
  window.autoLearnUserProfile = autoLearnUserProfile;

  return {
    buildMemoryInjection, takeMemoryOpts,
    autoUpdateAgentMemories, autoLearnUserProfile,
  };
})();