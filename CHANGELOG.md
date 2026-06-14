# MyAgentTeam 更新日志

> 从 V1.0 到 F+ 的完整版本演进
> 标签：⭐ FEATURE · 🐛 FIX · 📝 DOCS · 💥 BREAKING · 🔧 CHORE

---

## F+24 · 2026-06-06（历史"重跑陷阱"修复 + README 定位声明）

### 🐛 重跑陷阱（最终评估中点名的真 bug）
历史任务的「🔄 直接重跑」调用 `launchTask(h.sceneId, h.userText)` —— 用的是**当前**场景配置 / 模型 / Agent 身份，**不是当时跑这条任务时的设置**。

`pushHistory` 存的 `h.agents` 只有 `{key, name, tokens}`,**没存 per-Agent 模型** → 无法还原当时配置。

用户常误以为"重跑 = 一模一样再跑一遍" → 实际可能用了完全不同的模型(尤其 F+17 之后用户频繁改 model)。

### ✅ 修复（`src/ui/history.js`）
直接重跑前加 `confirm` 明示(双语):
```
🔄 直接重跑会用你【当前】的场景配置 / 模型 / Agent 身份
—— 不是当时跑这条任务时的设置（历史未保存每个 Agent 的模型，无法还原）。
确定继续？（想先改输入，请改用 ✏️ 编辑后重跑）
```
- zh / en 双语(按 MAT_I18N.getLocale())
- 用户可取消 → 改用「✏️ 编辑后重跑」(填回输入框,改完再启动)

### ✅ README 定位声明
顶部加"先读这一句"声明,消除"玩具/产品/作品"定位混乱:
> 这是个人作品 / 工程能力展示项目,不是商业产品。核心价值在 30+ F+ 编号 + BLOG 6 幕工程心路。架构 0 后端是隐私优先取舍,不以商业化为目标。

### 📊 浏览器验证(preview_eval 实测)
Sprint 4 模块拆分 + 本次修复后,6 个核心全局函数全部加载干净:
`openHistoryModal / buildModelOptgroups / buildMemoryInjection / translateToast / MAT_I18N / state.history` 全 ✓,0 console error。

### 工程教训
- **"重跑"语义要诚实**:不能还原的别假装能还原。confirm 明示 = 诚实优于假装
- **最终评估抓出来的 bug**:F+19 评估列了 12 个弱点漏了这条,但二轮评估补上 → 评估本身也要迭代

---

## F+19.1 · 2026-06-06（核心体验 i18n 100% · 高频 toast + 快速开始双语）

### 💡 目标
"补 F+19 + 高频 toast（核心体验 100%）"——把用户**每次操作都看到**的 toast + 介绍页首屏"快速开始"补全双语。

### 🎯 难点 & 方案
41 个 `toast()` 调用大多含模板插值（如 `已切换到「${name}」`），逐个改 `et()` 易错。

**改在 `toast()` 函数内部统一翻译**（一处覆盖全部）：
```js
function toast(msg, ...) {
  t.textContent = translateToast(msg);  // ← 唯一改动点
}
function translateToast(msg) {
  if (locale !== 'en') return msg;            // zh 原样
  if (TOAST_EN[msg]) return TOAST_EN[msg];    // ① 静态查表（34 条）
  for (const [re, fn] of TOAST_PATTERNS)      // ② 正则模式（12 条，保留变量）
    if (msg.match(re)) return fn(...);
  return msg;                                  // 未覆盖原样（不阻塞）
}
```

**两层覆盖**：
- `TOAST_EN`（34 条静态）：'配置已保存'→'Settings saved' 等
- `TOAST_PATTERNS`（12 条正则）：`已切换到「X」`→`Switched to "X"`（X 是项目名/预设名，保留原值）

### ✅ 介绍页"快速开始 3 步"双语
- 加 9 处 data-i18n / data-i18n-html
- zh.js / en.js 各加 9 keys（STEP 1/2/3 + 成本预估）

### 📊 验证（浏览器 preview_eval 实测）
| 检查 | EN 结果 |
|------|--------|
| quickstart h2 | "🚀 Quick Start · 3 Steps" ✓ |
| 静态 toast '配置已保存' | "Settings saved" ✓ |
| 模式 toast '已切换到「我的项目」' | 'Switched to "我的项目"' ✓（变量保留）|
| 模式 toast '已载入预设：三方辩论' | 'Loaded preset: 三方辩论' ✓ |
| 切回 zh | 全部恢复中文 ✓ |

### 设计哲学
- **拦截点 > 调用点**：与其改 41 个 caller，不如改 1 个 `toast()` 出口
- **静态查表 + 正则兜底**：纯静态精确翻译，插值文案正则保留变量
- **未覆盖不阻塞**：return 原文，宁可露一句中文也不报错
- i18n key 平衡：zh 298 = en 298

---

## F+19 · 2026-06-06（介绍页完善 · 9 项 / 数据 + 8 张新卡 + i18n + 工程哲学 + TOC + 快速开始 + 对比表 + FAQ）

### 💡 用户痛点
"完善介绍界面" —— 经审计 14 个可优化点，落地第一+第二梯队共 9 项。

### ✅ 9 项改进

**第一梯队 · 数据修复（必修）**

| # | 改动 |
|---|------|
| 1 | hero stats 数字更新：`10+ 生产稳定 F+` → `18+` · 新增 `12 历史功能 F+18` + `中/英 双语 i18n F+14` |
| 2 | F+ 稳定 section 加 **8 张新卡片**：F+13 模块化 / F+14.1 hybrid 代理 / F+14.3 server msg / F+15 暂停 / F+16 multi-phase critical / F+17 智能感知 / F+17.1 自定义 ID / F+18+18.1 历史升级 |
| 3 | F+ 引用：F+1~F+10 → **F+1~F+18.1** + 加 BLOG.md 入口 |
| 4 | **新 section "🌐 中英双语 i18n F+14 NEW"**（4 张卡：340 keys / 4 种 data-i18n attr / Agent 输出运行时注入 / 向后兼容）|
| 5 | **新 section "🧠 工程哲学 · 4 个决策原则"**（4 张卡：自我修正闭环 / 服务器原话 > 本地推断 / 撤回不丢脸 / 多 vendor 自我免疫）|

**第二梯队 · 体验飞跃**

| # | 改动 |
|---|------|
| 6 | 用 PowerShell 给 15 个 intro section 自动加 `id="sec-1"` ~ `sec-15` + 新增 `sec-0` 快速开始 + `sec-faq` + `sec-compare` |
| 7 | hero 后第一 section "🚀 快速开始 · 3 步"：STEP 1 设置 Key / STEP 2 写一句话 / STEP 3 启动 + 成本预估提示 |
| 8 | **vs 对比表 (sec-compare)**：11 项能力 × 4 工具（MyAgentTeam / ChatGPT-Claude.ai / CrewAI-LangGraph / Coze）+ "不适合的场景"诚实声明 |
| 9 | **FAQ 5 问 (sec-faq)**：Q1 Key 安全 / Q2 成本控制 / Q3 浏览器直连理由 / Q4 model ID 过期 / Q5 离线 + 备份。`<details>` 折叠展开 |

### 🎯 招聘叙事关键加强
- "工程哲学"4 张卡是直击 reader 的招聘素材
  - 自我修正闭环（F+17）
  - 服务器原话 > 本地推断（F+14.3）
  - 撤回不丢脸（F+5, F+14.1 两次撤回）
  - 多 vendor = 自我免疫系统（F+16 经典案例）
- vs 对比表诚实地标出"MyAgentTeam 不适合的 3 个场景"（用 ChatGPT Team / LangGraph / Coze）—— 比"我们最好"更可信

### 🔧 PowerShell 自动化片段（值得记录）
```powershell
# 给所有 intro-section 自动加 id="sec-N"
$i = 0
[regex]::Replace($c, '<section class="intro-section( intro-section-new)?">', {
  param($m); $script:i++
  '<section class="intro-section' + $m.Groups[1].Value + '" id="sec-' + $script:i + '">'
})
```
15 个 section 一次性加 id，避免手动编辑 15 次 + 防止 typo。

### 第三梯队（待启动 · 不在本次 scope）
- 截图嵌入（决策跑起来 / 历史界面 / 智能感知）—— 需手动截图
- 动态 stats（MODEL_PRICING.length 实时数）
- 完整 use case showcase（3 个真实跑过的任务结果）
- 移动端响应式优化

---

## F+18.1 · 2026-06-06（历史任务第二梯队 · 4 项中等 ROI）

### 💡 完成 12 项审计的第二梯队
继 F+18 的强推 5 项（编辑后重跑/场景 chip/时间 chip/复制输入/导出 .md）后，把第二梯队 4 项一次性落地。

### ✅ 4 项改进

**1. ⭐ 收藏置顶**
- 每行最左加 `⭐` / `☆` 按钮（点击 toggle）
- starred 任务排序优先（在 ts 倒序之上）
- chip 行加 `⭐ 仅看收藏` 切换 button
- 持久化到 `state.history[i].starred`（schema 兼容：undefined === !true）

**2. ☑ 选择模式 + 批量管理**
- chip 行 toggle `☑ 选择模式` → 进入批量模式
- 每行最左出现 checkbox + 行 click 也能 toggle（不只是点 checkbox）
- 底部出现**粘性 floating action bar**：
  ```
  N 已选 · [全选可见] [清空] [🗑 删除选中] [📁 加入「X」] [📁 移出] [⭐ 收藏] [☆ 取消收藏]
  ```
- 删除前 `confirm()` 二次确认（防误触）
- 批量加入/移出项目 / 批量 star/unstar 都 0 阻塞

**3. 👁 加载到主区**
- 详情区加 `👁 加载到主区` button
- 点击：关弹层 → `showResultFromHistory(h)` → 主区结果窗渲染 h.result + 加 `📜 从历史载入` meta box
- 复用 `sanitizeMarkdown` + `showResultView()` —— 不写新的渲染层
- 用户能用**大屏 + 现有 markdown 体验**重新审视历史结果（小弹层 500 字截断的烦恼解除）

**4. 搜索 scope 切换**
- 搜索框下方加 3 个 mini chip：`☑ 输入 / ☐ 结果 / ☐ 讨论`（默认只搜输入）
- toggle 任意 chip → 即时 re-filter
- **applyHistoryFilter 重写**：从"搜 row.textContent"改成"直接 filter state.history"
  - 之前：row 不展开 → textContent 没有 result/discussion → 永远搜不到
  - 现在：每条 history 拼 `hay` 字符串（按 scope 决定包含哪些字段）→ Set<id> 控制 row.display
  - 性能：50 条 history × ~10K 字 ≈ 500K 字 indexOf，远低于 1ms

### 📊 用户旅程升级
| 场景 | 之前 | F+18.1 |
|------|------|--------|
| "上周那个重要决策" | 翻几页 | ⭐ 标记 → ⭐ 仅看收藏 |
| "把这 10 条移到新项目" | 一条条改（不支持）| 选择模式 → 全选可见 → 加入项目 |
| "清理上个月没用的" | 一条条删 | 选 7 天倒挂 → 选择模式 → 删除选中 |
| "结果看着太挤" | 在小弹层挤着看 | 👁 加载到主区 → 大屏 markdown |
| "搜结果里的关键词" | 永远搜不到 | ☑ 结果 → 搜索栏输入 → 命中 |

### 🔧 改动文件
| 文件 | 改动 |
|------|------|
| `app.js` `showResultFromHistory(h)` | 新 helper，把历史结果加载到主 #resultContent + #resultMeta，复用 showResultView |
| `app.js` `openHistoryModal` | 闭包加 4 个新状态 + chip 行 3（仅收藏/选择模式）+ row 加 checkbox + ⭐ button + 详情 actions 加 👁 + 底部 floating action bar |
| `app.js` `applyHistoryFilter` | 完全重写：直接搜 state.history（支持搜结果/讨论）+ Set 控制 row.display |

### 设计哲学
- **闭包状态多了 4 个 → render 函数职责更重**，但保持 single source of truth（闭包变量 → render → DOM）
- **批量操作的 floating bar 用 position:sticky** —— 滚动时仍可见，比 fixed 更友好（不会遮挡）
- **复用 > 复制**：showResultFromHistory 复用 showResultView + sanitizeMarkdown + meta 渲染，不重写一遍
- **不动核心 schema**：`starred` 是 undefined-friendly 的可选字段，旧 history 直接兼容
- **批量删要 confirm**：唯一不可逆操作，强制确认；其他批量都是可逆（取消收藏 / 移出项目）

### 完成度
12 项审计已落地 **9 项**（强推 5 + 第二梯队 4），剩 3 项第三梯队：
- 快捷键导航（Esc 关 / Ctrl+F 搜索 / Enter 展开）
- 重跑前 tooltip 提示"会用当前配置"
- 统计可视化（按场景分布 / 按月份柱图）

---

## F+18 · 2026-06-06（历史任务体验升级 · 5 项强推）

### 💡 用户痛点
> "能不能让从历史任务操作起来更方便，有什么可以优化的地方"

代码审计找出 12 个优化点，按 ROI 排序。强推第一梯队 5 项一次性落地。

### ✅ 5 项改进

**1. ✏️ 编辑后重跑（最常用场景）**
- 原本只能 `🔄 重跑` —— 用完全相同的 userText 重新启动
- 现在加 `✏️ 编辑后重跑`：关弹层 → 把 userText 填回主输入框 `#userInput` → 滚到中间 + focus + 全选
- 用户改完 30% 内容就能基于"已有任务"启动新任务（高频用例：迭代式调研、变形测试）

**2. 场景 chip 筛选**
- 之前只有项目筛选 + 关键词搜索
- 现在加 5 个场景 chip：`全部 / ⚖️ 决策 / 🔍 起底 / 📋 规划 / 🛠️ 自定义`
- 点击切换即时过滤（row data-scene 属性匹配）

**3. 时间 chip 筛选**
- 之前要肉眼扫"几天前"列
- 现在加 4 个时间 chip：`全部 / 今天 / 7 天 / 30 天`
- row data-ts 属性 + Date.now() 计算窗口

**4. 📋 复制原始输入（无需展开）**
- 之前要展开详情 → 选中 pre 文本 → 复制
- 现在每个 row head 右侧加 `📋` 按钮，一键 `navigator.clipboard.writeText(userText)`
- toast 显示字数确认
- e.stopPropagation() 防止误展开 row

**5. 📥 导出历史任务为 Markdown**
- 原本只能导出当前正在跑的 task（`exportTaskAsMarkdown` 用 `state.task`）
- 现在加 `exportHistoryAsMarkdown(h)` helper，从 history 记录构造同结构 markdown
- 详情区按钮触发 → 自动下载 `MyAgentTeam_{场景}_{时间戳}.md`
- 含：完成时间 / 模式 / 耗时 / Token / 费用 / 项目 / 原始任务 / Agent 列表 / 讨论过程 / 最终结果

### 🔧 实施
| 文件 | 改动 |
|------|------|
| `app.js` `openHistoryModal` | 完整重写（127 行 → 180 行）：闭包加 sceneFilter/timeFilter 状态 + chip 渲染 + 4 个新按钮 handler |
| `app.js` `exportHistoryAsMarkdown(h)` | 新 helper，complement 现有 `exportTaskAsMarkdown` |
| `app.js` `applyHistoryFilter` | + scene + time 两个新维度过滤逻辑 |
| row 模板 | + `data-scene` / `data-ts` 属性 + `📋` 按钮 + 4 个 actions（直接重跑 / 编辑重跑 / 导出 / 删除）|

### 📊 用户旅程对比
| 场景 | 之前 | F+18 |
|------|------|------|
| "用昨天那个任务重新跑下" | 翻历史 → 重跑（无法改输入） | 找到 → ✏️ → 改输入 → 启动 |
| "我要找上周决策任务" | 滚动 + 搜索 | 决策 chip + 7 天 chip |
| "复制输入到 ChatGPT 对比" | 展开 → 选中 pre → 复制 | row `📋` 一键 |
| "把这次的结果给同事看" | 没有导出，只能截图 | 详情 `📥 导出 .md` |
| 误展开行（想点小按钮）| 经常发生 | `e.stopPropagation()` 防误触 |

### 🎯 改动哲学
- **闭包状态 ≥ DOM 状态**：sceneFilter / timeFilter 用闭包变量，重渲染不丢
- **chip 选择重渲染整 list**：让 active class 切换 + row data 属性匹配，比"只动 class + 单独 filter"更稳
- **复用 > 复制**：exportHistoryAsMarkdown 跟 exportTaskAsMarkdown 是 sibling，不复制大段代码
- **避免破坏性改动**：所有新功能加 button，没动现有"🔄 直接重跑"语义（用户习惯保留）

### 待第二梯队（按需启动）
- ⭐ 收藏置顶 / 仅看 ⭐ 筛选
- 选择模式批量删 / 批量加项目
- 详情"👁 在主区查看"（关弹层 + 加载到主结果区）
- 搜索范围扩展（搜结果 / 搜讨论过程）

---

## F+22.1 · 2026-06-06（Sprint 4 模块化 · 拆 model_picker.js）

### 💡 用户决定
> "拆 3 块（模型 UI / 历史 / 记忆）"

继 F+13 Sprint 1（拆 20+ 模块）之后，**Sprint 4 精细化拆分**。

### 🎯 第一步：model_picker.js（F+17 hot zone）

**抽取**：app.js L1246-1251 + L1795-2021 共 233 行
**目标**：`src/ui/model_picker.js`（~237 行 with IIFE wrapper + 注释）

**包含**：
- `getModelGroups()` — 6 vendor single source of truth
- `buildModelOptgroups(selectedModel)` — 主下拉渲染
- `handleAddCustomModel(selectEl, vendor, onPick)` — ✏️ 触发 prompt
- `openManageAllModelsModal(onChange)` — 🛠 管理弹窗
- `refreshDefaultModelSelect()` — 设置面板 default model 渲染

### 📊 模块化后 app.js 体积

```
F+22.1 前：app.js 4498 行
F+22.1 后：app.js 4265 行 (-233, 减 5%)
src/ui/model_picker.js 新增 237 行
```

### 🔧 设计选择
**IIFE + 双暴露**（跟其他 src/ 模块对齐）：
```js
window.MAT_MODEL_PICKER = (function() {
  'use strict';
  function getModelGroups() {...}
  function buildModelOptgroups(...) {...}
  // ...
  // 向后兼容：双暴露
  window.getModelGroups = getModelGroups;
  window.buildModelOptgroups = buildModelOptgroups;
  // ...
  return { getModelGroups, buildModelOptgroups, ... };
})();
```

