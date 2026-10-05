(() => {
  const $ = selector => document.querySelector(selector);
  const home = $('#memories-view'), editor = $('#entry-view'), detail = $('#detail-view');
  const form = $('#entry-form'), dateInput = $('#entry-date'), contentInput = $('#entry-content');
  const titleInput = $('#entry-heading'), moodInput = $('#entry-mood');
  const error = $('#content-error'), status = $('#save-status');
  const moods = { 开心: '😊 开心', 平静: '🌿 平静', 难过: '😔 难过', 焦虑: '😟 焦虑', 期待: '✨ 期待' };
  let entries = [], current = null, editingId = null, busy = false, initialForm = '';
  const snapshot = () => JSON.stringify([titleInput.value, moodInput.value, dateInput.value, contentInput.value]);
  const today = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  const timestamp = value => value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '旧记录未保存时间';
  function show(view) {
    [home, editor, detail].forEach(section => { section.hidden = section !== view; });
    status.textContent = '';
  }
  function lock(value) {
    busy = value;
    document.querySelectorAll('main button, main input, main textarea, main select').forEach(control => { control.disabled = value; });
    dateInput.disabled = value || editingId !== null;
  }
  function renderMemories() {
    entries.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || b.id - a.id);
    $('#memory-list').replaceChildren();
    $('#empty-state').hidden = entries.length > 0;
    $('#entry-count').textContent = `${entries.length} 篇`;
    entries.forEach(entry => {
      const card = document.createElement('button');
      card.type = 'button'; card.className = 'memory-card';
      card.setAttribute('aria-label', `查看记录：${entry.title}`);
      const title = document.createElement('span');
      title.className = 'card-title'; title.textContent = entry.title;
      const created = document.createElement('span');
      created.className = 'entry-meta'; created.textContent = `创建于 ${timestamp(entry.createdAt)}`;
      const mood = document.createElement('span');
      mood.className = 'entry-meta'; mood.textContent = moods[entry.mood];
      const content = document.createElement('span');
      content.className = 'memory-content card-summary';
      const characters = Array.from(entry.content);
      content.textContent = characters.slice(0, 100).join('') + (characters.length > 100 ? '…' : '');
      card.append(title, created, mood, content);
      card.addEventListener('click', () => openDetail(entry.id));
      $('#memory-list').append(card);
    });
  }
  async function loadEntries() {
    if (busy) return;
    lock(true);
    $('#home-error').textContent = '';
    $('#retry-load').hidden = true;
    $('#empty-state').hidden = true;
    status.textContent = '正在读取已保存的回忆…';
    try { entries = await window.journalStore.list(); renderMemories(); status.textContent = ''; }
    catch {
      status.textContent = '';
      $('#home-error').textContent = '读取记录失败，未改动已保存的数据。请检查浏览器本地存储权限后重新读取。';
      $('#retry-load').hidden = false;
    } finally { lock(false); }
  }
  function renderDetail(entry) {
    current = entry;
    $('#detail-title').textContent = entry.title;
    $('#detail-mood').textContent = moods[entry.mood];
    $('#detail-date').textContent = `记录日期：${entry.date || '未记录'}`;
    $('#detail-created').textContent = `创建于 ${timestamp(entry.createdAt)}`;
    $('#detail-updated').hidden = !entry.updatedAt;
    $('#detail-updated').textContent = entry.updatedAt ? `最后修改于 ${timestamp(entry.updatedAt)}` : '';
    $('#detail-content').textContent = entry.content;
    $('#detail-error').textContent = '';
    $('#delete-prompt').hidden = true;
    show(detail); $('#detail-title').focus();
  }
  async function openDetail(id) {
    if (busy) return;
    lock(true); $('#home-error').textContent = '';
    try { renderDetail(await window.journalStore.get(id)); }
    catch {
      $('#home-error').textContent = '读取详情失败，记录可能已在其他页面删除。请重新读取后重试。';
      $('#retry-load').hidden = false;
    } finally { lock(false); }
  }
  function openForm(entry = null) {
    editingId = entry ? entry.id : null;
    form.reset();
    titleInput.value = entry ? entry.title : '';
    moodInput.value = entry ? entry.mood : '平静';
    dateInput.value = entry ? entry.date : today();
    dateInput.disabled = !!entry;
    contentInput.value = entry ? entry.content : '';
    contentInput.setCustomValidity(''); error.textContent = '';
    $('#entry-title').textContent = entry ? '编辑回忆' : '写一篇回忆';
    form.querySelector('[type="submit"]').textContent = entry ? '保存修改' : '保存回忆';
    $('#date-hint').textContent = entry ? '编辑保留原来的记录日期和创建时间。' : '默认是今天，也可以选择想记录的那一天。';
    $('#discard-prompt').hidden = true;
    initialForm = snapshot(); show(editor); titleInput.focus();
  }
  $('#new-entry').addEventListener('click', () => { if (!busy) openForm(); });
  $('#first-entry').addEventListener('click', () => { if (!busy) openForm(); });
  $('#retry-load').addEventListener('click', loadEntries);
  $('#edit-entry').addEventListener('click', () => { if (!busy && current) openForm(current); });
  $('#back-home').addEventListener('click', () => {
    if (busy) return;
    editingId = null; show(home); $('#memories-title').focus(); loadEntries();
  });
  contentInput.addEventListener('input', () => { contentInput.setCustomValidity(''); error.textContent = ''; });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || editor.hidden) return;
    const content = contentInput.value.trim();
    if (!content) {
      error.textContent = '请写一点内容，不能只输入空格。';
      contentInput.setCustomValidity(error.textContent); contentInput.reportValidity(); return;
    }
    if (!form.reportValidity()) return;
    const changes = { title: titleInput.value, mood: moodInput.value, content };
    const isEdit = editingId !== null;
    lock(true); error.textContent = '';
    const save = form.querySelector('[type="submit"]'); save.textContent = '正在保存…';
    let saved;
    try {
      saved = isEdit ? await window.journalStore.update(editingId, changes)
        : await window.journalStore.add(dateInput.value, content, changes.title, changes.mood);
    } catch {
      error.textContent = `${isEdit ? '修改' : '保存'}失败，输入内容已保留。请检查本地存储权限、磁盘空间或记录是否仍存在，然后重试。`;
      return;
    } finally { lock(false); save.textContent = isEdit ? '保存修改' : '保存回忆'; }
    if (isEdit) entries = entries.map(entry => entry.id === saved.id ? saved : entry);
    else entries.push(saved);
    renderMemories(); form.reset(); editingId = null;
    if (isEdit) renderDetail(saved);
    else { show(home); $('#memories-title').focus(); }
    status.textContent = isEdit ? '修改已保存，原始创建时间保持不变。' : '已保存到当前浏览器。刷新或关闭后重新打开，记录仍会保留。';
  });
  function cancelForm() {
    if (busy) return;
    const wasEditing = editingId !== null;
    editingId = null; form.reset(); $('#discard-prompt').hidden = true;
    if (wasEditing) renderDetail(current);
    else { show(home); $('#new-entry').focus(); }
  }
  $('#cancel-entry').addEventListener('click', () => {
    if (busy) return;
    if (snapshot() !== initialForm) { $('#discard-prompt').hidden = false; $('#keep-writing').focus(); }
    else cancelForm();
  });
  $('#discard-entry').addEventListener('click', cancelForm);
  $('#keep-writing').addEventListener('click', () => { $('#discard-prompt').hidden = true; contentInput.focus(); });
  $('#delete-entry').addEventListener('click', () => {
    if (busy) return;
    $('#detail-error').textContent = ''; $('#delete-prompt').hidden = false; $('#cancel-delete').focus();
  });
  $('#cancel-delete').addEventListener('click', () => { $('#delete-prompt').hidden = true; $('#delete-entry').focus(); });
  $('#confirm-delete').addEventListener('click', async () => {
    if (busy || !current || $('#delete-prompt').hidden) return;
    const id = current.id;
    lock(true); $('#detail-error').textContent = '';
    $('#confirm-delete').textContent = '正在删除…';
    try { await window.journalStore.remove(id); }
    catch { $('#detail-error').textContent = '删除失败，未确认删除成功。请返回首页重新读取或稍后重试。'; return; }
    finally { lock(false); $('#confirm-delete').textContent = '确认删除'; }
    entries = entries.filter(entry => entry.id !== id); current = null; editingId = null;
    renderMemories(); show(home); $('#memories-title').focus(); status.textContent = '记录已删除。';
  });
  form.reset(); loadEntries();
})();
