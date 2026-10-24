(() => {
const W = 960, H = 540;
const KEY = 'prezintazii.v1';
const $ = s => document.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 10);

let state = load() || fresh();
let cur = 0;          // current slide index
let sel = null;       // selected element id

function fresh() {
  return { title: 'Новая презентация', slides: [newSlide(true)] };
}
function newSlide(withTitle) {
  const s = { id: uid(), bg: '#ffffff', els: [] };
  if (withTitle) {
    s.els.push(mkText('Заголовок презентации', 80, 180, 800, 90, 54, true, 'center'));
    s.els.push(mkText('Подзаголовок', 80, 290, 800, 50, 28, false, 'center'));
  }
  return s;
}
function mkText(text, x, y, w, h, size, bold, align) {
  return { id: uid(), type: 'text', x, y, w, h, text, size, bold: !!bold, italic: false, underline: false, align: align || 'left', color: '#222222' };
}
function load() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.slides && d.slides.length) return d; } catch (e) {}
  return null;
}
let saveT;
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { alert('Не удалось сохранить в браузере (слишком много картинок?). Используйте кнопку «Сохранить» для файла.'); }
  }, 200);
}

const slide = () => state.slides[cur];
const selEl = () => slide().els.find(e => e.id === sel);

/* ---------- rendering ---------- */
function buildEl(e, editable) {
  const d = document.createElement('div');
  d.className = 'el ' + e.type;
  d.dataset.id = e.id;
  d.style.cssText += `left:${e.x}px;top:${e.y}px;width:${e.w}px;height:${e.h}px;`;
  if (e.type === 'text') {
    d.textContent = e.text;
    d.style.fontSize = e.size + 'px';
    d.style.fontWeight = e.bold ? '700' : '400';
    d.style.fontStyle = e.italic ? 'italic' : 'normal';
    d.style.textDecoration = e.underline ? 'underline' : 'none';
    d.style.textAlign = e.align;
    d.style.color = e.color;
    d.style.whiteSpace = 'pre-wrap';
  } else if (e.type === 'image') {
    const img = document.createElement('img'); img.src = e.src; d.appendChild(img);
  } else {
    d.style.background = e.fill;
  }
  if (editable && e.id === sel) {
    d.classList.add('selected');
    const h = document.createElement('div'); h.className = 'handle'; d.appendChild(h);
  }
  return d;
}
function fillStage(stage, s, editable) {
  stage.innerHTML = '';
  stage.style.background = s.bg;
  s.els.forEach(e => stage.appendChild(buildEl(e, editable)));
}
function render() {
  const stage = $('#stage');
  stage.classList.add('editing');
  fillStage(stage, slide(), true);
  fit();
  renderThumbs();
  syncToolbar();
}
function renderThumbs() {
  const box = $('#thumbs');
  box.innerHTML = '';
  state.slides.forEach((s, i) => {
    const t = document.createElement('div');
    t.className = 'thumb' + (i === cur ? ' active' : '');
    t.innerHTML = `<span class="num">${i + 1}</span>`;
    const mini = document.createElement('div');
    mini.className = 'stage mini';
    mini.style.boxShadow = 'none';
    const k = (t.style.width ? parseFloat(t.style.width) : (innerWidth <= 700 ? 86 : 176)) / W;
    mini.style.transform = `scale(${k})`;
    mini.style.transformOrigin = '0 0';
    mini.style.position = 'absolute';
    fillStage(mini, s, false);
    t.appendChild(mini);
    t.onclick = () => { cur = i; sel = null; render(); };
    box.appendChild(t);
  });
}
function fit() {
  const wrap = $('#stageWrap'), stage = $('#stage');
  const k = Math.min((wrap.clientWidth - 40) / W, (wrap.clientHeight - 40) / H, 1.6);
  stage.style.transform = `scale(${k})`;
  stage.style.margin = `${(H * k - H) / 2}px ${(W * k - W) / 2}px`;
}
function syncToolbar() {
  $('#bgColor').value = slide().bg;
  const e = selEl();
  if (!e) return;
  if (e.type === 'text') { $('#fontSize').value = e.size; $('#textColor').value = e.color; }
  else if (e.fill) $('#fillColor').value = e.fill;
}
addEventListener('resize', () => { fit(); renderThumbs(); });

