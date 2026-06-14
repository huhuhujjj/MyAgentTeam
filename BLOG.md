# F+1 到 F+15：一个 LLM 编排项目 5 天的工程心路

> 不是版本号，是修复编号。这里讲的是 MyAgentTeam 这个项目，
> 从 2026-06-01 第一次 release 到 06-06 六天内的 16 次迭代——
> 包括 2 次正式撤回、1 次同主题 bug 复发、和我后来才意识到的一个根本性认知错误。

---

## 为什么是 "F+"，不是 "v1.1 v1.2"

第一次 release 之后我就给自己定了规矩：**任何上线之后改的东西，都用 `F+N` 编号**。

不叫 v1.0.1、不叫 patch、不叫 hotfix。原因很简单：

- "version" 暗示**计划好的演进**。但 release 之后的修复不是计划，是被生产打脸的痕迹。
- "fix" 暗示**只是修 bug**。但 F+ 里有撤回、有 UX 改、有架构换血——不止是修 bug。
- "F+" 是 **F**ield-driven、**F**ollow-up、**F**ix——一个混合体，**承认我没把第一版做对**。

这套编号在 5 天后已经写到 F+15。本文是它们的故事。

---

## 第一幕 · F+1 到 F+10 · 二十四小时十次修复

**2026-06-01**。release day。我在工位上写完 README，喝了口水，把链接发给三个朋友。20 分钟后第一个反馈来：「豆包模型怎么不能用」。

那天我修了 10 次。

### F+1：第一个上线小时

豆包 1.5 系列的 model ID 是 `doubao-1-5-pro-32k-250115`。我写代码时它还是默认入口，发布当天才发现火山引擎 2026 改了权限模型——**新版必须用 `doubao-seed-2-0-*` ID + 在 API Key 里勾选具体模型**。老 ID 直接 401。

修法很简单：换 model ID，重写设置面板的提示文案。但这是个**信号**：我对豆包生态的认知停留在 2024。

### F+2：超时翻倍 —— 数字必须从实测来

发完 F+1 半小时，新反馈：「决策场景 Phase 2 一直转圈」。

我开始计时。豆包 Seed 2.0 pro 在中国 ARK 区域**实测约 41 tokens/sec**。Phase 2 群聊带工具结果+多轮历史的单次 Agent 调用是 52-90 秒。我设的 `singleAgent: 60s` 必然超时。

把 4 个 TIMEOUTS 全部翻倍。这是"数字必须从实测来"的第一课——我之前的 60 秒是从 GPT-4 习惯反推的，根本不适用国内厂商。

### F+3：1500 → 8000 —— 长输出真的存在

下一个反馈：「裁决说着说着就停了」。

我看 token 设置：`MAX_TOKENS_PER_TURN: 1500`。这是从 GPT-3 时代继承的"经济默认值"。但决策场景的 coordinator 要输出 8 段裁决（问题回顾/证据评估/分歧分析/推理过程/不确定性/二选一推荐/折中路径/风险预案），实测**约 6570 tokens**。

我设了 8000。**留 20% 余量**——这个"20%"也是有意识的：太紧会再被打脸，太松浪费钱。

### F+4 → F+5 —— 第一次撤回

F+4 我做了一个看似聪明的优化：**`TOOL_LOOP_MAX: 5 → 3`**。理由：用户的 Agent-B 在决策场景一次消耗 50K tokens（Agent-A 才 5K），是因为每次工具循环都把所有 tool_result 累积，prompt 几何级膨胀。降到 3 直接砍掉 40% 成本。

发布。用户跑下一个任务。立刻反馈：「**工具调用循环达到 3 次上限，强制停止** —— 我要充分调研，这就停了？」

我盯着这条反馈想了半小时。技术上 F+4 没错——它真的省了钱。但它**违反了用户对产品的期待**：用户选决策场景就是要"5-7 次搜证才下结论"的扎实感，省钱不是它来这里的原因。

