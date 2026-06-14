/* ============================================================
   MyAgentTeam · F+13 Sprint 1：模块化拆分
   src/persist/storage.js — localStorage 持久化层

   职责：
   - 12 个简单 save 函数（state.X → localStorage）
   - 每个函数都是单一职责，无副作用扩散

   保留在 app.js（依赖过重，未在本次拆分）：
   - loadConfig（70+ 行，含 11 个 try-catch + F+11 项目迁移逻辑）
   - saveActiveTask（依赖 state.task 内部结构）
   - 加密层（ENC_SENSITIVE_KEYS / _deriveKeyFromPassword / _sessionKey）
   - 这些下次 Sprint 1 推进时再拆

   依赖：window.state (全局) · window.MAT_CONSTANTS (storage keys)
   ============================================================ */

window.MAT_STORAGE = (function() {
  'use strict';
  const C = MAT_CONSTANTS;

  function saveConfig() {
    if (!state.config.remember) {
      localStorage.removeItem(C.STORAGE_KEY);
      return;
    }
    localStorage.setItem(C.STORAGE_KEY, JSON.stringify(state.config));
  }

  function saveCumulative() {
    localStorage.setItem(C.CUMULATIVE_KEY, JSON.stringify(state.cumulative));
  }

  function saveHistory() {
    // FIFO cap：保留最近 HISTORY_LIMIT 条
    if (state.history.length > C.HISTORY_LIMIT) {
      state.history = state.history.slice(-C.HISTORY_LIMIT);
    }
    localStorage.setItem(C.HISTORY_KEY, JSON.stringify(state.history));
  }

  function saveCustomTeam() {
    localStorage.setItem(C.TEAM_KEY, JSON.stringify(state.customTeam));
  }

  function saveTeamLibrary() {
    localStorage.setItem(C.TEAM_LIBRARY_KEY, JSON.stringify(state.teamLibrary));
  }

  function saveTplLibrary() {
    localStorage.setItem(C.TPL_LIBRARY_KEY, JSON.stringify(state.tplLibrary));
  }

  function saveSceneConfigs() {
    localStorage.setItem(C.SCENE_CFG_KEY, JSON.stringify(state.sceneConfigs));
  }

  function saveScenePrompts() {
    localStorage.setItem(C.SCENE_PROMPT_KEY, JSON.stringify(state.scenePrompts));
  }

  function saveMemory() {
    localStorage.setItem(C.MEMORY_KEY, JSON.stringify(state.memory));
  }

  function saveProjects() {
    localStorage.setItem(C.PROJECTS_KEY, JSON.stringify(state.projects));
    if (state.activeProjectId) localStorage.setItem('myAgentTeam.activeProjectId', state.activeProjectId);
  }

  function saveProjectMemory() {
    try {
      localStorage.setItem(C.MEMORY_BY_PROJECT_KEY, JSON.stringify(state.memoryByProject || {}));
    } catch (e) {
      console.warn('saveProjectMemory failed', e);
    }
  }

  function saveKnowledgeBase() {
    localStorage.setItem(C.KB_KEY, JSON.stringify(state.knowledgeBase));
  }

  // F+17：上次失败的 model ID 记录（让下拉给该 model 加 ⚠ 标）
  function saveModelFailures() {
    try {
      localStorage.setItem(C.MODEL_FAILURES_KEY, JSON.stringify(state.modelFailures || {}));
    } catch (e) {
      console.warn('saveModelFailures failed', e);
    }
  }
  function loadModelFailures() {
    try {
      const raw = localStorage.getItem(C.MODEL_FAILURES_KEY);
      if (raw) state.modelFailures = JSON.parse(raw) || {};
    } catch (e) {
      console.warn('loadModelFailures failed', e);
    }
  }

  // F+17.1：用户填过的自定义 model ID 列表
  function saveCustomModels() {
    try {
      localStorage.setItem(C.CUSTOM_MODELS_KEY, JSON.stringify(state.customModels || []));
    } catch (e) {
      console.warn('saveCustomModels failed', e);
    }
  }
  function loadCustomModels() {
    try {
      const raw = localStorage.getItem(C.CUSTOM_MODELS_KEY);
      if (raw) state.customModels = JSON.parse(raw) || [];
    } catch (e) {
      console.warn('loadCustomModels failed', e);
    }
  }

  // F+17.3：用户主动隐藏的 hardcode model（过期版本）
  function saveHiddenModels() {
    try {
      localStorage.setItem(C.HIDDEN_MODELS_KEY, JSON.stringify(state.hiddenModels || {}));
    } catch (e) {
      console.warn('saveHiddenModels failed', e);
    }
  }
  function loadHiddenModels() {
    try {
      const raw = localStorage.getItem(C.HIDDEN_MODELS_KEY);
      if (raw) state.hiddenModels = JSON.parse(raw) || {};
    } catch (e) {
      console.warn('loadHiddenModels failed', e);
    }
  }

  // F+17.5：永久移除（UI 不可撤销，仅通过重置偏好后门恢复）
  function savePurgedModels() {
    try {
      localStorage.setItem(C.PURGED_MODELS_KEY, JSON.stringify(state.purgedModels || {}));
    } catch (e) {
      console.warn('savePurgedModels failed', e);
    }
  }
  function loadPurgedModels() {
    try {
      const raw = localStorage.getItem(C.PURGED_MODELS_KEY);
      if (raw) state.purgedModels = JSON.parse(raw) || {};
    } catch (e) {
      console.warn('loadPurgedModels failed', e);
    }
  }

  return {
    saveConfig, saveCumulative, saveHistory,
    saveCustomTeam, saveTeamLibrary, saveTplLibrary,
    saveSceneConfigs, saveScenePrompts,
    saveMemory, saveProjects, saveProjectMemory,
    saveKnowledgeBase,
    saveModelFailures, loadModelFailures,
    saveCustomModels, loadCustomModels,
    saveHiddenModels, loadHiddenModels,
    savePurgedModels, loadPurgedModels,
  };
})();
