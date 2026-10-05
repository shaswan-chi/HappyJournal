// 图片字节作为 Blob 存入 IndexedDB；对象 URL 仅用于当前界面预览。
window.journalImages = (() => {
  const MAX_FILE = 5 * 1024 * 1024;
  const groups = new Map();
  function clear(group) {
    (groups.get(group) || []).forEach(url => URL.revokeObjectURL(url));
    groups.delete(group);
  }
  function picture(item, group, thumbnail = false) {
    const image = document.createElement('img');
    image.alt = item.name || '日记图片';
    image.loading = 'lazy'; image.decoding = 'async';
    const blob = thumbnail ? item.thumbnail : item.blob;
    if (!(blob instanceof Blob)) { image.alt = '图片无法显示'; return image; }
    const url = URL.createObjectURL(blob);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(url);
    image.src = url;
    image.onerror = () => { image.alt = '图片无法显示，可编辑移除此图片'; };
    return image;
  }
  async function validate(file) {
    if (file.size > MAX_FILE) throw new Error('超过 5MB，请选择较小的图片');
    if (!file.size) throw new Error('文件为空');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const text = (offset, length) => String.fromCharCode(...bytes.subarray(offset, offset + length));
    const view = new DataView(bytes.buffer);
    if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return;
    if (bytes[0] === 137 && text(1, 3) === 'PNG' && bytes[4] === 13 && bytes[5] === 10) {
      for (let at = 8; at + 12 <= bytes.length;) {
        const size = view.getUint32(at);
        if (text(at + 4, 4) === 'acTL') throw new Error('暂不支持动图');
        if (at + size + 12 > bytes.length) throw new Error('图片文件不完整');
        at += size + 12;
      }
      return;
    }
    if (text(0, 4) === 'RIFF' && text(8, 4) === 'WEBP') {
      for (let at = 12; at + 8 <= bytes.length;) {
        const type = text(at, 4), size = view.getUint32(at + 4, true);
        if (type === 'ANIM' || type === 'ANMF' || (type === 'VP8X' && (bytes[at + 8] & 2))) throw new Error('暂不支持动图');
        if (at + size + 8 > bytes.length) throw new Error('图片文件不完整');
        at += size + 8 + (size % 2);
      }
      return;
    }
    throw new Error('只支持静态 JPG、JPEG、PNG、WEBP 图片');
  }
  async function prepare(file) {
    await validate(file);
    const sourceURL = URL.createObjectURL(file);
    const source = new Image();
    source.src = sourceURL;
    let canvas;
    try {
      try { await source.decode(); } catch { throw new Error('图片读取失败，文件可能已损坏'); }
      if (!source.naturalWidth || source.naturalWidth * source.naturalHeight > 40000000) throw new Error('图片像素过大，请先缩小图片');
      const scale = Math.min(1, 1600 / Math.max(source.naturalWidth, source.naturalHeight));
      canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(source.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
      const width = canvas.width, height = canvas.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('浏览器暂时无法处理图片');
      context.drawImage(source, 0, 0, width, height);
      const encode = () => new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('图片处理失败')), 'image/webp', .82));
      const blob = await encode();
      if (blob.size > 2 * 1024 * 1024) throw new Error('压缩后仍超过 2MB，请选择较小的图片');
      const thumbScale = Math.min(1, 400 / Math.max(width, height));
      canvas.width = Math.max(1, Math.round(width * thumbScale));
      canvas.height = Math.max(1, Math.round(height * thumbScale));
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      const thumbnail = await encode();
      if (thumbnail.size > 512 * 1024) throw new Error('缩略图过大，请选择较小的图片');
      return { id: crypto.randomUUID(), name: file.name, blob, thumbnail, width, height };
    } finally {
      URL.revokeObjectURL(sourceURL); source.src = '';
      if (canvas) { canvas.width = 0; canvas.height = 0; }
    }
  }
  window.addEventListener('pagehide', event => { if (!event.persisted) Array.from(groups.keys()).forEach(clear); });
  return { prepare, picture, clear };
})();