F+5 撤回：`3 → 5` 恢复。同时换思路—— **降不了次数，那就降密度**：F+6 做了自适应折叠（保留最新搜索完整、早期搜索折叠为占位符），既不限制 Agent 行为，又防止短 ctx 模型爆掉。

这次撤回教会我：**技术对的事情不一定是产品对的事情**。

### F+7：一个潜伏 5 天的隐性 bug

F+7 修的是 DeepSeek R1 模型在强制工具场景下的怪行为：思考过程里写"我无法真正使用 Tavily 搜索，**需要模拟**"，然后用训练数据回答 + 自己标 [警告：未联网]。

我查代码找了 40 分钟。最后定位到一行：

```js
const { system, userMsg, history, onDelta, signal, model } = opts;
//                                                            ↑ 漏了 tools, messagesOverride
```

只解构了 6 个字段，遗漏 `tools` 和 `messagesOverride`。所以即使 `forceTools: true`，R1 从未真正收到工具定义——R1 是"诚实"的，它在思考过程里写"我没工具，只能模拟"，但最终输出还是给了像样的答案让人没注意到。

这种 bug 最危险：**没有 crash，没有 error，输出还看起来正常**，只是**完全靠 LLM 训练数据在编**。

教训：**对长解构语句的字段要 grep 验证**，特别是从函数外加进来的新字段。

### F+8 与 F+9：特例与遗漏

F+8 是 F+2 的补丁：超时翻倍时漏了 coordinator——它输出量是普通 Agent 的 3-5 倍。普通 120s 不够，加了 `coordinatorAgent: 300_000`。

F+9 修的是「**按暂停按钮没用**」。我自信地查了 click handler、查了 state.paused、查了按钮 ID——全对。最后发现：**6 处关键循环只检查 `state.aborted` 没检查 `state.paused`**。

我加了个 `waitWhilePaused()` helper，6 处循环顶部都 await 一下。修完很骄傲：「以后所有调度循环都用这个，再也不会漏了」。

——这是后面 F+15 的伏笔。

### F+10：搜索结果乱码

最后一个修：Tavily 搜索偶尔返回二进制乱码 → Agent 用乱码下结论。加了字符密度过滤（非 ASCII 中文比例 > 阈值则丢弃）。

那天我修到凌晨 1 点。10 个 F+，平均每个 1.4 小时。

**第一幕的教训**：
1. **首发上线后的 24 小时几乎所有假设都会被打脸**——TIMEOUTS、MAX_TOKENS、TOOL_LOOP_MAX，这三个数字我设了三次。
2. **撤回不丢脸**——F+5 撤掉 F+4 的优化，反而让我后来更愿意做"激进的优化尝试"，因为我知道撤回的成本可控。
3. **隐性 bug 比 crash 更危险**——F+7 那种"功能降级却看似正常"的失败模式，需要主动审视输出真实性。

---

## 第二幕 · F+13 · "为什么我的 init 没跑"

F+11/F+12 是产品聚焦工作（删了 3 个低价值场景、加了项目空间），节奏正常。

F+13 是个让我反复折腾的 bug。

### 第一段：DOMContentLoaded 已经过了

用户报告：「项目切换器点击没反应」。我打开 console：`init() is undefined`、`renderProjectSwitcher is undefined`——所有挂载到全局的 init 逻辑都没跑。

```js
document.addEventListener('DOMContentLoaded', init);
```

我先怀疑是 init 内部有 throw，结果不是——是 `DOMContentLoaded` 事件**根本没触发 init**。

原因很微妙：在 Sprint 1 拆模块后，`<script>` 加载顺序变了，到 init 的脚本执行时 `document.readyState` 已经是 `complete`——**事件已经过了**。

修法：

```js
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();  // 已经过了 → 直接调用
}
```

### 第二段：即使加进去，还是 throw

应用这个 fix 之后 init 终于跑了，但抛 `_restoreSessionKey is not defined`。

原来：我在 Sprint 1 把加密相关的代码拆到 `src/persist/encryption.js`，但 `_restoreSessionKey`——一个**用于刷新页面后恢复 session key 的私有函数**——在 IIFE 内部定义后**没加到 return 对象**。app.js 调用 `MAT_ENCRYPTION._restoreSessionKey()` 就找不到。

