/* ============================================================
   MyAgentTeam · F+13 Sprint 1：模块化拆分
   src/ui/render.js — 任务运行时 DOM render 函数

   职责（8 个 render helper）：
   - setTaskStatus / updateProgress（顶栏状态）
   - renderAgentMsg / renderUserMsg / renderSystemMsg
   - renderToolCallMsg / finalizeToolCallMsg
   - renderPhaseDivider

   依赖（全局访问 window.*）：
   - DOM（document / $）
   - AGENTS（agents.js 已拆）
   - escapeHtml / sanitizeMarkdown（utils + app.js 内）
   - state.task / state.config（运行时状态）
   ============================================================ */

window.MAT_UI = (function() {
  "use strict";

  function setTaskStatus(text, cls) {
    const b = $('taskStatusBadge');
    b.textContent = text;
    b.className = 'task-status-badge ' + cls;
    // 同步顶栏 running 徽章
    const rb = $('runningBadge');
    if (rb) {
      if (text === '运行中' || text === '已暂停') rb.classList.remove('hidden');
      else rb.classList.add('hidden');
    }
  }
  
  /**
   * 渲染 Agent 流式消息卡片。返回 onDelta(text) 用于追加 token
   */
  function renderAgentMsg(agentKey, opts = {}, customAgent = null) {
    const a = customAgent || AGENTS[agentKey];
    const wrap = document.createElement('div');
    wrap.className = 'msg ' + (a?.cls || '');
    // 自定义 Agent 在 tag 里显示其使用的模型，便于排查多模型协作时的成本
    const modelTag = a?.model ? `<span class="bubble-tag">${escapeHtml(a.model)}</span>` : '';
    wrap.innerHTML = `
      <div class="avatar">${renderAvatarInner(a, agentKey)}</div>
      <div class="bubble">
        <div class="bubble-head">
          <span class="bubble-name">${escapeHtml(a?.name || agentKey)}</span>
          ${modelTag}
          ${opts.tag ? `<span class="bubble-tag">${opts.tag}</span>` : ''}
        </div>
        <div class="bubble-body markdown streaming-cursor"></div>
      </div>
    `;
    $('discussion').appendChild(wrap);
    scrollDiscussion();
    const body = wrap.querySelector('.bubble-body');
    let buffer = '';
    return {
      el: wrap,
      delta(txt) {
        buffer += txt;
        // 渲染 Markdown（每帧）。body 自带 .streaming-cursor 类负责显示光标，
        // 这里不再拼 inner span，避免出现双光标。
        body.innerHTML = sanitizeMarkdown(buffer);
        scrollDiscussion();
      },
      done() {
        body.classList.remove('streaming-cursor');
        body.innerHTML = sanitizeMarkdown(buffer);
      },
      text() { return buffer; }
    };
  }
  /** 工具调用渲染为独立的 msg 卡片，含 details 折叠（默认收起结果）*/
  function renderToolCallMsg(call) {
    const name = call.function?.name || '?';
    const argsStr = call.function?.arguments || '{}';
    const wrap = document.createElement('div');
    wrap.className = 'msg tool-call-msg tool-call-pending';
    wrap.innerHTML = `
      <div class="avatar tool-call-avatar">🔧</div>
      <div class="bubble tool-call-bubble">
        <details>
          <summary class="tool-call-summary">
            <span class="tool-call-name"><code>${escapeHtml(name)}</code></span>
            <span class="tool-call-args" title="${escapeHtml(argsStr)}">${escapeHtml(argsStr.length > 80 ? argsStr.slice(0, 80) + '…' : argsStr)}</span>
            <span class="tool-call-status">⏳ 执行中…</span>
          </summary>
          <pre class="tool-call-result">等待结果…</pre>
        </details>
      </div>
    `;
    $('discussion').appendChild(wrap);
    scrollDiscussion();
    return wrap;
  }
  
  function finalizeToolCallMsg(wrap, toolResult) {
    if (!wrap) return;
    const isErr = /^\{"error"/.test(toolResult);
    const status = wrap.querySelector('.tool-call-status');
    const resBox = wrap.querySelector('.tool-call-result');
    if (status) {
      status.textContent = isErr ? '❌ 失败' : '✅ 完成';
      status.className = 'tool-call-status ' + (isErr ? 'err' : 'ok');
    }
    if (resBox) {
      // 漂亮打印 JSON（如果是合法 JSON）
      let pretty = toolResult;
      try { pretty = JSON.stringify(JSON.parse(toolResult), null, 2); } catch {}
      resBox.textContent = pretty;
    }
    wrap.classList.remove('tool-call-pending');
    wrap.classList.add(isErr ? 'tool-call-err' : 'tool-call-ok');
    scrollDiscussion();
  }
  
  function renderSystemMsg(text) {
    const wrap = document.createElement('div');
    wrap.className = 'msg system';
    wrap.innerHTML = `
      <div class="avatar">⚙</div>
      <div class="bubble">
        <div class="bubble-head"><span class="bubble-name">系统</span></div>
        <div class="bubble-body">${escapeHtml(text)}</div>
      </div>
    `;
    $('discussion').appendChild(wrap);
    scrollDiscussion();
  }
  function renderUserMsg(text) {
    const wrap = document.createElement('div');
    wrap.className = 'msg user';
    wrap.innerHTML = `
      <div class="avatar">你</div>
      <div class="bubble">
        <div class="bubble-head"><span class="bubble-name">你</span><span class="bubble-tag">介入</span></div>
        <div class="bubble-body">${escapeHtml(text)}</div>
      </div>
    `;
    $('discussion').appendChild(wrap);
    scrollDiscussion();
  }
  function renderPhaseDivider(text) {
    const wrap = document.createElement('div');
    wrap.className = 'phase-divider';
    wrap.textContent = text;
    $('discussion').appendChild(wrap);
  }
  function scrollDiscussion() {
    const d = $('discussion');
    d.scrollTop = d.scrollHeight;
  }
  function updateProgress(text) { $('progressText').textContent = text; }

  return {
    setTaskStatus, updateProgress,
    renderAgentMsg, renderUserMsg, renderSystemMsg,
    renderToolCallMsg, finalizeToolCallMsg,
    renderPhaseDivider,
  };
})();