/* ---------- mouse interaction ---------- */
const stageEl = $('#stage');
stageEl.addEventListener('mousedown', ev => {
  if (ev.target.isContentEditable) return;
  const node = ev.target.closest('.el');
  if (!node) { sel = null; render(); return; }
  const e = slide().els.find(x => x.id === node.dataset.id);
  if (sel !== e.id) { sel = e.id; render(); }
  const k = stageEl.getBoundingClientRect().width / W;
  const resizing = ev.target.classList.contains('handle');
  const sx = ev.clientX, sy = ev.clientY, ox = e.x, oy = e.y, ow = e.w, oh = e.h;
  const cn = () => stageEl.querySelector(`[data-id="${e.id}"]`);
  const move = m => {
    const dx = (m.clientX - sx) / k, dy = (m.clientY - sy) / k;
    if (resizing) { e.w = Math.max(30, Math.round(ow + dx)); e.h = Math.max(20, Math.round(oh + dy)); }
    else { e.x = Math.round(ox + dx); e.y = Math.round(oy + dy); }
    const n = cn();
    n.style.left = e.x + 'px'; n.style.top = e.y + 'px'; n.style.width = e.w + 'px'; n.style.height = e.h + 'px';
  };
  const up = () => { removeEventListener('mousemove', move); removeEventListener('mouseup', up); renderThumbs(); save(); };
  addEventListener('mousemove', move);
  addEventListener('mouseup', up);
  ev.preventDefault();
});
stageEl.addEventListener('dblclick', ev => {
  const node = ev.target.closest('.el.text');
  if (!node) return;
  node.contentEditable = 'true';
  node.focus();
  const r = document.createRange(); r.selectNodeContents(node);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  node.onblur = () => {
    const e = slide().els.find(x => x.id === node.dataset.id);
    if (e) e.text = node.innerText.replace(/\n$/, '');
    node.contentEditable = 'false';
    save(); render();
  };
});

/* ---------- element actions ---------- */
function addEl(e) { slide().els.push(e); sel = e.id; save(); render(); }
document.querySelectorAll('[data-add]').forEach(b => b.onclick = () => {
  const t = b.dataset.add;
  if (t === 'text') addEl(mkText('Текст', 100, 120, 400, 60, 32));
  else if (t === 'title') addEl(mkText('Заголовок', 60, 40, 840, 80, 48, true));
  else addEl({ id: uid(), type: t, x: 300, y: 180, w: 220, h: t === 'ellipse' ? 220 : 140, fill: $('#fillColor').value });
});

function addImage(src) {
  const img = new Image();
  img.onload = () => {
    let w = img.naturalWidth, h = img.naturalHeight;
    const k = Math.min(1, 500 / w, 380 / h);
    addEl({ id: uid(), type: 'image', x: 100, y: 80, w: Math.round(w * k), h: Math.round(h * k), src });
  };
  img.onerror = () => alert('Не удалось загрузить картинку');
  img.src = src;
}
$('#btnImage').onclick = () => $('#fileImage').click();
$('#fileImage').onchange = ev => {
  const f = ev.target.files[0]; ev.target.value = '';
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    // уменьшаем большие картинки, чтобы влезли в хранилище браузера
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, 1280 / im.naturalWidth, 1280 / im.naturalHeight);
      if (k === 1 && f.size < 400000) return addImage(r.result);
      const c = document.createElement('canvas');
      c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      addImage(c.toDataURL(f.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.85));
    };
    im.src = r.result;
  };
  r.readAsDataURL(f);
};
$('#btnImageUrl').onclick = () => { const u = prompt('Ссылка на картинку:'); if (u) addImage(u.trim()); };

function patch(fn) { const e = selEl(); if (!e) return; fn(e); save(); render(); }
document.querySelectorAll('[data-cmd]').forEach(b => b.onclick = () => patch(e => {
  const p = { bold: 'bold', italic: 'italic', underline: 'underline' }[b.dataset.cmd];
  if (e.type === 'text') e[p] = !e[p];
}));
document.querySelectorAll('[data-align]').forEach(b => b.onclick = () => patch(e => { if (e.type === 'text') e.align = b.dataset.align; }));
$('#fontSize').oninput = ev => patch(e => { if (e.type === 'text') e.size = Math.max(8, +ev.target.value || 8); });
$('#textColor').oninput = ev => patch(e => { if (e.type === 'text') e.color = ev.target.value; });
$('#fillColor').oninput = ev => patch(e => { if (e.type === 'rect' || e.type === 'ellipse') e.fill = ev.target.value; });
$('#bgColor').oninput = ev => { slide().bg = ev.target.value; save(); render(); };
$('#btnFront').onclick = () => { const a = slide().els, i = a.findIndex(e => e.id === sel); if (i >= 0) { a.push(a.splice(i, 1)[0]); save(); render(); } };
$('#btnBack').onclick = () => { const a = slide().els, i = a.findIndex(e => e.id === sel); if (i >= 0) { a.unshift(a.splice(i, 1)[0]); save(); render(); } };
function delEl() { const a = slide().els, i = a.findIndex(e => e.id === sel); if (i >= 0) { a.splice(i, 1); sel = null; save(); render(); } }
$('#btnDelEl').onclick = delEl;