两个 bug 各自独立、互相掩盖：
- 没有第一个 bug，第二个 bug 早就暴露
- 没有第二个 bug，第一个 bug 修完就能 work

**双 bug 叠加** 是 bug 调试里最折磨人的形式之一。每修一个都看起来"应该好了"，但症状不变。

教训：**任何"修了 A 但症状没变"的情况，要警觉 B 的存在**——不是 A 没修对，可能是 A 之外还有 B。

---

## 第三幕 · F+14 · 一次架构级撤回

这是整个 F+ 历程里我最自豪的一次决策——因为它本来不会发生。

### F+14 的诞生

用户在 hui1067.vercel.app 上跑决策场景，Agent-C 用豆包模型直接 `Failed to fetch`。F12 console:

```
Access to fetch at 'https://ark.cn-beijing.volces.com/...'
has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present
```

**Volcengine ARK API 不返回 CORS header**。

我盯着这个错误 5 分钟，然后想通了一件事：**F+1 到 F+10 的 7 次豆包修复，全部在 localhost 测的**。生产环境（任何非 localhost 域名）豆包**根本调不通**。

我有 3 个方案：
- **A**：honest 接受。加 UI 警告"豆包仅 localhost"，5 厂商生产可用。
- **B**：上 serverless 代理转发豆包。违反"0 后端" 卖点。
- **C**：彻底删豆包支持。丢失 7 次 F+ 修复成果。

我选了 A。写了 5 处代码、写了 CHANGELOG。挺得意——觉得自己"honest engineering"了。

### 用户的一句反问

发完之后 user 看着 changelog，发了一句话：

> 「没有更好的解决方式吗？」

就这句话。

我盯着看了 1 分钟，发现自己**被"0 中间服务器"这个字面意思绑架了**。

"0 中间服务器"的核心承诺是什么？拆开看：
- 不存你的 API Key
- 不读你的对话内容
- 不有业务逻辑

**不是 "流量绝对不经过任何 server"**——vercel 本身就是 server，hosting 已经是 server。我已经信任了 vercel 在 hosting 层不读不存，**为什么不能让它在 Edge Function 层也做透明转发**？

### F+14.1 —— Hybrid 透明代理

方案 D 写了 80 行：

```js
// api/proxy/ark.js · Vercel Edge Function
export const config = { runtime: 'edge' };

export default async function handler(req) {
  // CORS preflight ...
  if (!req.headers.get('authorization')) return 401-response;

  const arkResp = await fetch(ARK_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': req.headers.get('authorization'),  // 透传 Key
    },
    body: req.body,
    duplex: 'half',  // 支持 SSE streaming
  });

  return new Response(arkResp.body, {
    status: arkResp.status,
    headers: {
      ...arkResp.headers,
      'Access-Control-Allow-Origin': req.headers.get('origin') || '*',
    },
  });
}
```

**纯 pass-through。零业务逻辑。不存 Key。不 log body**。

callDoubao 加 hybrid endpoint 切换：

```js
const endpoint = isLocal
  ? 'https://ark.cn-beijing.volces.com/...'  // localhost 直连
  : '/api/proxy/ark';                          // 生产走 same-origin
```

我 commit 之前在 CHANGELOG 写了一段工程教训：

> "0 中间服务器" 应精确表述为 **"0 凭证存储 + 零业务逻辑代理"**。
> 不要被字面化的设计原则绑架——要思考承诺的本质。

这是我整个 F+ 历程里学到的最有价值的一课。**有时候**用户的一句反问，比 100 行代码更值得。

---

## 第四幕 · F+14.2 ~ F+15 · 一天三个小修

F+14.1 推上线后，用户立刻去跑决策场景。然后 24 小时内连续 3 个反馈，对应 3 个不同的层次。

### F+14.2：Agent 输出格式漂移

任务跑完，系统报：

