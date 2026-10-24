(() => {
const W = 960, H = 640;
const KEY = 'prezintazii.v2';
const OLD_KEY = 'prezintazii.v1';
const $ = s => document.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 10);

let lib = loadLib();   // { pres: [презентации] }
let state = null;      // открытая презентация
let cur = 0;           // текущий слайд
let sel = null;        // id выбранного элемента
let editingId = null;  // id текста, который сейчас печатается

/* ---------- данные ---------- */
function newSlide() { return { id: uid(), bg: '#ffffff', els: [] }; }
function fresh(title) { return { id: uid(), title: title || 'Без названия', slides: [newSlide()], updated: Date.now() }; }
function loadLib() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && Array.isArray(d.pres)) return d;
  } catch (e) {}
  try { // перенос презентации из первой версии
    const o = JSON.parse(localStorage.getItem(OLD_KEY));
    if (o && o.slides && o.slides.length) return { pres: [{ id: uid(), title: o.title || 'Без названия', slides: o.slides, updated: Date.now() }] };
  } catch (e) {}
  return { pres: [] };
}
let saveT;
function save() {
  if (state) state.updated = Date.now();
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(lib)); }
    catch (e) { toast('Не удалось сохранить: слишком много картинок'); }
  }, 200);
}
let toastT;
function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 3500); }

const slide = () => state.slides[cur];
const selEl = () => state && slide().els.find(e => e.id === sel);