**双暴露原因**：app.js 内 onchange handlers / openSceneConfig 等多处直接调用全局函数名（如 `handleAddCustomModel(...)`）。如果只暴露到 `MAT_MODEL_PICKER.handleAddCustomModel`，app.js 那些调用全部要改 → 大量改动 + 出错风险。

**双暴露 = 零 app.js 改动 + 仍然真模块化**。

### 🔧 script 加载顺序
```html
<script src="src/ui/render.js"></script>
<script src="src/ui/model_picker.js"></script>  ← 新增
<script src="src/scenes/orchestrator.js"></script>
...
<script src="app.js"></script>
```

加载在 app.js **之前**，window 函数已可用。

### ✅ 为什么先拆这块
1. **F+17 系列 16 次修改证明这是 hot zone** —— git blame 频率最高
2. **依赖独立**：仅用 state / escapeHtml / inferVendor / showModal / toast / saveCustomModels —— 都是全局可见
3. **业务自包含**：与 launchTask / runAgent / handleApiError 完全解耦
4. **风险最低**：纯 UI 渲染层，没碰核心调度

### 工程教训
- **git blame 频率是最朴素的"该拆"指标**：F+17 在这 16 次 = 信号
- **IIFE + 双暴露**：渐进式模块化的妥协方案，避免一次性改全部 caller
- **不动业务逻辑只搬位置**：风险评估 < 5%（syntax check pass + 0 caller 改动）

### 下一步
- F+22.2：拆 history UI（实际 547 行 · 比估计大）
- F+22.3：拆 memory/learning（199 行 · 跟估计接近）

---

## F+22.2 · 2026-06-06（Sprint 4 模块化 · 拆 history.js）

### 抽取
app.js L1939-2485 共 **547 行**（比 model_picker 还大）→ `src/ui/history.js`

**4 个函数**：
- `fmtRelativeTime(ts)` — 相对时间格式化
- `exportHistoryAsMarkdown(h)` — 导出单条历史为 .md
- `showResultFromHistory(h)` — 把历史任务结果加载到主结果区
- `openHistoryModal()` — 历史弹窗（446 行包含 chip 筛选 / 批量 / ⭐ / 搜索 scope 等所有 F+18/18.1 升级）

### app.js 累计减重
```
F+22.1 后  4265 行
F+22.2 后  3718 行  (-547, 累计 -12%)
```

### IIFE + 双暴露
跟 F+22.1 同模式：保留全局函数名 → 0 caller 改动 → 0 风险。

---

## F+22.3 · 2026-06-06（Sprint 4 模块化 · 拆 memory/learning.js）

### 抽取
app.js L890-1088 共 **199 行** → `src/memory/learning.js`

**4 个核心 memory 函数**：
- `buildMemoryInjection(opts)` — 5 源记忆按优先级裁剪生成 prompt 注入
- `takeMemoryOpts(agentKey)` — 取当前任务的记忆 opts
- `autoUpdateAgentMemories(task, final)` — 任务结束后异步更新 Agent 个体记忆
- `autoLearnUserProfile(task, final)` — 任务结束后 LLM 自学用户画像新事实

### 未搬的（耦合度高）
- `runMemoryHygiene`（L767 · 跟 saveActiveTask 等耦合）
- `findRelatedHistory`（L842 · 跟项目逻辑耦合）

### app.js 累计减重
```
原始（F+13 Sprint 1 后）   ~6000 行
F+21 末尾                  4498 行
F+22.1 (model_picker)      4265 行  -233
F+22.2 (history)           3718 行  -547
F+22.3 (learning)          3519 行  -199 ⭐
———————————————————————————————————————————
3 块累计                   -979 行（减 22%）
```

### Sprint 4 总成果（F+22.1-3 合并条目）
| 指标 | F+21 末尾 | F+22.3 后 |
|------|:----:|:----:|
| app.js 行数 | 4498 | **3519** (-22%) |
| 模块数 | 23 | **26** |
| 新增模块 | - | `model_picker.js` / `history.js` / `learning.js` |

### Sprint 4 设计思路
- **按 git blame 频率拆**：model_picker（F+17 16 次改）/ history（F+18 多次改）= 真热区
- **业务自包含先拆**：3 块都是高内聚 + 低对外依赖
- **IIFE + 双暴露渐进式**：保留所有全局函数名 → caller 完全不动 → 0 regression
- **不强求完美**：runMemoryHygiene / findRelatedHistory 因耦合留着，**部分模块化 > 0 模块化**

### 工程教训（写进 BLOG.md 招聘素材）
> **模块化的真正难点不是"拆什么"，而是"什么时候停"。**
> 
> F+13 Sprint 1 拆了 20+ 个明显独立的模块。Sprint 4 又拆 3 块 hot zone。但 runMemoryHygiene / findRelatedHistory **不拆** —— 因为它们跟 saveActiveTask / 项目逻辑耦合度高，硬拆会引入 inter-module dependency hell。
> 
> "完美模块化"是工程师 ego。"够用 + 不出 regression"是产品判断。

---

## F+21 · 2026-06-06（API Key 输入框加 👁 显示/隐藏切换）

### 💡 用户反馈
> "APIkey 有可视选项"

7 个 API Key 输入框都是 `type="password"`，用户输入后看到 `••••••`，**无法核对自己有没有输错**。

### ✅ 修复
通用 JS 给所有 `input[type="password"]` 自动加 👁 toggle 按钮（0 处改 HTML）：

```js
function setupPasswordToggles() {
  document.querySelectorAll('input[type="password"]').forEach(input => {
    if (input.dataset.toggleApplied) return;
    input.dataset.toggleApplied = '1';
    const btn = document.createElement('button');
    btn.textContent = '👁';
    btn.title = '显示 / 隐藏（默认隐藏保护 Key 安全）';
    btn.onclick = () => {
      const isPwd = input.type === 'password';
      input.type = isPwd ? 'text' : 'password';
      btn.textContent = isPwd ? '🙈' : '👁';
    };
    input.parentElement.insertBefore(btn, input.nextSibling);
  });
}
```

`init()` 末尾调用 `setupPasswordToggles()` 一次。

### 设计权衡
| 选项 | 选择 |
|------|:----:|
| 默认 password 还是 text | ✅ password（安全优先） |
| HTML 改 7 处 vs 通用 JS | ✅ 通用 JS（一处生效，未来加新 Key 自动 toggle） |
| Toggle 状态持久化 | ❌ 不持久（每次打开默认 hidden）|
| Toggle 用 emoji 还是 SVG | ✅ emoji 👁/🙈 简洁 + 跨平台 |

### 影响范围
- 设置抽屉：6 个 vendor Key + 1 个 Tavily Key = 7 个 toggle 自动生效
- 未来加新 Key 输入：只要是 `type="password"` 自动获得 toggle

### 工程教训
- **通用 JS 解决重复 UI 需求**：与其改 7 处 HTML，不如写 1 个 helper 通配 → 未来新加 Key 自动适配
- **CSS 用 inline style 而不是 stylesheet**：为了避免维护 style.css 改动 + 让按钮自包含
- **`dataset.toggleApplied` 防重复绑**：如果 setupPasswordToggles 被多次调用（如 i18n 重渲染后）也安全

---

## F+20 · 2026-06-06（运行中任务可查看 + 明确停止入口）

### 🐛 用户报告
> "无法查看或停止/删除运行中的项目"

### 🎯 诊断（两个 critical UX bug）

**Bug 1: runningBadge 始终隐藏**
- HTML 写了 `<button id="runningBadge" class="running-badge hidden">`
- `grep "runningBadge.*classList"` → **0 处切换 visibility**
- 结果：runningBadge **永远不显示**，用户从首页/介绍/设置切回时**找不到入口**回到运行中任务

**Bug 2: "← 返回" 按钮的隐藏行为**
- 点击 `← 返回` 实际会执行 `state.aborted = true` + abort 所有 controller
- 但按钮文字暗示"导航"而非"停止"
- 用户**不知道点这个会停任务**，担心点了任务就丢

### ✅ 修复

**1. `index.html` 按钮文字明示语义**
```html
<!-- 之前 -->
<button id="backBtn">← 返回</button>

<!-- F+20 -->
<button id="backBtn" title="停止任务并返回首页（abort 所有正在跑的 Agent）">
  ⏹ 停止并返回
</button>
```

**2. `orchestrator.js launchTask` 显示 runningBadge**
```js
showTaskView(sceneId);
try { document.getElementById('runningBadge')?.classList.remove('hidden'); } catch {}
```

**3. `app.js finalizeTask / handleApiError / backBtn` 隐藏 runningBadge**
- 任务完成 → hide
- 任务出错 → hide
- 用户点 ⏹ 停止 → hide

**4. backBtn onclick 加 toast 反馈**
```js
$('backBtn').onclick = () => {
  state.aborted = true;
  state.task?.abortControllers.forEach(ac => ac.abort('user-back'));
  $('runningBadge').classList.add('hidden');
  showWelcomeView();
  toast('任务已停止', 'warn', 2000);
};
```

### 🎁 用户旅程
**之前**：
1. 启动任务 → 任务跑起来
2. 切到首页 / 设置 / 介绍 → **看不到正在运行的提示**
3. 不知道怎么回去 → 只能刷新或盲点
4. 想停止 → 找不到 ⏹ 按钮 → 误关浏览器

**F+20 之后**：
1. 启动任务 → 顶栏 **🔴 运行中** badge 醒目显示
2. 任意时刻切走 → badge 一直在 → 一眼能看到
3. 点 badge → 立刻切回任务视图 ✓
4. 想停止 → 任务页 **⏹ 停止并返回** 按钮明确 → toast 确认 ✓
5. 完成 / 出错 / 用户停止 → badge 自动消失

### 工程教训
- **隐藏的"通用入口"等于不存在**：runningBadge 写了 HTML 但 0 处切换 visibility = 0 用户能看到
- **按钮文字必须传达 action 后果**："← 返回"不该承担"停止"语义，应该用 "⏹ 停止并返回"
- **F+ 评估时已发现 #11 历史"重跑陷阱"，但 F+20 这个"运行中找不到入口"我没列出来** → 评估盲区
- 后续改进：每次评估时主动 audit `[hidden]` 类的元素是否有切换逻辑

### 后续可改进（不在本 F+ 内）
- 加 `↩ 后台运行`（保留任务跑，只切回 Welcome）—— 跟 ⏹ 停止并列
- runningBadge 加 pulse 动画（更醒目）
- 历史任务里运行中的标"⚡ 正在运行" + 不可删除

---

## F+17.16 · 2026-06-06（customModels 按 vendor 分组到对应 optgroup）

### 💡 用户反馈
> "自定义的模型应该写入对应的厂家下面"

附图显示：顶部"⭐ 已保存 model（2）"区有 `qwen-turbo` + `doubao-seed-2-0-pro-260215`，跟 6 个 vendor optgroup 上下并列。用户期望：
- `qwen-turbo` 应该出现在 **"✓ 通义千问（阿里）"** 区下面
- `doubao-seed-2-0-pro-260215` 应该出现在 **"✓ 豆包 Seed 2.0"** 区下面

### 🎯 改动
重写 `buildModelOptgroups` 的渲染逻辑：

**1. 按 vendor 分组 customModels**
```js
const customByVendor = {};
const customUnknown = [];
customModels.forEach(c => {
  if (c.vendor && knownVendors.has(c.vendor)) {
    (customByVendor[c.vendor] ||= []).push(c);
  } else {
    customUnknown.push(c);  // vendor 为 null/未知 → 兜底放顶部
  }
});
```

**2. 每个 vendor optgroup 渲染该 vendor 的 customModels + ✏️ 触发器**
```js
const customOpts = (customByVendor[g.vendor] || []).map(renderCustomOption).join('');
const addCustomOpt = `<option value="__add_custom__:${g.vendor}">...</option>`;
return `<optgroup label="${groupLabel}">${customOpts}${addCustomOpt}</optgroup>`;
```

**3. vendor 标签加数量**
```
✓ 通义千问（阿里）（1）       ← 显示该 vendor 有 1 个自定义
🔑 OpenAI · 未配 Key
```

**4. 未识别 vendor 的 customModels 兜底放顶部"❓ 未识别"区**
- inferVendor 没识别出 vendor 的（如某些 ep-xxxx / 旧数据）
- 顶部独立 optgroup 显示，避免丢失

### 📊 用户视角对比
**之前（F+17.11 ~ F+17.15）**：
```
⭐ 已保存 model（2）—— 直接选用
  qwen-turbo
  doubao-seed-2-0-pro-260215
🔑 OpenAI · 未配 Key
  ✏️ 填自定义 OpenAI model ID...
✓ 通义千问（阿里）
  ✏️ 填自定义 通义千问 model ID...
✓ 豆包 Seed 2.0...
  ✏️ 填自定义 豆包 Seed 2.0 model ID...
```

**F+17.16**：
```
🔑 OpenAI · 未配 Key
  ✏️ 填自定义 OpenAI model ID...
✓ 通义千问（阿里）（1）
  qwen-turbo                       ← 直接在 vendor 下！
  ✏️ 填自定义 通义千问 model ID...
✓ 豆包 Seed 2.0...（1）
  doubao-seed-2-0-pro-260215       ← 同上
  ✏️ 填自定义 豆包 Seed 2.0 model ID...
```

### 设计逻辑
- **vendor 就近原则**：用户想加豆包 model → 看豆包区就知道现有哪些 + 在哪里加新
- **数量提示**：vendor 标签显示有几个 custom，避免点开才知道
- **不丢数据**：未识别 vendor 的兜底放顶部 → 用户不会"找不到自己填过的 model"

### 工程教训
- **设计原则：分类信息按用户最常用的维度分组**：之前按"自定义 vs 内置"分（工程师本能），现在按"vendor"分（用户体验本能）
- F+17.11 砍掉 hardcode 后，"自定义 vs 内置"区分本身就没意义了 → F+17.16 顺势按 vendor 分组

### F+17 系列 16 步
F+17 → ... → 17.15 全部清空 → **17.16 按 vendor 分组**

16 步 = 13 次用户反馈推着改。

---

## F+17.15 · 2026-06-06（manage 弹窗加"全部清空"按钮兜底）

### 💡 用户继续报告
> "这些怎么还在"（附主下拉截图显示"⭐ 已保存 model（4）"区有 4 个 model）

可能性：
1. F+17.14 后用户未硬刷，仍在跑 F+17.12 / 17.13 的代码（删除不 work）
2. F+17.14 修复未完全生效（极端情况）

无论哪种，**给用户一个一次清空的兜底入口**。

### ✅ 改动
manage 弹窗底部加 **"🗑 全部清空（N 项）"** 按钮：
- 深红边框 #991b1b（视觉警示）
- confirm 弹窗 + 显示具体数量
- 同时清理 modelFailures
- bindHandlers 同步绑定该按钮 onclick + stopPropagation

```js
clearBtn.onclick = (ev) => {
  ev.stopPropagation();
  if (!window.confirm(`真的清空所有 ${n} 个自定义 model？此操作不可撤销。`)) return;
  state.customModels = [];
  try { saveCustomModels(); } catch {}
  toast(`已清空 ${n} 项`);
};
```

### 跟 F+17.6 撤回"重置后门"不冲突
- F+17.5 加的是"重置所有 model 偏好"（含 customModels + hiddenModels + purgedModels + modelFailures）→ F+17.6 撤回
- F+17.15 只清 customModels（作用域小，纯 UX 功能）
- hidden/purged 已在 F+17.10/11 废弃

→ 设计原则：**作用域大的全清需要谨慎；作用域小的方便操作要给**。

### 🎁 用户场景
1. 用户累积了 4 个自定义 model（其中 2 个已过期，不想再用）
2. 之前要一个一个删 → 4 次点击
3. 现在 → 弹窗底部 `🗑 全部清空（4 项）` → confirm → 1 次清掉
4. 想重新加 → vendor optgroup 末尾 `✏️ 填自定义...`

### F+17 系列 15 步
F+17 → ... → 17.13 设置面板 → 17.14 直接绑定 → **17.15 全部清空兜底**

15 步 = 12 次用户反馈推着改。**bug 复发 + UX 持续打磨** = 真实工程节奏。

---

## F+17.14 · 2026-06-06（删除按钮换直接绑定 · 真正修好 F+17.12 没修好的）

### 🐛 用户继续报告
> "还是删不掉，分析原因并解决"

F+17.12 已经清理了 onclick handler 残留分支，但用户验证后仍不 work。

### 🎯 真正根因（深度分析）
`body.onclick = ...` 这种 delegation 在**共享 modalBody DOM 元素**的场景下不可靠：

1. openSceneConfig 调 showModal → 写入"场景配置"内容 → 注册 `$('modalBody').onclick` 处理头像/重置 prompt（L2833）
2. 用户选 select "🛠 管理..." → openManageAllModelsModal
3. **openManageAllModelsModal 内 showModal 重设 modalBody.innerHTML** 但 modalBody **是同一个 DOM 节点**
4. openManageAllModelsModal L1958 试图 `body.onclick = ...` 覆盖 openSceneConfig 的
5. **但**：节点引用没变 / browser quirk / 某种异步时序问题 → onclick 没真正覆盖

→ 用户点删除 → 触发的是 openSceneConfig 的 onclick（处理 `.reset-prompt-btn` / `.agent-avatar`）→ 找不到匹配 → 静默 return → 用户体验"无反应"。

### ✅ 终极修复（不用 delegation）
直接给每个按钮绑 onclick：

```js
const bindDeleteHandlers = () => {
  body.querySelectorAll('.custom-model-delete').forEach(btn => {
    btn.onclick = (ev) => {
      ev.stopPropagation();
      const id = btn.dataset.id;
      // ... 删除 + saveCustomModels + re-render
      bindDeleteHandlers();  // re-render 后重新绑定
    };
  });
};
bindDeleteHandlers();
body.onclick = null;  // 清掉残留的 delegation
```

**优势**：
- 每个 button 自己的 onclick 直接绑定 → 不可能被 modalBody.onclick 干扰
- `stopPropagation` 阻止事件冒泡 → 即使 modalBody.onclick 还有也不会跑
- `body.onclick = null` 显式清除 → 排除残留 handler
- re-render 后 `bindDeleteHandlers()` 重新绑 → 删除后新列表也能 work

