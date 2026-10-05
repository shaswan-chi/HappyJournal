// 保留原有数据库和 entries 表，不迁移、不清空旧记录。
window.journalStore = (() => {
  const moods = ['开心', '平静', '难过', '焦虑', '期待'];
  const normalize = entry => ({ ...entry,
    title: typeof entry.title === 'string' && entry.title.trim() ? entry.title.trim() : '今天的记录',
    mood: moods.includes(entry.mood) ? entry.mood : '平静',
    content: typeof entry.content === 'string' ? entry.content : '',
    images: Array.isArray(entry.images) ? entry.images : []
  });
  function openDatabase() {
    return new Promise((resolve, reject) => {
      let blocked = false;
      const request = indexedDB.open('HappyJournal', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('entries', { keyPath: 'id', autoIncrement: true });
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => { blocked = true; reject(new Error('数据库被占用，请关闭其他手帐页面后重试。')); };
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
        let result, failure;
        tx.oncomplete = () => resolve(result);
        tx.onabort = () => reject(failure || tx.error || new Error('数据库操作未完成。'));
        const fail = error => { failure = error; tx.abort(); };
        try { action(tx.objectStore('entries'), value => { result = value; }, fail); }
        catch (error) { fail(error); }
      });
    } finally { db.close(); }
  }
  const fields = ({ title = '', mood = '平静', content }) => {
    if (typeof content !== 'string' || !content.trim()) throw new Error('请填写正文。');
    return { title: String(title).trim() || '今天的记录', mood: moods.includes(mood) ? mood : '平静', content: content.trim() };
  };
  const imageFields = images => {
    if (!Array.isArray(images) || images.length > 3) throw new Error('每条日记最多保存 3 张图片。');
    if (images.some(image => !(image.blob instanceof Blob) || !(image.thumbnail instanceof Blob)
      || image.blob.size > 2 * 1024 * 1024 || image.thumbnail.size > 512 * 1024)) throw new Error('图片数据无效或过大。');
    return images;
  };
  // 首页只保留封面缩略图引用，详情和编辑时再读取完整图片。
  const summary = entry => ({ ...normalize(entry), images: normalize(entry).images.slice(0, 1).map(({ id, name, thumbnail }) => ({ id, name, thumbnail })) });
  return {
    summary,
    async add(date, content, title = '', mood = '平静', images = []) {
      const entry = { date, ...fields({ title, mood, content }), images: imageFields(images), createdAt: new Date().toISOString() };
      return transaction('readwrite', (store, done) => {
        const request = store.add(entry);
        request.onsuccess = () => done({ ...entry, id: request.result });
      });
    },
    async list() {
      return transaction('readonly', (store, done) => {
        const entries = [];
        const request = store.openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) { entries.push(summary(cursor.value)); cursor.continue(); }
          else done(entries.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || b.id - a.id));
        };
      });
    },
    async get(id) {
      return transaction('readonly', (store, done, fail) => {
        const request = store.get(id);
        request.onsuccess = () => request.result ? done(normalize(request.result)) : fail(new Error('记录已不存在，请返回首页刷新。'));
      });
    },
    async update(id, changes) {
      const values = fields(changes);
      if ('images' in changes) values.images = imageFields(changes.images);
      // 在同一个事务内先读取再更新，保留 id、日记日期和原始创建时间。
      return transaction('readwrite', (store, done, fail) => {
        const request = store.get(id);
        request.onsuccess = () => {
          if (!request.result) { fail(new Error('记录已不存在，请返回首页刷新。')); return; }
          const entry = { ...request.result, ...values, updatedAt: new Date().toISOString() };
          const write = store.put(entry);
          write.onsuccess = () => done(normalize(entry));
        };
      });
    },
    async remove(id) {
      return transaction('readwrite', (store, done, fail) => {
        const request = store.get(id);
        request.onsuccess = () => {
          if (!request.result) { fail(new Error('记录已不存在，请返回首页刷新。')); return; }
          const deletion = store.delete(id);
          deletion.onsuccess = () => done(id);
        };
      });
    }
  };
})();