/* ---------- slides ---------- */
$('#btnAddSlide').onclick = () => { state.slides.splice(cur + 1, 0, newSlide(false)); cur++; sel = null; save(); render(); };
$('#btnDupSlide').onclick = () => {
  const c = JSON.parse(JSON.stringify(slide()));
  c.id = uid(); c.els.forEach(e => e.id = uid());
  state.slides.splice(cur + 1, 0, c); cur++; sel = null; save(); render();
};
$('#btnDelSlide').onclick = () => {
  if (state.slides.length === 1) { state.slides[0] = newSlide(false); }
  else { state.slides.splice(cur, 1); cur = Math.min(cur, state.slides.length - 1); }
  sel = null; save(); render();
};

/* ---------- file / title ---------- */
$('#title').value = state.title;
$('#title').oninput = ev => { state.title = ev.target.value; document.title = state.title || 'Презентации'; save(); };
$('#btnNew').onclick = () => {
  if (!confirm('Создать новую презентацию? Текущая будет удалена, если вы её не сохранили в файл.')) return;
  state = fresh(); cur = 0; sel = null; $('#title').value = state.title; save(); render();
};
$('#btnExport').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(state)], { type: 'application/json' }));
  a.download = (state.title || 'presentation') + '.json';
  a.click(); URL.revokeObjectURL(a.href);
};
$('#btnImport').onclick = () => $('#fileImport').click();
$('#fileImport').onchange = ev => {
  const f = ev.target.files[0]; ev.target.value = '';
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!d.slides || !d.slides.length) throw 0;
      state = d; cur = 0; sel = null; $('#title').value = state.title || ''; save(); render();
    } catch (e) { alert('Неверный файл презентации'); }
  };
  r.readAsText(f);
};
$('#btnPrint').onclick = () => {
  const pa = $('#printArea');
  pa.innerHTML = '';
  state.slides.forEach(s => { const st = document.createElement('div'); st.className = 'stage'; fillStage(st, s, false); pa.appendChild(st); });
  print();
};

/* ---------- presenter ---------- */
let pi = 0;
function showPres() {
  const ps = $('#presStage');
  fillStage(ps, state.slides[pi], false);
  const k = Math.min(innerWidth / W, innerHeight / H);
  ps.style.transform = `scale(${k})`;
}
$('#btnPresent').onclick = () => {
  pi = cur; $('#presenter').hidden = false; showPres();
  if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
};
function endPres() {
  $('#presenter').hidden = true;
  if (document.fullscreenElement) document.exitFullscreen();
}
$('#presenter').addEventListener('click', () => { if (pi < state.slides.length - 1) { pi++; showPres(); } else endPres(); });
addEventListener('resize', () => { if (!$('#presenter').hidden) showPres(); });

addEventListener('keydown', ev => {
  if (!$('#presenter').hidden) {
    if (ev.key === 'Escape') endPres();
    else if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(ev.key)) { if (pi < state.slides.length - 1) { pi++; showPres(); } }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(ev.key)) { if (pi > 0) { pi--; showPres(); } }
    return;
  }
  const t = ev.target;
  if (t.isContentEditable || /INPUT|TEXTAREA/.test(t.tagName)) return;
  if ((ev.key === 'Delete' || ev.key === 'Backspace') && sel) { delEl(); ev.preventDefault(); }
  const e = selEl();
  if (e && ev.key.startsWith('Arrow')) {
    const d = ev.shiftKey ? 10 : 1;
    if (ev.key === 'ArrowLeft') e.x -= d; if (ev.key === 'ArrowRight') e.x += d;
    if (ev.key === 'ArrowUp') e.y -= d; if (ev.key === 'ArrowDown') e.y += d;
    save(); render(); ev.preventDefault();
  }
});

document.title = state.title || 'Презентации';
render();
})();