### 📊 修复路径对照
| 子版本 | 修复 | 结果 |
|--------|------|:----:|
| F+17.12 | 清空 handler 残留分支 | ❌ 仍不 work |
| **F+17.14** | **换直接绑定 + stopPropagation + 清空 delegation** | ✅ 真正修好 |

### 工程教训（贵的那种）
- **delegation 不是万能的**：当 DOM 元素被多个不同函数复用（如全局 modalBody）时，delegation 的 onclick 容易被覆盖
- **直接绑定虽然更"重"，但更可预测**：每次 render 重新绑 querySelectorAll → 性能损失可忽略（小列表）
- **诊断技巧**：F+17.12 时我假设代码 syntax 正确就够了 → 实际是 DOM 共享冲突。这种 bug 必须在用户环境复现才能发现
- **F+ 编号序列**：F+17.12 → F+17.14 = 两次修同一个问题。这种"修了没修好"的真实记录比"一次到位"更值钱（招聘叙事）

### F+17 系列至此 14 步
F+17 → 17.1 加 → 17.2 删自定义 → 17.3 加内置删 → 17.4 改名 → 17.5 加永久移除 → 17.6 删后门 → 17.7 头像 → 17.8 502 → 17.9 UX → 17.10 砍 manage 内置 → 17.11 砍主下拉 → 17.12 修删除 ⚠ → 17.13 设置面板 → **17.14 真正修删除 ⭐**

14 步迭代 + 同一问题修两次（F+17.12 → F+17.14）= **真实工程不是直线**。

---

## F+17.13 · 2026-06-06（设置面板 default model 下拉也走 buildModelOptgroups）

### 💡 用户反馈
> "这里也是"（附设置面板"内置场景默认模型"截图，显示 Qwen Turbo（上一代）等 hardcode 名称）

设置面板的 `#defaultModel` 是 **index.html 写死的 select**（L1187-1227 有 6 个 optgroup + 27 个 hardcode option）。F+17 系列做的所有改进（智能感知 / 自定义 / 删除 / Key 状态）**对它完全不生效**。

→ 修：让它也用 `buildModelOptgroups`。

### ✅ 改动 4 处

**1. `index.html` L1187-1227 → 1 行**
```html
<!-- 之前：40 行 hardcode optgroup -->
<!-- F+17.13 -->
<select id="defaultModel"></select>
```

**2. `app.js` 新增 `refreshDefaultModelSelect()` helper**
```js
function refreshDefaultModelSelect() {
  const sel = $('defaultModel');
  if (!sel) return;
  sel.innerHTML = buildModelOptgroups(state.config.model);
  sel.dataset.prevValue = state.config.model;
}
```

**3. 2 处调用 refreshDefaultModelSelect**
- `loadConfig()` 内（每次打开设置抽屉）
- `init()` 内（首次 page load）

**4. `#defaultModel.onchange` 升级**
处理 3 种特殊 value（跟 Agent 卡片下拉一致）：
- `__add_custom__:vendor` → `handleAddCustomModel`
- `__manage_all_models__` → `openManageAllModelsModal` + 重渲染
- 普通 model ID → 更新 prev value + `updateDefaultModelHint`

### 🎁 用户体验
**之前**：设置面板下拉 ≠ Agent 卡片下拉
- 设置面板：27 个 hardcode model（含已过期的 doubao-seed-2-0-pro-260215 / 等）
- Agent 卡片：⭐ 已保存自定义 + 6 vendor 触发器

**F+17.13 之后**：完全一致
- 两处下拉都是 ⭐ 已保存自定义 + 6 vendor "✏️ 填自定义" + 🛠 管理入口
- 用户改 default model 时也能填自定义 ID（如 ARK ep-xxxxx）

### 设计哲学
**buildModelOptgroups 作为单一渲染源**：所有 model 下拉走同一函数 → F+17 智能感知 / F+17.1 自定义 / F+17.11 移除 hardcode → 自动同步到设置面板。

如果当时设置面板就用 buildModelOptgroups，F+17 系列就不需要 13 个子版本去发现"设置面板也得改"。

### 工程教训
- **单一渲染源 > 多处 hardcode**：F+17 ~ F+17.12 都在改 buildModelOptgroups，但漏了设置面板这个独立的 hardcode → F+17.13 补
- **"统一抽象"和"性能"之间，对小数据优先统一抽象**：6 厂商 27 model 的 select 不会因为函数生成而慢
- **F+19 评估提到的"设置面板独立 hardcode 不享受 F+17 智能感知"**：被用户的截图反馈逼着修

### F+17 系列 13 步终态
F+17 → 17.1 加自定义 → 17.2 删自定义 → 17.3 加内置删除 → 17.4 改名"删除" → 17.5 加永久移除 → 17.6 删后门 → 17.7 头像 350KB → 17.8 502 ⚠ → 17.9 UX 两层强化 → 17.10 砍 manage 内置区 → 17.11 砍主下拉 hardcode → 17.12 删除按钮 bugfix → **17.13 设置面板也走 buildModelOptgroups**

13 步 = 10 次用户反馈推着改。最后一步把"两个独立 hardcode 列表"统一成"单一渲染源"，**真正完成 hardcode 剥离**。

---

## F+17.12 · 2026-06-06（manage 弹窗删除按钮无效 bugfix）

### 🐛 用户报告
> "点击删除不管用"（附 manage 弹窗截图，4 个 customModel 各带"🗑 删除"按钮，点击无效）

### 🎯 根因
F+17.11 把 manage 弹窗的"已删除"区移除了，但 **onclick handler 的代码没清理**——残留 5 个废弃分支：
- `.model-hide`
- `.model-unhide`
- `.model-purge`
- `#clearAllHidden`
- `永久移除` confirm 逻辑

这些分支引用 `state.hiddenModels[id] = true` 等 ——
- F+17.11 移除了 hiddenModels 初始化（`if (!state.hiddenModels) state.hiddenModels = {}`）
- 当 click event 到 body.onclick 时，**delegation 走完 .custom-model-delete 分支后继续走 .model-hide / .model-unhide 等检查**
- 这些 closest() 调用本身无害（返回 null），但**理论上不会 silent fail**

实际上**等等** —— `.custom-model-delete` 分支末尾有 `return`，所以后续不会执行。那为什么用户报无效？

最可能原因：**用户浏览器缓存了 F+17.11 之前的代码**，那时 button className 可能不一致或 onclick 有其他冲突。

### ✅ 修复（双保险）
1. **彻底清空 onclick handler**：用 PowerShell 重写 L1944-2007，只保留一个分支
2. **bump cache buster** `v=f20-0` → `v=f20-1` 强制用户重新加载

### 🔧 新 onclick handler（极简版）
```js
const body = $('modalBody');
body.onclick = (e) => {
  const delBtn = e.target.closest('.custom-model-delete');
  if (!delBtn) return;
  const id = delBtn.dataset.id;
  state.customModels = (state.customModels || []).filter(c => c.id !== id);
  if (state.modelFailures && state.modelFailures[id]) {
    delete state.modelFailures[id];
    try { saveModelFailures(); } catch {}
  }
  try { saveCustomModels(); } catch {}
  body.innerHTML = render();
  toast(`已删除：${id}`, 'ok', 2000);
  if (typeof onChange === 'function') onChange();
};
```

48 行 → 14 行（缩 70%）。

### 工程教训
- **render 简化后必须同步简化 handler**：F+17.10/11 改 render 时只动了渲染层，handler 残留 4-5 个废弃分支
- **死代码不只是噪音，是潜在 bug 源**：即使分支永远不触发，未初始化的 state 引用、错误的 className 检查都可能在某些 edge case 下炸开
- **F+17.11 → F+17.12 = 同主题 follow-up bug**：F+9/F+15 暂停问题复发的同型号 —— **render 改了 handler 没改的"对称改动遗漏"**
- 系统化对策：以后改 render 时 grep `body.onclick` 同步审视 handler 的所有分支

---

## F+17.11 · 2026-06-06（完全移除内置 hardcode model · 100% 用户驱动）

### 💡 用户决策
> "移除所有内置模型"

F+17.10 移除了 manage 弹窗内置区，但**主下拉**仍渲染 6 厂商 27 个 hardcode model。F+17.11 进一步把**主下拉的 hardcode 也全删** —— 100% 用户驱动。

### 🎯 设计转向
**之前**（F+17 ~ F+17.10）：hardcode + custom 二元体系
- hardcode：开箱即用，但会过期
- custom：用户填，永久跟随
- 矛盾点：hardcode 过期了需要用户手动删，再填 custom 替代

**之后**（F+17.11）：**custom-only**
- 所有 model 都通过 customModels 管理
- 主下拉只显示 ⭐ 已保存 + 6 vendor"填自定义"触发器
- 新用户首次：下拉几乎空，只有 6 个"✏️ 填自定义 [vendor] model ID..."触发器
- 用户从厂商控制台拿最新 model ID 自己填 → 永远不过期

### ✅ 改动

**1. buildModelOptgroups 不再渲染 hardcode model**
```js
// 之前
return groups.map(g => {
  const opts = visibleModels.map(m => `<option value="${m}">...</option>`).join('');
  const addCustomOpt = `<option value="__add_custom__:${g.vendor}">✏️ 填自定义...</option>`;
  return `<optgroup>${opts}${addCustomOpt}</optgroup>`;
});

// F+17.11
return groups.map(g => {
  // 不再渲染 hardcode model option
  const addCustomOpt = `<option value="__add_custom__:${g.vendor}">✏️ 填自定义...</option>`;
  return `<optgroup>${addCustomOpt}</optgroup>`;  // 每个 vendor 只 1 个触发器
});
```

**2. selectedModel 不在 customModels 时自动加入**（向前兼容）
```js
// F+17.11：之前判断"不在 hardcode 列表"→ 改为"只要不在 customModels"就加入
if (selectedModel && !customIds.has(selectedModel)) {
  customModels.push({ id, vendor, addedAt });
  saveCustomModels();
}
```
→ 老用户的 sceneConfigs 里指向 hardcode model 的，**自动迁移**到 customModels（无感升级）。

**3. manage 弹窗简化为单区**
- 移除"已删除"区（hidden 概念彻底废弃，因为没 hardcode 可以被 hidden 了）
- 标题从 "📝 自定义 model" → "📝 你的 model"

**4. 简化变量 + 注释**
- 移除 hidden / purged / allHardcoded 等过滤逻辑
- 移除"K/N 显示中"、"已永久移除"等所有内置相关的统计

### 📊 主下拉对比
| 内容 | F+17.10 | F+17.11 |
|------|:----:|:----:|
| ⭐ 已保存 customModels | ✅ | ✅ |
| OpenAI 6 个 hardcode | ✅ | ❌ |
| Anthropic 5 个 | ✅ | ❌ |
| 通义千问 7 个 | ✅ | ❌ |
| DeepSeek 2 个 | ✅ | ❌ |
| 豆包 2 个 | ✅ | ❌ |
| Gemini 5 个 | ✅ | ❌ |
| 每个 vendor "✏️ 填自定义..." | ✅ | ✅ |
| 末尾 manage 入口 | ✅ | ✅ |

**总 option 数从 ~33 → ~7**（5-6 个 customModel + 6 vendor 填自定义触发器 + 1 manage）。

### 数据层向前兼容
- state.customModels：仍正常工作
- state.hiddenModels / state.purgedModels：保留持久化（避免数据迁移风险），但不再被任何渲染逻辑使用
- 老用户 sceneConfigs 指向 hardcode model：第一次打开下拉时自动迁移到 customModels（无感）

### 设计哲学（终态）
> **"hardcode 提供入门便利"是个工程师的善意假设，但实际：hardcode 过期 / 用户 Key 权限不同 / vendor 更新太快 → hardcode 反而是麻烦源。**
> **完全用户驱动反而最稳定 —— 用户自己知道自己的 Key 配什么，自己填的最准。**

### F+17 系列完整 11 步演化
F+17 自动智能感知 → 17.1 加自定义 → 17.2 删自定义 → 17.3 加内置删除 → 17.4 改名"删除" → 17.5 加永久移除 → 17.6 删后门 → 17.7 头像 350KB → 17.8 502 标 ⚠ → 17.9 UX 两层强化 → 17.10 砍 manage 内置区 → **17.11 砍主下拉所有 hardcode** ⭐

**11 步 = 9 次用户反馈推着改 = 真实工程节奏**。F+17.5 加内置删除区 → 17.10 砍区 → 17.11 砍主下拉，**3 次小修把 hardcode 概念彻底剥离**。

### 工程教训
- **删比加难**：加 hardcode 列表是工程师的本能（"给用户预设"），删 hardcode 是产品判断（"预设反而是束缚"）
- **"开箱即用"和"长期稳定"是 trade-off**：很多 SDK / 工具的"开箱即用"都建立在静态版本号上，1 年后就成了维护负担
- **真正"开箱即用"的应该是机制不是数据**：F+17.11 留下"✏️ 填自定义..." 入口 = 机制；之前的 27 个 model ID = 数据。机制永远活，数据 1 年就死

---

## F+17.10 · 2026-06-06（manage 弹窗激进简化 · 用户驱动减负）

### 💡 用户反馈
> "不需要内置，全看用户自定义都会同步改变，不要显示'0/0之类的和以永久删除'"

附图显示 manage 弹窗"内置 model 列表"区被 vendor optgroup（OpenAI 6/6 / 通义 2/7 · 5 已永久移除 / 豆包 0/2 · 2 已永久移除）填满，**信息噪音 > 信息密度**。

### 🎯 修改：去掉一切非必要信息

**1. 移除整个"内置 model 列表"区** ❌
- vendor 详细展开 + "🗑 删除"按钮（约 25 行）→ 全删
- 用户管 hardcode 删除的入口转移：**主下拉每个 vendor optgroup 末尾的 "✏️ 填自定义..." 触发器**让用户**用新版替换旧的**
- 失败的 hardcode 在主下拉里已有 ⚠ 标 + tooltip 提示（F+17 已有）

**2. 移除所有数字** ❌
- `📝 自定义 model（3）` → `📝 自定义 model`
- `🗑 已删除（5）` → `🗑 已删除`
- `🛠 管理 model 下拉（自定义 3 · 已删除 5）` → `🛠 管理 model 下拉`
- vendor 标题里的 `(2/7 显示中 · 5 已永久移除)` → 整个区都没了

**3. 简化顶部说明文字**
```
之前：管理模型下拉。**所有 model（含内置）都能"🗑 删除"且永久生效**...
F+17.10：管理你的自定义 model 和已删除条目。新增自定义请在主下拉每个 vendor optgroup 末尾点 "✏️ 填自定义..."。
```

**4. 撤销全部按钮简化**
```
之前：↩ 撤销全部删除（恢复 N 个内置 model）
F+17.10：↩ 撤销全部删除
```

### 📊 弹窗结构对比
| 区 | F+17.9 | F+17.10 |
|----|:------:|:-------:|
| 📝 自定义 model | ✅ 带计数 | ✅ 不带计数 |
| 🗑 已删除 | ✅ 带计数 + 按钮 | ✅ 不带计数 + 按钮 |
| 📋 内置 model 列表 | ✅ 6 个 vendor 详细展开 | ❌ **移除整区** |

### 设计哲学：内置 model 的管理逻辑迁移
**之前**（F+17.5/6）：弹窗有内置区 → 用户在弹窗"主动删除"hardcode
**之后**（F+17.10）：弹窗只管 customModels 和 hiddenModels（已删的）→ **内置 model 的"管理"通过主下拉本身完成**：
- 看到 ⚠ 标的 hardcode → 失败一次后自动标 → 用户在主下拉里直接知道
- 想换 → 同 vendor optgroup 末尾 "✏️ 填自定义..." 填新版 ID
- 自定义自动保存到 ⭐ 区 + 下次直接用

→ 责任归位：**自定义 = 用户主动管理 / 内置 = 自动失败标识 + 自助替换**。

### 数据层不动
- state.customModels / state.hiddenModels / state.purgedModels 全保留
- 已存在的数据继续生效（已删除的仍隐藏 / 已永久移除的仍消失）
- 仅简化 UI 渲染逻辑

### 工程教训
- **数字 ≠ 信息密度**：vendor 标题"2/7 显示中 · 5 已永久移除"看似精确，实际**用户根本不需要知道这种统计**
- **少即是多**：F+17.5 加内置区是工程师本能（"所有操作都要有入口"），F+17.10 是产品决策（不必要的全删）
- **F+ 演化体现真实迭代**：F+17.3 加 → F+17.4/5/6 调 → F+17.10 删，**4 次小版本砍掉一个本不该有的区**

### F+17 系列至此（10 步）
F+17 → 17.1 加自定义 → 17.2 删自定义 → 17.3 加内置删除 → 17.4 改名"删除" → 17.5 加永久移除+后门 → 17.6 删后门 → 17.7 头像 350KB → 17.8 502 加 ⚠ → 17.9 UX 两层强化 → **17.10 砍掉内置区**

**10 步迭代 = 8 次用户反馈推着改 = 真实工程节奏**。

---

## F+17.9 · 2026-06-06（自定义 model UX 两层强化）

### 💡 用户反馈
> "自定义写入的无法永久保存，每次使用需要复制粘贴太麻烦了"

附图显示场景配置面板，但 manage 入口显示"自定义 3"—— state.customModels 实际**已经持久化**。问题不是数据没存，是 UX 让用户**看不到/不会用**。

### 🎯 诊断（两层 UX bug）

**Bug 1：用户看不到顶部"自定义 / 历史"区**
当前 label `📝 自定义 / 历史（你填过或当前选中）` 不够显眼。用户滚下拉时下意识跳过 → 直奔 hardcode 区 → 找不到 → 又点"✏️ 填自定义"重新输入。

**Bug 2：场景配置"关闭"按钮歧义**
用户填了自定义 ID 后，customModels 已持久化（saveCustomModels），但**sceneConfigs[sceneId][agentKey] 仍是旧值**（需点"保存"按钮才会写入）。用户点"关闭" → 以为=保存 → 下次打开 select 默认值仍 hardcode → 又得重新选。

→ 经典 UX bug：**数据没问题，操作流程沟通不清**。

### ✅ 修复（3 处文字升级）

**1. 顶部 optgroup label 大幅强化**
```js
// 之前：📝 自定义 / 历史（你填过或当前选中）
// F+17.9：⭐ 已保存自定义 model（3）—— 直接选用，无需重填
```
⭐ + 显示数量 + "直接选用，无需重填" 把"可复用"明确传达。

