// 仅保存在当前页面的内存中，刷新后重新变成空数组。
window.journalStore = (() => {
  const entries = [];
  let nextId = 1;
  return {
    add(date, content) { entries.push({ id: nextId++, date, content }); },
    list() {
      return entries.map(entry => ({ ...entry })).sort((a, b) =>
        b.date.localeCompare(a.date) || b.id - a.id
      );
    }
  };
})();
