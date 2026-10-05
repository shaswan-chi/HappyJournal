// IndexedDB 是当前浏览器、当前网站地址下的本地数据库。
// 每次操作使用独立事务，只有事务完成才报告保存成功。
window.journalStore = (() => {
  function openDatabase() {
    return new Promise((resolve, reject) => {
      let blocked = false;
      const request = indexedDB.open('HappyJournal', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('entries', { keyPath: 'id', autoIncrement: true });
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => {
        blocked = true;
        reject(new Error('数据库被其他页面占用，请关闭其他手帐页面后重试。'));
      };
      request.onsuccess = () => {
        if (blocked) { request.result.close(); return; }
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
    });
  }

  async function transaction(mode, action) {
    const db = await openDatabase();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('entries', mode);
        let result;
        tx.oncomplete = () => resolve(result);
        tx.onabort = () => reject(tx.error || new Error('数据库操作未完成。'));
        tx.onerror = () => { /* 等待 abort，确保没有把未提交的数据当作成功。 */ };
        const request = action(tx.objectStore('entries'));
        request.onsuccess = () => { result = request.result; };
      });
    } finally {
      db.close();
    }
  }

  return {
    async add(date, content) {
      const entry = { date, content, createdAt: new Date().toISOString() };
      const id = await transaction('readwrite', store => store.add(entry));
      return { ...entry, id };
    },
    async list() {
      const entries = await transaction('readonly', store => store.getAll());
      return entries.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
    }
  };
})();