> `L1 格式校验 · Agent-A：缺少 [来源] 标注、缺少 [置信度] 标注`

但 Agent-A 输出**明明有** `🔗 来源` `📊 置信度`——它用了 Markdown 表格 + emoji 前缀的风格。校验 regex 只认 `[来源]` 纯方括号格式。

不同 vendor 的"自由发挥"会导致**输出契约漂移**：
- Qwen 风格：`[证据]/[来源]/[置信度: 高]`
- DeepSeek 风格：表格 + 🔗 📊 emoji
- 兜底：直接 URL，没标签

修法二选一：
- **强约束 system prompt 格式** ——但下次出新模型可能又会漂
- **放宽校验** ——一次改通吃

我选后者：regex 加 emoji 范围识别。

```js
const EMOJI_CLASS = '[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}]';
const RE_SOURCE = new RegExp(
  `(\\[来源\\]|来源[:：]|${EMOJI_CLASS}\\s*来源|http)`, 'u'
);
```

教训：**当 LLM 输出格式自由时，验证逻辑应该宽容；强约束写在 prompt 里同样会被漂掉**。

### F+14.3：不要"猜原因"

F+14.1 修了 CORS 之后，新一轮 doubao 错误：先 401（Key 没勾权限），然后 400。

用户给我看 400 的提示：「请求被拒绝 · 检查任务描述是否包含敏感内容；或换一个模型」。

我看着这条提示愣了一下——**这是我的代码写的**。它在猜原因。可能是审核、可能不是。

真实 error message 其实在 `e.body` 里就有。各 vendor 几乎都用 `{error: {message: ...}}` 结构。我的 handleApiError 自己写了一堆 if/else 试图根据 status 和关键词推断原因，**唯独没把服务器的原话直接给用户看**。

7 行修复：

```js
let serverMsg = '';
try {
  const parsed = JSON.parse(e.body || '');
  serverMsg = (
    parsed?.error?.message ||
    parsed?.error?.msg ||
    parsed?.message ||
    parsed?.msg || ''
  ).slice(0, 300);
} catch {}
const serverTail = serverMsg
  ? `\n\n📋 **服务器原话**："${serverMsg}"` : '';
```

效果立竿见影：以后 400 会显示「📋 服务器原话："Tools parameter not supported by ..."」——用户立刻知道是 lite 不支持 tools，换 pro 就行。

**教训**：错误处理代码常陷入"自己猜原因"的陷阱。**vendor 的 error.message 才是 ground truth**——本地推断 + 服务器原话应该**并存**，不是二选一。

### F+15：暂停 bug 的复发

用户发来三个字：**"暂停不管用"**。

我心想：F+9 修过啊？

然后我搜了一下 `waitWhilePaused`——9 处调用，全在外层调度循环（runGroupChat / runDecisionScene 的 Agent 之间）。

**runAgent 内部的 tool 循环**（4-7 次 web_search 调用，每次 5-10 秒，总 30-60 秒）**一处都没有**。

```js
for (let iter = 0; iter < TOOL_LOOP_MAX; iter++) {
  // ← 这里漏了 await waitWhilePaused()
  const result = await callLLM({ ... });
  for (const call of result.tool_calls) {
    // ← 这里也漏了
    await executeToolCall(call);
  }
}
```

F+9 我自信地说"以后所有调度循环都用这个 helper"，但**runAgent 是另一个模块的另一个循环**——我当时没考虑到。

修法两行：

```js
for (let iter = 0; iter < TOOL_LOOP_MAX; iter++) {
  await waitWhilePaused();                       // ← F+15
  if (state.aborted || ac.signal.aborted) break;
  ...
  for (const call of result.tool_calls) {
    await waitWhilePaused();                     // ← F+15
    if (state.aborted || ac.signal.aborted) break;
    ...
  }
}
```

外加一个 UX 提示：暂停后弹 toast「将在当前 Agent / 工具调用结束后生效（最多 5-30 秒）」——避免用户按了暂停还看着 Agent 写 10 秒 token 产生的困惑。