/* ---------- отрисовка элементов ---------- */
const SHAPES = {
  line:   { w: 320, h: 40,  svg: '<line class="shp" x1="2" y1="50" x2="98" y2="50"/>' },
  arrow:  { w: 320, h: 90,  svg: '<line class="shp" x1="2" y1="50" x2="96" y2="50"/><polyline class="shp" points="68,18 98,50 68,82"/>' },
  square: { w: 220, h: 220, svg: '<rect class="shp" x="3" y="3" width="94" height="94"/>' },
  circle: { w: 220, h: 220, svg: '<ellipse class="shp" cx="50" cy="50" rx="47" ry="47"/>' },
  rect:   { w: 300, h: 170, svg: '<rect class="shp solid" x="0" y="0" width="100" height="100" rx="8" ry="14"/>' },
  dot:    { w: 60,  h: 60,  svg: '<ellipse class="shp solid" cx="50" cy="50" rx="50" ry="50"/>' },
};
function styleText(d, e) {
  d.style.fontSize = e.size + 'px';
  d.style.fontFamily = `"${e.font || 'Roboto'}", sans-serif`;
  d.style.fontWeight = e.bold ? '700' : '400';
  d.style.fontStyle = e.italic ? 'italic' : 'normal';
  d.style.textDecoration = e.underline ? 'underline' : 'none';
  d.style.textAlign = e.align || 'left';
  d.style.color = e.color;
}
function buildEl(e, editable) {
  const d = document.createElement('div');
  d.className = 'el ' + (e.type === 'shape' ? 'shapeel' : e.type);
  d.dataset.id = e.id;
  d.style.left = e.x + 'px'; d.style.top = e.y + 'px'; d.style.width = e.w + 'px';
  if (e.type === 'text') d.style.minHeight = e.h + 'px'; else d.style.height = e.h + 'px';
  if (e.rot) d.style.transform = `rotate(${e.rot}deg)`;
  if (e.type === 'text') {
    d.textContent = e.text;
    styleText(d, e);
  } else if (e.type === 'image') {
    const img = document.createElement('img'); img.src = e.src; d.appendChild(img);
  } else if (e.type === 'shape') {
    d.style.color = e.color;
    d.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="--sw:${e.sw || 8}px">${SHAPES[e.kind].svg}</svg>`;
    d.querySelectorAll('.shp').forEach(n => n.style.strokeWidth = (e.sw || 8) + 'px');
  } else {
    d.style.background = e.fill; // rect / ellipse из прошлых версий
  }
  if (editable && e.id === sel) {
    d.classList.add('selected');
    const h = document.createElement('div'); h.className = 'handle'; d.appendChild(h);
    const x = document.createElement('div'); x.className = 'del'; x.textContent = '✕'; d.appendChild(x);
  }
  return d;
}
function fillStage(stage, s, editable) {
  stage.innerHTML = '';
  stage.style.background = s.bg;
  s.els.forEach(e => stage.appendChild(buildEl(e, editable)));
}

/* ---------- экран редактора ---------- */
const stageEl = $('#stage');
function render() {
  fillStage(stageEl, slide(), true);
  fit();
  renderThumbs();
  syncUI();
}
function fit() {
  const wrap = $('#stageWrap');
  const k = Math.min((wrap.clientWidth - 16) / W, (wrap.clientHeight - 16) / H);
  if (!(k > 0)) return;
  $('#stageBox').style.width = W * k + 'px';
  $('#stageBox').style.height = H * k + 'px';
  stageEl.style.transform = `scale(${k})`;
}
new ResizeObserver(() => { if (state) fit(); }).observe($('#stageWrap'));
addEventListener('resize', () => { if (state) renderThumbs(); else renderHome(); });

function renderThumbs() {
  const box = $('#thumbs');
  box.innerHTML = '';
  state.slides.forEach((s, i) => {
    const t = document.createElement('div');
    t.className = 'thumb' + (i === cur ? ' active' : '');
    t.innerHTML = `<span class="num">${i + 1}</span>`;
    const mini = document.createElement('div');
    mini.className = 'stage mini';
    mini.style.transform = `scale(${90 / W})`;
    fillStage(mini, s, false);
    t.appendChild(mini);
    t.onclick = () => { blurEditing(); cur = i; sel = null; render(); };
    box.appendChild(t);
    if (i === cur) t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
}
function elColor(e) { return e.type === 'text' || e.type === 'shape' ? e.color : e.type === 'image' ? null : e.fill; }
function syncUI() {
  const e = selEl();
  $('#ctx').hidden = !e;
  $('#ctx').classList.toggle('no-text', !e || e.type !== 'text');
  $('#ctx').classList.toggle('no-shape', !e || e.type !== 'shape');
  $('#swatch').style.background = (e && elColor(e)) || slide().bg;
  if (!e) return;
  if (e.type === 'text') { $('#font').value = e.font || 'Roboto'; $('#fontSize').value = e.size; }
  if (e.type === 'shape') $('#sw').value = e.sw || 8;
  $('#rot').value = e.rot || 0;
}

/* ---------- перетаскивание, размер, правка текста ---------- */
function blurEditing() {
  const a = document.activeElement;
  if (a && a.isContentEditable) a.blur();
}
function startEdit(id, selectAll) {
  const n = stageEl.querySelector(`[data-id="${id}"]`);
  if (!n) return;
  editingId = id;
  n.querySelectorAll('.handle, .del').forEach(x => x.remove());
  n.contentEditable = 'true';
  n.classList.add('edit');
  n.focus();
  const r = document.createRange();
  r.selectNodeContents(n);
  if (!selectAll) r.collapse(false);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  n.onblur = () => {
    editingId = null;
    const e = state.slides[cur].els.find(x => x.id === id);
    if (e) {
      e.text = n.innerText.replace(/\n$/, '');
      if (!e.text.trim()) { slide().els = slide().els.filter(x => x !== e); sel = null; }
    }
    n.contentEditable = 'false';
    save(); render();
  };
}
stageEl.addEventListener('pointerdown', ev => {
  if (ev.target.isContentEditable) return;
  const hit = ev.target.closest('.el');
  if (ev.target.classList.contains('del')) { sel = hit.dataset.id; delEl(); ev.preventDefault(); return; }
  blurEditing();
  if (!hit) { if (sel) { sel = null; render(); } return; }
  const id = hit.dataset.id;
  const e = slide().els.find(x => x.id === id);
  const wasSel = sel === id;
  if (!wasSel) { sel = id; render(); }
  const resizing = ev.target.classList.contains('handle');
  const k = stageEl.getBoundingClientRect().width / W;
  const sx = ev.clientX, sy = ev.clientY, ox = e.x, oy = e.y, ow = e.w, oh = e.h;
  let moved = false;
  const node = () => stageEl.querySelector(`[data-id="${id}"]`);
  const move = m => {
    const dx = (m.clientX - sx) / k, dy = (m.clientY - sy) / k;
    if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
    if (!moved) return;
    const n = node();
    if (resizing) {
      e.w = Math.max(30, Math.round(ow + dx)); e.h = Math.max(20, Math.round(oh + dy));
      n.style.width = e.w + 'px';
      if (e.type === 'text') n.style.minHeight = e.h + 'px'; else n.style.height = e.h + 'px';
    } else {
      e.x = Math.round(ox + dx); e.y = Math.round(oy + dy);
      n.style.left = e.x + 'px'; n.style.top = e.y + 'px';
    }
  };
  const up = () => {
    removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
    if (moved) { renderThumbs(); save(); }
    else if (wasSel && !resizing && e.type === 'text') startEdit(id, false);
  };
  addEventListener('pointermove', move);
  addEventListener('pointerup', up);
  addEventListener('pointercancel', up);
  ev.preventDefault();
});

/* ---------- добавление ---------- */
function addEl(e) { blurEditing(); slide().els.push(e); sel = e.id; save(); render(); }
$('#btnText').onclick = () => {
  const e = { id: uid(), type: 'text', x: 200, y: 260, w: 560, h: 70, text: 'Текст', size: 44, font: 'Roboto', bold: false, italic: false, underline: false, align: 'left', color: '#000000' };
  addEl(e);
  startEdit(e.id, true); // открывается клавиатура
};
document.querySelectorAll('[data-shape]').forEach(b => b.onclick = () => {
  const kind = b.dataset.shape, s = SHAPES[kind];
  addEl({ id: uid(), type: 'shape', kind, x: Math.round((W - s.w) / 2), y: Math.round((H - s.h) / 2), w: s.w, h: s.h, color: $('#swatch').dataset.last || '#000000', sw: 8, rot: 0 });
});
function addImage(src) {
  const img = new Image();
  img.onload = () => {
    const k = Math.min(1, 640 / img.naturalWidth, 460 / img.naturalHeight);
    const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
    addEl({ id: uid(), type: 'image', x: Math.round((W - w) / 2), y: Math.round((H - h) / 2), w, h, src });
  };
  img.onerror = () => toast('Не удалось открыть картинку');
  img.src = src;
}
$('#fileImage').onchange = ev => { // input лежит прямо в кнопке: на телефоне открывает галерею
  blurEditing();
  const f = ev.target.files[0]; ev.target.value = '';
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    const im = new Image();
    im.onload = () => { // уменьшаем большие фото, чтобы хватило места в браузере
      const k = Math.min(1, 1280 / im.naturalWidth, 1280 / im.naturalHeight);
      if (k === 1 && f.size < 400000) return addImage(r.result);
      const c = document.createElement('canvas');
      c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      addImage(c.toDataURL(f.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.85));
    };
    im.onerror = () => toast('Не удалось открыть картинку');
    im.src = r.result;
  };
  r.readAsDataURL(f);
};

/* ---------- панель выбранного элемента ---------- */
function patch(fn) {
  const e = selEl(); if (!e) return;
  fn(e); save();
  const n = stageEl.querySelector(`[data-id="${e.id}"]`);
  if (n && n.isContentEditable) { styleText(n, e); renderThumbs(); } else render();
}
document.querySelectorAll('.ctx button').forEach(b => b.addEventListener('pointerdown', ev => ev.preventDefault())); // не терять фокус при печати
document.querySelectorAll('[data-fmt]').forEach(b => b.onclick = () => patch(e => { e[b.dataset.fmt] = !e[b.dataset.fmt]; }));
document.querySelectorAll('[data-align]').forEach(b => b.onclick = () => patch(e => { e.align = b.dataset.align; }));
$('#font').onchange = ev => patch(e => { e.font = ev.target.value; });
$('#fontSize').oninput = ev => { const v = +ev.target.value; if (v >= 8) patch(e => { e.size = Math.min(300, v); }); };
$('#szMinus').onclick = () => patch(e => { e.size = Math.max(8, e.size - 2); $('#fontSize').value = e.size; });
$('#szPlus').onclick = () => patch(e => { e.size = Math.min(300, e.size + 2); $('#fontSize').value = e.size; });
$('#sw').oninput = ev => patch(e => { e.sw = +ev.target.value; });
$('#rot').oninput = ev => patch(e => { e.rot = +ev.target.value; });
$('#btnFront').onclick = () => { const a = slide().els, i = a.findIndex(e => e.id === sel); if (i >= 0) { a.push(a.splice(i, 1)[0]); save(); render(); } };
$('#btnBack').onclick = () => { const a = slide().els, i = a.findIndex(e => e.id === sel); if (i >= 0) { a.unshift(a.splice(i, 1)[0]); save(); render(); } };
function delEl() { const a = slide().els, i = a.findIndex(e => e.id === sel); if (i >= 0) { a.splice(i, 1); sel = null; save(); render(); } }
$('#btnDelEl').onclick = delEl;

/* ---------- свернуть панель ---------- */
$('#btnCollapse').onclick = () => {
  const c = $('#panelArea').classList.toggle('collapsed');
  $('#btnCollapse').setAttribute('aria-label', c ? 'Показать панель' : 'Скрыть панель');
};

/* ---------- слайды ---------- */
$('#btnAddSlide').onclick = () => { blurEditing(); state.slides.splice(cur + 1, 0, newSlide()); cur++; sel = null; save(); render(); };
$('#btnDupSlide').onclick = () => {
  blurEditing();
  const c = JSON.parse(JSON.stringify(slide()));
  c.id = uid(); c.els.forEach(e => e.id = uid());
  state.slides.splice(cur + 1, 0, c); cur++; sel = null; save(); render();
};
$('#btnDelSlide').onclick = () => {
  blurEditing();
  if (state.slides.length === 1) state.slides[0] = newSlide();
  else { state.slides.splice(cur, 1); cur = Math.min(cur, state.slides.length - 1); }
  sel = null; save(); render();
};

/* ---------- выбор цвета ---------- */
const hsv = { h: 0, s: 1, v: 1 };
function hsv2hex({ h, s, v }) {
  const f = n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return '#' + [f(5), f(3), f(1)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}
function hex2hsv(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s: mx ? d / mx : 0, v: mx };
}
function targetColor() { const e = selEl(); return (e && elColor(e)) || slide().bg; }
function applyColor(hex) {
  const e = selEl();
  if (!e) slide().bg = hex;
  else if (e.type === 'text' || e.type === 'shape') e.color = hex;
  else if (e.type !== 'image') e.fill = hex;
  $('#swatch').dataset.last = hex;
  save();
  const n = e && stageEl.querySelector(`[data-id="${e.id}"]`);
  if (n && n.isContentEditable) styleText(n, e);
  else render();
}
function paintPicker() {
  const wheel = $('#wheel'), R = wheel.clientWidth / 2;
  $('#sv').style.setProperty('--h', `hsl(${hsv.h}, 100%, 50%)`);
  const a = (hsv.h - 90) * Math.PI / 180, rr = R * 0.835;
  const mh = $('#markH'); mh.style.left = R + Math.cos(a) * rr + 'px'; mh.style.top = R + Math.sin(a) * rr + 'px';
  mh.style.background = `hsl(${hsv.h}, 100%, 50%)`;
  const side = R * 2 * 0.46, lx = (hsv.s - 0.5) * side, ly = (0.5 - hsv.v) * side, c = Math.SQRT1_2;
  const ms = $('#markSV'); ms.style.left = R + (lx * c - ly * c) + 'px'; ms.style.top = R + (lx * c + ly * c) + 'px';
  const hex = hsv2hex(hsv);
  ms.style.background = hex;
  if (document.activeElement !== $('#hex')) $('#hex').value = hex;
}
function pick(ev) {
  const wheel = $('#wheel'), b = wheel.getBoundingClientRect(), R = b.width / 2;
  const dx = ev.clientX - b.left - R, dy = ev.clientY - b.top - R;
  if (drag === 'h') hsv.h = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
  else {
    const side = R * 2 * 0.46, c = Math.SQRT1_2;
    const lx = dx * c + dy * c, ly = -dx * c + dy * c;
    hsv.s = Math.max(0, Math.min(1, lx / side + 0.5));
    hsv.v = Math.max(0, Math.min(1, 0.5 - ly / side));
  }
  paintPicker(); applyColor(hsv2hex(hsv));
}
let drag = null;
$('#wheel').addEventListener('pointerdown', ev => {
  const b = $('#wheel').getBoundingClientRect(), R = b.width / 2;
  const d = Math.hypot(ev.clientX - b.left - R, ev.clientY - b.top - R) / R;
  drag = d > 0.62 ? 'h' : 'sv';
  pick(ev); ev.preventDefault();
  const mv = m => pick(m), up = () => { drag = null; removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
  addEventListener('pointermove', mv); addEventListener('pointerup', up);
});
$('#hex').oninput = ev => {
  let v = ev.target.value.trim(); if (v[0] !== '#') v = '#' + v;
  if (/^#[0-9a-f]{6}$/i.test(v)) { Object.assign(hsv, hex2hsv(v)); paintPicker(); applyColor(v.toLowerCase()); }
};
['#000000', '#ffffff', '#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa'].forEach(c => {
  const b = document.createElement('button'); b.style.background = c; b.setAttribute('aria-label', c);
  b.onclick = () => { Object.assign(hsv, hex2hsv(c)); paintPicker(); applyColor(c); };
  $('#presets').appendChild(b);
});
$('#btnColor').onclick = () => { // не трогаем выбор: красим выбранный элемент, а без выбора фон слайда
  blurEditing();
  Object.assign(hsv, hex2hsv(/^#[0-9a-f]{6}$/i.test(targetColor()) ? targetColor() : '#000000'));
  $('#colorModal').hidden = false;
  paintPicker();
};
$('#colorDone').onclick = () => { $('#colorModal').hidden = true; };
$('#btnColor').addEventListener('pointerdown', ev => { if (editingId) ev.preventDefault(); });

/* ---------- главная ---------- */
function showHome() {
  blurEditing();
  state = null; sel = null;
  document.title = 'Презентации';
  $('#editor').hidden = true; $('#home').hidden = false;
  renderHome();
}
function openPres(p) {
  state = p; cur = 0; sel = null;
  $('#home').hidden = true; $('#editor').hidden = false;
  document.title = p.title || 'Презентации';
  render();
}
function renderHome() {
  const grid = $('#grid');
  grid.innerHTML = '';
  if (!lib.pres.length) {
    grid.innerHTML = '<p class="empty">Пока нет презентаций. Нажмите «Создать презентацию +».</p>';
    return;
  }
  lib.pres.slice().sort((a, b) => b.updated - a.updated).forEach(p => {
    const card = document.createElement('div');
    card.className = 'card';
    const head = document.createElement('div');
    head.className = 'card-head';
    const name = document.createElement('div');
    name.className = 'card-name';
    name.textContent = p.title || 'Без названия';
    const lnk = document.createElement('button');
    lnk.className = 'card-link'; lnk.title = 'Скопировать ссылку'; lnk.setAttribute('aria-label', 'Скопировать ссылку на презентацию');
    lnk.textContent = '🔗';
    lnk.onclick = ev => { ev.stopPropagation(); copyLinkFor(p); };
    head.append(name, lnk);
    const prev = document.createElement('div');
    prev.className = 'card-prev';
    const tools = document.createElement('div');
    tools.className = 'card-tools';
    const ren = document.createElement('button');
    ren.textContent = '✎'; ren.title = 'Переименовать';
    ren.onclick = ev => { ev.stopPropagation(); askName(p.title, v => { p.title = v; save(); renderHome(); }); };
    const del = document.createElement('button');
    del.textContent = '×'; del.title = 'Удалить';
    del.onclick = ev => {
      ev.stopPropagation();
      if (del.classList.contains('armed')) { lib.pres = lib.pres.filter(x => x !== p); save(); renderHome(); return; }
      del.classList.add('armed'); del.textContent = 'Удалить?';
      setTimeout(() => { del.classList.remove('armed'); del.textContent = '×'; }, 3000);
    };
    tools.append(ren, del);
    card.append(head, prev, tools);
    card.onclick = () => openPres(p);
    grid.appendChild(card);
    const mini = document.createElement('div');
    mini.className = 'stage mini';
    mini.style.transform = `scale(${prev.clientWidth / W})`;
    fillStage(mini, p.slides[0], false);
    prev.appendChild(mini);
  });
}
let nameCb = null;
function askName(initial, cb) {
  nameCb = cb;
  $('#nameInput').value = initial || '';
  $('#nameModal').hidden = false;
  $('#nameInput').focus(); $('#nameInput').select();
}
function nameDone() {
  const v = $('#nameInput').value.trim() || 'Без названия';
  $('#nameModal').hidden = true;
  const cb = nameCb; nameCb = null;
  if (cb) cb(v);
}
$('#nameOk').onclick = nameDone;
$('#nameCancel').onclick = () => { $('#nameModal').hidden = true; nameCb = null; };
$('#nameInput').onkeydown = ev => { if (ev.key === 'Enter') nameDone(); };
$('#btnCreate').onclick = () => askName('', v => { const p = fresh(v); lib.pres.push(p); save(); openPres(p); });
$('#btnHome').onclick = () => { save(); showHome(); };

/* ---------- поделиться: презентация целиком внутри ссылки ---------- */
const toB64 = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const fromB64 = t => { t = t.replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '='; const s = atob(t), b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; };
async function pipe(bytes, stream) {
  const w = stream.writable.getWriter(); w.write(bytes); w.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}
function shrinkImage(src) { // для ссылки уменьшаем фото, иначе она будет огромной
  if (!src.startsWith('data:')) return Promise.resolve(src);
  return new Promise(res => {
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, 700 / im.naturalWidth, 700 / im.naturalHeight);
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k));
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
      res(c.toDataURL('image/jpeg', 0.6));
    };
    im.onerror = () => res(src);
    im.src = src;
  });
}
const MAX_LINK = 4000; // длиннее мессенджеры режут на части и телефон зависает
async function makeShareLink(p) {
  const slides = [];
  for (const s of p.slides) {
    const els = [];
    for (const e of s.els) { const c = { ...e }; delete c.id; if (c.type === 'image') c.src = await shrinkImage(c.src); els.push(c); }
    slides.push({ bg: s.bg, els });
  }
  const bytes = await pipe(new TextEncoder().encode(JSON.stringify({ t: p.title, s: slides })), new CompressionStream('deflate-raw'));
  return location.href.split('#')[0] + '#v1=' + toB64(bytes);
}
// всё, что пришло извне (ссылка, файл), приводим к безопасному виду
function cleanPres(title, slidesRaw) {
  if (!Array.isArray(slidesRaw) || !slidesRaw.length) throw 0;
  const num = (v, d) => { v = Number(v); return isFinite(v) ? v : d; };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const color = v => /^#[0-9a-f]{6}$/i.test(v) ? v : '#000000';
  const TYPES = ['text', 'image', 'shape', 'rect', 'ellipse'];
  return { id: uid(), title: String(title || 'Без названия').slice(0, 60), updated: Date.now(),
    slides: slidesRaw.slice(0, 200).map(s => ({
      id: uid(), bg: color((s && s.bg) || '#ffffff'),
      els: ((s && s.els) || []).slice(0, 500).filter(e => e && TYPES.includes(e.type)).map(e => {
        const c = { id: uid(), type: e.type, x: num(e.x, 0), y: num(e.y, 0), w: clamp(num(e.w, 100), 1, 5000), h: clamp(num(e.h, 50), 1, 5000), rot: clamp(num(e.rot, 0), -360, 360) };
        if (e.type === 'text') Object.assign(c, { text: String(e.text || '').slice(0, 5000), size: clamp(num(e.size, 32), 8, 300), font: String(e.font || 'Roboto').replace(/[^\wа-яА-ЯёЁ \-]/g, '').slice(0, 40) || 'Roboto', bold: !!e.bold, italic: !!e.italic, underline: !!e.underline, align: ['left', 'center', 'right'].includes(e.align) ? e.align : 'left', color: color(e.color) });
        else if (e.type === 'image') c.src = /^(data:image\/|https:\/\/)/.test(String(e.src)) ? String(e.src) : '';
        else if (e.type === 'shape') Object.assign(c, { kind: SHAPES[e.kind] ? e.kind : 'rect', color: color(e.color), sw: clamp(num(e.sw, 8), 1, 60) });
        else c.fill = color(e.fill);
        return c;
      })
    })) };
}
async function readShareLink(hash) {
  const bytes = await pipe(fromB64(hash.slice(4)), new DecompressionStream('deflate-raw'));
  const d = JSON.parse(new TextDecoder().decode(bytes));
  return cleanPres(d && d.t, d && d.s);
}
async function copyLinkFor(p) { // ссылка на презентацию: копируется одним нажатием на 🔗 у названия
  if (typeof CompressionStream === 'undefined') return toast('Этот браузер не умеет делать ссылки. Обновите Chrome.');
  toast('Готовим ссылку…');
  let link;
  try { link = await makeShareLink(p); } catch (e) { return toast('Не получилось сделать ссылку'); }
  if (link.length > MAX_LINK) return toast('Презентация слишком большая для ссылки (много фото). Ссылка не скопирована. Нажмите «Поделиться» внутри презентации и выберите «Отправить файлом».');
  try { await navigator.clipboard.writeText(link); toast('Ссылка скопирована. Её можно отправить: по ней презентацию можно только смотреть.'); }
  catch (e) { // если браузер не дал скопировать сам, показываем ссылку для ручного копирования
    $('#shareLink').value = link; $('#shareInfo').textContent = 'Выделите ссылку и скопируйте её.';
    $('#shareSend').hidden = !navigator.share; $('#shareModal').hidden = false;
    $('#shareLink').focus(); $('#shareLink').select();
  }
}
$('#btnShare').onclick = async () => {
  blurEditing();
  if (typeof CompressionStream === 'undefined') return toast('Этот браузер не умеет делать ссылки. Обновите Chrome.');
  const box = $('#shareLink');
  box.value = 'Готовим ссылку…'; $('#shareInfo').textContent = '';
  $('#shareSend').hidden = !navigator.share;
  $('#shareModal').hidden = false;
  try {
    const link = await makeShareLink(state);
    if (link.length > MAX_LINK) {
      box.value = ''; $('#shareCopy').hidden = true; $('#shareSend').hidden = true;
      $('#shareInfo').textContent = 'Презентация слишком большая для ссылки: ' + link.length + ' знаков, а можно до ' + MAX_LINK + '. Обычно мешают фото. Нажмите «Отправить файлом»: получатель откроет файл в приложении.';
    } else {
      box.value = link; $('#shareCopy').hidden = false; $('#shareSend').hidden = !navigator.share;
      $('#shareInfo').textContent = 'Ссылка готова. Нажмите «Копировать» и отправьте её.';
    }
  } catch (e) { box.value = ''; $('#shareInfo').textContent = 'Не получилось сделать ссылку.'; }
};
async function sendFile(p) { // презентация целиком (с фото в хорошем качестве) одним файлом
  const blob = new Blob([JSON.stringify({ app: 'prezintazii', v: 1, title: p.title, slides: p.slides })], { type: 'application/json' });
  const name = (p.title || 'presentation').replace(/[\\/:*?"<>|]+/g, '_') + '.json';
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: p.title }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Файл сохранён в «Загрузки». Отправьте его из файлового менеджера.');
}
$('#shareFile').onclick = () => sendFile(state);
$('#shareClose').onclick = () => { $('#shareModal').hidden = true; };
$('#shareCopy').onclick = async () => {
  const box = $('#shareLink');
  try { await navigator.clipboard.writeText(box.value); toast('Ссылка скопирована'); }
  catch (e) { box.focus(); box.select(); toast('Выделите ссылку и скопируйте'); }
};
$('#shareSend').onclick = () => { navigator.share({ title: state.title, url: $('#shareLink').value }).catch(() => {}); };

/* ---------- просмотр по ссылке ---------- */
let shared = null, vi = 0;
function fitViewer() {
  const w = $('#viewerWrap'), k = Math.min((w.clientWidth - 16) / W, (w.clientHeight - 16) / H);
  if (!(k > 0)) return;
  $('#viewerBox').style.width = W * k + 'px'; $('#viewerBox').style.height = H * k + 'px';
  $('#viewerStage').style.transform = `scale(${k})`;
}
function showViewer() {
  fillStage($('#viewerStage'), shared.slides[vi], false);
  $('#vCount').textContent = (vi + 1) + ' / ' + shared.slides.length;
  $('#vPrev').disabled = vi === 0; $('#vNext').disabled = vi === shared.slides.length - 1;
  fitViewer();
}
async function openShared() {
  try { shared = await readShareLink(location.hash); }
  catch (e) { toast('Эта ссылка не открывается'); history.replaceState(null, '', location.href.split('#')[0]); return showHome(); }
  showSharedPres();
}
function showSharedPres() {
  vi = 0;
  document.title = shared.title;
  $('#viewerTitle').textContent = shared.title;
  $('#home').hidden = true; $('#editor').hidden = true; $('#viewer').hidden = false;
  showViewer();
}
$('#btnCloseViewer').onclick = () => { shared = null; history.replaceState(null, '', location.href.split('#')[0]); $('#viewer').hidden = true; showHome(); };
$('#btnOpenFile').onclick = () => $('#fileOpen').click();
$('#fileOpen').onchange = ev => {
  const f = ev.target.files[0]; ev.target.value = '';
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try { const d = JSON.parse(r.result); shared = cleanPres(d.title, d.slides); }
    catch (e) { return toast('Это не файл презентации'); }
    showSharedPres();
  };
  r.readAsText(f);
};
$('#vPrev').onclick = () => { if (vi > 0) { vi--; showViewer(); } };
$('#vNext').onclick = () => { if (vi < shared.slides.length - 1) { vi++; showViewer(); } };
$('#btnSaveCopy').onclick = () => {
  lib.pres.push(shared); save();
  history.replaceState(null, '', location.href.split('#')[0]);
  $('#viewer').hidden = true;
  const p = shared; shared = null;
  openPres(p);
  toast('Копия сохранена у вас');
};
addEventListener('resize', () => { if (shared && !$('#viewer').hidden) fitViewer(); });
addEventListener('hashchange', () => { if (location.hash.startsWith('#v1=')) openShared(); });

/* ---------- показ ---------- */
let pi = 0;
function showPres() {
  const ps = $('#presStage');
  fillStage(ps, state.slides[pi], false);
  ps.style.transform = `scale(${Math.min(innerWidth / W, innerHeight / H)})`;
}
function nextPres() { if (pi < state.slides.length - 1) { pi++; showPres(); } else endPres(); }
function prevPres() { if (pi > 0) { pi--; showPres(); } }
function endPres() { $('#presenter').hidden = true; if (document.fullscreenElement) document.exitFullscreen(); }
$('#btnPresent').onclick = () => {
  blurEditing(); pi = cur; $('#presenter').hidden = false; showPres();
  if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
};
$('#presenter').addEventListener('click', ev => {
  if (ev.target.id === 'presClose') return endPres();
  ev.clientX < innerWidth / 3 ? prevPres() : nextPres();
});
addEventListener('resize', () => { if (!$('#presenter').hidden) showPres(); });

addEventListener('keydown', ev => {
  if (!$('#presenter').hidden) {
    if (ev.key === 'Escape') endPres();
    else if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(ev.key)) nextPres();
    else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(ev.key)) prevPres();
    return;
  }
  if (!state) return;
  const t = ev.target;
  if (t.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
  if ((ev.key === 'Delete' || ev.key === 'Backspace') && sel) { delEl(); ev.preventDefault(); }
  const e = selEl();
  if (e && ev.key.startsWith('Arrow')) {
    const d = ev.shiftKey ? 10 : 1;
    if (ev.key === 'ArrowLeft') e.x -= d;
    if (ev.key === 'ArrowRight') e.x += d;
    if (ev.key === 'ArrowUp') e.y -= d;
    if (ev.key === 'ArrowDown') e.y += d;
    save(); render(); ev.preventDefault();
  }
});

if (location.hash.startsWith('#v1=')) openShared(); else showHome();

// установка как приложение: офлайн-кэш (работает при открытии по http/https)
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) {}
}
})();
