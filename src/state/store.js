/* ============================================================
   MyAgentTeam · F+13 Sprint 1：模块化拆分
   src/state/store.js — 项目空间 + 跨项目 memory 隔离 API

   职责：
   - 项目 CRUD（create / switch / delete / rename）
   - 项目颜色管理（palette + auto-assign）
   - 项目隔离 memory 访问器（getProjectMemory / getProjectHistory）
   - 旧数据迁移（migrateMemoryToProjects · F+11 落地保护）

   设计原则：
   - 本模块是 state 的"受控变更入口"，鼓励新代码用 store API
   - 旧代码 411 处直接 `state.X` 访问保持不变（避免 big-bang 重构）
   - 后续 Sprint 渐进迁移，最终目标：所有 mutation 经 store

   依赖：
   - window.state（全局，含 projects / activeProjectId / memoryByProject / memory）
   - window.MAT_STORAGE（saveProjects / saveProjectMemory / saveMemory）
   - window.toast（UI 反馈，仍在 app.js）
   ============================================================ */

window.MAT_STORE = (function() {
  'use strict';
  const { saveProjects, saveProjectMemory, saveMemory } = MAT_STORAGE;

  // ====== 项目颜色 palette（F+11.1）======
  // 10 色，覆盖暖/冷/中性。default 项目固定中性灰。
  const PROJECT_COLORS = [
    '#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#06B6D4', '#EC4899', '#84CC16', '#F97316', '#14B8A6',
  ];

  function pickProjectColor() {
    const used = new Set((state.projects || []).map(p => p.color).filter(Boolean));
    const free = PROJECT_COLORS.filter(c => !used.has(c));
    if (free.length) return free[Math.floor(Math.random() * free.length)];
    // 全用完了 → 按 index 兜底
    return PROJECT_COLORS[(state.projects || []).length % PROJECT_COLORS.length];
  }

  function ensureProjectColors() {
    if (!Array.isArray(state.projects)) return;
    let changed = false;
    state.projects.forEach(p => {
      if (!p.color) {
        // default 项目用中性灰，其他随机分配
        p.color = (p.id === 'default') ? '#6B7280' : pickProjectColor();
        changed = true;
      }
    });
    if (changed) saveProjects();
  }

  // ====== Active project resolution ======
  function getActiveProjectId() {
    return state.activeProjectId || 'default';
  }

  // ====== 项目隔离 memory 访问器（F+11 Level 3 核心）======
  // 5 路记忆里 projectContext / userProfile / agentMemories 按项目隔离
  // 全局共享：settings / knowledgeBase / cumulative
  function getProjectMemory(pid) {
    pid = pid || getActiveProjectId();
    if (!state.memoryByProject) state.memoryByProject = {};
    if (!state.memoryByProject[pid]) {
      state.memoryByProject[pid] = {
        projectContext: '',
        userProfile: { learnedFacts: [] },
        agentMemories: {},
      };
    }
    const pm = state.memoryByProject[pid];
    // 防御：旧迁移可能缺字段
    if (!pm.userProfile) pm.userProfile = { learnedFacts: [] };
    if (!pm.userProfile.learnedFacts) pm.userProfile.learnedFacts = [];
    if (!pm.agentMemories) pm.agentMemories = {};
    if (typeof pm.projectContext !== 'string') pm.projectContext = '';
    return pm;
  }

  function getProjectHistory(pid) {
    pid = pid || getActiveProjectId();
    return (state.history || []).filter(h => (h.projectId || 'default') === pid);
  }

  // ====== 项目初始化 + 旧数据迁移 ======
  function ensureDefaultProject() {
    if (!Array.isArray(state.projects)) state.projects = [];
    if (!state.projects.find(p => p.id === 'default')) {
      state.projects.unshift({ id: 'default', name: '默认', color: '#6B7280', createdAt: Date.now() });
    }
    if (!state.activeProjectId || !state.projects.find(p => p.id === state.activeProjectId)) {
      state.activeProjectId = 'default';
    }
    ensureProjectColors();  // F+11.1 给所有缺色项目补色
  }

  /**
   * 旧数据（pre-F+11）迁移：state.memory 内的 projectContext / userProfile / agentMemories
   * → state.memoryByProject.default
   * 幂等：只在 default 项目 memory 还没初始化时执行
   */
  function migrateMemoryToProjects() {
    ensureDefaultProject();
    if (!state.memoryByProject) state.memoryByProject = {};
    if (!state.memoryByProject.default) {
      const old = state.memory || {};
      state.memoryByProject.default = {
        projectContext: old.projectContext || '',
        userProfile: old.userProfile && old.userProfile.learnedFacts ? old.userProfile : { learnedFacts: [] },
        agentMemories: old.agentMemories || {},
      };
      // 清空旧字段防止双写
      if (state.memory) {
        state.memory.projectContext = '';
        state.memory.userProfile = { learnedFacts: [] };
        state.memory.agentMemories = {};
      }
      saveMemory();
      saveProjectMemory();
    }
  }

  // ====== 项目 CRUD ======
  function createProject(name) {
    const n = (name || '').trim() || '未命名项目';
    // F+11.1 重名检查（避免下拉里出现 2 个同名项目无法区分）
    if (state.projects.find(p => p.name === n)) {
      if (typeof toast === 'function') toast('项目名已存在', 'warn');
      return null;
    }
    const id = 'proj_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const p = { id, name: n, color: pickProjectColor(), createdAt: Date.now() };
    state.projects.push(p);
    state.activeProjectId = id;
    saveProjects();
    saveProjectMemory();
    return p;
  }

  function switchProject(pid) {
    if (!state.projects.find(p => p.id === pid)) return false;
    state.activeProjectId = pid;
    saveProjects();
    return true;
  }

  function deleteProject(pid) {
    if (pid === 'default') return false;  // default 不允许删
    state.projects = state.projects.filter(p => p.id !== pid);
    if (state.memoryByProject) delete state.memoryByProject[pid];
    if (state.activeProjectId === pid) state.activeProjectId = 'default';
    saveProjects();
    saveProjectMemory();
    return true;
  }

  function renameProject(pid, newName) {
    const p = state.projects.find(p => p.id === pid);
    if (!p) return false;
    p.name = (newName || '').trim() || p.name;
    saveProjects();
    return true;
  }

  return {
    PROJECT_COLORS,
    // active project
    getActiveProjectId,
    // memory accessors（按项目隔离）
    getProjectMemory, getProjectHistory,
    // 初始化 + 迁移
    ensureDefaultProject, ensureProjectColors, migrateMemoryToProjects,
    // 项目 CRUD
    createProject, switchProject, deleteProject, renameProject,
    // 颜色 helper
    pickProjectColor,
  };
})();
