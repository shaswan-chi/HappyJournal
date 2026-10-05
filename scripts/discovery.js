// 搜索与筛选只处理已读入内存的记录，不访问 IndexedDB。
window.journalDiscovery = (() => {
  const index = new WeakMap();
  function normalizeTags(tags) {
    return [...new Set((Array.isArray(tags) ? tags : []).filter(tag => typeof tag === 'string').map(tag => tag.trim()).filter(Boolean))];
  }
  function validateTags(tags) {
    const values = normalizeTags(tags);
    if (values.length > 5) throw new Error('每条记录最多 5 个标签，请删减后再保存。');
    if (values.some(tag => Array.from(tag).length > 12)) throw new Error('每个标签最多 12 个字符，请缩短后再保存。');
    return values;
  }
  const parseTags = input => validateTags(input.split(/[,，、\n]+/));
  function strings(value) {
    if (typeof value === 'string') return [value];
    if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
    return [];
  }
  function searchable(entry) {
    if (!index.has(entry)) index.set(entry, [entry.title || '', entry.content || '', ...strings(entry.templateData), ...normalizeTags(entry.tags)].join('\n').toLowerCase());
    return index.get(entry);
  }
  const localDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  function select(entries, filters, now = new Date()) {
    const query = (filters.query || '').trim().toLowerCase();
    let start = '', end = '';
    if (filters.range === '7' || filters.range === '30') {
      const from = new Date(now); from.setDate(from.getDate() - Number(filters.range) + 1);
      start = localDate(from); end = localDate(now);
    } else if (filters.range === 'year') {
      start = `${now.getFullYear()}-01-01`; end = `${now.getFullYear()}-12-31`;
    }
    const selected = entries.filter(entry => {
      const date = entry.date || '';
      return (!query || searchable(entry).includes(query))
        && (!filters.mood || entry.mood === filters.mood)
        && (!filters.template || entry.templateType === filters.template)
        && (!filters.tag || normalizeTags(entry.tags).includes(filters.tag))
        && (!start || (date >= start && date <= end));
    });
    const time = entry => Date.parse(entry.createdAt) || 0;
    const direction = filters.sort === 'oldest' ? 1 : -1;
    return selected.sort((a, b) => direction * (String(a.date || '').localeCompare(String(b.date || '')) || time(a) - time(b) || a.id - b.id));
  }
  return { normalizeTags, validateTags, parseTags, select };
})();