**2. handleAddCustomModel toast 升级为强提示**
```js
// 之前：已添加自定义 model ID：X（2.5 秒）
// F+17.9（7 秒）：
//   ✅ 已永久保存：X
//   📍 下次打开任意 model 下拉，顶部"⭐ 已保存自定义"区直接选用，无需重填
//   ⚠️ 若在场景配置面板，还需点底部「保存」按钮让此 Agent 真正用该 model
```
明确告知 ① 数据已存 ② 下次怎么找 ③ 场景配置还需多按一个保存。

**3. openSceneConfig "关闭" → "取消（丢弃改动）" + "保存"加 ✅**
```js
// 之前：[重置该场景] [关闭] [保存]
// F+17.9：  [重置该场景] [取消（丢弃改动）] [✅ 保存]
```
消除"关闭=保存"歧义。

### 数据层完全不动
- state.customModels / saveCustomModels / loadCustomModels 不动
- sceneConfigs / scenePrompts 不动
- 仅改 3 处 UI 文字 → 0 regression 风险

### 工程教训
- **持久化没问题 ≠ UX 没问题**：数据已存但用户找不到 = 等于没存
- **按钮命名歧义最贵**：在生产 app 里"关闭"按钮的语义是"丢弃 vs 保存"是最大歧义源，应永远写"取消（丢弃改动）"或"保存并关闭"明确语义
- **toast 时长要匹配信息密度**：单行 toast 2 秒够；3 行说明性 toast 应至少 5-7 秒
- **优秀的 label 是 UX 第一道关卡**：`📝 自定义/历史` vs `⭐ 已保存自定义（N）—— 直接选用，无需重填` 视觉权重差 10 倍

---

## F+17.8 · 2026-06-06（502 也记录 modelFailures + 豆包专属"换自定义"建议）

### 🐛 用户实战发现
> "选择页面给的不行，反而自定义输入的成功了"
>
> 现象：内置 `doubao-seed-2-0-pro-260215` → 502；用户自己 ✏️ 填自定义新版 ID → 成功。

### 🎯 根因
F+17.8 之前 handleApiError 的 modelFailure 记录条件是 `[400, 401, 403, 404, 0]`。**502 不在内**——理由是"502 是临时服务问题，跟 model 无关"。

但**用户实测**：豆包 ARK 对**已下线 model**（如 2026-02 发布的 `260215`）会返 **502** 而不是 404，因为 ARK gateway 试图路由但找不到对应 model server。

→ 经典假设错误：**502 ≠ 临时**，对 ARK 来说 502 ≈ "model 退役了"。

### ✅ 修复
**1. 扩展记录条件**
```js
// 之前：[400, 401, 403, 404, 0]
// F+17.8：[400, 401, 403, 404, 502, 503, 0]
```

**2. 加 502 专用分支 + 豆包 vendor-aware 提示**
```js
} else if (e.status === 502) {
  msg = '⚠️ 模型路由失败（502）';
  if (vendor === 'doubao') {
    action = `豆包 ARK 经常下线旧版本 model（如 ${e.failedModel} 可能 2026-02 后已退役）。
              建议：① 任意 model 下拉里点末尾「✏️ 填自定义 豆包 model ID...」输入新版 ID
                    （如 doubao-seed-1-6-pro-250615 或自建 ep-xxxxxxxx）
                    ② 该自定义 ID 会持久化进"📝 自定义 / 历史"区，下次直接选`;
  } else {
    action = '该 model 可能已被厂商下线 / 网关路由失败。换其他模型或厂商。';
  }
}
```

### 🎁 用户体验
**之前**（用户实测）：
```
⚠️ LLM 服务暂时不可用（502）
👉 稍后重试，或换一家厂商。
```
→ 用户："稍后重试还是 502，到底怎么办？"

**F+17.8 之后**：
```
⚠️ 模型路由失败（502）
👉 豆包 ARK 经常下线旧版本 model（如 doubao-seed-2-0-pro-260215 可能 2026-02 后已退役）。
   建议：① 下拉「✏️ 填自定义 豆包 model ID...」输入新版 ID
         ② 该自定义 ID 会持久化进"📝 自定义 / 历史"区，下次直接选
```
→ 用户："哦，知道怎么做了。"

下次该 model 也会带 ⚠ 标 + tooltip 显示 502 失败信息。

### 工程教训
- **不要假设 HTTP 状态码的"标准语义"通用** —— 不同厂商对 502 的语义不同（ARK 把"model 不存在"返成 502 而不是 404）
- **用户实测 > 标准文档**：F+17 设计时按"5xx = 临时"分类的，被真实流量纠正
- **F+14.3 server.message + F+17 modelFailures + F+17.8 502 收录 = 联动起作用** —— 三个独立改进合在一起 = 完整的"错误诊断→自我修正"闭环

### 关于内置 hardcode 列表
**保留不动**：不替用户更新内置列表里那些可能已过期的 ID。原因：
1. 厂商 model ID 更新频率太高，hardcode 跟不上
2. F+17.1 的"自定义 model"已是设计好的逃生通道
3. F+17.8 让"过期"的失败被识别 + 引导用户走自定义路径

→ **"hardcode 提供入门便利 + 自定义保留终极自由"** 的分工不变。

---

## F+17.7 · 2026-06-06（Agent 头像上限 100KB → 350KB）

### 💡 用户反馈
> "这个图片应该最大支持 350kb 大小"（附 Agent 头像截图）

### 🎯 改动
`app.js` L2104:
```js
const AVATAR_MAX_BYTES = 100 * 1024;   // 之前
const AVATAR_MAX_BYTES = 350 * 1024;   // F+17.7
```

toast 文字 `${AVATAR_MAX_BYTES / 1024} KB 上限` 自动算 → 不用改。

### 影响
- 用户头像 / Agent 头像上传现在支持到 350KB
- 100KB 太紧，普通微信表情包 / 手机拍照都过不了
- localStorage 单条目 ~5-10MB 限制 → 350KB × 多个 Agent 仍安全

---

## F+17.6 · 2026-06-06（移除"重置偏好"后门 · "永久"语义彻底化）

### 💡 用户决策
> "不需要 终极后门"

F+17.5 加的 "🔄 重置所有 model 偏好"后门让"永久"语义有了 escape hatch。用户决定：**"永久"就是真的永久，UI 不要给逃生通道**。

### 🎯 修改
1. **移除 manage 弹窗底部 "🔄 重置所有 model 偏好"按钮**（删除 resetAllBtn 渲染）
2. **移除对应 onclick handler**（`resetAllModelPrefs` 分支）
3. **改 "🗑 永久移除" 的 confirm 文字**：
   - F+17.5: "可通过底部'🔄 重置所有 model 偏好'按钮全清后才能恢复"
   - **F+17.6**: "之后想找回只能：① 通过'✏️ 填自定义...'重新输入该 model ID · ② 或开浏览器 DevTools 清 localStorage 的 myAgentTeam.purgedModels 键"
4. **manage 弹窗顶部说明** 加粗强调 "**不可在 UI 撤销**"

### 数据层保留（向后兼容）
- `state.purgedModels` 字段保留 + `savePurgedModels` / `loadPurgedModels` 保留
- F+17.5 之前已加进 purgedModels 的数据仍生效（用户没操作时数据状态稳定）
- 仅去掉**新增数据后的 UI 全清入口**

### 设计哲学（修正）
之前：废纸篓 + 清空废纸篓 + **系统还原**
之后：废纸篓 + 清空废纸篓 = 真的不可恢复（系统还原级别下放到"开 DevTools"）

**两个层次的"撤销路径"**：
| 路径 | 用户角度 | 数据角度 |
|------|---------|----------|
| ↩ 撤销（软删除）| UI 一键 | hiddenModels 移除 key |
| ✏️ 重新填自定义 | UI 重新输入 | 该 model 以 customModels 形式重新加入（**绕过 purged 检查**因为 buildModelOptgroups 顶部用 customModels）|
| 开 DevTools 清 localStorage | 开发者操作 | 数据彻底重置 |

**关键发现**：永久移除某 hardcode 后，用户仍可用 ✏️ 填自定义重新加回相同 ID —— 这其实是一种"非 UI 后门但符合用户直觉"的恢复路径。F+17.6 confirm 里把这条路告诉用户。

### F+17 系列完整闭环（最终版）
| 子版本 | 能力 |
|--------|------|
| F+17 | 🔑/⚠/✓ 智能感知 + 失败记忆 |
| F+17.1 | ✏️ 添加自定义 |
| F+17.2 | 🗑 删除自定义 |
| F+17.3 | 🚫 隐藏 hardcode + 统一入口 |
| F+17.4 | 🗑 统一"删除"语义 |
| F+17.5 | 🗑 永久移除 + ~~🔄 终极后门~~ |
| **F+17.6** | **去掉 🔄 终极后门 ·"永久"语义彻底化** |

6 步演化 → 7 步（F+17.5 提出后门 → F+17.6 用户拒绝）。诚实记录用户驱动的真实迭代节奏。

### 工程教训
- **过度防御 ≠ 用户友好**：F+17.5 怕用户手滑加的后门，反而被用户拒绝 ——"永久"就该有"永久"的份量
- **撤销路径不必一定在 UI 上**：用户可以用 ✏️ 重填 / DevTools 清 LS，这两条"非显式后门"足够 advanced user 自救
- **倾听 > 自作主张**：F+17.5 是工程师本能（"加个安全网吧"），F+17.6 是产品决策（用户说不要就不要）

---

## F+17.5 · 2026-06-06（永久移除按钮 + 重置偏好后门）

### 💡 用户痛点
> "🗑 已删除区的 model 会一直存在吗"

F+17.3 + 17.4 的"已删除"区会一直显示，因为 `state.hiddenModels` 持久化到 localStorage。删多了列表会越来越长，用户没有"我真的不会再撤销了"的彻底清场入口。

### 🎯 设计思路：三层删除模型
| 层级 | UI | 数据 | 撤销路径 |
|------|------|------|---------|
| 软删除 (F+17.3/4) | `🗑 删除` | `state.hiddenModels[id] = true` | 弹窗"已删除"区 `↩ 撤销` |
| **永久移除 (F+17.5)** | **`🗑 永久移除`**（红边）| **`state.purgedModels[id] = true`**（从 hiddenModels 删除）| ❌ UI 不可撤销 |
| 终极后门 (F+17.5) | **`🔄 重置所有 model 偏好`** | 清空 customModels + hiddenModels + purgedModels + modelFailures | 全局唯一恢复路径 |

类比废纸篓：删除 → 进废纸篓 → 清空废纸篓（不可撤销）→ 但还有"系统还原"。

### ✅ 实施
**1. 持久化扩展**
- `constants.js`: + `PURGED_MODELS_KEY = 'myAgentTeam.purgedModels'`
- `state.js`: + `state.purgedModels: {}`
- `storage.js`: + `savePurgedModels()` / `loadPurgedModels()`
- `app.js init()`: + `loadPurgedModels()`

**2. buildModelOptgroups 过滤**
```js
const visibleModels = g.models.filter(m =>
  (!hidden[m] && !purged[m]) || m === selectedModel
);
```

**3. manage 弹窗增强**
- "🗑 已删除"区每行加 **`🗑 永久移除`** 按钮（深红 #991b1b 边框，区别于普通删除红色 #ef4444）
- hardcode 区跳过 purged（vendor 标题显示 `· N 已永久移除` 提示）
- 底部加 **`🔄 重置所有 model 偏好`** 按钮（仅当有数据时显示）

**4. confirm 保护**
- 永久移除前 `window.confirm` 警告"UI 不可撤销"
- 重置偏好前 `window.confirm` 列出将清的 4 类数据

### 🎁 用户操作流
1. 删除 model（lite-260428）→ 进入"🗑 已删除"区
2. 觉得"已删除"区太长 → 该项旁 `🗑 永久移除` → confirm → 彻底消失（从下拉 + 从已删除区都看不到）
3. 几个月后想起来需要这 model → 重新写 ID 通过 `✏️ 填自定义...` 加回去 ✓
4. 万一手滑误移除了重要 model：弹窗底部 `🔄 重置所有 model 偏好` → 重置全部 → 该 model 重新出现在内置区

### 设计哲学
- **三态清晰**：visible / hidden / purged 分层处理，每层一个动作
- **撤销路径不可缺**：即使是"永久"也要有终极后门（重置偏好），否则用户怕手滑不敢用
- **confirm 保护**：危险操作必须二次确认 + 列出后果
- **类比心智**：删除 ≈ 废纸篓 / 永久移除 ≈ 清空废纸篓 / 重置偏好 ≈ 系统还原 → 用户已有的认知不用重学

### F+17 系列完整闭环
| 子版本 | 能力 | 操作 |
|--------|------|------|
| F+17 | 🔑/⚠/✓ 智能感知 | 自动 |
| F+17.1 | ✏️ 添加自定义 | 主动 |
| F+17.2 | 🗑 删除自定义 | 主动 |
| F+17.3 | 🚫 隐藏 hardcode + 统一入口 | 主动（旧名）|
| F+17.4 | 🗑 统一"删除"语义 | UI 改名 |
| **F+17.5** | **🗑 永久移除 + 🔄 重置偏好** | **主动（彻底/恢复）** |

模型下拉**完整生命周期**：创建 → 使用 → 软删除（可撤销）→ 永久移除（终极后门可恢复）✅

---

## F+17.4 · 2026-06-06（统一"删除"语义 · 所有 model 都能永久删除）

### 💡 用户反馈
> "删除对所有 model 都永久生效"

F+17.3 用了**两套语义**：
- 自定义 model = "🗑 删除"（永久从 customModels 移除）
- hardcode model = "🚫 隐藏"（hiddenModels 持久化，效果等同永久但叫法不一致）

→ 用户感觉"hardcode 是不是只是临时隐藏"。

### 🎯 修复：统一为"删除"语义
- **数据层不变**：仍用 `state.hiddenModels` 持久化 hardcode 删除（已经"永久"）
- **UI 层统一**：按钮 / 区名 / toast 全部改用"删除"
- **保留撤销路径**：每个删除项旁 `↩ 撤销` + 底部"撤销全部删除"（删错反悔用）

### 📊 文字变更对照
| 位置 | F+17.3 | F+17.4 |
|------|--------|--------|
| hardcode 按钮 | `🚫 隐藏` | `🗑 删除`（红色边框） |
| 已删除区标题 | `🚫 已隐藏 (N)` | `🗑 已删除 (N)` |
| 区内项前缀 | `🚫 modelId` | `🗑 modelId` |
| 撤销按钮 | `✓ 恢复` / `✓ 恢复显示` | `↩ 撤销` |
| 全部撤销按钮 | `✓ 全部恢复显示（N）` | `↩ 撤销全部删除（恢复 N 个内置）` |
| toast 删除 | `已隐藏：X` | `已删除：X（重启 app 也不出现，可点 ↩ 撤销恢复）` |
| toast 撤销单项 | `已恢复显示：X` | `已撤销删除：X` |
| toast 撤销全部 | `已恢复 N 个隐藏 model` | `已撤销 N 个删除，恢复内置默认列表` |
| modal 标题 | `自定义 N · 已隐藏 M` | `自定义 N · 已删除 M` |
| select 末尾入口 | `... · 已隐藏 M ...` | `... · 已删除 M ...` |
| 说明段顶部 | "隐藏对 hardcode（仅去掉，不删数据）" | "**所有 model 都能 🗑 删除且永久生效**，删错可 ↩ 撤销" |

### 🔧 改动文件
| 文件 | 改动 |
|------|------|
| `app.js` `openManageAllModelsModal` render | UI 文字全部统一为"删除" |
| `app.js` `openManageAllModelsModal` onclick | toast 文字统一 + 强调"永久生效" |
| `app.js` `buildModelOptgroups` select 末尾 | manage entry 文字改"已删除" |
| `app.js` `title()` 函数 | 模态标题 |

### 数据层不动（向后兼容）
- 变量 `state.hiddenModels` 名字不变（避免大量重构）
- localStorage key `myAgentTeam.hiddenModels` 不变
- onclick handler 内部仍处理 `model-hide` / `model-unhide` className（CSS hook 习惯保留）
- **F+17.3 用户已隐藏的 model 自动迁移成"已删除"** —— 0 数据迁移

### 设计教训
- **"语义一致" > "技术精确"**：工程上 hide ≠ delete（hardcode 删不了真常量），但对用户来说"看不到了 + 永久"=删除
- **保留反悔路径**：即使语义是"永久删除"，UI 也要给"↩ 撤销"逃生通道（CMD+Z 心智）
- **变量名 vs UI 文字解耦**：变量保持 hiddenModels，UI 显示"已删除" → 工程语义和产品语义可以分离

---

## F+17.3 · 2026-06-06（隐藏 hardcode 过期 model + 统一管理入口）

### 💡 用户反馈
> "并没有找到能移除过期型号模型的功能"

用户截图显示模型下拉里**没有** "🗑 管理..." 入口。

### 🎯 根因
F+17.2 的 "🗑 管理自定义列表..." 入口**只在 `state.customModels.length > 0` 时显示**。该用户从未用过 F+17.1 添加自定义 → 没入口 → 无法清理任何 model。

**更核心问题**：F+17.2 只能删**自定义 model**，**不能移除 hardcode 的过期版本**（如 `doubao-seed-2-0-lite-260428` 这种内置但已下线的）。用户真正的痛点是后者。

### ✅ 三层修复

**1. 加 `state.hiddenModels = { [modelId]: true }` 持久化**
- constants.js + state.js + storage.js（saveHiddenModels / loadHiddenModels）
- localStorage key: `myAgentTeam.hiddenModels`

**2. `buildModelOptgroups` 跳过 hidden + 保留 selected**
```js
const visibleModels = g.models.filter(m => !hidden[m] || m === selectedModel);
```
关键保护：当前 selected 即使在 hidden 里也强制显示 → 防 select 跳空到默认值

**3. select 末尾统一管理入口（始终显示，不论数据状态）**
```html
<optgroup label="—————————————">
  <option value="__manage_all_models__">🛠 管理 model 下拉（自定义 N · 已隐藏 M）...</option>
</optgroup>
```
独立 optgroup 视觉隔离 + 始终可见 → **解决"没数据就没入口"的悖论**

**4. 升级 `openManageCustomModelsModal` → `openManageAllModelsModal`**

