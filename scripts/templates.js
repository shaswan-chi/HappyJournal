// 模板定义、数据校验和展示共用一份规则，避免表单与数据库字段不一致。
window.journalTemplates = (() => {
  const definitions = {
    free: { name: '自由记录', fields: [] },
    daily: { name: '日常记录', fields: [
      ['happened', '今天发生了什么'], ['happy', '今天最开心的事情'],
      ['grateful', '今天值得感谢的事情'], ['learned', '今天学到了什么'], ['tomorrow', '明天想做什么']
    ] },
    reflection: { name: '反思记录', fields: [
      ['concern', '今天困扰我的事情'], ['emotion', '我当时的情绪'], ['happened', '事情发生了什么'],
      ['canControl', '我能控制什么'], ['cannotControl', '我不能控制什么'],
      ['nextTime', '如果再遇到一次，我想怎么做'], ['futureSelf', '给未来自己的话']
    ] },
    timeline: { name: '时间记录', fields: [] }
  };
  const typeOf = value => Object.hasOwn(definitions, value) ? value : 'free';
  const text = value => typeof value === 'string' ? value : '';
  function normalizeData(type, data) {
    const source = data && typeof data === 'object' ? data : {};
    if (type === 'timeline') return { rows: Array.isArray(source.rows) ? source.rows.map(row => ({ time: text(row?.time), event: text(row?.event) })) : [] };
    return Object.fromEntries(definitions[typeOf(type)].fields.map(([key]) => [key, text(source[key])]));
  }
  function normalize(entry) {
    const templateType = typeOf(entry.templateType);
    return { templateType, templateData: normalizeData(templateType, entry.templateData) };
  }
  const ordered = rows => [...rows].sort((a, b) => a.time.localeCompare(b.time));
  function prepare(entry) {
    const { templateType, templateData } = normalize(entry);
    let content;
    if (templateType === 'free') {
      content = text(entry.content).trim();
      if (!content) throw new Error('请写一点内容，不能只输入空格。');
    } else if (templateType === 'timeline') {
      const rows = templateData.rows.map(row => ({ time: row.time.trim(), event: row.event.trim() })).filter(row => row.time || row.event);
      if (!rows.length) throw new Error('请至少填写一行时间和事件。');
      if (rows.some(row => !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.time) || !row.event)) throw new Error('每条时间记录都需要有效时间和事件；空白行可留空或删除。');
      templateData.rows = ordered(rows);
      content = templateData.rows.map(row => `${row.time} ${row.event}`).join('\n');
    } else {
      Object.keys(templateData).forEach(key => { templateData[key] = templateData[key].trim(); });
      const filled = definitions[templateType].fields.filter(([key]) => templateData[key]);
      if (!filled.length) throw new Error('请至少填写一个模板内容项，不能只输入空格。');
      content = filled.map(([key, label]) => `${label}：${templateData[key]}`).join('\n');
    }
    return { templateType, templateData, content };
  }
  function renderDetail(container, entry) {
    container.replaceChildren();
    const { templateType, templateData } = normalize(entry);
    container.hidden = templateType === 'free';
    if (templateType === 'timeline') {
      const list = document.createElement('ol'); list.className = 'timeline-list';
      ordered(templateData.rows).forEach(row => {
        const item = document.createElement('li'), time = document.createElement('time'), event = document.createElement('p');
        time.textContent = row.time; time.dateTime = row.time; event.textContent = row.event;
        item.append(time, event); list.append(item);
      });
      container.append(list);
    } else {
      definitions[templateType].fields.forEach(([key, label]) => {
        if (!templateData[key]) return;
        const section = document.createElement('section'), heading = document.createElement('h2'), body = document.createElement('p');
        section.className = 'template-section'; heading.textContent = label; body.textContent = templateData[key];
        section.append(heading, body); container.append(section);
      });
    }
  }
  function createEditor(onChange) {
    const host = document.querySelector('#template-fields'), free = document.querySelector('#free-content');
    const content = document.querySelector('#entry-content');
    const choices = [...document.querySelectorAll('input[name="templateType"]')];
    let type = 'free', drafts = {};
    function read() {
      if (type === 'free') return { content: content.value };
      if (type === 'timeline') return { rows: [...host.querySelectorAll('.time-row')].map(row => ({ time: row.querySelector('input').value, event: row.querySelector('textarea').value })) };
      return Object.fromEntries(definitions[type].fields.map(([key]) => [key, host.querySelector(`[data-field="${key}"]`).value]));
    }
    let rowSerial = 0;
    function addRow(parent, value = { time: '', event: '' }) {
      const row = document.createElement('div'); row.className = 'time-row';
      const number = ++rowSerial;
      const timeLabel = document.createElement('label'), eventLabel = document.createElement('label');
      const time = document.createElement('input'), event = document.createElement('textarea');
      time.type = 'time'; time.step = '60'; time.id = `time-${number}`; time.value = value.time;
      event.id = `event-${number}`; event.rows = 2; event.value = value.event;
      timeLabel.textContent = '时间'; timeLabel.htmlFor = time.id; eventLabel.textContent = '事件内容'; eventLabel.htmlFor = event.id;
      const timeBox = document.createElement('div'), eventBox = document.createElement('div');
      timeBox.append(timeLabel, time); eventBox.append(eventLabel, event);
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'secondary'; remove.textContent = '删除此行';
      remove.addEventListener('click', () => { row.remove(); onChange(); document.querySelector('#add-time-row').focus(); });
      row.append(timeBox, eventBox, remove); parent.append(row);
      return time;
    }
    function render() {
      host.replaceChildren(); host.hidden = type === 'free'; free.hidden = type !== 'free';
      content.required = type === 'free'; content.setCustomValidity('');
      choices.forEach(choice => { choice.checked = choice.value === type; });
      const hint = document.querySelector('#template-hint');
      hint.textContent = type === 'free' ? '自由书写。切换模板会暂存本次输入，保存时只保存当前所选模板。'
        : type === 'timeline' ? '至少填写一条完整的时间和事件；保存后按时间先后展示。同一时间按填写顺序排列。'
          : '内容项不必全部填写，至少写一项即可。切换模板会暂存本次输入，保存时只保存当前所选模板。';
      if (type === 'free') { content.value = drafts.free?.content || ''; return; }
      if (type === 'timeline') {
        const rows = document.createElement('div'); rows.id = 'time-rows';
        (drafts.timeline?.rows?.length ? drafts.timeline.rows : [{ time: '', event: '' }]).forEach(value => addRow(rows, value));
        const add = document.createElement('button'); add.id = 'add-time-row'; add.type = 'button'; add.className = 'secondary'; add.textContent = '＋ 新增时间记录行';
        add.addEventListener('click', () => { addRow(rows).focus(); onChange(); });
        host.append(rows, add); return;
      }
      definitions[type].fields.forEach(([key, label]) => {
        const caption = document.createElement('label'), field = document.createElement('textarea');
        field.id = `${type}-${key}`; field.dataset.field = key; field.rows = 3; field.value = drafts[type]?.[key] || '';
        caption.htmlFor = field.id; caption.textContent = label; host.append(caption, field);
      });
    }
    choices.forEach(choice => choice.addEventListener('change', () => {
      if (!choice.checked) return;
      drafts[type] = read(); type = choice.value; render(); onChange();
    }));
    host.addEventListener('input', onChange);
    return {
      reset(entry) {
        type = typeOf(entry?.templateType); rowSerial = 0;
        drafts = { free: { content: type === 'free' ? text(entry?.content) : '' } };
        if (type !== 'free') drafts[type] = normalizeData(type, entry.templateData);
        render();
      },
      collect() { return prepare({ templateType: type, templateData: read(), content: content.value }); },
      snapshot() { return { type, drafts: { ...drafts, [type]: read() } }; },
      focus() { (type === 'free' ? content : host.querySelector('input, textarea, button'))?.focus(); }
    };
  }
  return { definitions, normalize, prepare, renderDetail, createEditor };
})();
