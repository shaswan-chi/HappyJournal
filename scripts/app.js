(() => {
  const home = document.querySelector('#memories-view');
  const editor = document.querySelector('#entry-view');
  const form = document.querySelector('#entry-form');
  const dateInput = document.querySelector('#entry-date');
  const contentInput = document.querySelector('#entry-content');
  const error = document.querySelector('#content-error');
  const status = document.querySelector('#save-status');
  const discardPrompt = document.querySelector('#discard-prompt');
  let openingDate = '';
  let opener;
  let entries = [];
  let saving = false;
  const saveButton = form.querySelector('button[type="submit"]');

  function localToday() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  function renderMemories() {
    entries.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
    const list = document.querySelector('#memory-list');
    list.replaceChildren();
    document.querySelector('#empty-state').hidden = entries.length > 0;
    document.querySelector('#entry-count').textContent = `${entries.length} 篇`;
    entries.forEach(entry => {
      const card = document.createElement('article');
      card.className = 'memory-card';
      const heading = document.createElement('h3');
      const date = document.createElement('time');
      date.dateTime = entry.date;
      date.title = `创建于 ${new Date(entry.createdAt).toLocaleString('zh-CN')}`;
      const [year, month, day] = entry.date.split('-');
      date.textContent = `${year}年${Number(month)}月${Number(day)}日`;
      heading.append(date);
      const content = document.createElement('p');
      content.className = 'memory-content';
      // HTML 标签也只会作为文字展示，不会执行。
      content.textContent = entry.content;
      card.append(heading, content);
      list.append(card);
    });
  }

  function openEntry(event) {
    opener = event.currentTarget;
    form.reset();
    openingDate = localToday();
    dateInput.value = openingDate;
    contentInput.setCustomValidity('');
    error.textContent = '';
    status.textContent = '';
    discardPrompt.hidden = true;
    home.hidden = true;
    editor.hidden = false;
    dateInput.focus();
  }

  function showHome() { editor.hidden = true; home.hidden = false; }

  document.querySelector('#new-entry').addEventListener('click', openEntry);
  document.querySelector('#first-entry').addEventListener('click', openEntry);
  contentInput.addEventListener('input', () => {
    contentInput.setCustomValidity('');
    error.textContent = '';
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (editor.hidden || saving) return;
    const content = contentInput.value.trim();
    if (!content) {
      error.textContent = '请写一点内容，不能只输入空格。';
      contentInput.setCustomValidity(error.textContent);
      contentInput.reportValidity();
      return;
    }
    if (!form.reportValidity()) return;
    saving = true;
    error.textContent = '';
    const controls = Array.from(form.querySelectorAll('input, textarea, button'));
    controls.forEach(control => { control.disabled = true; });
    saveButton.textContent = '正在保存…';
    let entry;
    try {
      entry = await window.journalStore.add(dateInput.value, content);
    } catch (cause) {
      error.textContent = '保存失败，输入内容已保留。请检查浏览器是否允许本地存储、磁盘空间是否充足，然后重试。';
      return;
    } finally {
      saving = false;
      controls.forEach(control => { control.disabled = false; });
      saveButton.textContent = '保存回忆';
    }
    entries.push(entry);
    renderMemories();
    form.reset();
    showHome();
    document.querySelector('#memories-title').focus();
    status.textContent = '已保存到当前浏览器。刷新或关闭后重新打开，记录仍会保留。';
  });
  function discardEntry() {
    form.reset();
    discardPrompt.hidden = true;
    showHome();
    opener.focus();
  }
  document.querySelector('#cancel-entry').addEventListener('click', () => {
    const hasChanges = contentInput.value.length > 0 || dateInput.value !== openingDate;
    if (hasChanges) {
      discardPrompt.hidden = false;
      document.querySelector('#keep-writing').focus();
    } else discardEntry();
  });
  document.querySelector('#discard-entry').addEventListener('click', discardEntry);
  document.querySelector('#keep-writing').addEventListener('click', () => {
    discardPrompt.hidden = true;
    contentInput.focus();
  });
  form.reset();
  const entryButtons = [document.querySelector('#new-entry'), document.querySelector('#first-entry')];
  entryButtons.forEach(button => { button.disabled = true; });
  document.querySelector('#empty-state').hidden = true;
  status.textContent = '正在读取已保存的回忆…';
  window.journalStore.list().then(savedEntries => {
    entries = savedEntries;
    renderMemories();
    status.textContent = '';
    entryButtons.forEach(button => { button.disabled = false; });
  }).catch(() => {
    status.textContent = '读取记录失败，未改动已保存的数据。请检查浏览器本地存储权限，关闭其他手帐页面后刷新重试。';
  });
})();