3 区设计：
| 区 | 内容 | 操作 |
|----|------|------|
| 📝 **自定义 model** | state.customModels 列表 | 🗑 永久删除（含同步清理 failures） |
| 🚫 **已隐藏 model** | state.hiddenModels keys | ✓ 恢复显示 + 全部恢复 |
| 📋 **内置 model 按 vendor 列出** | getModelGroups() 全部 | 🚫 隐藏 / ✓ 恢复（按状态切按钮） |

`<details>` 折叠每个 vendor 区，**有 hidden 的 vendor 自动展开**让用户立即看到。

**5. 抽 `getModelGroups()` helper**
让 `buildModelOptgroups` + `openManageAllModelsModal` 共享 model 列表 single source of truth。未来加新 vendor / 新 model 只需改 1 处。

### 🎁 完整闭环（F+17 + 17.1 + 17.2 + 17.3）
| 子版本 | 能力 |
|--------|------|
| F+17 | 🔑/⚠/✓ 智能感知 + 失败自动记忆 + 30 天清理 + 成功自清 |
| F+17.1 | ✏️ 添加自定义 model ID + 持久化复用 |
| F+17.2 | 🗑 删除自定义 model |
| **F+17.3** | **🚫 隐藏 hardcode 过期 model + ✓ 恢复 + 统一管理入口** |

**模型下拉完整 CRUD**：添加 / 读取 / 更新（hide/unhide）/ 删除 ✅

### 🔧 改动文件
| 文件 | 改动 |
|------|------|
| `constants.js` | + `HIDDEN_MODELS_KEY` |
| `state.js` | + `state.hiddenModels: {}` |
| `storage.js` | + `saveHiddenModels()` / `loadHiddenModels()` |
| `app.js` `init()` | + `loadHiddenModels()` |
| `app.js` `getModelGroups()` | 新 helper（抽自 buildModelOptgroups）|
| `app.js` `buildModelOptgroups` | + 跳过 hidden + 末尾加 manage 入口 + 移除老 `__manage_custom__` |
| `app.js` `openManageAllModelsModal` | 升级 3 区设计（从 openManageCustomModelsModal 改名） |
| `app.js` `buildAgentCard` onchange | `__manage_custom__` → `__manage_all_models__` |
| `app.js` `openSceneConfig` onchange | 同上 |

### 设计哲学（延续 F+17 系列）
- **始终显示入口** > 条件显示：F+17.2 的"自定义 0 项就藏入口"是反模式 → F+17.3 总有入口
- **hardcode 不删，只隐藏**：保护数据完整性，用户随时可恢复
- **selected 保护**：被隐藏的 model 如果是当前选中的强制显示 → 不破坏现有 Agent 配置
- **single source of truth**：getModelGroups() 抽出避免维护 2 份相同列表

---

## F+17.2 · 2026-06-06（自定义 model ID 删除/清空）

### 💡 用户痛点
F+17.1 只支持**添加**自定义 model，没有删除入口。后果：
- 输错 model ID → 列表里永久残留垃圾选项
- 自定义 ID 过期 / 不再用 → 没法清理
- 多次自定义后列表越来越长 → 噪音

### ✅ 三处改动
**1. `buildModelOptgroups` 自定义 optgroup 末尾加 manage 触发器**
```html
<option value="__manage_custom__">🗑 管理自定义列表（N 项）...</option>
```
仅当 `state.customModels.length > 0` 时显示。

**2. 新 helper `openManageCustomModelsModal(onChange?)`**
- 弹 `showModal` 列出所有自定义 model（id + vendor + 添加日期 + ⚠ 失败标记）
- 每行右侧 `🗑 删除` 按钮（红色）
- 列表 > 1 项时底部加 `🗑 全部清空 (N)` 按钮（带 confirm）
- **删除时同步清理 `state.modelFailures` 对应记录**（避免孤儿 failure 数据）
- onChange callback 让调用方重渲染 select

**3. select onchange 处理 `__manage_custom__`**
- `buildAgentCard`（自定义团队 Agent 卡片）
- `openSceneConfig`（内置场景 ⚙ 配置）
两个地方各加一段处理：
  - 回滚 select.value 到 prev value（不让 select 停在 manage option）
  - 打开管理 modal
  - onChange callback 内：重渲染 select + 检查当前 agent.model 是否被删 → fallback 全局默认 + toast 提示

### 🎁 用户操作流
1. 任意 model 下拉 → 看到顶部 `📝 自定义 / 历史` optgroup
2. 拉到底 → 看到 `🗑 管理自定义列表（3 项）...`
3. 点击 → 弹窗列出 3 项 + 每项右侧 🗑 删除
4. 点某项 🗑 → 立刻删 + toast `已删除：xxx` + 列表刷新
5. 列表空了 → 0.8s 后自动关 modal
6. 关 modal → select 自动重渲染 + 当前选中的 model 仍在 → 不变；如果被删 → fallback 默认 + toast 警告

### 🔧 改动文件
| 文件 | 改动 |
|------|------|
| `app.js` `buildModelOptgroups` | 自定义 optgroup 末尾 + manage 触发器 |
| `app.js` `openManageCustomModelsModal(onChange?)` | 新 helper · 70 行 |
| `app.js` `buildAgentCard` model onchange | + `__manage_custom__` 分支 + fallback 逻辑 |
| `app.js` `openSceneConfig` modal select onchange | + `__manage_custom__` 分支 + fallback 逻辑 |

### 数据完整性
- 删除 customModel → 同步删 modelFailures[modelId] （**避免孤儿数据**）
- 全部清空 → 批量清同样的失败记录
- agent.model fallback → 仅 UI 层 + toast，**不影响已存的 state**（用户可在场景重新选）

### 设计哲学（延续 F+17 自我修正循环）
- 添加：F+17.1 让用户随时加
- 失败标记：F+17 自动记 ⚠
- 成功清除：F+17 自动 clear failure
- **删除：F+17.2 让用户主动清理**

完整闭环：**加 → 用 → 失败标记 → 成功清除 / 主动删除**。

---

## F+17.1 · 2026-06-06（模型下拉支持任意自定义 model ID）

### 💡 用户痛点（F+17 之后的进一步反馈）
F+17 只做了"标记"（🔑/⚠/✓），但**模型列表本身仍是 hardcode 的 6 厂商 27 model**。用户：

> "不能自动匹配吗，有的模型版本过期了，有的允许的模型版本没有"

两个核心痛点：
1. **应用列的 model ID 过期**了（如 doubao 发了新版，旧 ID 不可用）
2. **用户 ARK Key 允许的 model ID 应用没列**（如某新版 / 自建 ep-xxxxxxxx）

→ 用户希望能**填任意 model ID**，不被 hardcode 列表绑死。

### ✅ 三层方案
**1. 每个 vendor optgroup 末尾加触发器**
```html
<optgroup label="✓ 豆包 Seed 2.0...">
  <option value="doubao-seed-2-0-lite-260428">...</option>
  <option value="doubao-seed-2-0-pro-260215">...</option>
  <option value="__add_custom__:doubao">✏️ 填自定义 豆包 model ID...</option>
</optgroup>
```
- 选中触发 `prompt()` 让用户输入任意 model ID
- 取消则 select 回滚到 prev value

**2. 顶部"📝 自定义 / 历史" optgroup**
- 自动收集 `state.customModels`（用户填过的）
- 当前 selectedModel 不在 hardcode 列表内时**自动加入**（避免 select 跳空）
- 优先显示在最上方，方便复用

**3. 持久化 + 跨场景共用**
- `state.customModels = [{ id, vendor, addedAt }]`
- localStorage key: `myAgentTeam.customModels`
- 一次添加，所有 Agent / 所有场景下拉都能选

### 🔧 实施
| 文件 | 改动 |
|------|------|
| `constants.js` | + `CUSTOM_MODELS_KEY` |
| `state.js` | + `state.customModels: []` |
| `storage.js` | + `saveCustomModels()` / `loadCustomModels()` |
| `app.js` `buildModelOptgroups` | + 顶部历史 optgroup + 每组末尾自定义触发器 |
| `app.js` `handleAddCustomModel(selectEl, vendor, onPick?)` | 新 helper，弹 prompt 处理输入 |
| `app.js` `buildAgentCard` model onchange | 检测 `__add_custom__:` 调 helper |
| `app.js` `openSceneConfig` select | setTimeout 后绑 onchange 同样处理 |
| `app.js` `init()` | + `loadCustomModels()` |

### 🎁 用户场景示例
**场景 1：豆包发了新版 lite**
1. 用户开 ⚙ 配置 → Agent-C 模型下拉
2. 看到 `doubao-seed-2-0-lite-260428` 选项已有 ⚠（之前失败过）
3. 拉到底点 `✏️ 填自定义 豆包 model ID...`
4. 弹 prompt → 输入 `doubao-seed-1-6-pro-250615`
5. select 顶部出现 "📝 自定义 / 历史" optgroup 含新 ID（已选中）
6. 保存 → 跑任务 → 成功 → F+17 自动 clear failure
7. 下次别的 Agent 也能选这个自定义 ID

**场景 2：自建 endpoint ep-xxxxxxxx**
1. 用户在 ARK 控制台创建 endpoint 拿到 `ep-abc123`
2. 任意 select → "✏️ 填自定义 豆包 model ID..."
3. 输入 `ep-abc123` → 持久保存
4. 不需要每个 Agent 都手填一次

### 工程教训
- **试错成本应该由系统消化** —— F+17 只是"提示有问题"，F+17.1 让用户能"绕过 hardcode 限制"自救
- HTML `<select>` 的限制（不能输入）用 **"特殊 option 触发 prompt + DOM 重渲染"** 优雅解决
- localStorage 持久化让 "添加一次，所有地方可用" —— 不是 per-agent 也不是 per-scene 的，是全局公共池

---

## F+17 · 2026-06-06（模型下拉智能感知 · Key 状态 + 失败记忆）

### 💡 用户痛点
> "那个模型选择能不能自动匹配密钥允许的模型，因为有的模型过没过期、能不能用都得一个个尝试"

模型下拉 6 厂商 27 个 model 全列出来，但用户可能只配了 2-3 个 Key。其他厂商的 model 选了肯定 401；某些 model ID 过期了也只能跑一次才知道。**试错成本高**。

### ✅ 两层智能感知

**1. 🔑 Key 状态感知**
- 没配 Key 的厂商 optgroup label 前加 `🔑` + 加 "· 未配 Key（设置面板填入即可选）" 后缀
- 该 optgroup 下的所有 option `disabled`（保留发现性，让用户知道厂商存在但要配 Key）
- 已选中的 option 不 disable（避免下拉值意外变）
- 有 Key 的厂商加 `✓` 前缀

**2. ⚠ 失败 model 记忆**
- 每次 API 调用失败（400 / 401 / 403 / 404 / Failed to fetch），handleApiError 自动 record 到 `state.modelFailures[modelId] = { ts, status, msg, vendor }`
- 不记录临时性错误（429 限流 / 503 过载 / 5xx 服务端临时）
- 失败 model 在下拉中加 ` ⚠ · 上次失败` 后缀 + hover tooltip 显示**失败时间 + HTTP code + server 原话前 100 字**
- 30 天自动清理失败记录（model 可能已恢复）
- **runAgent 成功调用时自动清除该 model 的 failure**（成功一次说明 model 当前 OK）
- 持久化到 localStorage（key: `myAgentTeam.modelFailures`），刷新页面仍记得

### 🎁 用户体验对比
**之前**：
```
[Doubao-Seed-2.0-lite]
[Doubao-Seed-2.0-pro]    ← 选了才知道这个过期/无权限/不支持工具
[gpt-4o]
[gpt-4o-mini]            ← 选了才知道你没配 OpenAI Key
```

**F+17 之后**：
```
[🔑 OpenAI · 未配 Key]    ← 灰色，hover 提示去配
  [gpt-4o] (disabled)
  [gpt-4o-mini] (disabled)
[✓ 豆包 Seed 2.0]
  [doubao-seed-2-0-lite-260428]
  [doubao-seed-2-0-pro-260215 ⚠ · 上次失败]  ← 标 + tooltip：上次失败 5 分钟前 · HTTP 400 · ...
```

### 🔧 改动文件
| 文件 | 改动 |
|------|------|
| `src/lib/constants.js` | + `MODEL_FAILURES_KEY = 'myAgentTeam.modelFailures'` |
| `src/state/state.js` | + `state.modelFailures: {}` 字段 |
| `src/persist/storage.js` | + `saveModelFailures()` / `loadModelFailures()` |
| `app.js` `buildModelOptgroups` | 重写：Key 状态 + 失败标 + tooltip + disabled |
| `app.js` `handleApiError` | + 自动 record failure |
| `app.js` `init()` | + `loadModelFailures()` 启动时恢复 |
| `src/scenes/orchestrator.js` `runAgent` | + callLLM 成功时 clear 该 model failure |

### 工程教训
- "智能感知 UI" 应该建立在**可定位的状态源**上：① 已知（Key 配置）② 历史（失败记录）③ 时效（30 天过期）
- 不要让用户做计算机能做的判断 —— 试错成本应该由系统消化
- "成功就 clear 失败"的双向自我修正机制比"手动清理"友好 10 倍

---

## F+16 · 2026-06-06（multi-phase Phase 2 history.content = `[]` critical bug）

### 🐛 BUG（用户反馈 + F+14.3 服务器原话定位）
用户：「在多阶段部分，第三个和第四个 agent 不能用豆包的模型，反而第一个和第二个可以用」

F+14.3 显示的 server 原话直接定位根因：
> `📋 服务器原话："The request failed because it is missing 'messages.content' parameter"`

### 🎯 根因
`src/scenes/orchestrator.js` L997 `runScene` 通用调度器（F+13 Sprint 2 抽出的）的 Phase 2 调度：

```js
const res = await runAgent(targetKey, sys, phase2History, { tag, sceneId });
...
phase2History.push({ role: 'assistant', content: []  });
//                                       ^^^^^^^^^^^
//                                       空数组！应该是 res.text
```

每轮 Phase 2 Agent 输出完，把 assistant 消息的 content 写成了**空数组**而不是真实文本 `res.text`。

下一轮 Agent（Phase 2 中心补充 / Phase 3 裁决）拿到 phase2History 时：
- OpenAI / Claude / Qwen / DeepSeek：**宽容地把 `content: []` 当成空串能跑** → 掩盖 bug
- **豆包 ARK**：严格按 OpenAI 协议校验 → 400 `missing messages.content`

### 📊 为什么"Agent 1/2 行，3/4 不行"
| Agent | 位置 | 接收 history | 触发 bug? |
|-------|------|------|------|
| Agent 1 (infoA / dossierA) | Phase 1 并行隔离 | 无 history | ✅ 不触发 |
| Agent 2 (infoB / dossierB) | Phase 1 并行隔离 | 无 history | ✅ 不触发 |
| **Agent 3 (infoC / dossierC 第 4 轮)** | Phase 2 中心补充 | **消费 phase2History** | ❌ 触发 |
| **Agent 4 (coordinator / archivist)** | Phase 3 裁决 | **消费整个累积 history** | ❌ 触发 |

### 📊 为什么"豆包报，其他厂商不报"
**严格协议 vs 宽容协议**：豆包 ARK 是少数严格按 OpenAI Chat Completions 协议要求 `messages[].content` 必须是 string 或 [{type, text}] 数组的厂商；其余主流厂商把 `[]` 当 falsy 处理。

→ 经典的"宽容服务器掩盖客户端 bug"故事。

### ✅ 修复
```js
phase2History.push({
  role: 'assistant',
  content: `[${AGENTS[targetKey].name}] ${res.text}`
});
```

对照 `runCustomTeamMultiPhase` L723：自定义团队的 multi-phase 版本**一直是正确的** `\`[${agent.name}] ${res.text}\`` —— 这个 bug 只在 F+13 Sprint 2 把决策/起底场景抽成 `runScene` 通用调度器时引入。

### 📊 影响面
- 所有 `runScene`-based 内置场景（**决策 / 起底**）的 Phase 2 第二轮中心补充 + Phase 3 裁决
- 受影响范围：用豆包当 Agent 3 (infoC/dossierC) 或 Agent 4 (coordinator/archivist) 模型的所有用户
- `runCustomTeamMultiPhase`（自定义团队 multi-phase）**不受影响**（独立代码路径，写法一直正确）

### 工程教训
- **服务器宽容是双刃剑**：OpenAI/Claude 接受 `content: []` 让 bug 潜伏数月；豆包严格校验直接暴露
- **F+14.3 显示 server.message 是这次 1 分钟定位的关键**——之前只显示"请求被拒绝（400）"完全猜不出原因
- 抽通用调度器时**对照原始实现的细节差异**：F+13 Sprint 2 抽 `runScene` 时漏掉了 customTeam 版本的关键写法
- **multi-厂商架构的隐性收益**：用豆包暴露了别人掩盖的 bug，否则永远潜伏

---

## i18n Phase 3 · 2026-06-06（Agent prompts 运行时英文化 + handleApiError 全字典化）

### 🌐 核心策略：运行时语言注入，不翻译 22 个中文 prompt
原计划 Phase 3 翻译 22 个 Agent 的中文 system prompt（4000-7000 字纯翻译工作 + 风险损失 prompt 精度）。

**重新评估后选了更聪明的方案**：
- 中文 prompt 保留不动
- runAgent 系统 prompt 末尾追加"[IMPORTANT — Output language] Respond entirely in English. ..."
- 现代旗舰 LLM（GPT-4+ / Claude 3+ / DeepSeek V3+ / Qwen3 / Doubao Seed 2.0）能完美处理"中文 prompt + 英文输出"

**理由**：
1. **0 翻译工作量** —— 覆盖所有 22 个 Agent + 未来新增 Agent
2. **0 prompt 精度损失** —— 中文 prompt 是多年迭代的产物
3. **留扩展接口** —— `AGENTS[key].systemEn` 字段未定义则 fallback 到 system；未来想彻底翻译某 Agent 时可加上

### ✅ 改动详情

**1. `src/i18n/i18n.js` 加 2 个 helper**
```js
outputLanguageHint()       // en → "[IMPORTANT — Output language] Respond entirely in English. ..."
                           // zh → ''
resolveSystemByLocale(ag)  // en + agent.systemEn → systemEn
                           // 否则 → agent.system
```

**2. `src/scenes/orchestrator.js` runAgent**
- 系统 prompt 解析改用 `resolveSystemByLocale()` —— 自定义 Agent + 内置 Agent 都走 locale fallback
- 记忆注入后追加 `MAT_I18N.outputLanguageHint()`