**响应时间从 60 秒降到 10 秒。但语义没变——暂停依然是协作式的，不是强制中断**。

教训：
- **bug 会复发**。F+9 修过的同主题问题，F+15 在另一个模块以另一种形式再次出现。
- "我以后会注意 X" 这种自我承诺**几乎从不生效**。生效的是 grep `state.paused` 跑一遍代码库——是工具，不是意志。

---

## 尾声 · F+ 的本质是什么

写到这里，我盘了下这 16 个 F+ 的来源：

| 来源 | 数量 |
|------|:----:|
| 用户直接报告 | 9 |
| 我自己在生产环境用到 | 4 |
| 用户的"反问"催生 | 1（F+14.1）|
| 同主题 bug 复发 | 1（F+15）|
| 主动重构带出来的副作用 | 1（F+13）|

**没有一个 F+ 是我在写代码时预见到的**。

这让我想清楚一件事：**F+ 不是 changelog，是与生产对话的记号**。

每一个 F+ 都对应一个我没想到的现实：
- 没想到豆包 41 tok/sec
- 没想到 R1 会"诚实地模拟"工具
- 没想到 ARK 不返 CORS header
- 没想到"0 中间服务器"会被自己字面化绑架
- 没想到暂停 bug 会在另一个循环复发

这些"没想到"集合起来——就是 F+1 到 F+15。

---

### 三个最值钱的教训

**1. 撤回不丢脸——计划好"可以撤回"反而能更激进**

F+4→F+5、F+14→F+14.1。两次撤回都让我后来更愿意尝试有争议的优化，因为我知道撤回的成本可控（一个 commit + 一段 changelog 解释）。

**2. 用户的反问值 100 行代码**

"没有更好的解决方式吗"——7 个字，让我重新审视一个我以为已经定型的架构原则，最后产生了整个项目里最满意的一段代码（F+14.1）。

**3. 系统化思维 > 个人意志**

F+15 的复发证明：**"我以后会注意 X"** 是空头支票。真正生效的是工具——grep、test、lint、CI。任何"承诺记得检查 N 处地方"的修法，都应该升级为"全 codebase 自动扫描"。

---

### 写在最后

如果你在做一个会被真实用户用的项目，**给你的修复一个比 v1.0.1 更诚实的名字**。

每一次修复都是一次承认——"我没把第一版做对"。这种承认不应该藏在 git log 里，应该堂堂正正地放在 changelog 头部。

5 天 16 个 F+ 不是负担，是**项目活着的证据**。

死掉的项目没有 F+。

---

## 第五幕 · F+17 系列 16 步演化 —— 用户驱动的真实迭代

写完上面四幕的 BLOG 之后，又冒出来一个完全意想不到的 F+ 系列。

起点很普通：用户问"模型选择能不能自动匹配密钥允许的模型，因为有的模型过没过期、能不能用都得一个个尝试"。

我没想到这一句话会演化出 **16 个子版本**。

### F+17 → F+17.1：从"标记"到"自定义"

F+17 我做了智能感知：
- 🔑 没配 Key 的厂商灰掉
- ⚠ 上次调用失败的 model 加标 + tooltip
- ✓ 有 Key 的厂商加标
- 30 天自动清理失败记录

我觉得这就够了。结果用户说：

> "不能自动匹配吗，有的模型版本过期了，有的允许的模型版本没有。"

—— **标记只是缓解，不解决问题**。真正的问题是 hardcode 列表跟不上厂商发布节奏。

F+17.1：每个 vendor 末尾加 `✏️ 填自定义 model ID...`，用户填的持久化到 localStorage，跨 Agent 跨场景共用。

### F+17.2 → F+17.6：删除概念的反复折腾

F+17.2：用户填的能删（自定义列表加 🗑 删除按钮）。

F+17.3：用户问"那 hardcode 过期的呢？" → 加内置 model 隐藏功能 + manage 弹窗统一入口。

F+17.4：用户感觉"自定义=删除 / hardcode=隐藏"两套语义不一致 → **统一改成"🗑 删除"**。

