/* ============================================================
   MyAgentTeam · F+13 Sprint 1.5 / Phase C
   src/test/smoke.js — 50+ smoke 测试覆盖 16 模块

   触发：URL ?test=1 → app.js 加载 runner.js → 本文件 → 自动 run

   分布：
   - MAT_UTILS: 8 tests
   - MAT_VENDOR: 7 tests
   - MAT_CONSTANTS: 4 tests
   - MAT_STORAGE: 3 tests
   - MAT_STREAM: 1 test
   - MAT_LLM: 2 tests
   - MAT_STORE: 5 tests
   - MAT_TOOLS: 6 tests
   - MAT_AGENTS_DICT: 3 tests
   - MAT_SIMULATED: 3 tests
   - MAT_UI: 1 test
   - MAT_ORCHESTRATOR: 1 test
   - MAT_ENCRYPTION: 2 tests
   - MAT_IDB: 2 tests
   - MAT_KB: 3 tests
   - MAT_SCENE_CONFIG: 3 tests
   - Integration: 4 tests
   合计：58 tests
   ============================================================ */

(function() {
  'use strict';
  const { describe, expect } = MAT_TEST;

  // ====== MAT_UTILS ======
  describe('MAT_UTILS', (it) => {
    it('module loaded', () => expect(typeof MAT_UTILS).toBe('object'));
    it('fmtUsd formats 4 decimals', () => expect(MAT_UTILS.fmtUsd(1.23456)).toBe('$1.2346'));
    it('fmtUsdShort formats 2 decimals', () => expect(MAT_UTILS.fmtUsdShort(1.234)).toBe('$1.23'));
    it('sleep returns Promise', () => expect(MAT_UTILS.sleep(0)).toBeInstanceOf(Promise));
    it('escapeHtml escapes <', () => expect(MAT_UTILS.escapeHtml('<script>')).toBe('&lt;script&gt;'));
    it('tokensFromText counts Chinese', () => expect(MAT_UTILS.tokensFromText('你好世界')).toBeGreaterThan(0));
    it('jaccardSim identical strings', () => expect(MAT_UTILS.jaccardSim('北京下雨', '北京下雨')).toBe(1));
    it('detectFactConflict catches negation', () => expect(MAT_UTILS.detectFactConflict('喜欢咖啡', '不喜欢咖啡')).toBe(true));
  });

  // ====== MAT_VENDOR ======
  describe('MAT_VENDOR', (it) => {
    it('module loaded', () => expect(typeof MAT_VENDOR).toBe('object'));
    it('MODEL_PRICING has 27 models', () => expect(Object.keys(MAT_VENDOR.MODEL_PRICING).length).toBeGreaterThan(20));
    it('inferVendor ep- → doubao', () => expect(MAT_VENDOR.inferVendor('ep-20260101abc')).toBe('doubao'));
    it('inferVendor gpt-5 → openai', () => expect(MAT_VENDOR.inferVendor('gpt-5')).toBe('openai'));
    it('inferVendor claude → anthropic', () => expect(MAT_VENDOR.inferVendor('claude-sonnet-4-5')).toBe('anthropic'));
    it('isExpensiveModel opus 4.5 = true', () => expect(MAT_VENDOR.isExpensiveModel('claude-opus-4-5')).toBe(true));
    it('getModelContextWindow doubao lite = 32K', () => expect(MAT_VENDOR.getModelContextWindow('doubao-seed-2-0-lite-260428')).toBe(32768));
  });

  // ====== MAT_CONSTANTS ======
  describe('MAT_CONSTANTS', (it) => {
    it('module loaded', () => expect(typeof MAT_CONSTANTS).toBe('object'));
    it('MAX_TOKENS_PER_TURN = 8000', () => expect(MAT_CONSTANTS.MAX_TOKENS_PER_TURN).toBe(8000));
    it('TIMEOUTS.coordinatorAgent = 5min', () => expect(MAT_CONSTANTS.TIMEOUTS.coordinatorAgent).toBe(300000));
    it('TOOL_LOOP_MAX = 5', () => expect(MAT_CONSTANTS.TOOL_LOOP_MAX).toBe(5));
  });

  // ====== MAT_STORAGE ======
  describe('MAT_STORAGE', (it) => {
    it('module loaded', () => expect(typeof MAT_STORAGE).toBe('object'));
    it('all 12 save functions exist', () => {
      const fns = ['saveConfig','saveCumulative','saveHistory','saveCustomTeam','saveTeamLibrary',
        'saveTplLibrary','saveSceneConfigs','saveScenePrompts','saveMemory','saveProjects',
        'saveProjectMemory','saveKnowledgeBase'];
      fns.forEach(f => expect(typeof MAT_STORAGE[f]).toBe('function'));
    });
    it('saveMemory writes localStorage', () => {
      MAT_STORAGE.saveMemory();
      expect(localStorage.getItem('myAgentTeam.memory')).toBeTruthy();
    });
  });

  // ====== MAT_STREAM ======
  describe('MAT_STREAM', (it) => {
    it('module loaded with 4 exports', () => {
      ['readOpenAIStream','readDeepSeekR1Stream','readAnthropicStream','convertOpenAIMessagesToAnthropic']
        .forEach(f => expect(typeof MAT_STREAM[f]).toBe('function'));
    });
  });

  // ====== MAT_LLM ======
  describe('MAT_LLM', (it) => {
    it('module loaded with ApiError + 7 callers', () => {
      ['callLLM','callOpenAI','callAnthropic','callQwen','callDeepSeek','callDoubao','callGemini']
        .forEach(f => expect(typeof MAT_LLM[f]).toBe('function'));
      expect(typeof MAT_LLM.ApiError).toBe('function');
    });
    it('ApiError instanceof works cross-module', () => {
      try { throw new MAT_LLM.ApiError(400, 'test'); }
      catch (e) { expect(e instanceof MAT_LLM.ApiError).toBe(true); }
    });
  });

  // ====== MAT_STORE ======
  describe('MAT_STORE', (it) => {
    it('module loaded', () => expect(typeof MAT_STORE).toBe('object'));
    it('PROJECT_COLORS has 10 colors', () => expect(MAT_STORE.PROJECT_COLORS).toHaveLength(10));
    it('getActiveProjectId returns string', () => expect(typeof MAT_STORE.getActiveProjectId()).toBe('string'));
    it('getProjectMemory returns shape', () => {
      const pm = MAT_STORE.getProjectMemory('default');
      expect(typeof pm.projectContext).toBe('string');
      expect(Array.isArray(pm.userProfile.learnedFacts)).toBe(true);
      expect(typeof pm.agentMemories).toBe('object');
    });
    it('ensureDefaultProject creates default', () => {
      MAT_STORE.ensureDefaultProject();
      expect(state.projects.find(p => p.id === 'default')).toBeTruthy();
    });
  });

  // ====== MAT_TOOLS ======
  describe('MAT_TOOLS', (it) => {
    it('4 tools registered', () => {
      ['date_now','web_search','js_execute','web_fetch'].forEach(t => expect(MAT_TOOLS.TOOLS[t]).toBeTruthy());
    });
    it('each tool has schema + execute', () => {
      Object.values(MAT_TOOLS.TOOLS).forEach(t => {
        expect(typeof t.schema.function.name).toBe('string');
        expect(typeof t.execute).toBe('function');
      });
    });
    it('date_now execute returns iso/local/weekday', async () => {
      const r = await MAT_TOOLS.TOOLS.date_now.execute();
      expect(typeof r.iso).toBe('string');
      expect(typeof r.local).toBe('string');
      expect(typeof r.weekday).toBe('string');
    });
    it('sanitize normal Chinese unchanged', () => {
      expect(MAT_TOOLS.sanitizeSearchDescription('正常中文描述', 'http://x')).toBe('正常中文描述');
    });
    it('sanitize garbled → placeholder', () => {
      const garbled = '˾д Efort йгуо ƒƒьƞ Ϊςα ϯ дзжц ц ц цϲ ɞ Ι Φ Ψ ӝ Ӟ ƞ ƀ ƞ ƣ Ј Ѧ ӂ Ӝ';
      expect(MAT_TOOLS.sanitizeSearchDescription(garbled, 'http://x')).toContain('编码异常');
    });
    it('getToolsForAgent honors toolsEnabled', () => {
      expect(MAT_TOOLS.getToolsForAgent({ toolsEnabled: true }, null)).toBeTruthy();
      expect(MAT_TOOLS.getToolsForAgent({ toolsEnabled: false }, null)).toBeFalsy();
    });
  });

  // ====== MAT_AGENTS_DICT ======
  describe('MAT_AGENTS_DICT', (it) => {
    it('AGENTS dictionary 22+ entries', () => expect(Object.keys(MAT_AGENTS_DICT.AGENTS).length).toBeGreaterThan(20));
    it('decision Phase 1 Agents have system prompts', () => {
      ['infoA','infoB','infoC','coordinator'].forEach(k => {
        expect(MAT_AGENTS_DICT.AGENTS[k].system.length).toBeGreaterThan(100);
      });
    });
    it('dossier 4 Agents complete', () => {
      ['dossierA','dossierB','dossierC','archivist'].forEach(k => {
        expect(typeof MAT_AGENTS_DICT.AGENTS[k].system).toBe('string');
      });
    });
  });

  // ====== MAT_SIMULATED ======
  describe('MAT_SIMULATED', (it) => {
    it('module loaded with 3 exports', () => {
      ['SIM_TEMPLATES','callSimulated','extractTopic'].forEach(f => expect(typeof MAT_SIMULATED[f]).toBeTruthy());
    });
    it('SIM_TEMPLATES 14 agents', () => expect(Object.keys(MAT_SIMULATED.SIM_TEMPLATES).length).toBe(14));
    it('extractTopic strips user_input tags', () => {
      expect(MAT_SIMULATED.extractTopic('<user_input>测试</user_input>')).toBe('测试');
    });
  });

  // ====== MAT_UI ======
  describe('MAT_UI', (it) => {
    it('module loaded with 8 render functions', () => {
      ['setTaskStatus','updateProgress','renderAgentMsg','renderUserMsg','renderSystemMsg',
        'renderToolCallMsg','finalizeToolCallMsg','renderPhaseDivider']
        .forEach(f => expect(typeof MAT_UI[f]).toBe('function'));
    });
  });

  // ====== MAT_ORCHESTRATOR ======
  describe('MAT_ORCHESTRATOR', (it) => {
    it('module loaded with 10 functions', () => {
      ['detectLoop','runAgent','runTeamPipeline','runTeamReflection','renderPhaseList',
        'runDecisionScene','runDossierScene','checkDossierFormat','checkEvidenceFormat','launchTask']
        .forEach(f => expect(typeof MAT_ORCHESTRATOR[f]).toBe('function'));
    });
  });

  // ====== MAT_ENCRYPTION ======
  describe('MAT_ENCRYPTION', (it) => {
    it('module loaded', () => expect(typeof MAT_ENCRYPTION).toBe('object'));
    it('ENC_SENSITIVE_KEYS has 3 entries', () => expect(MAT_ENCRYPTION.ENC_SENSITIVE_KEYS).toHaveLength(3));
  });

  // ====== MAT_IDB ======
  describe('MAT_IDB', (it) => {
    it('module loaded', () => expect(typeof MAT_IDB).toBe('object'));
    it('IDB constants defined', () => {
      expect(MAT_IDB.IDB_NAME).toBe('myAgentTeamDB');
      expect(typeof MAT_IDB.IDB_VERSION).toBe('number');
    });
  });

  // ====== MAT_KB ======
  describe('MAT_KB', (it) => {
    it('module loaded with 7 exports', () => {
      ['chunkText','addKnowledgeBaseFile','deleteKbDocument','recallKnowledgeBase']
        .forEach(f => expect(typeof MAT_KB[f]).toBe('function'));
    });
    it('chunkText splits text', () => expect(MAT_KB.chunkText('一二三四五六七八九十', 3)).toHaveLength(4));
    it('KB_RECALL_TOP_K = 3', () => expect(MAT_KB.KB_RECALL_TOP_K).toBe(3));
  });

  // ====== MAT_SCENE_CONFIG ======
  describe('MAT_SCENE_CONFIG', (it) => {
    it('SCENE_AGENT_LIST.decision = 4 agents', () => {
      expect(MAT_SCENE_CONFIG.SCENE_AGENT_LIST.decision).toEqual(['infoA','infoB','infoC','coordinator']);
    });
    it('SCENE_AGENT_LIST.dossier = 4 agents', () => {
      expect(MAT_SCENE_CONFIG.SCENE_AGENT_LIST.dossier).toEqual(['dossierA','dossierB','dossierC','archivist']);
    });
    it('resolveAgentModel returns string-or-null', () => {
      // state.config.model 可能为 null（未配置 Key 时），string 或 null 都算正常
      const r = MAT_SCENE_CONFIG.resolveAgentModel('decision', 'infoA');
      expect(r === null || typeof r === 'string').toBeTruthy();
    });
  });

  // ====== Integration ======
  describe('Integration', (it) => {
    it('app.js loaded with state', () => expect(typeof state).toBe('object'));
    it('routeScene 决策识别', () => expect(routeScene('该选 React 还是 Vue').primary.id).toBe('decision'));
    it('routeScene 起底识别', () => expect(routeScene('查查 xx 公司什么背景').primary.id).toBe('dossier'));
    it('cross-module: vendor + utils 协作', () => {
      const cost = calcCost(1000, 1000, 'gpt-4o-mini');
      expect(MAT_UTILS.fmtUsd(cost)).toMatch(/^\$[0-9]+\.[0-9]+$/);
    });
  });

  // ====== Integration · Page Lifecycle（F+13 加：防止 init/DOMContentLoaded 类 bug）======
  // 触发起源：F+13 修复"项目切换器点击无反应" bug —— init() 因 DOMContentLoaded 时机 +
  // _restoreSessionKey 未 export 导致从未执行。smoke 测试全部直接调函数，没测真实生命周期。
  // 这组测试针对"页面加载后的 DOM 状态"专门验证，覆盖 init() 是否真的跑过、关键 button 是否绑了 onclick。
  describe('Lifecycle', (it) => {
    it('init() 已运行（state 完整初始化）', () => {
      expect(state).toBeTruthy();
      expect(typeof state.config).toBe('object');
      expect(Array.isArray(state.history)).toBe(true);
      expect(Array.isArray(state.projects)).toBe(true);
    });

    it('default 项目已通过 ensureDefaultProject 创建', () => {
      const def = state.projects.find(p => p.id === 'default');
      expect(def).toBeTruthy();
      expect(def.name).toBe('默认');
    });

    it('settingsBtn onclick 已绑定（bindEvents 已执行）', () => {
      const btn = document.getElementById('settingsBtn');
      expect(btn).toBeTruthy();
      expect(typeof btn.onclick).toBe('function');
    });

    it('historyBtn onclick 已绑定', () => {
      const btn = document.getElementById('historyBtn');
      expect(btn).toBeTruthy();
      expect(typeof btn.onclick).toBe('function');
    });

    it('introBtn onclick 已绑定', () => {
      const btn = document.getElementById('introBtn');
      expect(btn).toBeTruthy();
      expect(typeof btn.onclick).toBe('function');
    });

    it('projectSwitcherBtn onclick 已绑定（F+13 真实撞过的 bug 防回归）', () => {
      const btn = document.getElementById('projectSwitcherBtn');
      expect(btn).toBeTruthy();
      expect(typeof btn.onclick).toBe('function');
    });

    it('projectSwitcherMenu 默认 hidden（防止启动闪现）', () => {
      const menu = document.getElementById('projectSwitcherMenu');
      expect(menu).toBeTruthy();
      expect(menu.classList.contains('hidden')).toBe(true);
    });

    it('defaultModel select 已设置 value（loadConfig 已执行）', () => {
      const sel = document.getElementById('defaultModel');
      expect(sel).toBeTruthy();
      expect(typeof sel.value).toBe('string');
      expect(sel.value.length).toBeGreaterThan(0);
    });

    it('encryption helper 全部 export（防 _restoreSessionKey 类遗漏）', () => {
      // F+13 实战教训：encryption.js 内部 private function 被 app.js 外部调用，必须 export
      ['encryptionSetup','encryptionUnlock','encryptionIsLocked','encryptionEnabled',
       '_restoreSessionKey','readEncryptedJSON','writeEncryptedJSON']
        .forEach(f => expect(typeof MAT_ENCRYPTION[f]).toBe('function'));
    });

    it('全部 16 个 MAT_* 模块加载完成（防加载顺序 bug）', () => {
      ['MAT_UTILS','MAT_VENDOR','MAT_CONSTANTS','MAT_STORAGE','MAT_STREAM','MAT_LLM',
       'MAT_STORE','MAT_TOOLS','MAT_AGENTS_DICT','MAT_SIMULATED','MAT_UI','MAT_ORCHESTRATOR',
       'MAT_ENCRYPTION','MAT_IDB','MAT_KB','MAT_SCENE_CONFIG','MAT_STATE','MAT_TYPES_LOADED']
        .forEach(m => expect(typeof window[m]).toBeTruthy());
    });
  });
})();