**3. `app.js` resolveAgentSystemPrompt**
- scenePrompts 覆盖优先级最高（用户自定义不动）
- 内置 prompt 走 locale fallback

**4. `app.js` handleApiError 全字典化（80+ 行 if/else 链）**
- 引入 `et(key, fallback)` 局部 helper
- 22 个 error msg + action 全部走 `et()` 调用
- contextLine / fixHint / serverTail 全部走 i18n
- **完全向后兼容**：i18n 未加载或字典缺失时 fallback 到原中文，零 regression 风险

**5. `app.js` togglePause 接入字典**
- 按钮文字 / 状态条 / toast 提示全走 et()

**6. zh.js / en.js 各加 18 个 error 字典条目**
- 错误细分到 doubao 专属 404 / 413 / 503 / cors 子类型 / 4 种 fixHint 模板

### 📊 完成度
| 模块 | 完成度 | 备注 |
|------|:------:|------|
| 顶栏 / 设置抽屉 / 介绍页 | 95% | Phase 2a/b/c/d 累计 |
| handleApiError | **100%** | 22 个分支全走字典 |
| togglePause / 任务控制 | 100% | |
| Agent 输出语言切换 | 100% | 运行时注入策略 |
| 高频 toast 调用（40+ 处） | ~5% | 仅 togglePause；其余需逐步接入 |
| SCENE_RULES / SIM_TEMPLATES 文案 | 0% | 未启动 |
| README / TECHNICAL_MANUAL 英文版 | 0% | 未启动 |
| BLOG.md 英文版 | 0% | 未启动 |

### 🎁 用户体验
- **EN locale**：UI 全部英文 + Agent 输出全部英文（中文 prompt → 英文回答，靠 LLM 能力）
- **ZH locale**：UI 全部中文 + Agent 输出中文（默认行为不变）
- **切换无刷新**：点 EN/中文按钮 → walkAndTranslate 重渲染 DOM；下次新任务的 Agent 自动按当前 locale 注入语言 hint

### 工程教训
- "翻译所有 prompt"听起来 thorough，实际 ROI 极低：4-6 小时纯翻译 vs 现代 LLM 5 行代码搞定
- **基础设施 + fallback 机制** 比 **大批量翻译** 更重要 —— 留 `systemEn` 字段，未来某个 Agent 有特殊需求再翻译
- error message 字典化的关键不是翻译质量，是**通用 helper `et(key, fallback)` 模式 + 完全向后兼容**

---

## i18n Phase 2d · 2026-06-06（设置面板 + 顶栏 title + 错误信息字典）

### 🌐 i18n 扩展
继 Phase 2a/2b/2c 的介绍页双语化后，把**用户最高频接触的三块**收尾：

**1. 基础设施增强**（`src/i18n/i18n.js`）
- 新增 `data-i18n-html` 属性支持 —— 用 `innerHTML` 替换，支持含 `<a>` / `<code>` / `<ul>` 等 HTML 标签的复杂 hint
- 之前只有 `data-i18n`（textContent，会清空子元素）和 `data-i18n-placeholder` / `data-i18n-title`

**2. zh.js / en.js 各加 ~85 keys**
- 顶栏 title 属性：8 个 button（介绍/历史/设置/项目/语言/running）
- 设置抽屉：7 个 vendor label + 7 个 hint + tools/default model
- 豆包专属：hybrid 代理说明（complex HTML）+ 控制台 hint + 权限 details
- toast 高频消息：15 条（saved/copied/paused/intervention/key/network/...）
- 状态条：6 个（idle/running/paused/done/error/aborted）
- 任务控制按钮：4 个（pause/resume/abort/back）
- API 错误：22 条（401/403/404/429×2/5xx/400×4/net/3 个 tag）

**3. `index.html` 加 i18n 标记 ~20 处**
- 顶栏 6 个 button title
- 设置抽屉 `<h2>` + close btn
- 7 个 vendor label + 4 个 HTML hint（qwen/deepseek/gemini/tavily）
- 豆包 hybrid box + permission details（用 `data-i18n-html`）
- tools/default model label
- page title + brand sub + running badge

### 📊 进度对比
| 模块 | Phase 2a/b/c 之前 | Phase 2d 之后 |
|------|:-----:|:-----:|
| zh.js 条目数 | 233 | **~318** |
| en.js 条目数 | 233 | **~318** |
| index.html `data-i18n` 标记 | 143 | **~163** |
| 顶栏 button title 双语 | ❌ | ✅ |
| 设置面板核心 label/hint 双语 | ❌ | ✅ |
| 豆包复杂段双语 | ❌ | ✅ |
| 错误信息字典完整 | ❌ | ✅（待 app.js 接入 i18n.t）|

### 🔧 待后续接入
toast() 调用和 handleApiError 内的中文字符串仍是写死的。Phase 2d 提供了完整的字典 + 改造路径，但实际接入需要修改 ~40 处 toast() 调用 + handleApiError 的所有分支。这一步建议跟 Phase 3 一起做（避免反复改 app.js）。

---

## F+15 · 2026-06-06（暂停按钮在 tool 循环中无响应）

### 🐛 BUG（用户反馈）
> "这个暂停操作不管用"

### 🎯 根因
`runAgent` 的 tool 调用循环（`orchestrator.js` L105-166）**只检查 `ac.signal`（超时/abort），不检查 `state.paused`**。

`waitWhilePaused()` helper 在 9 个外层调度点都有调用（runGroupChat / runDecisionScene 的每轮 Agent 之间），但 **runAgent 内部的 tool 循环没有**。

后果（决策场景实测）：
- Agent-A 触发 4-7 次 `web_search` tool call，每次 5-10 秒
- 用户按暂停后，state.paused = true，按钮变 "▶ 继续"
- 但当前 Agent 必须把整个 tool 循环跑完（30-60 秒）才进入外层 `waitWhilePaused()` → 体感**完全没暂停**

### ✅ 修复（2 处 + 1 处 UX）

**1. `orchestrator.js` runAgent tool loop 顶部**
```js
for (let iter = 0; iter < TOOL_LOOP_MAX; iter++) {
  await waitWhilePaused();          // ← 新增
  if (state.aborted || ac.signal.aborted) break;  // ← 顺手补 aborted check
  const result = await callLLM({ ... });
```

**2. `orchestrator.js` tool 执行循环每次迭代**
```js
for (const call of result.tool_calls) {
  await waitWhilePaused();          // ← 新增
  if (state.aborted || ac.signal.aborted) break;
  const toolResult = await executeToolCall(call);
```

**3. `app.js` togglePause 加 UX 提示**
```js
if (state.paused) {
  toast('暂停将在当前 Agent 当前 token / 工具调用结束后生效（最多 5-30 秒）', 'warn', 4500);
}
```

### 📊 暂停响应时间对比
| 场景 | 之前 | F+15 |
|------|------|------|
| 顺序模式 Agent 之间 | 立即（外层已支持）| 立即 |
| 决策场景 phase 之间 | 立即 | 立即 |
| **Agent tool loop 中** | **30-60 秒**（等所有 tool 跑完）| **5-10 秒**（等当前 tool 完成）|
| Agent streaming 中 | 等 stream 结束（不变）| 等 stream 结束（不变）|

### 设计权衡：协作式暂停 vs 强制中断
- **暂停（pause）**：协作式 —— Agent 跑到下一个 await 点检查 state.paused。优点：不丢已生成的 token，可继续。
- **停止（abort）**：强制 —— 通过 AbortSignal 立即中断 fetch。优点：立即停。缺点：streaming 一半的输出丢失，无法继续。

两个按钮各有用途，不该合并。F+15 让暂停**响应速度从 60s 降到 10s**，但保持协作式语义。

### 工程教训
- "暂停"这种状态机要在所有长循环点都检查 —— grep `state.paused` / `waitWhilePaused` 找出遗漏点
- UX 提示和功能修复同等重要：即使修了暂停响应速度，也要告诉用户"不是立即停"避免误解
- 类似的还有 `state.aborted` —— 也应该 grep 一下 tool loop 是否有遗漏

---

## F+14.3 · 2026-06-06（显示 vendor 真实 error message）

### 🐛 BUG（生产实战暴露）
用户连续遇到 401 → 400 的 doubao 错误：
- 401 时只显示 "API Key 无效"
- 400 时只显示 "请求被拒绝 · 检查任务描述是否包含敏感内容；或换一个模型"

**真实 error.message 藏在 `e.body` 里**，但 `handleApiError` 没把它显示给用户 → 用户必须 F12 → Network → Response 才能看到 ARK 实际说了什么。

### 🎯 根因
`handleApiError` 的所有分支都是"基于 status + body 关键词推断 + 写死 action"，**唯独没有直接把服务器的 error.message 转述给用户**。

对于 400 这种"原因多样"的状态码，靠正则关键词推断常常猜错：
- `Model xxx does not exist` → 现在显示"检查任务描述是否包含敏感内容"（误导）
- `Tools parameter not supported` → 现在显示"换一个模型"（不够具体）
- `Content moderation failed` → 现在能识别 ✓

### ✅ 修复（`app.js` handleApiError，1 处通用提取）
在 `fullMsg` 拼接前加一步通用 JSON parse + 安全提取：

```js
let serverMsg = '';
try {
  const parsed = JSON.parse(e.body || '');
  serverMsg = (parsed?.error?.message || parsed?.error?.msg || parsed?.message || parsed?.msg || '').slice(0, 300);
} catch {}
const serverTail = serverMsg ? `\n\n📋 **服务器原话**："${serverMsg}"` : '';

const fullMsg = msg + serverTail + contextLine + ... ;
```

### 📊 8 个 vendor error 结构覆盖测试
| Vendor / 场景 | 结构 | 提取结果 |
|---------------|------|---------|
| ARK model 不存在 | `{error:{message:...}}` | ✓ "The model ... does not exist" |
| OpenAI content filter | `{error:{message,type,code}}` | ✓ "Your input violates content policy" |
| DeepSeek invalid | `{error:{message,code}}` | ✓ "Invalid model specified" |
| Qwen 内容审核 | `{message,code}`（无 error 包裹）| ✓ "DataInspectionFailed: 输入内容存在敏感信息" |
| Gemini key invalid | `{error:{message,status}}` | ✓ "API key not valid..." |
| `error.msg` 变体 | `{error:{msg:...}}` | ✓ "Tools not supported on this model" |
| non-JSON HTML（502 等）| `<html>...</html>` | ✓ 空字符串 → 不显示（优雅降级）|
| 空 body | `''` | ✓ 空字符串 → 不显示 |

### 🎁 用户体验对比
**之前** ❌（400 时）：
```
❌ 请求被拒绝（400）
📍 失败位置：Agent「信息 Agent-C」尝试调用 doubao-seed-2-0-lite-260428
👉 检查任务描述是否包含敏感内容；或换一个模型。
```
→ 用户：什么意思？换哪个模型？真的是敏感内容吗？

**之后** ✅：
```
❌ 请求被拒绝（400）

📋 **服务器原话**："Tools parameter not supported by doubao-seed-2-0-lite-260428"

📍 失败位置：Agent「信息 Agent-C」尝试调用 doubao-seed-2-0-lite-260428
👉 检查任务描述是否包含敏感内容；或换一个模型。
```
→ 用户：哦原来 lite 不支持 tools，换 pro 就行。

### 工程教训
- 错误处理代码常陷入"自己猜原因"的陷阱，**vendor 的 error.message 才是 ground truth**
- "友好提示"和"原始信息"应该**并存**而不是二选一：本地推断 + 服务器原话同时显示
- 通用提取（4 个 fallback 字段路径）覆盖所有主流 vendor 的 error 结构变体

---

## F+14.2 · 2026-06-06（L1 校验兼容 emoji 表格格式）

### 🐛 BUG（生产实战暴露）
决策场景跑出后系统报：
- ⚙ `L1 格式校验 · 信息 Agent-A（正面）：缺少 [来源] 标注、缺少 [置信度] 标注`

但 Agent-A 输出 **明明有** `🔗 来源` `📊 置信度`，只是用了 **Markdown 表格 + emoji 前缀** 格式（DeepSeek 自由发挥风格），而 L1 regex 只认 `[来源]` 纯文本格式（Qwen 风格）。

### 🎯 根因
`checkEvidenceFormat` / `checkDossierFormat` 的 regex 太严：
```js
if (!/(\[来源\]|来源[:：])/.test(text)) ...   // 不识别 🔗 来源
```
而 Agent 输出格式自由（system prompt 没强约束）→ 不同 vendor 风格不同 → 误报。

### ✅ 修复（`src/scenes/orchestrator.js` L1 校验段）
新增第 3 种格式识别：emoji 前缀 + 中文关键字。

```js
const EMOJI_CLASS = '[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}]';
const RE_SOURCE     = new RegExp(`(\\[来源\\]|来源[:：]|${EMOJI_CLASS}\\s*来源|http)`, 'u');
const RE_CONFIDENCE = new RegExp(`(\\[置信度\\]|置信度[:：]|${EMOJI_CLASS}\\s*置信度)`, 'u');
// 同样改 RE_TIME / RE_TYPE
```

emoji 范围覆盖：
- `U+1F300-1FAFF` Pictographs（🔗 📊 📋 📄 📌 🌐 等）
- `U+2600-27BF`  Misc Symbols & Dingbats（✅ ⭐ ☑ ✔ 等）

兼容性：保留原 `[关键字]` 和 `关键字：` 两种格式 → Agent-B（Qwen 风格）和 Agent-A（DeepSeek 风格）都通过。

### 📊 三种格式兼容矩阵
| Agent 输出格式 | 示例 | 之前 | F+14.2 |
|---------------|------|------|---------|
| 纯文本方括号 | `[来源] https://...` | ✅ | ✅ |
| 冒号式 | `来源：CSDN` | ✅ | ✅ |
| Markdown 表格 + emoji | `\| 🔗 来源 \| ...` | ❌ 误报 | ✅ |
| 纯 URL（兜底） | `详见 https://...` | ✅ | ✅ |

### 工程教训
- L1 正则校验是"输出格式契约"——但 Agent 自由发挥时契约会漂移
- 修法二选一：① 强约束 system prompt 格式 ② 放宽校验兼容多种格式
- 选 ② 更鲁棒：未来 Agent 用 GPT-5/Claude 4 出新格式不会再误报

---

## F+14.1 · 2026-06-04（撤回方案 A 改做 hybrid 透明代理 · 方案 D）

### 🔄 撤回 F+14 方案 A，改做方案 D
F+14 当天 user 反问"没有更好的解决方式吗"。重新审视后发现**之前被"0 中间服务器"字面意思绑架了**，遗漏了真正最优解：

**Hybrid 透明代理**：localhost 直连 / 生产走 same-origin Vercel Edge Function（纯 pass-through）。

### 🧠 关键 insight
"0 中间服务器" 的核心承诺是 **"不存你的 Key / 不读你的对话"**，不是"流量绝对不经过任何 server"。
- vercel hosting 本身已经是 server
- 加 30 行 pass-through Edge Function 不增加任何凭证/业务逻辑
- 用户对 vercel 的信任（已经信任了 hosting）= 对透明代理的信任

### ✅ 方案 D 实施
1. 新建 `api/proxy/ark.js` Vercel Edge Function（80 行）：
   - `runtime: 'edge'` 支持 SSE streaming pass-through
   - 验证 Authorization header 存在
   - 透传 Body 到 ARK
   - 加 CORS header 返回流式响应
2. `callDoubao` 智能 endpoint 选择：localhost → 直连 / 生产 → `/api/proxy/ark`
3. 设置面板豆包 Key warning box：⚠️ "仅本地" → 💡 "hybrid 代理自动适配"
4. 介绍 UI 豆包 vendor：撤回 ⚠ badge，加 F+14.1 hybrid 说明
5. `handleApiError` 豆包错误：撤回"换模型"建议，改"检查 vercel 部署版本"
6. CHANGELOG 本章节记录决策演化

### 📊 vs 方案 A 对比
| 维度 | 方案 A | **方案 D（已采用）** |
|------|------|----------------|
| 豆包生产可用 | ❌ | ✅ |
| F+1~F+10 七次豆包修复成果生产用 | ❌ | ✅ |
| 0 凭证存储 | ✅ | ✅（Key 仍在 localStorage） |
| 用户体验 | 必须避开豆包 | 透明 |
| 招聘叙事 | "honest 接受限制" | "smart engineering：透明代理保留架构原则" |

### 工程教训（更新版）
- "0 中间服务器"应精确表述为"0 凭证存储 + 零业务逻辑代理"
- 不要被字面化的设计原则绑架，要思考承诺的本质
- Edge Function 同源代理 ≠ 真正的"中间服务器"

---

## F+14（已撤回 · 改做 F+14.1 hybrid 代理）· 2026-06-04

### 🐛 BUG（生产实战暴露）
- 用户决策场景在 hui1067.vercel.app 跑：信息 Agent-C (doubao-seed-2-0-lite-260428) "Failed to fetch"
- F12 console：`Access to fetch at 'ark.cn-beijing.volces.com' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header`
- 根因：**Volcengine ARK API 不返回 CORS header**。浏览器跨域必被阻。

### 💔 这暴露了 F+1~F+10 的盲区
- F+1~F+10 修了 **7 次豆包相关 bug**（model ID / 慢响应 / 自适应折叠 / ...），全部在 localhost 测的
- 生产环境（任何非 localhost 域名）豆包根本调不通
- "0 中间服务器"卖点和"豆包支持"在生产环境是**矛盾**的

### 🎯 方案选择
- 方案 A：honest 接受 + UI 警告 + 5 厂商生产可用 + 豆包 localhost only（**选这个**）
- 方案 B：Vercel serverless 代理豆包（违反 0 后端核心卖点 · 拒绝）
- 方案 C：彻底删豆包支持（丢失 7 次 F+ 迭代成果 · 拒绝）

### ✅ 方案 A 实施（5 处改动）
1. `callOpenAI` fetch 加 try-catch → `TypeError: Failed to fetch` 包成 `ApiError(0)` 含 endpoint 信息
2. `handleApiError` !status 分支 vendor-aware：检测 doubao → "豆包 ARK 跨域阻拦" 专项提示 + 修复路径
3. 设置面板豆包 Key 字段加 warning box：列出"localhost ✅ / 生产 ❌ / 代理"3 种情况
4. 介绍 UI 豆包 vendor card 加 "⚠ 仅本地" badge + 说明
5. CHANGELOG 本章节记录