F+17.5：考虑"删了想真彻底"的需求 → 加 **`🗑 永久移除`** 按钮 + **`🔄 重置所有 model 偏好`** 终极后门。

F+17.6：用户说 **"不需要终极后门"**。

我盯着这句话看了 30 秒。F+17.5 是工程师本能：「加个安全网，让用户万一手滑能恢复」。但用户说的是：**"永久"就该有"永久"的份量，你不要替我做安全决定**。

撤回。`🔄 重置偏好`按钮拆掉。

### F+17.7 → F+17.10：UX 持续打磨

F+17.7：用户上传 Agent 头像被 100KB 上限拒了 → 改 350KB。

F+17.8：用户实测 doubao-seed-2-0-pro-260215 报 502。我之前以为 502 是临时故障，不记录 modelFailures。**用户实测告诉我：豆包 ARK 把"model 已下线"返回成 502 而不是 404**。加入记录列表 + 豆包专属 "换自定义" 建议。

F+17.9：用户报"自定义写不进去，每次都得重填"。诊断发现：数据**实际已经持久化了**，只是 UI 标识太隐蔽 + 场景配置面板"关闭"按钮歧义。**数据没问题不等于 UX 没问题**。

F+17.10：用户截图 manage 弹窗，说"内置 model 列表区那 6 个 vendor 折叠看着烦"。砍掉。

### F+17.11：彻底剥离 hardcode

F+17.10 之后用户又说："移除所有内置模型"。

完全砍掉主下拉的 27 个 hardcode model。每个 vendor optgroup 只剩"✏️ 填自定义..." 触发器。新用户首次打开下拉**几乎是空的**。

这个决定看起来激进，但符合一个原则：**"开箱即用"是工程师的善意假设，但实际操作里 hardcode 永远跟不上厂商发布节奏。让用户自己掌控反而最稳定**。

写 CHANGELOG 时写下这句：

> **"hardcode 27 model = 数据 → 1 年就过期。"✏️ 填自定义..." 入口 = 机制 → 永远活。**
> **真正"开箱即用"的应该是机制不是数据。**

### F+17.12 → F+17.14：一个 bug 修两次

F+17.11 砍掉 hardcode 后，用户反馈"删除按钮不管用"。

F+17.12：我盯着 onclick handler 看，发现里面残留了 F+17.10 之前的 5 个废弃分支（处理已删除的 hardcode UI 等）。我清理了。

用户继续报：还是不行。

F+17.14：再仔细看 —— **`modalBody` 是被多个函数复用的 DOM 节点**（openSceneConfig 注册了 onclick 处理头像 / openManageAllModelsModal 也注册了处理删除）。后者的 `body.onclick = ...` 在某些情况下**没有真正覆盖**前者，所以删除按钮的 click 冒泡到了"找头像"的 handler，匹配不上，静默 return。

修法：不用 delegation，**直接给每个删除按钮绑 onclick + `stopPropagation`**。

F+17.14 真正修对了。

**F+17.12 → F+17.14 = 同一个 bug 修两次**。这种"修了没修对 → 重修"的记录比"一次到位"更真实。

### F+17.15 → F+17.16：再加再砍

F+17.15：用户说"删除按钮还是不行，加个一键清空兜底吧"。加 `🗑 全部清空` 按钮。

F+17.16：用户截图说"我填的 qwen-turbo 应该在通义千问下面，而不是顶部 ⭐ 区"。

这个改动让我顿悟：F+17.11 砍掉 hardcode 后，**"⭐ 已保存"和"6 vendor 区"的二元划分根本没意义了** —— 所有 model 都是用户自定义的。应该按 **vendor** 分组而不是按 "自定义 vs 内置"。

砍掉顶部 ⭐ 区，customModels 散布到对应 vendor optgroup。每个 vendor 标签显示数量。识别不出 vendor 的兜底放顶部"❓ 未识别"区。

终于到了我满意的状态。

### F+17 系列的真正教训

