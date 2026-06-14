/* ============================================================
   MyAgentTeam · F+13 Sprint 1.5 / Phase D
   src/persist/indexeddb.js — IndexedDB 轻量封装

   职责：KB chunks 存储 + 历史任务归档 + migrateBigDataToIDB
   依赖：window.MAT_CONSTANTS (HISTORY_KEY, MEMORY_KEY)
   ============================================================ */

window.MAT_IDB = (function() {
  "use strict";
  const { HISTORY_KEY, MEMORY_KEY } = MAT_CONSTANTS;

  const IDB_NAME = 'myAgentTeamDB';
  const IDB_VERSION = 1;
  const IDB_STORE_KB = 'kb';            // 知识库 chunks
  const IDB_STORE_HISTORY = 'history';  // 历史任务（超出 50 条后的归档）
  
  let _idbPromise = null;
  function openIDB() {
    if (_idbPromise) return _idbPromise;
    _idbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) { reject(new Error('IndexedDB 不支持')); return; }
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE_KB)) db.createObjectStore(IDB_STORE_KB, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(IDB_STORE_HISTORY)) db.createObjectStore(IDB_STORE_HISTORY, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return _idbPromise;
  }
  
  async function idbPut(storeName, value) {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(value);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }
  async function idbGetAll(storeName) {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }
  async function idbDelete(storeName, id) {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }
  async function idbClear(storeName) {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }
  
  /**
   * 一次性迁移：检测旧 localStorage 里的 KB 文档 + 超额 history → 搬到 IDB
   * 触发条件：localStorage 用量 > 3MB，或显式调用
   */
  async function migrateBigDataToIDB({ force = false } = {}) {
    let totalSize = 0;
    for (const k in localStorage) totalSize += (localStorage[k] || '').length;
    const sizeMB = totalSize / (1024 * 1024);
    if (!force && sizeMB < 3) return { skipped: true, sizeMB };
  
    // KB 迁移
    try {
      const kbDocs = state.knowledgeBase?.documents || [];
      if (kbDocs.length) {
        for (const doc of kbDocs) await idbPut(IDB_STORE_KB, doc);
        // 元数据保留在 localStorage（仅 id/name/ts），chunks 留在 IDB
        state.knowledgeBase.documents = kbDocs.map(d => ({ id: d.id, name: d.name, ts: d.ts, chunkCount: d.chunks?.length || 0 }));
        saveKnowledgeBase();
      }
    } catch (e) { console.warn('KB IDB migrate failed', e); }
  
    // History 溢出迁移：history 仍主要在 localStorage，但超过 100 条的旧条目搬到 IDB
    try {
      if (state.history.length > 100) {
        const overflow = state.history.slice(0, state.history.length - 100);
        for (const h of overflow) await idbPut(IDB_STORE_HISTORY, h);
        state.history = state.history.slice(-100);
        saveHistory();
      }
    } catch (e) { console.warn('History IDB migrate failed', e); }
  
    return { skipped: false, sizeMB };
  }
  
  /** 读取 KB 文档的完整 chunks（按需）—— 召回时用 */
  async function loadKBDocChunks(docId) {
    try {
      const docs = await idbGetAll(IDB_STORE_KB);
      return docs.find(d => d.id === docId)?.chunks || [];
    } catch { return []; }
  }

  return {
    IDB_NAME, IDB_VERSION, IDB_STORE_KB, IDB_STORE_HISTORY,
    openIDB, idbPut, idbGetAll, idbDelete, idbClear,
    migrateBigDataToIDB, loadKBDocChunks,
  };
})();