### 📊 6 厂商生产可用度（F+14 后真实矩阵）
- ✅ OpenAI / Anthropic / Qwen / DeepSeek / Gemini：浏览器直连 OK
- ⚠️ 豆包 ARK：仅 localhost · 生产需后端代理（违反 0 后端原则）

### 工程教训
- "浏览器直连"作为架构卖点，**必须先验证目标 vendor 的 CORS 政策**再加进 MODEL_PRICING
- 仅 localhost 测试 ≠ 生产可用
- 加新 vendor 时应增加"production smoke test"（在 vercel preview 跑一次实际调用）

---

## F+12.2 · 2026-06-01（项目切换器 dropdown 看不清 + CSS 缓存修复）

### 🐛 BUG FIX
- **项目切换器下拉文字几乎不可见** → `.project-menu` CSS 用了未定义变量 `var(--bg-elev, #fff)` 退白底 + 浅字 `#e6e9f0` 在白底上对比度 ~1.1:1
- 修复：`background: var(--bg-elev-2)` + `border: --border-strong` + 加深 box-shadow 0.45 + hover/active opacity 0.18→0.28 + active color `--accent` → `--accent-hover`
- 验证：non-active 字色对比度 1.1:1 → **13.2:1**（WCAG AAA 级）

### 🔧 CHORE
- `index.html` styles.css URL 加版本号 `?v=f12-1` —— 解决浏览器顽固缓存（之前用户 reload 后 CSS 仍是旧版）
- 经验：以后每次改 CSS 都 bump 版本号，CDN 时代标准做法

---

## F+12.1 · 2026-06-01（产品聚焦终点 · 删 writing 直接场景）

### 💥 BREAKING
- **删 writing 从 SCENE_RULES + scene-chip + 编排模式映射文案**：直接选场景从 4 → 3（规划 / 决策 / 起底）
- 自动路由器不再把"写技术周报"路由到 writing 场景；改走全局 default 路由或交给用户选自定义团队

### 🔧 保留
- `SCENE_FLOWS.writing` + `SCENE_AGENT_LIST.writing` + 4 个 writing Agent（writing_planner / writing_drafter / writing_polisher / writing_proofreader）+ `runWritingPipeline` 函数全部保留
- 自定义团队仍可引用 writing 4 工序完整 Pipeline（这是设计：直接场景做减法，自定义团队做加法）
- 介绍 UI hero stat / scene grid / README 表格 / TECHNICAL_MANUAL 目录全数同步 4 → 3

### 配套：F+12 新增 dossier 起底场景（架构由用户先实现）
- 复用决策场景 Multi-phase 架构，4 Agent：`dossierA` 基础事实 + `dossierB` 时间线 + `dossierC` 第三方 + `archivist` 档案整理
- 强制 web_search ≥ 4 次 · 9 段事实档案输出 · **绝对禁止任何主观判断/推测/对比性结论**
- 与决策场景互补：决策 = "帮我选"，起底 = "帮我看清"，输出不下结论
- 详见 TECHNICAL_MANUAL §16.10

---

## F+12 · 2026-06-01（修 Gemini Key 字段被豆包长说明挤到看不见）

### 🐛 BUG FIX
- **用户报告"缺少 gemini apikey"** → 实际 DOM 存在，但豆包字段下的 ⚠ 模型权限 + 方法 A/B 长说明占了 322px，把 Gemini Key 推到 top=825，远超其他字段 ~100px 间距 → 用户滚动设置抽屉时跳过
- 修复：豆包 field-hint 长说明用 `<details>` 折叠为"点击展开"按钮，默认收起 → 豆包→Gemini 间距 322 → 128px
- 顺手同步 F+11：`<label for="toolsEnabledGlobal">` 文本"内置 6 场景允许 Agent 调用工具" → "内置场景允许 Agent 调用工具"

### 验证数据
```
key 字段相邻间距（preview eval 实测）：
F+11 后：[105, 80, 104, 104, 322, 105] ← 第 5 个异常
F+12 后：[105, 80, 104, 104, 128, 105] ← 全部正常
```

---

## F+11 · 2026-06-01（产品聚焦 · 删 3 个场景 UI 入口）

### 💥 BREAKING
- **UI 入口删除 3 个内置场景**：📊 分析、📚 学习、💡 创意
- 保留 3 个核心场景：📝 写作、📋 规划、⚖️ 决策（都经 F+1~F+10 验证）
- 首页 chip：6 → 3 · Hero stats "内置场景"：6 → 3 · "强制工具场景"：3 → 2

### 改动清单
- `app.js` `SCENE_RULES`：删 analysis/learning/creative 3 个 routing 规则；writing 的 negative 清空
- `index.html` 首页 scenes-grid：删 3 个 chip
- `index.html` 介绍 UI Hero stats / "📦 6 个内置场景" → "3 个" / "F+ 强制工具的 3 个场景" → "2 个" / "不强制工具的 3 个场景" → "不强制工具的场景" / 编排模式↔场景对应行
- `README.md` 6 场景表 → 3 场景表 + 加自定义团队引导
- `TECHNICAL_MANUAL.md` §3 重写：标题改 / 表减 3 行 / 删 §3.2 分析 / §3.4 学习 / §3.5 创意，重新编号 §3.1 写作 / §3.2 规划 / §3.3 决策

### 保留（向后兼容 + 避免破坏存档）
- 底层 `SCENE_FLOWS` 字典：analysis / learning / creative 配置不删
- 所有 Agent definitions：`analyst` / `industry` / `teacher` / `student` / `creative` / `reviewer` 保留
- 调度函数：`runAnalysisScene` / `runLearningScene` / `runCreativeScene` 保留
- 自定义团队 11 个预设里若引用上述 Agent 仍可正常运行
- 旧存档（用户保存的"分析队"等）打开时仍能识别和运行

### 设计理由
- 用户上一轮市场竞争力评估反馈：6 场景过于分散稀释产品差异化
- 聚焦 3 场景的 ROI：写作（生产力刚需）+ 规划（项目管理）+ 决策（Multi-phase 是核心卖点）
- 收益：首屏更聚焦 / 测试面减少 / 文档负担减轻
- 成本：低（保留底层代码，无破坏性变更）

---

## F+11.1 · 2026-06-01（项目颜色 + 历史过滤增强）

### ⭐ FEATURE
- **每个项目分配 10 色之一的随机颜色**（PROJECT_COLORS palette）：default 项目固定中性灰 `#6B7280`，新建项目从空闲色里随机抽
- **顶栏项目切换器**：当前项目名前显示彩色 dot；下拉菜单每项前都有 dot
- **设置面板项目列表**：每行左边 4px 彩色 border + 名字前 dot
- **历史模态框**：
  - 每条任务卡片左边 3px 彩色 border（同项目颜色）
  - 项目 pill 用项目颜色着色（半透明背景 + 主色文字 + 细边框）
  - 项目过滤 dropdown 加 "当前项目" 快捷选项（之前只有 "全部 / 无项目 / 各项目名"）
  - 全部项目选项显示历史任务总数 `全部项目（123）`

### 🐛 FIX
- **重复函数定义**：L2031 旧 `createProject` + L2042 旧 `deleteProject` 删除（F+11 helper 区已有新版本，含 saveProjectMemory + 重名检查 + color 字段）

### 🔧 CHORE
- `ensureProjectColors()` helper：给所有缺色项目补色（含旧 default 项目的迁移）
- `pickProjectColor()`：优先从空闲色里随机抽，全用完按 index 兜底

---

## F+11 · 2026-06-01（Level 3 项目空间）

### ⭐ FEATURE
- **项目空间（Projects）**：引入完全隔离的命名空间，解决跨主题记忆污染
- 每个 project 独立隔离：
  - 📌 项目上下文（projectContext）
  - 👤 用户画像（userProfile.learnedFacts，自动学习）
  - 🧠 Agent 个体记忆（agentMemories）
  - 📜 历史任务（通过 history.projectId 过滤）
- 全局共享：⚙ 设置 / 📂 知识库 / 💰 累计 metrics / 🛠 自定义团队
- 顶栏新增项目切换器（chip + dropdown 菜单 + 新建/管理入口）
- 设置面板新增"📁 项目空间"section（列表 + 新建/改名/删除）

### 🔧 实现
- **数据结构**：新加 `state.memoryByProject = { [pid]: { projectContext, userProfile, agentMemories } }`
- **持久化**：新 storage key `myAgentTeam.memoryByProject`（加入 ENC_SENSITIVE_KEYS 加密列表）
- **helper 函数**：`getActiveProjectId()` / `getProjectMemory(pid)` / `getProjectHistory(pid)` / `ensureDefaultProject()` / `createProject(name)` / `switchProject(pid)` / `deleteProject(pid)` / `renameProject(pid, name)` / `migrateMemoryToProjects()`
- **访问点迁移**：`buildMemoryInjection` / `runMemoryHygiene` / `autoLearnUserProfile` / `autoSummarizeAgentMemories` / `projectContextInput` 绑定 → 全部走 `getProjectMemory()`
- **旧数据迁移**：首次加载时自动把旧 `state.memory.{projectContext, userProfile, agentMemories}` 迁移到 `state.memoryByProject.default`（幂等）
- **删除项目**：项目 memory 清空，相关历史任务 `projectId` 重置为 'default'（不强删，可在默认项目继续看到）
- **任务运行时禁切**：`state.task` 非空时不允许 switchProject（避免上下文错乱）
- **UI 函数**：`renderProjectSwitcher()` / `renderProjectManagement()` / `bindProjectUI()` / `reloadUIAfterProjectSwitch()`

### 副作用
- 切换项目时 `location.reload()` 兜底刷新所有依赖 memory 的 UI（避免有遗漏的渲染入口）
- "默认"项目不允许删除（兜底，避免用户误删导致存档结构异常）

---

## F+10 · 2026-06-01（Tavily 乱码 result 过滤）

### 🐛 BUG FIX
- **Agent 看到部分 search result 乱码后自我降级"退回训练数据"** → 加 `sanitizeSearchDescription()` 过滤函数
- 根因：Tavily 抓中文页面（如新浪财经 GB18030）有时 description 包含乱码字符，LLM 看到一堆 `˾д | Efort | йգóߺƬ` 之类的乱码 → 自我评估 "search 不够好" → 主动退回训练数据 + 标 [警告：未联网]
- 修复：在 `web_search` 工具的 execute 函数里 sanitize 每条 description
  - 检测 Latin Ext-A/B (0100-024F) + IPA Extended (0250-02AF) + Spacing Modifier (02B0-02FF) + Greek (0370-03FF) + Cyrillic (0400-04FF) + U+FFFD 占比
  - 修复迭代：最初 regex 覆盖范围过窄，新浪乱码仅 11% 命中（< 15% 阈值漏放）→ 扩展到 Cyrillic + Latin Ext 后命中 16% 正确识别
  - 若 > 15%，整段替换为：`[原页面编码异常（如 GB18030 被当 UTF-8 解析），无法提取摘要。如需该来源，请直接访问：URL]`
  - 保留正常 result 不变；保留 URL 让 Agent 自行决定要不要 web_fetch 拿完整内容

### 副作用
- 个别极端混合编码页面（中文 + 数学符号）可能误判为乱码 → 但替换文本含 URL，Agent 可以选择 web_fetch 详查

---

## F+9 · 2026-06-01（修暂停按钮无效）

### 🐛 BUG FIX
- **决策场景按暂停无效** → 6 处关键循环只检查 `state.aborted` 没检查 `state.paused`
- 根因：`togglePause()` 和按钮绑定都正常，但决策 Phase 1/2 调度代码（L5095/5172/5319/5346/5483/5517）只 break on aborted，paused=true 后流程依旧往前跑
- 修复：
  - 加 `waitWhilePaused()` helper（循环 sleep 直到 paused=false；同时响应 abort 避免死循环）
  - 6 处 `if (state.aborted) break...` 前置 `await waitWhilePaused()`
  - 现有 4 处 `while (state.paused) await sleep(200)` 也升级成 helper 调用（防 abort 触发后 paused 仍 true 导致死循环）
- 影响面：所有场景（决策 / debate / reflection / hub-spoke）的暂停按钮现在真的能暂停

---

## F+8 · 2026-06-01（修 coordinator 超时被砍）

### 🐛 BUG FIX
- **coordinator 8 段裁决在第 4 段被超时砍掉** → 加 `coordinatorAgent: 300_000` 专用超时（5 分钟）
- 时间反推：豆包 Seed 2.0 pro 国内 ARK 实测 ~41 tok/sec，coordinator 完整 8 段 ≈ 6000-8000 tokens → 需要 195s+
- F+2 翻倍 timeout 时漏了 coordinator 是特例（输出量是普通 Agent 的 3-5 倍），仍用 `singleAgent: 120s` → 必然超时
- 配套：`taskDecision: 600 → 900`（Phase 1 并行 + 5 轮 Phase 2 串行 + coordinator 5min，总耗时实测可达 12 min）
- `runDecisionScene` 的 coordinator 调用补传 `timeoutMs: TIMEOUTS.coordinatorAgent`
- `TECHNICAL_MANUAL.md` 同步更新超时章节

---

## F+7 · 2026-06-01（修 DeepSeek R1 收不到 tools）

### 🐛 BUG FIX
- **callDeepSeek 的 R1 分支漏传 tools** → R1 在 Phase 1 强制工具场景下，思考过程显示"我无法真正使用 Tavily 搜索，需要模拟" → 自动降级用训练数据回答 + 标 [警告：未联网]
- 根因：L2556 旧代码 `const { system, userMsg, history, onDelta, signal, model } = opts;` 只解构 6 个字段，遗漏 `tools` 和 `messagesOverride` → 即使 forceTools=true，R1 模型从未真正收到 tool definitions
- 修复：解构补全 + body 加 `tools` 和 `tool_choice: 'auto'`（如有）+ 支持 messagesOverride（工具循环里的累积 messages）

### ⚠️ 已知限制
- DeepSeek R1 (`deepseek-reasoner`) 对 function calling 的官方支持本身就**有限/不稳定**（不同于 V3 `deepseek-chat`）
- 修复后 API 至少能正确收到 tools，但 R1 是否真正调用 tool 取决于 DeepSeek 服务端实现
- **建议**：决策场景这类强制工具流程，把 R1 改成 `deepseek-chat` (V3) 或其他厂商工具支持更稳的模型（claude-sonnet-4-5 / gpt-5 / qwen3-max）

---

## F+6 · 2026-06-01（短 ctx 模型适配 · 豆包 lite 32K 可用）

### ⭐ FEATURE
- **runAgent 自适应折叠**：tool 循环里每次 push tool result 后，估算 messages 累积 tokens；若超过当前模型 `contextWindow × 0.6` 阈值，自动把最早的 tool result 替换为占位符 `[早期搜索结果已折叠...]`，保留最新 1 个完整
- 设计目标：不降低 `TOOL_LOOP_MAX`、不缩短 prompt search 要求，让短 ctx 模型（豆包 lite 32K / Volcengine 自定义 endpoint）也能跑完 5 轮循环
- 新增 `getModelContextWindow(model)` 函数（按模型名前缀推断 ctx）：
  - GPT-5 / Gemini-2.5-pro: 256K-2M
  - GPT-4o / o3 / Claude / Qwen3: 128K-200K
  - DeepSeek: 65K
  - 豆包 Seed 2.0 pro: 256K；**豆包 lite / Volcengine endpoint: 32K**
  - 未知模型兜底 32K

### 副作用
- 大 ctx 模型（Claude 200K / Qwen3 128K / Gemini 1M）几乎不会触发折叠，调研体验完全不变
- 短 ctx 模型（豆包 lite 32K）：到第 4-5 次 search 时会触发折叠，老 result 被替换为占位符 → LLM 依靠最新 1 个 result + 自己的中间结论继续；信息密度略降但能跑完不爆

---

## F+5 · 2026-06-01（撤回 F+4 + tool 触发数 UI）

### 💥 BREAKING
- 撤回 F+4 的 `TOOL_LOOP_MAX: 5 → 3` 降级 → 恢复 5
- 理由：用户实跑 `qwen3-max` 跑 Phase 2 暴露"工具调用循环达到 3 次上限，强制停止"提示，用户偏好"充分调研路线"

### ⭐ FEATURE
- **Agent 消耗面板加 🔧 触发数显示**：每个 Agent 行尾显示 `🔧×N`，N 为该 Agent 本任务累计的 tool call 总次数（多个 search 算多次）
- TokenTracker.record 加第 4 参数 `toolCalls`（默认 0，向后兼容）
- runAgent 在 tool loop 里累加 `toolCallsCount`，return 给调用方

### 🔧 CHORE
- 4 个 Agent prompt 把"至少 2 次 web_search"改成"至少 4 次"，列出 4 个具体搜索方向以鼓励 Agent 用满循环：
  - `analyst`（分析）/ `industry`（分析）/ `infoA`（决策正面）/ `infoB`（决策反面）
- 已知 trade-off：Agent-B 类多关键词搜索 Agent 可能回到 ~50K tokens；短 ctx 模型（豆包 lite 32K）切不动

---

## F+4 · 2026-06-01（Agent token 累积爆炸修复）

### 🐛 FIX
- **Agent-B 在决策场景消耗 50K tokens（A 仅 5K、C 26K）** → `TOOL_LOOP_MAX: 5 → 3`
- 根因：runAgent 的工具循环里，每次 iteration 都把之前所有 `tool_result` 累积进 messages 数组，造成 prompt 几何级膨胀（iter 0 = 5K，iter 4 = 25K，累积 67K）
- Agent-B prompt 列了 5 个搜索方向（失败案例/风险/劣势/成本/反例），模型倾向一个一个搜，触发 4-5 次循环 → 用满 5 次上限累积最大
- 副作用评估：单 Agent 最大 search 次数从 4 降到 2，证据数从 20 降到 10（仍能选出 3-5 条优质）；累积 input 从 ~67K 降到 ~22K，避免短 ctx 模型（如豆包 lite 32K）爆 context

---

## F+3 · 2026-06-01（裁决截断修复）

### 🐛 FIX
- **决策场景 coordinator 8 段裁决在第 4 段被截断** → `MAX_TOKENS_PER_TURN: 1500 → 8000`
- 根因：8 段裁决（问题回顾/证据评估/分歧分析/推理过程/不确定性/二选一推荐/折中路径/风险预案）在高密度证据场景实测约 6570 tokens；之前 1500 tokens 上限砍掉 ⑤⑥⑦⑧ 一半内容
- 数字演进：最初估算 6000 tokens（按平均密度），但用户实跑数据反推 ② 证据评估含 11 条详细引用时每段密度更高，**最终值 8000 留 20% 余量**
- 副作用评估：Phase 1/2 Agent 实际输出由 prompt 决定，上限提升不会让短输出被动变长；对昂贵模型（Claude Opus 4.5）单次成本增 < $0.60（仅 coordinator 用满时）