| # | 子版本 | 反馈来源 | 教训 |
|---|------|---------|------|
| 1 | F+17 | 自己设计 | 不够 |
| 2 | F+17.1 | 用户："不能自动匹配吗" | 标记不够，要让用户掌控 |
| 3-7 | F+17.2-6 | 删除语义反复 | "永久"和"撤销"的设计权衡 |
| 8 | F+17.6 | 用户："不需要后门" | 不要替用户做安全决定 |
| 9 | F+17.7 | 用户：100KB 不够 | 给用户合理上限不是节省存储 |
| 10 | F+17.8 | 用户实测 502 | 协议假设要被真实流量纠正 |
| 11 | F+17.9 | 用户："写不进去" | 数据正确 ≠ UX 正确 |
| 12-13 | F+17.10-11 | 用户："移除所有内置" | 机制 > 数据 |
| 14-16 | F+17.12-14 | 用户报 bug 三次 | 同主题 bug 修两次很正常 |
| 17-18 | F+17.15-16 | UX 持续打磨 | 砍二元划分回归 vendor 维度 |

**16 步 = 13 次用户反馈推着改**。没有一次是我主动预见的。

这就是真实的迭代节奏 —— 不是工程师"想清楚一步到位"，而是"产品和用户一起把它磨出来"。

---

## 第六幕 · F+22 Sprint 4 · 模块化的边界

F+17 系列做完之后，app.js 已经膨胀到 4500 行。

F+13 时我已经做过 Sprint 1，拆出了 23 个模块。但 app.js 这只巨兽自己还在长。最大原因是 F+17 系列 16 次都在改同一段 200 行代码 —— **它本该是一个独立模块**。

Sprint 4 拆了 3 块（约 1000 行）：

| 模块 | 行数 | 拆它的理由 |
|------|:----:|---------|
| `model_picker.js` | 237 | F+17 系列 16 次修改的 hot zone（git blame 频率） |
| `history.js` | 547 | F+18/F+18.1 改过（独立 UI） |
| `memory/learning.js` | 199 | 业务高度独立（5 源记忆 + 自学画像）|

但我**没拆**`runMemoryHygiene`、`findRelatedHistory`、`openSceneConfig`、`confirmRoute` —— 它们跟 `saveActiveTask` / 项目逻辑 / launchTask 强耦合。

写 CHANGELOG 时我意识到一件事：

> **模块化的真正难点不是"拆什么"，而是"什么时候停"。**
> 
> "完美模块化"是工程师 ego。"够用 + 不出 regression"是产品判断。

Sprint 1 第一轮拆完后我也想过"全拆"。Sprint 4 这次有了更清晰的标准：

- ✅ **git blame 频率高**的 → 拆（因为还会被改）
- ✅ **业务自包含 + 0 跨模块依赖**的 → 拆（无风险）
- ❌ **跟核心调度耦合**的 → 不拆（拆出来反而难维护）
- ❌ **稳定不再改**的 → 不拆（强拆只是工程师 ego）

最终 app.js 从 4498 → 3519 行（-22%）。**剩下的 3519 行我不打算继续拆**，它们都是核心调度和事件绑定，**集中放反而清晰**。

这是我学到的：**模块化不是越多越好。**

---

### 写在最后（第二版）

5 天 16 个 F+ 不是负担，是项目活着的证据。
之后又来了 16 步的 F+17 系列 + Sprint 4 模块化 ——
直到我写这篇博客的第二版的时候，CHANGELOG 已经累计 **30+ 个 F+ 编号**。

这中间没有任何一次是我提前规划好的。每一个都来自：
- 用户报 bug
- 用户的反问
- 我自己跑生产时撞墙

如果你正在做一个真实有人用的项目，**给你的迭代序号一个比 v1.0.x 更诚实的命名**。
F+1 = 我没把第一版做对。
F+30 = 我承认我没把前 29 版做对，但每一次都比上一次更接近。

死掉的项目没有 F+。
活着的项目有 30+ 个。

---

*MyAgentTeam · 2026-06-06 · F+22 撰写于发布后约 1 周*
