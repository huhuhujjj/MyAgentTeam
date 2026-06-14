/* ============================================================
   MyAgentTeam · F+22.2 Sprint 4 模块化精细化
   src/ui/history.js — 历史任务 UI

   职责（4 个函数）：
   - fmtRelativeTime(ts)              相对时间格式化
   - exportHistoryAsMarkdown(h)       导出单条历史为 .md
   - showResultFromHistory(h)         把历史任务结果加载到主区
   - openHistoryModal()               历史任务弹窗（含 chip 筛选 / 批量 / ⭐ 收藏 / 搜索 scope）

   依赖（全局）：
   - state / $ / escapeHtml / sanitizeMarkdown / fmtUsd / modeLabel
   - AGENTS / SCENE_RULES / SCENE_FLOWS
   - saveHistory / getActiveProjectId / getProject / launchTask
   - showModal / closeModal / toast / setTaskStatus

   F+18 / F+18.1 改过这块（强推 5 项 + 第二梯队 4 项），独立 + 自包含
   ============================================================ */

window.MAT_HISTORY_UI = (function() {
  'use strict';

function exportHistoryAsMarkdown(h) {
  if (!h) { toast('找不到历史任务', 'warn'); return; }
  const sceneMeta = h.sceneId === 'custom'
    ? { icon: '🛠️', name: '自定义团队' }
    : (SCENE_RULES.find(s => s.id === h.sceneId) || { icon: h.sceneIcon || '·', name: h.sceneName || h.sceneId });
  const mode = h.mode || 'sequential';
  const durSec = h.durationMs ? (h.durationMs / 1000).toFixed(1) : '?';
  const dt = new Date(h.ts || Date.now()).toISOString().replace(/[:.]/g, '-').slice(0, 19);

  let md = `# ${sceneMeta.icon} ${sceneMeta.name} — 任务记录\n\n`;
  md += `**完成时间**：${new Date(h.ts).toLocaleString()}\n`;
  md += `**编排模式**：${modeLabel(mode, 'short')}\n`;
  md += `**耗时**：${durSec} 秒\n`;
  md += `**Token 消耗**：${(h.tokens || 0).toLocaleString()}\n`;
  md += `**费用**：${fmtUsd(h.costUsd || 0)}\n`;
  if (h.projectId) {
    const proj = getProject(h.projectId);
    if (proj) md += `**项目**：${proj.name}\n`;
  }
  md += `\n---\n\n## 📝 用户原始任务\n\n> ${(h.userText || '').replace(/\n/g, '\n> ')}\n\n`;

  // Agent 列表
  if (Array.isArray(h.agents) && h.agents.length) {
    md += `## 👥 参与 Agent（${h.agents.length}）\n\n`;
    h.agents.forEach(a => {
      const name = a.name || a.key || 'unknown';
      const model = a.model || 'unknown';
      md += `- **${name}**（${model}）\n`;
    });
    md += `\n`;
  }

  // 讨论过程
  if (Array.isArray(h.history) && h.history.length) {
    md += `---\n\n## 💬 讨论过程\n\n`;
    h.history.forEach(m => {
      const role = m.role === 'user' ? '🧑 你（介入）' : '🤖';
      md += `### ${role}\n\n${m.content || ''}\n\n`;
    });
  }

  // 最终结果
  md += `---\n\n## ✅ 最终结果\n\n${h.result || '（无结果）'}\n`;

  // 触发下载
  const safeName = sceneMeta.name.replace(/[\\/:*?"<>|]/g, '_');
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `MyAgentTeam_${safeName}_${dt}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast(`已导出：MyAgentTeam_${safeName}_${dt}.md`, 'ok', 3500);
}

/**
 * F+18.1：把历史任务的结果加载到主结果区（大屏查看 + 复用现有 markdown 渲染）
 * 跟 finalizeTask 的"任务完成 → 显示结果"是同一段视图
 * @param {object} h
 */
function showResultFromHistory(h) {
  if (!h) { toast('找不到历史任务', 'warn'); return; }
  const resultEl = $('resultContent');
  if (!resultEl) { toast('结果区未就绪', 'warn'); return; }
  resultEl.innerHTML = sanitizeMarkdown(h.result || '_（这次任务无最终结果）_');
  // 把 meta 区也填上（如果存在），让用户知道这是历史数据
  const metaEl = $('resultMeta');
  if (metaEl) {
    const proj = h.projectId ? getProject(h.projectId) : null;
    metaEl.innerHTML = `
      <div style="padding:10px;background:rgba(108,140,255,0.08);border-left:3px solid var(--accent);border-radius:4px;margin-bottom:10px;font-size:12px">
        <strong>📜 从历史载入</strong><br/>
        <span style="color:var(--text-muted)">
          ${escapeHtml(h.sceneName || h.sceneId)} · ${modeLabel(h.mode, 'short')} · ${fmtRelativeTime(h.ts)}
          ${proj ? `· <span style="color:${proj.color}">📁 ${escapeHtml(proj.name)}</span>` : ''}
          · ${fmtUsd(h.costUsd || 0)} · ${(h.tokens || 0).toLocaleString()} tk
        </span>
      </div>
    `;
  }
  showResultView();
  toast(`已加载到主区 · ${h.sceneName || h.sceneId}`, 'ok', 2500);
}

/* ====================== 历史任务弹层 ====================== */

function fmtRelativeTime(ts) {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return s + ' 秒前';
  const m = Math.floor(s / 60);
  if (m < 60) return m + ' 分钟前';
  const h = Math.floor(m / 60);
  if (h < 24) return h + ' 小时前';
  const d = Math.floor(h / 24);
  if (d < 30) return d + ' 天前';
  return new Date(ts).toLocaleDateString();
}

function openHistoryModal() {
  let expandedId = null;
  // F+18：场景 + 时间 chip 状态（闭包变量，重渲染后保持）
  let sceneFilter = 'all';
  let timeFilter  = 'all';
  // F+18.1：新闭包状态
  let showOnlyStarred = false;
  let selectMode = false;
  const selectedIds = new Set();
  const searchScopes = { input: true, result: false, discussion: false };

  const SCENE_FILTERS = [
    { id: 'all',      label: '全部' },
    { id: 'decision', label: '⚖️ 决策' },
    { id: 'dossier',  label: '🔍 起底' },
    { id: 'planning', label: '📋 规划' },
    { id: 'custom',   label: '🛠️ 自定义' },
  ];
  const TIME_FILTERS = [
    { id: 'all',   label: '全部时间' },
    { id: 'today', label: '今天' },
    { id: '7d',    label: '7 天' },
    { id: '30d',   label: '30 天' },
  ];
  const SCOPE_TOGGLES = [
    { id: 'input',      label: '输入' },
    { id: 'result',     label: '结果' },
    { id: 'discussion', label: '讨论' },
  ];
  const buildChips = (filters, active, dataKey) =>
    filters.map(f =>
      `<button class="history-chip${f.id === active ? ' active' : ''}" data-${dataKey}="${f.id}" style="padding:4px 10px;border-radius:14px;border:1px solid ${f.id === active ? 'var(--accent)' : 'var(--border)'};background:${f.id === active ? 'var(--accent)' : 'transparent'};color:${f.id === active ? '#fff' : 'var(--text)'};font-size:12px;cursor:pointer">${f.label}</button>`
    ).join('');
  // F+18.1 mini scope chip（比 SCENE/TIME chip 更小）
  const buildScopeChips = () => SCOPE_TOGGLES.map(s => {
    const on = searchScopes[s.id];
    return `<button class="history-scope-chip${on ? ' active' : ''}" data-scope="${s.id}" title="${on ? '点击关闭：不搜' : '点击启用：搜'} ${s.label}" style="padding:2px 8px;border-radius:10px;border:1px solid ${on ? 'var(--accent)' : 'var(--border)'};background:${on ? 'rgba(108,140,255,0.15)' : 'transparent'};color:${on ? 'var(--accent)' : 'var(--text-muted)'};font-size:11px;cursor:pointer">${on ? '☑' : '☐'} ${s.label}</button>`;
  }).join('');
  // F+18.1 starred 优先 → ts 倒序
  const sortHistory = (items) => items.sort((a, b) => {
    if (!!a.starred !== !!b.starred) return a.starred ? -1 : 1;
    return b.ts - a.ts;
  });

  const render = () => {
    if (state.history.length === 0) {
      return `<p style="color:var(--text-muted);text-align:center;padding:20px">
        还没有历史任务记录。完成一个任务后会自动出现在这里。
      </p>`;
    }
    const sorted = sortHistory([...state.history]);
    const totalCost = state.cumulative.totalCostUsd;
    const totalTk = state.cumulative.totalTokens;
    const projOpts = state.projects.map(p => `<option value="${p.id}">📁 ${escapeHtml(p.name)}</option>`).join('');
    const header = `
      <div class="history-summary">
        <div>累计 <strong>${state.cumulative.taskCount}</strong> 次任务 · <strong>${fmtUsd(totalCost)}</strong> · ${totalTk.toLocaleString()} tk</div>
        <button class="ghost-btn small" id="clearAllHistoryBtn">🗑 清空全部</button>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:6px">
        <input type="text" id="historySearch" class="history-search" placeholder="搜索任务（按下方范围 chip 决定搜哪里）…" style="margin-bottom:0"/>
        <select id="historyProjectFilter" style="flex:0 0 180px" title="按项目过滤历史">
          <option value="">全部项目（${state.history.length}）</option>
          <option value="${escapeHtml(getActiveProjectId())}">📁 当前项目</option>
          <option value="__none__">无项目（旧数据）</option>
          ${projOpts}
        </select>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:8px;align-items:center;flex-wrap:wrap">
        <span style="font-size:11px;color:var(--text-muted);margin-right:2px">搜索范围</span>
        ${buildScopeChips()}
        <span style="font-size:10px;color:var(--text-muted);margin-left:4px">默认搜输入；结果/讨论可选（开启后搜得更深但更慢）</span>
      </div>
      <div class="history-chip-row" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;align-items:center">
        <span style="font-size:11px;color:var(--text-muted);margin-right:4px">场景</span>
        ${buildChips(SCENE_FILTERS, sceneFilter, 'scene-filter')}
      </div>
      <div class="history-chip-row" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;align-items:center">
        <span style="font-size:11px;color:var(--text-muted);margin-right:4px">时间</span>
        ${buildChips(TIME_FILTERS, timeFilter, 'time-filter')}
      </div>
      <div class="history-chip-row" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;align-items:center">
        <button id="toggleStarredOnly" class="history-chip${showOnlyStarred ? ' active' : ''}" title="只显示已收藏 ⭐ 的任务" style="padding:4px 10px;border-radius:14px;border:1px solid ${showOnlyStarred ? '#facc15' : 'var(--border)'};background:${showOnlyStarred ? 'rgba(250,204,21,0.15)' : 'transparent'};color:${showOnlyStarred ? '#facc15' : 'var(--text)'};font-size:12px;cursor:pointer">${showOnlyStarred ? '⭐ 仅看收藏' : '☆ 仅看收藏'}</button>
        <button id="toggleSelectMode" class="history-chip${selectMode ? ' active' : ''}" title="进入选择模式批量管理" style="padding:4px 10px;border-radius:14px;border:1px solid ${selectMode ? 'var(--accent)' : 'var(--border)'};background:${selectMode ? 'var(--accent)' : 'transparent'};color:${selectMode ? '#fff' : 'var(--text)'};font-size:12px;cursor:pointer">${selectMode ? '✕ 退出选择' : '☑ 选择模式'}</button>
      </div>
    `;
    const rows = sorted.map(h => {
      const isOpen = h.id === expandedId;
      const isSelected = selectedIds.has(h.id);
      const detail = isOpen ? `
        <div class="history-detail">
          <h4>原始任务</h4>
          <pre>${escapeHtml(h.userText)}</pre>
          <h4>结果</h4>
          <div class="markdown">${sanitizeMarkdown(h.result || '')}</div>
          <h4>讨论过程（共 ${h.history.length} 条）</h4>
          <div class="history-discussion">${h.history.map(m =>
            `<div class="history-msg ${m.role}"><span class="history-msg-role">${m.role === 'user' ? '你' : 'A'}</span>${escapeHtml((m.content || '').slice(0, 500))}${(m.content || '').length > 500 ? '…' : ''}</div>`).join('')}
          </div>
          <div class="history-row-actions">
            <button class="ghost-btn small history-rerun" data-id="${h.id}" title="用相同 sceneId + userText 直接启动（会用当前场景配置）">🔄 直接重跑</button>
            <button class="ghost-btn small history-edit-rerun" data-id="${h.id}" title="把输入填回主输入框，让你改完再启动">✏️ 编辑后重跑</button>
            <button class="ghost-btn small history-load-main" data-id="${h.id}" title="把结果加载到主区大屏查看">👁 加载到主区</button>
            <button class="ghost-btn small history-export-md" data-id="${h.id}" title="导出为 Markdown 文件">📥 导出 .md</button>
            <button class="ghost-btn small history-delete" data-id="${h.id}">🗑 删除此条</button>
          </div>
        </div>
      ` : '';
      // F+11.1 project pill 带颜色（背景半透明 + 文字本色）
      const proj = h.projectId ? getProject(h.projectId) : null;
      const projPill = proj
        ? `<span class="project-pill" style="background:${proj.color}22;color:${proj.color};border:1px solid ${proj.color}44">📁 ${escapeHtml(proj.name)}</span>`
        : '';
      // F+18.1 selectMode 时 row 左加 checkbox（onclick inline 阻止冒泡，避免触发 row 切换）
      const checkboxHtml = selectMode
        ? `<input type="checkbox" class="history-select-checkbox" data-id="${h.id}" ${isSelected ? 'checked' : ''} style="margin-right:8px;cursor:pointer;width:16px;height:16px" />`
        : '';
      // F+18.1 ⭐ 收藏切换按钮（不论 selectMode 都显示）
      const starBtn = `<button class="history-star-btn" data-id="${h.id}" title="${h.starred ? '取消收藏' : '收藏（置顶）'}" style="background:none;border:none;font-size:16px;cursor:pointer;padding:2px 4px;margin-right:4px;color:${h.starred ? '#facc15' : 'var(--text-muted)'};line-height:1">${h.starred ? '⭐' : '☆'}</button>`;
      const rowExtraStyle = isSelected ? 'background:rgba(108,140,255,0.10);' : '';
      return `
        <div class="history-row${isOpen ? ' expanded' : ''}${isSelected ? ' row-selected' : ''}${h.starred ? ' row-starred' : ''}" data-id="${h.id}" data-project="${h.projectId || '__none__'}" data-scene="${escapeHtml(h.sceneId || '')}" data-ts="${h.ts}" style="${proj ? `border-left:3px solid ${proj.color};` : ''}${rowExtraStyle}">
          <div class="history-row-head">
            <div class="history-row-left" style="display:flex;align-items:center">
              ${checkboxHtml}${starBtn}
              <span class="history-icon">${h.sceneIcon}</span>
              <div>
                <div class="history-row-title">${escapeHtml(h.userText.slice(0, 50))}${h.userText.length > 50 ? '…' : ''}</div>
                <div class="history-row-sub">
                  ${escapeHtml(h.sceneName)} · ${modeLabel(h.mode, 'short')} · ${h.agents.length} Agent · ${fmtRelativeTime(h.ts)}
                  ${projPill}
                </div>
              </div>
            </div>
            <div class="history-row-right">
              <button class="ghost-btn small history-copy-input" data-id="${h.id}" title="复制原始输入到剪贴板" style="padding:2px 8px">📋</button>
              <div class="history-cost">${fmtUsd(h.costUsd)}</div>
              <div class="history-tokens">${h.tokens.toLocaleString()} tk</div>
            </div>
          </div>
          ${detail}
        </div>
      `;
    }).join('');
    // F+18.1 selectMode 时底部 floating action bar
    const activeProj = state.activeProjectId ? getProject(state.activeProjectId) : null;
    const floatBar = selectMode ? `
      <div class="history-float-bar" style="position:sticky;bottom:0;background:var(--bg);border-top:2px solid var(--accent);padding:10px 12px;display:flex;gap:8px;align-items:center;margin-top:10px;border-radius:6px;box-shadow:0 -4px 12px rgba(0,0,0,0.15);flex-wrap:wrap">
        <strong style="margin-right:8px;color:var(--accent)">${selectedIds.size} 已选</strong>
        <button class="ghost-btn small" id="batchSelectAll">全选可见</button>
        <button class="ghost-btn small" id="batchClearSelection">清空选择</button>
        <button class="ghost-btn small" id="batchDelete" ${selectedIds.size === 0 ? 'disabled' : ''} style="${selectedIds.size > 0 ? 'color:#ef4444;border-color:#ef4444' : ''}">🗑 删除选中 (${selectedIds.size})</button>
        ${activeProj ? `<button class="ghost-btn small" id="batchMoveToActive" ${selectedIds.size === 0 ? 'disabled' : ''}>📁 加入「${escapeHtml(activeProj.name)}」</button>` : ''}
        <button class="ghost-btn small" id="batchRemoveProject" ${selectedIds.size === 0 ? 'disabled' : ''}>📁 移出项目</button>
        <button class="ghost-btn small" id="batchStar" ${selectedIds.size === 0 ? 'disabled' : ''}>⭐ 批量收藏</button>
        <button class="ghost-btn small" id="batchUnstar" ${selectedIds.size === 0 ? 'disabled' : ''}>☆ 批量取消收藏</button>
      </div>
    ` : '';
    return header + `<div class="history-list">${rows}</div>` + floatBar;
  };

  showModal({
    title: '⏱ 历史任务',
    bodyHtml: render(),
    buttons: [{ label: '关闭', value: null }]
  });

  const body = $('modalBody');
  body.onclick = (e) => {
    // 全清空
    if (e.target.id === 'clearAllHistoryBtn') {
      state.history = [];
      saveHistory();
      body.innerHTML = render();
      toast('历史已清空', 'ok');
      return;
    }
    // F+18.1 ⭐ 仅看收藏 toggle
    if (e.target.id === 'toggleStarredOnly') {
      showOnlyStarred = !showOnlyStarred;
      body.innerHTML = render();
      applyHistoryFilter();
      return;
    }
    // F+18.1 选择模式 toggle
    if (e.target.id === 'toggleSelectMode') {
      selectMode = !selectMode;
      if (!selectMode) selectedIds.clear();
      body.innerHTML = render();
      applyHistoryFilter();
      return;
    }
    // F+18.1 批量管理 buttons
    if (e.target.id === 'batchSelectAll') {
      [...body.querySelectorAll('.history-row')].forEach(row => {
        if (row.style.display !== 'none') selectedIds.add(row.dataset.id);
      });
      body.innerHTML = render();
      applyHistoryFilter();
      return;
    }
    if (e.target.id === 'batchClearSelection') {
      selectedIds.clear();
      body.innerHTML = render();
      applyHistoryFilter();
      return;
    }
    if (e.target.id === 'batchDelete') {
      if (selectedIds.size === 0) return;
      if (!window.confirm(`确定删除选中的 ${selectedIds.size} 条历史任务？此操作不可撤销。`)) return;
      state.history = state.history.filter(h => !selectedIds.has(h.id));
      selectedIds.clear();
      saveHistory();
      body.innerHTML = render();
      applyHistoryFilter();
      toast('批量删除完成', 'ok');
      return;
    }
    if (e.target.id === 'batchMoveToActive') {
      if (selectedIds.size === 0 || !state.activeProjectId) return;
      let count = 0;
      state.history.forEach(h => {
        if (selectedIds.has(h.id)) { h.projectId = state.activeProjectId; count++; }
      });
      const proj = getProject(state.activeProjectId);
      selectedIds.clear();
      saveHistory();
      body.innerHTML = render();
      applyHistoryFilter();
      toast(`已把 ${count} 条加入项目「${proj?.name || ''}」`, 'ok');
      return;
    }
    if (e.target.id === 'batchRemoveProject') {
      if (selectedIds.size === 0) return;
      let count = 0;
      state.history.forEach(h => {
        if (selectedIds.has(h.id) && h.projectId) { delete h.projectId; count++; }
      });
      selectedIds.clear();
      saveHistory();
      body.innerHTML = render();
      applyHistoryFilter();
      toast(`已移出 ${count} 条`, 'ok');
      return;
    }
    if (e.target.id === 'batchStar' || e.target.id === 'batchUnstar') {
      if (selectedIds.size === 0) return;
      const want = e.target.id === 'batchStar';
      let count = 0;
      state.history.forEach(h => {
        if (selectedIds.has(h.id) && !!h.starred !== want) {
          h.starred = want;
          count++;
        }
      });
      saveHistory();
      body.innerHTML = render();
      applyHistoryFilter();
      toast(`${want ? '已收藏' : '已取消收藏'} ${count} 条`, 'ok');
      return;
    }
    // F+18.1 checkbox 切换（selectMode 时）
    const checkbox = e.target.closest('.history-select-checkbox');
    if (checkbox) {
      e.stopPropagation();
      if (checkbox.checked) selectedIds.add(checkbox.dataset.id);
      else selectedIds.delete(checkbox.dataset.id);
      // 不重渲染 list（避免 checkbox 视觉闪烁），只更新 floating bar 的 N 已选
      // 简化：直接重渲染让 bar count 准确
      body.innerHTML = render();
      applyHistoryFilter();
      return;
    }
    // F+18.1 ⭐ 收藏切换（单行）
    const starBtn = e.target.closest('.history-star-btn');
    if (starBtn) {
      e.stopPropagation();
      const h = state.history.find(x => x.id === starBtn.dataset.id);
      if (!h) return;
      h.starred = !h.starred;
      saveHistory();
      body.innerHTML = render();
      applyHistoryFilter();
      return;
    }
    // F+18.1 👁 加载到主区
    const loadMainBtn = e.target.closest('.history-load-main');
    if (loadMainBtn) {
      const h = state.history.find(x => x.id === loadMainBtn.dataset.id);
      if (!h) return;
      closeModal();
      showResultFromHistory(h);
      return;
    }
    // F+18.1 搜索 scope toggle
    const scopeBtn = e.target.closest('[data-scope]');
    if (scopeBtn) {
      const id = scopeBtn.dataset.scope;
      searchScopes[id] = !searchScopes[id];
      body.innerHTML = render();
      applyHistoryFilter();
      return;
    }
    // 删除单条
    const delBtn = e.target.closest('.history-delete');
    if (delBtn) {
      state.history = state.history.filter(h => h.id !== delBtn.dataset.id);
      saveHistory();
      expandedId = null;
      body.innerHTML = render();
      applyHistoryFilter();
      toast('已删除', 'ok');
      return;
    }
    // 直接重跑：用相同 sceneId + userText 启动
    // F+24「重跑陷阱」修复：重跑用的是【当前】场景配置 / 模型 / Agent 身份，
    // 不是当时跑这条任务时的配置（history 没存 per-Agent 模型，无法还原）。
    // 用户常误以为"重跑 = 一模一样再跑一遍" → 加 confirm 明示。
    const rerunBtn = e.target.closest('.history-rerun');
    if (rerunBtn) {
      const h = state.history.find(x => x.id === rerunBtn.dataset.id);
      if (!h) return;
      const isEn = (typeof MAT_I18N === 'object' && MAT_I18N.getLocale() === 'en');
      const warn = isEn
        ? `🔄 Re-run uses your CURRENT scene config / models / Agent identities — NOT the settings from when this task originally ran (history doesn't store per-Agent models).\n\nContinue?\n\n(To tweak the input first, use ✏️ Edit & re-run instead.)`
        : `🔄 直接重跑会用你【当前】的场景配置 / 模型 / Agent 身份 —— 不是当时跑这条任务时的设置（历史未保存每个 Agent 的模型，无法还原）。\n\n确定继续？\n\n（想先改输入，请改用 ✏️ 编辑后重跑）`;
      if (!window.confirm(warn)) return;
      closeModal();
      launchTask(h.sceneId, h.userText);
      return;
    }
    // F+18 ✏️ 编辑后重跑：填回主输入框 + 关弹层 + 滚到顶 focus 全选
    const editBtn = e.target.closest('.history-edit-rerun');
    if (editBtn) {
      const h = state.history.find(x => x.id === editBtn.dataset.id);
      if (!h) return;
      closeModal();
      // 切到欢迎页（如果当前在结果页 / 介绍页）
      try { if (typeof showWelcomeView === 'function') showWelcomeView(); } catch {}
      const inputEl = $('userInput');
      if (inputEl) {
        inputEl.value = h.userText;
        inputEl.focus();
        try { inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch {}
        // 全选方便用户立即输入新内容或追加
        setTimeout(() => {
          try { inputEl.setSelectionRange(0, inputEl.value.length); } catch {}
        }, 100);
        toast(`已填入历史输入，改完后点 🚀 启动（场景：${h.sceneName}）`, 'ok', 4000);
      } else {
        toast('找不到主输入框', 'warn');
      }
      return;
    }
    // F+18 📋 复制原始输入到剪贴板（row head 按钮，不展开 row）
    const copyBtn = e.target.closest('.history-copy-input');
    if (copyBtn) {
      e.stopPropagation();  // 阻止冒泡到 row 触发展开
      const h = state.history.find(x => x.id === copyBtn.dataset.id);
      if (!h) return;
      const text = h.userText || '';
      try {
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(text).then(
            () => toast(`已复制 · ${text.length} 字`, 'ok', 2000),
            () => toast('复制失败，请手动选中复制', 'warn')
          );
        } else {
          toast('当前浏览器不支持自动复制', 'warn');
        }
      } catch {
        toast('复制失败', 'warn');
      }
      return;
    }
    // F+18 📥 导出当前历史任务为 markdown
    const exportBtn = e.target.closest('.history-export-md');
    if (exportBtn) {
      const h = state.history.find(x => x.id === exportBtn.dataset.id);
      if (!h) return;
      exportHistoryAsMarkdown(h);
      return;
    }
    // F+18 scene chip 切换
    const sceneChip = e.target.closest('[data-scene-filter]');
    if (sceneChip) {
      sceneFilter = sceneChip.dataset.sceneFilter;
      body.innerHTML = render();
      applyHistoryFilter();
      return;
    }
    // F+18 time chip 切换
    const timeChip = e.target.closest('[data-time-filter]');
    if (timeChip) {
      timeFilter = timeChip.dataset.timeFilter;
      body.innerHTML = render();
      applyHistoryFilter();
      return;
    }
    // row 展开/收起 或 选择模式 toggle（最后兜底）
    const row = e.target.closest('.history-row');
    if (row) {
      const id = row.dataset.id;
      if (selectMode) {
        // F+18.1 选择模式：行 click 切换选中（checkbox 已 stopPropagation 走另一分支）
        if (selectedIds.has(id)) selectedIds.delete(id);
        else selectedIds.add(id);
        body.innerHTML = render();
        applyHistoryFilter();
      } else {
        expandedId = expandedId === id ? null : id;
        body.innerHTML = render();
        applyHistoryFilter();
      }
    }
  };
  // F+18.1 重写 applyHistoryFilter：直接 filter state.history（不再依赖 row.textContent）
  // 这样支持"搜结果 / 搜讨论"（row 不展开时 textContent 没有这些字段）+ 仅看收藏 + 用 Set 高效控制 row.display
  const applyHistoryFilter = () => {
    const q = (document.getElementById('historySearch')?.value || '').trim().toLowerCase();
    const pf = document.getElementById('historyProjectFilter')?.value || '';
    const now = Date.now();
    const TIME_LIMITS = { today: 86400000, '7d': 7 * 86400000, '30d': 30 * 86400000 };
    const timeLimit = TIME_LIMITS[timeFilter];

    const matchIds = new Set();
    state.history.forEach(h => {
      // 项目过滤
      if (pf && (h.projectId || '__none__') !== pf) return;
      // 场景过滤
      if (sceneFilter !== 'all' && h.sceneId !== sceneFilter) return;
      // 时间过滤
      if (timeLimit && (now - (h.ts || 0)) > timeLimit) return;
      // F+18.1 仅看收藏
      if (showOnlyStarred && !h.starred) return;
      // F+18.1 搜索（按 scope 决定搜哪些字段）
      if (q) {
        let hay = ` ${h.sceneName || ''} ${h.mode || ''}`.toLowerCase();
        if (searchScopes.input)      hay += ' ' + (h.userText || '').toLowerCase();
        if (searchScopes.result)     hay += ' ' + (h.result || '').toLowerCase();
        if (searchScopes.discussion) hay += ' ' + (h.history || []).map(m => m.content || '').join(' ').toLowerCase();
        if (!hay.includes(q)) return;
      }
      matchIds.add(h.id);
    });

    [...body.querySelectorAll('.history-row')].forEach(row => {
      row.style.display = matchIds.has(row.dataset.id) ? '' : 'none';
    });
  };
  body.oninput = (e) => { if (e.target.id === 'historySearch') applyHistoryFilter(); };
  body.onchange = (e) => { if (e.target.id === 'historyProjectFilter') applyHistoryFilter(); };
}

  // 向后兼容：双暴露
  window.fmtRelativeTime = fmtRelativeTime;
  window.exportHistoryAsMarkdown = exportHistoryAsMarkdown;
  window.showResultFromHistory = showResultFromHistory;
  window.openHistoryModal = openHistoryModal;

  return {
    fmtRelativeTime, exportHistoryAsMarkdown,
    showResultFromHistory, openHistoryModal,
  };
})();