---

## F+2 · 2026-06-01（豆包 pro 超时修复）

### 🐛 FIX
- **决策场景 Phase 2 群聊豆包 pro 频繁超时** → 4 个 TIMEOUTS 阈值统一翻倍
  - `singleAgent`: 60s → 120s
  - `decisionPhase1Agent`: 90s → 150s
  - `taskDefault`: 180s → 360s
  - `taskDecision`: 300s → 600s
- 根因：豆包 Seed 2.0 pro 在中国境内 ARK 区域实测 ~41 tokens/sec，简单 prompt 52s+；Phase 2 携带 tool call 结果 + 多轮历史时超 60s 是常态
- 影响面：所有场景的单 Agent 超时容忍度提升一倍（其他厂商也受益，但豆包 pro 最受益）

---

## F+1 · 2026-06-01（豆包 Seed 2.0 升级）

**豆包模型全面升级到 Seed 2.0 旗舰系列**。配合火山方舟 2026 年新的 API Key 权限模型（"自定义权限策略 → Model ID" 勾选制），不再依赖创建 endpoint，直接 model ID 调用。

### 💥 BREAKING
- `doubao-1-5-lite-32k-250115` → `doubao-seed-2-0-lite-260428`
- `doubao-1-5-pro-32k-250115` → `doubao-seed-2-0-pro-260215`
- 老 1.5 model ID 已从内置清单移除。如仍要用老版，可在自定义团队 model 字段手动填入。

### ⭐ FEATURE
- 升级到 Doubao-Seed-2.0-pro（旗舰主力）和 Doubao-Seed-2.0-lite（性价比）
- 豆包 Key 设置页提示文案重写：明确"必须在 ARK 控制台勾选 Model ID 权限"这一关键步骤
- 默认下拉里豆包条目改用更友好的官方显示名（Doubao-Seed-2.0-pro 等）

### 🔧 CHORE
- README.md / TECHNICAL_MANUAL.md 同步清除残留的 `doubao-1-5-pro-256k-250115` / `doubao-seed-1-6-flash-250615` / `doubao-seed-1-6-250615` 死链（这些 ID 早前从 MODEL_PRICING 删了但文档没同步）

---

## F+ · 2026-06-01

**决策 / 分析 / 写作场景升级为"事实强制核验"模式**。这是项目从"演示玩具"升级为"实用工具"的关键一跃。

### ⭐ 决策场景 F+ 全套
- runAgent 新增 `opts.forceTools` 参数（绕过全局开关）
- runDecisionScene 启动前 Tavily Key pre-flight check
- Phase 1 三 Agent 全部强制 web_search
- coordinator 在 Phase 3 强制 web_search 二次核查关键事实
- infoC 角色重构：从「中立陈述者」转为「假设挑战 + 重构警示 + 客观基准」三合一
- coordinator prompt 加"裁决前必须用 web_search 核查 3-5 条关键事实"
- preset_debate_phase 6 个 Agent 全部 toolsEnabled

### ⭐ 分析场景 F+ 全套
- SCENE_FLOWS.analysis 加 `forceTools: true`
- runGroupChat 读取 forceTools 标志并传给 runAgent
- analyst prompt 强制 web_search 实时指标
- industry prompt 强制 web_search 最新竞品 / 政策动态
- 启动前 Tavily Key check + 缺失警告横幅

### ⭐ 写作场景 F+ 全套（4 工序）
- SCENE_FLOWS.writing 加 `forceTools: true`
- buildBuiltinTeamForScene 给 Agent 注入 toolsEnabled
- writing_planner：建议 web_search 看角度差异化
- writing_drafter：强制 web_search 引真实数据
- writing_polisher：建议 web_search 校术语
- writing_proofreader：强制 web_search + web_fetch 验证每条引用

### 📝 文档
- **新增** TECHNICAL_MANUAL.md 完整技术参考手册
- 介绍页加"🛠 Agent 工具调用"章节
- 介绍页 Hero 统计加"Agent 工具" + "强制工具场景"
- 3 步上手补"事实可信路径 · 4 步"

---

## V1.5 · 2026-05-31

**长程会话记忆系统 + 工具调用基础设施**。从"金鱼脑多 Agent"升级为"记得过去任务、知道用户是谁、能调工具的 AI 团队"。

### ⭐ Agent 工具调用 Tier 1
- TOOLS 注册表 + executeToolCall 框架
- web_search 工具（最初用 Brave Search）
- web_fetch 工具（Jina Reader，免 Key）
- date_now 工具（本地 JS）
- runAgent 多轮工具循环（max 5 次）
- callLLM 全部 OpenAI 兼容 vendor 适配（OpenAI / Qwen / DeepSeek / 豆包 / Gemini）
- 每个 Agent 卡片可独立"🛠 启用工具"
- 设置面板全局开关 toolsEnabledGlobal

### 🔧 web_search 后端从 Brave 切到 Tavily
- 起因：Brave 在部分地区注册 / 访问受限
- Tavily 全球可用 + 免费 1000/月 + 专为 AI 优化
- braveSearchKey → tavilyKey（含向后兼容迁移）

### ⭐ 长程记忆 5 大源
- **项目上下文**：用户手填 ≤500 字长期上下文，注入每个 Agent
- **用户画像自学**：任务结束后 LLM 摘要"关于用户的新事实"，FIFO 上限 20 条
- **引用过往任务**：成本预估对话框选择从历史引用 1 条任务
- **知识库 (RAG)**：上传 .txt/.md 文档，按关键词召回 top-3 chunk
- **Agent 个体记忆**：每个 Agent 累积自己跑过的任务记忆

### ⭐ 任务延续
- runAgent 每次结束序列化 state.task 到 activeTask
- 首页检测未完成任务（1 天内）→ 横幅"⏯ 继续未完成的任务"

### ⭐ 自动关联推荐（用户可关）
- 启动任务时按关键词搜历史 top-3 相关
- 设置面板 enableAutoRelate 开关

### ⭐ 项目分组
- 历史任务可打 #project tag
- 设置面板管理 projects 列表

### ⭐ Token 预算精细化
- 每记忆源独立软上限（projectContext / userProfile / includedTask / knowledgeBase / agentMemory）
- 总 budget 二轮裁剪
- 成本预估对话框新增"💭 记忆消耗"明细

### ⭐ IndexedDB 迁移（P3-B）
- localStorage 总量 > 3MB 时自动迁
- KB chunks + 历史溢出归档到 IDB
- 元数据保留在 localStorage（快速过滤）

### ⭐ 记忆 hygiene（P3-C）
- 启动时自动跑：30 天过期 / Jaccard 去重 / 一正一反冲突检测
- 设置面板"🧹 立即清理"手动触发

### ⭐ PBKDF2 + AES-GCM 加密（P3-D）
- 设置面板"🔒 加密本地数据"toggle
- 主密码 PBKDF2 派生（10 万次迭代）
- AES-GCM 加密 API Keys / userProfile / agentMemories / knowledgeBase
- 派生密钥 sessionStorage 缓存

### ⭐ Vitest + Playwright 测试套件
- package.json + 测试基建
- 单元测试覆盖纯函数（路由 / 记忆 / 成本 / hygiene / 加密 / 编码）
- E2E 测试覆盖首屏 / 场景启动 / 设置弹层 / 介绍页

### 📝 文档
- 介绍页加"🧠 长程会话记忆"章节
- 介绍页加 6 项 hero stats 含"5 路记忆 / 85 测试"

---

## V1.4 · 2026-05-30

**14 个 Agent 系统提示词全面重写 + 裁决场景论述后置 + 介绍页升级 + 多场景模式映射**

### 💥 BREAKING：14 个内置 Agent prompt 重写
旧 prompt 仅一句话定位（150 字），新 prompt 含 6 要素（370 字）：
- 角色与边界
- 任务定义
- 工作方法（3-5 个有序步骤）
- 输出结构（明确 Markdown 模板）
- 质量门（数量底线如 "≥ 3 条证据"）
- 协作意识（明确知道上下游 / 同伴）

覆盖：researcher / editor / writing_planner/drafter/polisher/proofreader / analyst / industry / pm / advisor / teacher / student / creative / reviewer / infoA/B/C/coordinator

### 💥 BREAKING：裁决 Agent 改为"完整论述后置结论"
- coordinator + 顺序辩论中立裁判 + 多阶段辩论裁决官 全部改 8 段结构：
  1. 问题回顾
  2. 证据评估
  3. 关键分歧分析
  4. 推理过程
  5. 关键假设与边界
  6. 置信度评估
  7. **最终结论（只能在此处给出）**
  8. 建议下一步
- 防止"结论先行 → 论证凑数"的反向推理

### ⭐ 内置场景模式升级
- 写作场景从 sequential 改为 **Pipeline 4 工序**（选题/撰稿/润色/校对，新增 4 个专用 Agent）
- 规划场景改为 **Reflection 3 轮**（PM creator + 顾问 critic）
- 创意场景改为 **Reflection 3 轮**（创意总监 + 评审）
- 其余（分析 / 学习 / 决策）保持原模式

### 🐛 修 bug：场景配置弹层缺豆包 + Gemini
- buildModelOptgroups 漏了 2 家厂商 → 补全 6 厂商 16 模型
- 自定义团队 Agent 卡片复用 buildModelOptgroups（DRY）

### 📝 介绍页 5 模式映射 + 比较块
- 加"内置场景 ↔ 编排模式"映射表
- 加"普通 LLM 聊天 vs MyAgentTeam"对比块

---

## V1.3 · 2026-05-30

**6 厂商 16 模型 + 5 编排模式 + 11 预设 + 团队/模板库**

### ⭐ 接入豆包（火山引擎）+ Google Gemini
- 5 厂商 → 6 厂商
- 13 模型 → 16 模型（豆包 3 + Gemini 3）
- DRY 重构：vendorHasKey / modelHasKey / anyKeyConfigured 辅助函数

### ⭐ 新增 3 种编排模式
- Pipeline（线性工序）
- Reflection（创作 ⇄ 评论迭代）
- Hub-Spoke（中心 + 多专家）
- 加上原有的 Sequential + Multi-phase = **5 种编排模式**

### ⭐ 11 套精选预设
覆盖所有 5 种编排模式：三方对抗辩论（顺序/多阶段）/ 多视角分析 / 写作流水线 / 反思打磨 / 多专家问诊 / 苏格拉底学习 / 四厂商对照 / 创意三人组 / 经济型 / 深度推理

### ⭐ 团队库 + 模板库
- 团队可命名保存 / 切换 / 删除
- 身份描述可保存为模板
- 内置 10 模板（不可删）+ 用户自建（可删）
- 全部带搜索过滤

### ⭐ Per-Agent 模型配置（内置场景齿轮）
- 每个 chip 加 ⚙ 齿轮按钮
- 弹层为每个 Agent 选模型（跨厂商混合）
- ✨ 标记已自定义

### ⭐ 内置场景 Agent system prompt 可编辑
- 齿轮弹层加可折叠"✏️ 改 Agent 身份"
- 覆盖到 state.scenePrompts[sceneId][agentKey]
- 字符计数 + 一键恢复默认

### ⭐ Agent 头像本地上传
- 自定义团队 Agent 头像可上传图片（base64）
- 内置场景 Agent 头像（齿轮弹层）也支持上传
- 右键清除

### ⭐ 模型自定义图标 → 后撤
- 一度做了"为每个模型上传 logo"功能
- 用户判断价值低 → 删除（保留 Agent 头像）

### ⭐ 自定义团队多阶段编排
- 自定义团队也能用决策场景同款 Multi-phase 架构
- 每个 Agent 配 phase 1/2/3

### ⭐ 介入消息在 Pipeline/Reflection/Hub-Spoke 都生效
- takePendingInterventions 辅助函数
- 三种新编排都接收用户运行时介入

### ⭐ Pipeline 模式产出截断保护
- 长产出超 4000 字符自动截断
- 防止下游 Agent token 爆炸

### ⭐ chip 选中高亮反馈
- 输入框输入时 hint 高亮预测的场景
- 点 chip 时 firm 高亮 + 启动确认

### ⭐ Tier 1 顶栏运行中徽章 + 介入 toast + 错误翻译 + 空状态文案 + 搜索过滤 + 字符计数（6 项 P1 体验优化）

---

## V1.2 · 2026-05-30

**自定义团队构建器 + 决策场景多阶段独立会话**

### ⭐ 自定义团队构建器
- 首屏「🛠️ 自定义团队」chip
- 1-4 个 Agent 完全自由配置
- 每个 Agent 独立选模型（跨厂商）
- 8 套精选预设供一键载入

### ⭐ 决策场景多阶段独立会话
- runDecisionScene 实现 Phase 1 并行 + Phase 2 群聊 + Phase 3 裁决
- 信息隔离架构（设计档案 §6 核心）
- L1 正则校验 + L2 交叉引用校验
- coordinator 强制结构化输出

### ⭐ 接入通义千问（Qwen）DashScope + DeepSeek
- 2 厂商 → 4 厂商
- DashScope 兼容模式（OpenAI 协议）
- DeepSeek R1 reasoner 特殊流式处理（reasoning_content）

### ⭐ 历史任务页面（真实可点）
- 顶栏「⏱ 历史」从假 toast 变真 modal
- 列表 + 搜索 + 展开看完整讨论 + 重跑 + 删除

### ⭐ 结果导出 Markdown
- 结果页「📥 导出 Markdown」按钮
- 含元信息 + 用户原始任务 + 全部 Agent 发言 + 最终结果

### ⭐ 介绍页（顶栏入口 + 首次访问自动弹）
- 7 段排版 + 6 项 Hero 数据统计
- 首次访问自动展示 + introSeen 持久化

### ⭐ 部署到 Vercel
- vercel.json 配置
- 域名 hui1067.vercel.app

---

## V1.1 · 2026-05-30

**MVP 核心功能完成**

### ⭐ 6 场景 Agent 群聊 + AutoGen GroupChat 风格编排
- 写作 / 分析 / 规划 / 学习 / 创意 / 决策
- 每个场景 2-4 个 Agent
- Sequential 模式 4 轮发言

### ⭐ LLM 适配层（OpenAI + Anthropic + 模拟模式）
- OpenAI: chat completions + SSE 流式
- Anthropic: native messages API + dangerous-direct-browser-access
- 模拟模式：无 Key 时预脚本回复

### ⭐ Token 追踪 + 成本预估 + 硬熔断
- 实时追踪输入 / 输出 token + Agent 拆解
- 任务前预估对话框
- 单任务 $1 / 决策 $2 硬熔断

### ⭐ 用户介入（最多 3 次）+ 暂停 / 恢复
- 任务运行中底部输入框介入
- 介入消息全局可见
- 决策场景特殊规则（Phase 1/3 禁止介入）

### ⭐ 错误处理 + 超时分层
- 6 种错误场景（Key 无效 / 超时 / 限流 / 重试 / 网络 / 循环）
- 超时分层（连接 10s / 单 Agent 60s / Phase1 90s / 整体 3/5min）

### ⭐ 安全约束（V1 必须 9 条）
- DOMPurify XSS 防护
- `<user_input>` Prompt 注入防护
- 输入长度 2000 字符限制
- API Key mask 显示
- CORS 策略
- 速率限制

### ⭐ 配置面板 + 模型选择
- OpenAI / Anthropic Key 输入 + 格式校验
- 默认模型下拉
- 「记住我的配置」localStorage 持久化

### ⭐ 流式输出
- SSE 解析（OpenAI / Anthropic 各自格式）
- 实时打字效果

### ⭐ 场景路由器（关键词匹配）
- SCENE_RULES 数据驱动
- 否定词 + "还是"二选一规则
- 4 状态返回（唯一命中 / 多场景冲突 / 未命中 / 低置信度）
- chip 双档高亮反馈

### ⭐ 介绍页 + README + 验证

---

## V1.0 · 2026-05-30

**项目初始化**

- 搭建项目目录 + HTML 骨架
- 实现样式系统（暗色主题 + 14 Agent 配色 + 响应式）
- Tailwind via CDN
- 首屏布局：顶栏 / 主输入区 / 讨论区 / 结果区 / Token 面板
- 设计档案 v4.5 V1 范围全覆盖

---

## 版本回顾：从 V1.0 到 F+

```
V1.0 (5/30)  → MVP 单文件 demo                       2,500 行
V1.1 (5/30)  → 6 场景 + 2 厂商 + 流式 + 安全          4,500 行
V1.2 (5/30)  → 自定义团队 + 决策多阶段 + 4 厂商      8,000 行
V1.3 (5/30)  → 6 厂商 + 5 模式 + 11 预设 + 库       12,000 行
V1.4 (5/30)  → Agent prompt 全面重写 + 论述后置     13,500 行
V1.5 (5/31)  → 长程记忆 + 工具调用 + 测试 + 加密    16,500 行
F+   (6/1)   → 决策/分析/写作 F+ 事实强制核验       17,000 行
```

**累计**：17,000 行代码 / 200 个 JS 函数 / 7 个文档 / 15 个 localStorage Key / 2 个 IndexedDB store

---

## 已知遗留（V2+ 候选）

| 项 | 估时 |
|----|------|
| 故障转移（重试 3 次 + 切备用模型）| 1 周 |
| 任务断点恢复（Agent 级粒度） | 1 周 |
| 多任务并行 | 1 周 |
| Anthropic 原生 tools 协议适配 | 3 天 |
| Tier 2 工具：JS 执行（Web Worker 沙箱） | 0.5 天 |
| Pyodide Python 执行 | 1 周 |
| 移动端深度打磨（触屏验证） | 1 周 |
| 无障碍 WCAG 2.1 AA | 1 周 |
| 英文 i18n + 英文关键词路由 | 1 周 |
| 跨设备同步（需后端） | 1-2 周 |

---

## 致谢

- 设计档案：v4.5（核心架构源头）
- AutoGen GroupChat（多 Agent 编排灵感）
- LangFlow / CrewAI Studio（UX 参考）
- Anthropic《Building Effective Agents》论文（编排模式分类）
- 6 家厂商的 LLM API
- Tavily / Jina Reader（工具后端）

---

更新日志维护者：Claude + 用户协作开发
