/* ============================================================
   MyAgentTeam · F+22.1 Sprint 4 模块化精细化
   src/ui/model_picker.js — 模型下拉 UI + 自定义 model 管理

   职责：
   - getModelGroups        6 vendor 列表 (single source of truth)
   - buildModelOptgroups   主下拉渲染（含 customModels 按 vendor 分组）
   - handleAddCustomModel  "✏️ 填自定义" 触发 prompt
   - openManageAllModelsModal  "🛠 管理 model 下拉" 弹窗
   - refreshDefaultModelSelect 设置面板 default model 重渲染

   依赖（全局）：
   - state / escapeHtml / inferVendor
   - saveCustomModels / saveModelFailures (MAT_STORAGE)
   - showModal / closeModal / toast / $ (app.js)
   - MAT_I18N (i18n 后续可注入)

   F+17 系列 16 次修改的就是这块 → 拆出来后未来动它不动 app.js
   ============================================================ */

window.MAT_MODEL_PICKER = (function() {
  'use strict';

function refreshDefaultModelSelect() {
  const sel = $('defaultModel');
  if (!sel) return;
  sel.innerHTML = buildModelOptgroups(state.config.model);
  sel.dataset.prevValue = state.config.model;
  updateModelDiscoveryStatus();
}

function updateModelDiscoveryStatus() {
  const el = $('modelDiscoveryStatus');
  if (!el) return;
  try {
    el.textContent = (window.MAT_MODEL_DISCOVERY && MAT_MODEL_DISCOVERY.statusText()) || '';
  } catch (e) {
    el.textContent = '模型列表状态读取失败';
  }
}

function getModelGroups() {
  // F+17.3：抽出 single source of truth，让 buildModelOptgroups + openManageAllModelsModal 共用
  return [
    { label: 'OpenAI',                                vendor: 'openai',    models: ['gpt-4o-mini', 'gpt-5-mini', 'gpt-4o', 'gpt-5', 'o3-mini', 'o3'] },
    { label: 'Anthropic',                             vendor: 'anthropic', models: ['claude-haiku-4-5', 'claude-sonnet-4-5', 'claude-opus-4-5', 'claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest'] },
    { label: '通义千问（阿里）',                       vendor: 'qwen',      models: ['qwen3-turbo', 'qwen3-plus', 'qwen3-max', 'qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen-long'] },
    { label: 'DeepSeek',                              vendor: 'deepseek',  models: ['deepseek-chat', 'deepseek-reasoner'] },
    { label: '豆包 Seed 2.0（火山引擎 · 也可填 ep-xxxxx）', vendor: 'doubao',    models: ['doubao-seed-2-0-lite-260428', 'doubao-seed-2-0-pro-260215'] },
    { label: 'Google Gemini',                         vendor: 'gemini',    models: ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash-lite', 'gemini-2.0-flash'] },
  ];
}

function buildModelOptgroups(selectedModel) {
  const groups = getModelGroups();

  // F+17：自动清理 30 天前的 failure 记录（model 可能已恢复）
  const THIRTY_DAYS = 30 * 24 * 3600 * 1000;
  const now = Date.now();
  const failures = state.modelFailures || (state.modelFailures = {});
  for (const m of Object.keys(failures)) {
    if (now - (failures[m].ts || 0) > THIRTY_DAYS) delete failures[m];
  }

  const hasKey = (vendor) => !!state.config[vendor + 'Key']?.trim();
  const fmtAgo = (ts) => {
    if (!ts) return '';
    const sec = Math.floor((now - ts) / 1000);
    if (sec < 60) return `${sec} 秒前`;
    if (sec < 3600) return `${Math.floor(sec / 60)} 分钟前`;
    if (sec < 86400) return `${Math.floor(sec / 3600)} 小时前`;
    return `${Math.floor(sec / 86400)} 天前`;
  };
  const esc = (s) => (typeof escapeHtml === 'function' ? escapeHtml(s) : String(s));

  // 用户自定义模型：最高优先级，始终保留
  const customModels = Array.isArray(state.customModels) ? state.customModels : (state.customModels = []);
  const customIds = new Set(customModels.map(c => c.id));
  if (selectedModel && !customIds.has(selectedModel)) {
    customModels.push({ id: selectedModel, vendor: (typeof inferVendor === 'function') ? inferVendor(selectedModel) : null, addedAt: Date.now() });
    customIds.add(selectedModel);
    try { saveCustomModels(); } catch {}
  }

  const knownVendors = new Set(groups.map(g => g.vendor));
  const customByVendor = {};
  const customUnknown = [];
  customModels.forEach(c => {
    if (c.vendor && knownVendors.has(c.vendor)) {
      if (!customByVendor[c.vendor]) customByVendor[c.vendor] = [];
      customByVendor[c.vendor].push(c);
    } else {
      customUnknown.push(c);
    }
  });

  // F+23：远程发现结果（厂商 /v1/models），按 vendor 分组
  const remoteByVendor = {};
  try {
    const remote = (window.MAT_MODEL_DISCOVERY && MAT_MODEL_DISCOVERY.getModels()) || [];
    remote.forEach(m => {
      if (!remoteByVendor[m.vendor]) remoteByVendor[m.vendor] = [];
      remoteByVendor[m.vendor].push(m);
    });
  } catch (e) {}

  const staticByVendor = {};
  groups.forEach(g => { staticByVendor[g.vendor] = g.models || []; });

  const hidden = state.hiddenModels || {};
  const purged = state.purgedModels || {};
  const NEW_MS = 90 * 24 * 3600 * 1000;

  const renderOption = (id, vendor, source, meta) => {
    if (!id || purged[id] || hidden[id]) return '';
    const isSelected = id === selectedModel;
    const fail = failures[id];
    const failMark = fail ? ' ⚠' : '';

    let sourceMark = '';
    let tooltip = '';
    if (source === 'custom') {
      sourceMark = '⭐ ';
      tooltip = '自定义 model（用户保留，不会被自动同步覆盖）';
    } else if (source === 'remote') {
      tooltip = '厂商实时列表';
      if (meta && meta.created && (now - meta.created) < NEW_MS) sourceMark = '🆕 ';
      if (meta && meta.lifecycle === 'deprecated') {
        sourceMark = '⚠ ';
        tooltip = '厂商标记为即将停用';
      }
      if (meta && meta.ctx) tooltip += ` · 上下文 ${meta.ctx}`;
      if (meta && meta.pricing) tooltip += ` · $${meta.pricing.in}/$${meta.pricing.out} per 1M`;
    } else {
      tooltip = '内置列表（未拉取到厂商实时列表时使用）';
    }
    if (meta && meta.vendor) tooltip += ` · ${meta.vendor}`;
    if (fail) tooltip = `上次失败：${fmtAgo(fail.ts)} · HTTP ${fail.status || '-'} · ${(fail.msg || '').slice(0, 100)}`;

    return `<option value="${esc(id)}"${isSelected ? ' selected' : ''} title="${esc(tooltip)}">${sourceMark}${esc(id)}${failMark}${fail ? ' · 上次失败' : ''}</option>`;
  };

  let unknownOptgroupHtml = '';
  if (customUnknown.length > 0) {
    const opts = customUnknown.map(c => renderOption(c.id, c.vendor || null, 'custom', null)).join('');
    if (opts) unknownOptgroupHtml = `<optgroup label="⭐ 未识别 vendor（${customUnknown.length}）—— 可在管理弹窗调整">${opts}</optgroup>`;
  }

  const groupsHtml = groups.map(g => {
    const keyOk = hasKey(g.vendor);
    const seen = new Set();
    const opts = [];

    (customByVendor[g.vendor] || []).forEach(c => {
      if (seen.has(c.id)) return;
      seen.add(c.id);
      const html = renderOption(c.id, g.vendor, 'custom', null);
      if (html) opts.push(html);
    });

    const remoteList = remoteByVendor[g.vendor] || [];
    remoteList.forEach(m => {
      if (seen.has(m.id)) return;
      seen.add(m.id);
      const html = renderOption(m.id, g.vendor, 'remote', m);
      if (html) opts.push(html);
    });

    // 仅当该厂商没有远程列表时才用静态模型兜底
    if (!remoteList.length) {
      (staticByVendor[g.vendor] || []).forEach(id => {
        if (seen.has(id)) return;
        seen.add(id);
        const html = renderOption(id, g.vendor, 'static', null);
        if (html) opts.push(html);
      });
    }

    const count = opts.length;
    const groupLabel = keyOk
      ? `✓ ${g.label}${count ? `（${count}）` : ''}`
      : `🔑 ${g.label} · 未配 Key${count ? `（${count}）` : ''}`;
    const addCustomOpt = `<option value="__add_custom__:${g.vendor}" title="点击弹窗输入任意 model ID（如新版本 / ep-xxxxx）">✏️ 填自定义 ${g.label.split('（')[0]} model ID...</option>`;
    return `<optgroup label="${esc(groupLabel)}">${opts.join('')}${addCustomOpt}</optgroup>`;
  }).join('');

  const manageOptgroup = `<optgroup label="—————————————"><option value="__manage_all_models__" title="弹窗：管理自定义 model">🛠 管理 model 下拉...</option></optgroup>`;

  return unknownOptgroupHtml + groupsHtml + manageOptgroup;
}

/**
 * F+17.1：处理 select 选中 "__add_custom__:vendor" 特殊值的回调
 * 弹 prompt 让用户输入任意 model ID，加入 state.customModels 持久化，并设置 select.value
 * @param {HTMLSelectElement} selectEl
 * @param {string} vendor - 触发来源的 vendor（用于元数据 + Key 校验）
 * @param {(newModelId: string) => void} [onPick] - 调用方的副作用（如更新 agent.model）
 */
function handleAddCustomModel(selectEl, vendor, onPick) {
  const placeholder = vendor === 'doubao'
    ? '如：doubao-seed-1-6-pro-250615 或 ep-xxxxxxxx'
    : '输入完整 model ID';
  const input = window.prompt(
    `输入自定义 model ID（${vendor}）：\n\n用途：厂商发了新版但 MyAgentTeam 还没更新列表 / 你的 Key 有特殊权限 model / Volcengine 自建 endpoint ep-xxxxxxxx`,
    placeholder
  );
  if (!input || !input.trim() || input.trim() === placeholder) {
    // 用户取消：回滚 select 到原值
    const prev = selectEl.dataset.prevValue || '';
    if (prev) selectEl.value = prev;
    return;
  }
  const id = input.trim();
  // 加入 customModels 持久化（去重）
  if (!Array.isArray(state.customModels)) state.customModels = [];
  if (!state.customModels.find(c => c.id === id)) {
    state.customModels.push({ id, vendor, addedAt: Date.now() });
    try { saveCustomModels(); } catch {}
  }
  // 应用 onPick 回调（让 agent.model 更新）
  if (typeof onPick === 'function') onPick(id);
  // 重渲染 select 让自定义 optgroup 出现 + 选中新 id
  selectEl.innerHTML = buildModelOptgroups(id);
  selectEl.value = id;
  selectEl.dataset.prevValue = id;
  toast(`✅ 已永久保存：${id}\n📍 下次打开任意 model 下拉，顶部"⭐ 已保存自定义"区直接选用，无需重填\n⚠️ 若在场景配置面板，还需点底部「保存」按钮让此 Agent 真正用该 model`, 'ok', 7000);
}

/**
 * F+17.3：统一管理 model 下拉（自定义删除 + hardcode 隐藏/恢复）
 * 替代旧版 openManageCustomModelsModal（只能删自定义）
 * @param {() => void} [onChange] - 列表变化时调用方的副作用（如重渲染 select）
 */
function openManageAllModelsModal(onChange) {
  if (!Array.isArray(state.customModels)) state.customModels = [];

  const render = () => {
    const customs = state.customModels;

    // ===== 区 1：自定义 model（永久删除）=====
    const customSection = customs.length === 0
      ? `<p style="color:var(--text-muted);font-size:12px;padding:8px">（无自定义 model）<br/>提示：模型下拉里每个 vendor optgroup 末尾 "✏️ 填自定义..." 可加入</p>`
      : customs.map(c => {
          const fail = state.modelFailures?.[c.id];
          const failBadge = fail ? ' <span style="color:#facc15;font-size:11px">⚠</span>' : '';
          const dateStr = c.addedAt ? new Date(c.addedAt).toLocaleDateString() : '?';
          return `
            <div style="display:flex;align-items:center;padding:8px 10px;border:1px solid var(--border);border-radius:5px;margin-bottom:4px;background:var(--card);font-size:12.5px">
              <div style="flex:1;min-width:0">
                <span style="font-family:monospace">${escapeHtml(c.id)}</span>${failBadge}
                <span style="font-size:10.5px;color:var(--text-muted);margin-left:6px">${c.vendor ? '🏷 ' + escapeHtml(c.vendor) + ' · ' : ''}${dateStr}</span>
              </div>
              <button class="custom-model-delete" data-id="${escapeHtml(c.id)}" title="永久删除自定义 model" style="background:none;border:1px solid #ef4444;color:#ef4444;padding:3px 8px;border-radius:4px;font-size:11px;cursor:pointer;margin-left:8px">🗑 删除</button>
            </div>
          `;
        }).join('');

    // F+17.11：完全移除"已删除"区（hidden 概念废弃，所有 model 都是用户管的 customModels）
    // F+17.15：加"全部清空"按钮兜底
    const clearAllBtn = customs.length > 0
      ? `<button id="clearAllCustomBtn" style="background:none;border:1px solid #991b1b;color:#991b1b;padding:6px 12px;border-radius:4px;font-size:12px;cursor:pointer;margin-top:12px">🗑 全部清空（${customs.length} 项）</button>`
      : '';
    return `
      <p style="color:var(--text-muted);font-size:12.5px;margin-bottom:14px">
        管理你手动添加/保留的 model。厂商最新模型由「刷新模型列表」自动同步，不在这里维护；删除自定义项不会删除厂商列表里的同 ID 模型。
      </p>

      <h4 style="margin:0 0 8px;font-size:13px">📝 你的 model</h4>
      <div>${customSection}</div>

      ${clearAllBtn}
    `;
  };

  const title = () => `🛠 管理 model 下拉`;

  showModal({
    title: title(),
    bodyHtml: render(),
    buttons: [{ label: '关闭', value: null }]
  });

  const body = $('modalBody');
  // F+17.14：直接绑定 onclick + stopPropagation（不用 delegation）
  // F+17.15：bindHandlers 也绑"全部清空"按钮
  const bindHandlers = () => {
    body.querySelectorAll('.custom-model-delete').forEach(btn => {
      btn.onclick = (ev) => {
        ev.stopPropagation();
        const id = btn.dataset.id;
        if (!id) return;
        state.customModels = (state.customModels || []).filter(c => c.id !== id);
        if (state.modelFailures && state.modelFailures[id]) {
          delete state.modelFailures[id];
          try { saveModelFailures(); } catch {}
        }
        try { saveCustomModels(); } catch {}
        body.innerHTML = render();
        bindHandlers();
        toast(`已删除：${id}`, 'ok', 2000);
        if (typeof onChange === 'function') onChange();
      };
    });
    const clearBtn = body.querySelector('#clearAllCustomBtn');
    if (clearBtn) {
      clearBtn.onclick = (ev) => {
        ev.stopPropagation();
        const n = (state.customModels || []).length;
        if (!window.confirm(`真的清空所有 ${n} 个自定义 model？\n\n此操作不可撤销。`)) return;
        // 同时清理这些 model 的失败记录
        (state.customModels || []).forEach(c => {
          if (state.modelFailures && state.modelFailures[c.id]) delete state.modelFailures[c.id];
        });
        state.customModels = [];
        try { saveCustomModels(); } catch {}
        try { saveModelFailures(); } catch {}
        body.innerHTML = render();
        bindHandlers();
        toast(`已清空 ${n} 项自定义 model`, 'ok', 2500);
        if (typeof onChange === 'function') onChange();
      };
    }
  };
  bindHandlers();
  body.onclick = null;  // 清掉残留 delegation
}

  // 向后兼容：双暴露（app.js 内 onchange handlers 直接调用全局函数名）
  window.getModelGroups = getModelGroups;
  window.buildModelOptgroups = buildModelOptgroups;
  window.handleAddCustomModel = handleAddCustomModel;
  window.openManageAllModelsModal = openManageAllModelsModal;
  window.refreshDefaultModelSelect = refreshDefaultModelSelect;
  window.updateModelDiscoveryStatus = updateModelDiscoveryStatus;

  return {
    getModelGroups, buildModelOptgroups, handleAddCustomModel,
    openManageAllModelsModal, refreshDefaultModelSelect, updateModelDiscoveryStatus,
  };
})();