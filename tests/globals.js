/**
 * tests/globals.js
 * 让 vm 沙盒里的符号形态与测试期望一致：
 *  1) 把 window.MAT_XXX 命名空间成员平铺为全局裸名（模拟生产的"双暴露"）
 *  2) 从 app.js 的词法作用域中提取顶层 const（PRESET_TEAMS / MODE_LABEL / SCENE_FLOWS 等）
 *
 * 背景：生产是 index.html 顺序加载 IIFE 模块 + app.js；测试沙盒用 vm.runInContext，
 * 顶层 const 不会自动成为 global 属性，IIFE 内部符号只挂在 MAT_XXX 上，
 * 而测试用例按裸名访问（sb.AGENTS / sb.PRESET_TEAMS ...）。本模块负责对齐这两者。
 */
const vm = require('vm');

// 只在 sandbox 尚无该键时填入，避免覆盖 window 上真实的同名导出
function setIfMissing(sandbox, key, value) {
  if (value === undefined) return;
  if (!Object.prototype.hasOwnProperty.call(sandbox, key) || sandbox[key] === undefined) {
    sandbox[key] = value;
  }
}

// app.js 顶层 const/let 中测试需要按裸名访问的名字
const APP_LEXICAL = [
  'PRESET_TEAMS',
  'MODE_LABEL',
  'SCENE_FLOWS',
  'SCENES',
  'MAX_INTERVENTIONS',
  'MAX_USER_INPUT_LEN',
  'MAX_TOKENS_PER_TURN',
  'TOTAL_TOKEN_BUDGET',
  'COST_CAP_USD',
];

function exposeGlobals(sandbox) {
  // 1) 平铺 MAT_* 命名空间
  for (const ns of Object.keys(sandbox)) {
    if (!ns.startsWith('MAT_')) continue;
    const bag = sandbox[ns];
    if (!bag || typeof bag !== 'object') continue;
    for (const key of Object.keys(bag)) {
      // MAT_AGENTS_DICT.AGENTS 这类需要按裸名 AGENTS 访问
      setIfMissing(sandbox, key, bag[key]);
    }
  }

  // 1.5) 测试兼容桥接：F+11 起记忆改为按项目隔离（getProjectMemory() 从
  //      state.memoryByProject[default] 读），而旧单测仍写 state.memory.*。
  //      两者字段结构一致（projectContext / userProfile / agentMemories），
  //      这里让默认项目的记忆对象直接引用 state.memory，使两种写法等价。
  //      仅影响测试沙盒，不触碰生产代码。
  if (sandbox.state && sandbox.state.memory) {
    if (!sandbox.state.memoryByProject) sandbox.state.memoryByProject = {};
    const defaultPid = (typeof sandbox.getActiveProjectId === 'function')
      ? sandbox.getActiveProjectId() : 'default';
    sandbox.state.memoryByProject[defaultPid || 'default'] = sandbox.state.memory;
  }

  // 2) 提取 app.js 顶层词法常量
  for (const name of APP_LEXICAL) {
    try {
      const v = vm.runInContext(
        `typeof ${name} !== 'undefined' ? ${name} : undefined`, sandbox
      );
      setIfMissing(sandbox, name, v);
    } catch (_) { /* 该常量不存在则跳过 */ }
  }
  return sandbox;
}

module.exports = { exposeGlobals, APP_LEXICAL };
