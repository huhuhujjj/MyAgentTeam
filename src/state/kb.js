/* ============================================================
   MyAgentTeam · F+13 Sprint 1.5 / Phase D
   src/state/kb.js — 知识库（RAG）

   职责：文件上传 → chunkText 分块 → IDB 存储 + 任务启动时按关键词召回 top-3 chunks
   依赖：MAT_IDB (idbPut/idbGetAll/idbDelete) · MAT_CONSTANTS (KB_KEY) · state.knowledgeBase
   ============================================================ */

window.MAT_KB = (function() {
  "use strict";
  const { idbPut, idbGetAll, idbDelete } = MAT_IDB;
  const { KB_KEY } = MAT_CONSTANTS;

  const KB_MAX_FILE_BYTES = 500 * 1024;     // 单文件 500KB
  const KB_CHUNK_SIZE = 400;                 // 每块约 400 字
  const KB_RECALL_TOP_K = 3;                 // 召回 top 3
  
  function chunkText(text, size = KB_CHUNK_SIZE) {
    // 按段落优先切分，再按 size 切超长段
    const paragraphs = text.split(/\n\s*\n+/).map(p => p.trim()).filter(Boolean);
    const chunks = [];
    paragraphs.forEach(p => {
      if (p.length <= size) chunks.push(p);
      else {
        for (let i = 0; i < p.length; i += size) chunks.push(p.slice(i, i + size));
      }
    });
    return chunks;
  }
  
  function addKnowledgeBaseFile(file, onDone) {
    if (file.size > KB_MAX_FILE_BYTES) {
      toast(`文件过大（${(file.size / 1024).toFixed(0)} KB > 500 KB 上限）`, 'warn'); return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const chunks = chunkText(text).map(t => ({ text: t }));
      state.knowledgeBase.documents.push({
        id: 'kb_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4),
        name: file.name, ts: Date.now(),
        size: file.size,
        chunks,
      });
      saveKnowledgeBase();
      toast(`已加入知识库：${file.name}（${chunks.length} 块）`, 'ok');
      onDone?.();
    };
    reader.onerror = () => toast('读取失败', 'error');
    reader.readAsText(file);
  }
  
  function deleteKbDocument(id) {
    state.knowledgeBase.documents = state.knowledgeBase.documents.filter(d => d.id !== id);
    saveKnowledgeBase();
  }
  
  /**
   * 关键词匹配召回（V1 简化版，无 embedding）：
   * 把所有 chunks 按"与查询的关键词重叠数"打分，取 top K。
   */
  function recallKnowledgeBase(query, topK = KB_RECALL_TOP_K) {
    if (!state.memory.settings.enableKnowledgeBase) return [];
    const docs = state.knowledgeBase.documents || [];
    if (!docs.length) return [];
    const tokens = (s) => new Set(
      (s || '').toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/).filter(t => t.length >= 2)
    );
    const q = tokens(query);
    if (!q.size) return [];
    const scored = [];
    docs.forEach(d => {
      d.chunks.forEach(c => {
        const ct = tokens(c.text);
        let overlap = 0;
        for (const t of q) if (ct.has(t)) overlap++;
        if (overlap > 0) scored.push({ text: c.text, score: overlap, source: d.name });
      });
    });
    return scored.sort((a, b) => b.score - a.score).slice(0, topK);
  }
  
  /* ====================== 项目管理（#5）====================== */
  // F+11.1 createProject / deleteProject 已合并到 F+11 helper 区（L2120+），重名检查 + color + saveProjectMemory
  // 旧版函数已删除避免重复定义

  return {
    KB_MAX_FILE_BYTES, KB_CHUNK_SIZE, KB_RECALL_TOP_K,
    chunkText, addKnowledgeBaseFile, deleteKbDocument, recallKnowledgeBase,
  };
})();
