/* Éclat By Sev — local admin panel (no build step, no dependencies). */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ utils */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var view = $('#view');

  var CATS = { rings: 'Yüzük', necklaces: 'Kolye', earrings: 'Küpe', bracelets: 'Bileklik', sets: 'Set' };
  var TYPE_DEFAULT = { rings: 'Ring', necklaces: 'Necklace', earrings: 'Earrings', bracelets: 'Bracelet', sets: 'Set' };
  var TAGS = { 'new': 'Yeni', bestsellers: 'Çok satan', gifts: 'Hediye' };
  var CORE_PAGES = ['about', 'faq', 'contact', 'shipping-returns', 'privacy', 'terms'];
  var ICON = {
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    up: '<svg viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
    upload: '<svg viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/></svg>',
    ring: '<svg viewBox="0 0 220 220"><circle cx="110" cy="110" r="78"/><circle cx="110" cy="110" r="64"/><circle cx="110" cy="32" r="7"/></svg>',
    grip: '<svg viewBox="0 0 24 24"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>'
  };

  function getP(o, p) { return p.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
  function setP(o, p, v) {
    var ks = p.split('.'), last = ks.pop();
    var t = ks.reduce(function (a, k, i) {
      if (a[k] == null) a[k] = /^\d+$/.test(ks[i + 1] || last) ? [] : {};
      return a[k];
    }, o);
    t[last] = v;
  }
  function slugify(s) {
    return String(s || '').replace(/ı/g, 'i').replace(/İ/g, 'i').replace(/ß/g, 'ss').replace(/&/g, ' and ')
      .normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  }
  function today() {
    var d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }
  function niceDate(d) {
    if (!d) return '';
    var x = new Date(d + 'T12:00:00');
    return isNaN(x) ? d : x.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function eur(n) { return n === '' || n == null ? '' : '€' + (Number.isInteger(+n) ? +n : (+n).toFixed(2)); }
  function kb(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB'; }

  /* ------------------------------------------------------------------ api */
  function api(method, url, body, raw) {
    var opt = { method: method, headers: { 'X-Eclat-Admin': '1' } };
    if (body !== undefined) {
      if (raw) opt.body = body;
      else { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    }
    return fetch(url, opt).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: 'Sunucudan yanıt alınamadı' }; }).then(function (j) {
        if (!r.ok || j.ok === false) {
          var err = new Error(j.error || ('Hata ' + r.status)); err.log = j.log; throw err;
        }
        return j;
      });
    }, function () { throw new Error('Sunucuya ulaşılamadı. Terminalde admin panelinin açık olduğundan emin olun.'); });
  }

  /* ------------------------------------------------------------------ toasts & modal */
  function toast(msg, bad) {
    var t = document.createElement('div');
    t.className = 'toast' + (bad ? ' toast--bad' : '');
    t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(function () { t.remove(); }, bad ? 7000 : 2600);
  }
  function fail(e) { toast(e.message || String(e), true); if (e.log) console.error(e.log); }

  var modalEl = $('#modal');
  function openModal(html) {
    $('.modal__box', modalEl).innerHTML = html;
    modalEl.hidden = false;
    var f = $('input,textarea,button', modalEl); if (f) f.focus();
    return $('.modal__box', modalEl);
  }
  function closeModal() { modalEl.hidden = true; $('.modal__box', modalEl).innerHTML = ''; }
  modalEl.addEventListener('mousedown', function (e) { if (e.target === modalEl) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modalEl.hidden) closeModal(); });

  /* ------------------------------------------------------------------ state */
  var S = null;           // server data
  var draft = null;       // what the current screen edits
  var dirty = false;
  var saveFn = null;

  function markDirty() {
    dirty = true;
    var d = $('#dirty'); if (d) d.hidden = false;
  }
  function clean() {
    dirty = false;
    var d = $('#dirty'); if (d) d.hidden = true;
  }
  function previewUrl(path) { return 'http://' + location.hostname + ':' + S.previewPort + (path || '/'); }

  function wireSave(fn) {
    saveFn = function () {
      var b = $('#save'); if (!b || b.disabled) return;
      b.disabled = true; var label = b.textContent; b.textContent = 'Kaydediliyor…';
      Promise.resolve().then(fn).then(function () { refreshGit(); }, fail).then(function () {
        if (document.body.contains(b)) { b.disabled = false; b.textContent = label; }
      });
    };
    var b = $('#save'); if (b) b.addEventListener('click', saveFn);
  }

  function topBar(title, opts) {
    opts = opts || {};
    return (opts.back ? '<a class="crumb" href="' + opts.back[0] + '">← ' + esc(opts.back[1]) + '</a>' : '') +
      '<div class="page-top"><div><h1>' + title + '</h1>' + (opts.sub ? '<p>' + opts.sub + '</p>' : '') + '</div>' +
      '<div class="actions"><span class="dirty" id="dirty" hidden>Kaydedilmedi</span>' + (opts.extra || '') +
      (opts.save === false ? '' : '<button class="btn btn--ink" id="save" type="button">Kaydet</button>') + '</div></div>';
  }

  /* ------------------------------------------------------------------ form binding */
  function bind(root, obj, onChange) {
    $$('[data-k]', root).forEach(function (el) {
      var k = el.dataset.k, t = el.dataset.t, v = getP(obj, k);
      if (el.type === 'checkbox') el.checked = !!v;
      else el.value = v == null ? '' : v;
      var ev = (el.type === 'checkbox' || el.tagName === 'SELECT' || el.type === 'date') ? 'change' : 'input';
      el.addEventListener(ev, function () {
        var nv;
        if (el.type === 'checkbox') nv = el.checked;
        else if (t === 'num') nv = el.value === '' ? '' : Number(el.value);
        else if (t === 'numornull') nv = el.value === '' ? null : Number(el.value);
        else nv = el.value;
        setP(obj, k, nv); markDirty();
        if (onChange) onChange(k, nv, el);
      });
    });
  }

  function F(label, control, hint) {
    return '<div class="f"><label>' + label + '</label>' + control + (hint ? '<span class="hint">' + hint + '</span>' : '') + '</div>';
  }
  function inp(k, attrs) { return '<input class="in" data-k="' + k + '" ' + (attrs || '') + '>'; }
  function ta(k, rows, attrs) { return '<textarea data-k="' + k + '" rows="' + (rows || 3) + '" ' + (attrs || '') + '></textarea>'; }
  var ITALIC_HINT = 'Her satır sitede ayrı bir satır olur. İtalik vurgu için <b>*kelime*</b> yazın.';

  /* ------------------------------------------------------------------ chips (string list) */
  function mountChips(el, obj, path, placeholder) {
    function list() { return getP(obj, path) || []; }
    function render() {
      el.innerHTML = '<div class="chips">' + list().map(function (x, i) {
        return '<span class="chip">' + esc(x) + '<button type="button" data-i="' + i + '" aria-label="Kaldır">×</button></span>';
      }).join('') + '<input placeholder="' + esc(placeholder || 'Yazıp Enter’a basın') + '"></div>';
      var input = $('input', el);
      $('.chips', el).addEventListener('click', function (e) {
        var b = e.target.closest('button[data-i]');
        if (b) { var l = list().slice(); l.splice(+b.dataset.i, 1); setP(obj, path, l); markDirty(); render(); $('input', el).focus(); }
        else input.focus();
      });
      input.addEventListener('keydown', function (e) {
        if ((e.key === 'Enter' || e.key === ',') && input.value.trim()) {
          e.preventDefault();
          setP(obj, path, list().concat(input.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean)));
          markDirty(); render(); $('input', el).focus();
        } else if (e.key === 'Backspace' && !input.value && list().length) {
          var l = list().slice(); l.pop(); setP(obj, path, l); markDirty(); render(); $('input', el).focus();
        }
      });
      input.addEventListener('blur', function () {
        if (input.value.trim()) { setP(obj, path, list().concat([input.value.trim()])); markDirty(); render(); }
      });
    }
    render();
  }

  /* ------------------------------------------------------------------ list editor (rows of text) */
  function mountList(el, obj, path, opts) {
    opts = opts || {};
    function list() { return getP(obj, path) || []; }
    function render() {
      el.innerHTML = '<div class="list">' + list().map(function (x, i) {
        return '<div class="list__row"><input class="in" data-i="' + i + '" value="' + esc(x) + '">' +
          '<button type="button" class="icon-btn" data-up="' + i + '" title="Yukarı">' + ICON.up + '</button>' +
          '<button type="button" class="icon-btn" data-rm="' + i + '" title="Sil">' + ICON.x + '</button></div>';
      }).join('') + '</div>' +
        '<button type="button" class="btn btn--sm" data-add style="margin-top:8px">+ ' + esc(opts.add || 'Satır ekle') + '</button>';
      $$('input[data-i]', el).forEach(function (i) {
        i.addEventListener('input', function () { var l = list().slice(); l[+i.dataset.i] = i.value; setP(obj, path, l); markDirty(); });
      });
      el.onclick = function (e) {
        var b = e.target.closest('button'); if (!b) return;
        var l = list().slice();
        if (b.hasAttribute('data-add')) { l.push(''); setP(obj, path, l); markDirty(); render(); $$('input', el).pop().focus(); }
        else if (b.dataset.rm) { l.splice(+b.dataset.rm, 1); setP(obj, path, l); markDirty(); render(); }
        else if (b.dataset.up && +b.dataset.up > 0) { var i = +b.dataset.up; l.splice(i - 1, 0, l.splice(i, 1)[0]); setP(obj, path, l); markDirty(); render(); }
      };
    }
    render();
  }

  /* ------------------------------------------------------------------ images */
  function pickFiles(multiple) {
    return new Promise(function (resolve) {
      var i = document.createElement('input');
      i.type = 'file'; i.accept = 'image/*'; i.multiple = !!multiple;
      i.onchange = function () { resolve(Array.prototype.slice.call(i.files || [])); };
      i.click();
    });
  }

  // Resize to max 2000px and convert to WebP (falls back to JPEG) before upload.
  function prepare(file) {
    if (/heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)) {
      return createImageBitmap(file).then(encode, function () {
        throw new Error(file.name + ': HEIC biçimi bu tarayıcıda açılamıyor. Fotoğrafı JPG olarak dışa aktarıp tekrar deneyin (ya da Safari kullanın).');
      });
    }
    if (!/^image\//.test(file.type)) return Promise.reject(new Error(file.name + ' bir görsel dosyası değil'));
    if (file.type === 'image/gif' || file.type === 'image/svg+xml') return Promise.resolve(file);
    return createImageBitmap(file, { imageOrientation: 'from-image' }).then(encode, function () { return file; });

    function encode(bmp) {
      var max = 2000, sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
      var c = document.createElement('canvas');
      c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      return new Promise(function (r) { c.toBlob(r, 'image/webp', 0.86); }).then(function (b) {
        if (b && b.type === 'image/webp') return b;
        return new Promise(function (r) { c.toBlob(r, 'image/jpeg', 0.88); });
      }).then(function (b) {
        return (b && (b.size < file.size || sc < 1 || !/jpeg|webp|png/.test(file.type))) ? b : file;
      });
    }
  }
  function upload(file) {
    return prepare(file).then(function (blob) {
      return api('POST', '/api/upload?name=' + encodeURIComponent(file.name), blob, true);
    }).then(function (j) { return j.src; });
  }
  function uploadMany(files, statusEl) {
    var out = [], n = 0;
    if (statusEl) { statusEl.hidden = false; }
    function setStatus() { if (statusEl) statusEl.innerHTML = '<span class="spin"></span> Yükleniyor… ' + n + ' / ' + files.length; }
    setStatus();
    return files.reduce(function (p, f) {
      return p.then(function () {
        return upload(f).then(function (src) { out.push({ src: src, name: f.name }); }, fail).then(function () { n++; setStatus(); });
      });
    }, Promise.resolve()).then(function () { if (statusEl) statusEl.hidden = true; return out; });
  }
  function dropzone(el, onFiles) {
    el.addEventListener('dragover', function (e) {
      if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') > -1) { e.preventDefault(); el.classList.add('is-over'); }
    });
    el.addEventListener('dragleave', function () { el.classList.remove('is-over'); });
    el.addEventListener('drop', function (e) {
      el.classList.remove('is-over');
      var files = Array.prototype.slice.call((e.dataTransfer && e.dataTransfer.files) || []);
      if (files.length) { e.preventDefault(); onFiles(files); }
    });
  }

  function pickFromLibrary() {
    return new Promise(function (resolve) {
      api('GET', '/api/uploads').then(function (items) {
        var box = openModal('<h2>Medya kütüphanesi</h2><p class="muted">Daha önce yüklenen bir görseli seçin ya da yenisini yükleyin.</p>' +
          '<div class="drop" data-new style="min-height:80px;margin:14px 0">' + ICON.upload + '<span><b>Yeni görsel yükle</b> veya buraya sürükleyin</span></div>' +
          '<div class="uploading" hidden></div>' +
          (items.length ? '<div class="mgrid">' + items.map(function (m) {
            return '<button type="button" class="mitem" data-src="' + esc(m.src) + '"><span class="mitem__pic"><img src="' + esc(m.src) + '" alt="" loading="lazy"></span><span class="mitem__name">' + esc(m.name) + '</span></button>';
          }).join('') + '</div>' : '<p class="muted">Kütüphane henüz boş.</p>') +
          '<div class="modal__foot"><button class="btn" type="button" data-cancel>Vazgeç</button></div>');
        var done = function (v) { closeModal(); resolve(v); };
        box.addEventListener('click', function (e) {
          var m = e.target.closest('[data-src]'); if (m) return done(m.dataset.src);
          if (e.target.closest('[data-cancel]')) return done(null);
          if (e.target.closest('[data-new]')) pickFiles(false).then(go);
        });
        var go = function (files) {
          if (!files.length) return;
          uploadMany(files.slice(0, 1), $('.uploading', box)).then(function (r) { if (r[0]) done(r[0].src); });
        };
        dropzone($('[data-new]', box), go);
      }, fail);
    });
  }

  // Single image field: stores a src string at obj[path]
  function mountImage(el, obj, path, opts) {
    opts = opts || {};
    function render() {
      var src = getP(obj, path);
      el.innerHTML = '<div class="img-one' + (opts.wide ? ' img-one--wide' : '') + '">' +
        '<div class="img-one__pic drop" style="padding:0;min-height:0" data-pick>' + (src ? '<img src="' + esc(src) + '" alt="">' : ICON.upload) + '</div>' +
        '<div class="img-one__side"><div class="actions">' +
        '<button type="button" class="btn btn--sm" data-up>' + (src ? 'Değiştir' : 'Yükle') + '</button>' +
        '<button type="button" class="btn btn--sm btn--ghost" data-lib>Kütüphaneden</button>' +
        (src ? '<button type="button" class="btn btn--sm btn--danger" data-rm>Kaldır</button>' : '') + '</div>' +
        '<div class="uploading" hidden></div>' +
        (opts.hint ? '<span class="hint muted small">' + opts.hint + '</span>' : '') + '</div></div>';
    }
    function set(src) { setP(obj, path, src); markDirty(); render(); if (opts.onChange) opts.onChange(src); }
    function go(files) { if (files.length) uploadMany(files.slice(0, 1), $('.uploading', el)).then(function (r) { if (r[0]) set(r[0].src); }); }
    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-up],[data-pick]')) pickFiles(false).then(go);
      else if (e.target.closest('[data-lib]')) pickFromLibrary().then(function (s) { if (s) set(s); });
      else if (e.target.closest('[data-rm]')) set('');
    });
    dropzone(el, go);
    render();
  }

  // Product gallery: obj[path] = [{src, alt}]
  function mountGallery(el, obj, path) {
    function list() { return getP(obj, path) || []; }
    function render() {
      var l = list();
      el.innerHTML = (l.length ? '<div class="gallery">' + l.map(function (im, i) {
        return '<div class="gimg" draggable="true" data-i="' + i + '"><div class="gimg__pic"><img src="' + esc(im.src) + '" alt="">' +
          (i === 0 ? '<span class="gimg__tag">Ana görsel</span>' : i === 1 ? '<span class="gimg__tag" style="background:var(--gold-ink)">Üzerine gelince</span>' : '') +
          '<button type="button" class="gimg__rm" data-rm="' + i + '" title="Kaldır">' + ICON.x + '</button></div>' +
          '<input class="in" data-alt="' + i + '" placeholder="Açıklama (alt metin)" value="' + esc(im.alt || '') + '"></div>';
      }).join('') + '</div>' : '') +
        '<div class="uploading" hidden></div>' +
        '<div class="drop" data-add>' + ICON.upload + '<span><b>Fotoğraf ekle</b> — tıklayın ya da dosyaları buraya sürükleyin</span><span class="small">Birden fazla seçebilirsiniz. Görseller otomatik küçültülüp WebP’ye çevrilir.</span></div>' +
        '<div style="margin-top:8px"><button type="button" class="btn btn--sm btn--ghost" data-lib>Kütüphaneden ekle</button></div>';
      $$('[data-alt]', el).forEach(function (i) {
        i.addEventListener('input', function () { list()[+i.dataset.alt].alt = i.value; markDirty(); });
      });
      sortable($('.gallery', el), '.gimg', function (from, to) {
        var l2 = list(); l2.splice(to, 0, l2.splice(from, 1)[0]); markDirty(); render();
      });
    }
    function add(files) {
      if (!files.length) return;
      uploadMany(files, $('.uploading', el)).then(function (r) {
        var l = list().slice();
        r.forEach(function (x) { l.push({ src: x.src, alt: '' }); });
        setP(obj, path, l); markDirty(); render();
      });
    }
    el.addEventListener('click', function (e) {
      var rm = e.target.closest('[data-rm]');
      if (rm) { var l = list().slice(); l.splice(+rm.dataset.rm, 1); setP(obj, path, l); markDirty(); render(); }
      else if (e.target.closest('[data-add]')) pickFiles(true).then(add);
      else if (e.target.closest('[data-lib]')) pickFromLibrary().then(function (s) {
        if (s) { setP(obj, path, list().concat([{ src: s, alt: '' }])); markDirty(); render(); }
      });
    });
    dropzone(el, add);
    render();
  }

  // Drag-to-reorder for a set of siblings
  function sortable(container, sel, onMove) {
    if (!container) return;
    var from = null;
    $$(sel, container).forEach(function (it, i) {
      it.addEventListener('dragstart', function (e) {
        if (e.target.closest('input,textarea')) { e.preventDefault(); return; }
        from = i; it.classList.add('is-drag');
        e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'x');
      });
      it.addEventListener('dragend', function () { from = null; $$(sel, container).forEach(function (x) { x.classList.remove('is-drag', 'is-target'); }); });
      it.addEventListener('dragover', function (e) { if (from !== null) { e.preventDefault(); it.classList.add('is-target'); } });
      it.addEventListener('dragleave', function () { it.classList.remove('is-target'); });
      it.addEventListener('drop', function (e) {
        if (from === null) return;
        e.preventDefault(); e.stopPropagation();
        var f = from; from = null;
        if (f !== i) onMove(f, i);
      });
    });
  }

  /* ------------------------------------------------------------------ rich text */
  var ALLOWED = {
    P: [], H2: [], H3: [], H4: [], STRONG: [], B: [], EM: [], I: [], U: [], A: ['href', 'title', 'target', 'rel'],
    UL: [], OL: [], LI: [], BLOCKQUOTE: [], FIGURE: [], FIGCAPTION: [], IMG: ['src', 'alt'], HR: [], BR: [], DIV: [], SPAN: [], SECTION: []
  };
  function sanitize(html, keepClass) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (ch) {
        if (ch.nodeType === 8) { ch.remove(); return; }
        if (ch.nodeType !== 1) return;
        var tag = ch.tagName;
        if (/^(SCRIPT|STYLE|META|LINK|TITLE|IFRAME|OBJECT|EMBED|NOSCRIPT|TEMPLATE)$/.test(tag)) { ch.remove(); return; }
        walk(ch);
        var unwrap = !(tag in ALLOWED) || (tag === 'B' && /^docs-internal/.test(ch.id || ''));
        if (unwrap) { ch.replaceWith.apply(ch, Array.prototype.slice.call(ch.childNodes)); return; }
        Array.prototype.slice.call(ch.attributes).forEach(function (a) {
          var n = a.name.toLowerCase();
          var ok = ALLOWED[tag].indexOf(n) > -1 || (keepClass && (n === 'class' || n === 'id'));
          if (ok && (n === 'href' || n === 'src') && /^\s*javascript:/i.test(a.value)) ok = false;
          if (!ok) ch.removeAttribute(a.name);
        });
        if ((tag === 'SPAN' || tag === 'DIV' || tag === 'SECTION') && !ch.attributes.length && !keepClass) {
          if (tag === 'SPAN') ch.replaceWith.apply(ch, Array.prototype.slice.call(ch.childNodes));
          else { var p = doc.createElement('p'); while (ch.firstChild) p.appendChild(ch.firstChild); ch.replaceWith(p); }
        }
      });
    })(doc.body);
    return doc.body.innerHTML.replace(/<p>(\s|&nbsp;|<br>)*<\/p>/g, '').trim();
  }
  function pretty(html) {
    return html.replace(/\s*\n\s*/g, '\n')
      .replace(/(<\/(p|h[1-6]|ul|ol|li|div|blockquote|figure|section)>|<hr>|<br>(?=<\/?(p|div)))/g, '$1\n')
      .replace(/(<(ul|ol|div|section)[^>]*>)/g, '$1\n').replace(/\n{2,}/g, '\n').trim();
  }
  function textToHtml(t) {
    return t.split(/\n{2,}/).map(function (p) { return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>'; }).join('');
  }

  function mountRte(el, obj, path, opts) {
    opts = opts || {};
    var B = function (cmd, label, title) { return '<button type="button" data-cmd="' + cmd + '" title="' + title + '">' + label + '</button>'; };
    el.innerHTML = '<div class="rte"><div class="rte__bar">' +
      B('p', '¶', 'Paragraf') + B('h2', 'H2', 'Başlık') + B('h3', 'H3', 'Alt başlık') + '<span class="sep"></span>' +
      B('bold', '<b>B</b>', 'Kalın (⌘B)') + B('italic', '<i style="font-family:var(--italic);font-size:16px">I</i>', 'İtalik (⌘I)') +
      B('link', '<svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 006 0l3-3a4 4 0 00-6-6l-1 1"/><path d="M14 10a4 4 0 00-6 0l-3 3a4 4 0 006 6l1-1"/></svg>', 'Bağlantı') +
      '<span class="sep"></span>' +
      B('ul', '<svg viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r=".8"/><circle cx="4.5" cy="12" r=".8"/><circle cx="4.5" cy="18" r=".8"/></svg>', 'Madde listesi') +
      B('ol', '<svg viewBox="0 0 24 24"><path d="M10 6h10M10 12h10M10 18h10M4 5l1.5-1v5M3.5 14.5a1.5 1.5 0 013 .5c0 1-3 2.5-3 3.5h3"/></svg>', 'Numaralı liste') +
      B('quote', '<svg viewBox="0 0 24 24"><path d="M6 17h4l1-6H7V7h4M14 17h4l1-6h-4V7h4"/></svg>', 'Alıntı') +
      B('hr', '—', 'Ayırıcı çizgi') +
      B('image', '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="1"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/></svg>', 'Görsel ekle') +
      B('clear', '<svg viewBox="0 0 24 24"><path d="M5 5h14M12 5l-3 14M15 15l5 5M20 15l-5 5"/></svg>', 'Biçimi temizle') +
      '<span class="grow"></span>' + B('source', '&lt;/&gt;', 'HTML kodu') +
      '</div><div class="rte__area" contenteditable="true" spellcheck="true" data-ph="' + esc(opts.placeholder || 'Yazmaya başlayın…') + '"></div>' +
      '<textarea class="rte__src" hidden spellcheck="false"></textarea><div class="uploading" hidden style="margin:8px"></div></div>';
    var area = $('.rte__area', el), src = $('.rte__src', el), bar = $('.rte__bar', el), status = $('.uploading', el);
    area.innerHTML = getP(obj, path) || '';
    var range = null;
    function remember() { var s = getSelection(); if (s.rangeCount && area.contains(s.anchorNode)) range = s.getRangeAt(0).cloneRange(); }
    function restore() { area.focus(); if (range) { var s = getSelection(); s.removeAllRanges(); s.addRange(range); } }
    function sync() { setP(obj, path, area.innerHTML.replace(/​/g, '')); markDirty(); }
    function exec(c, v) { restore(); document.execCommand(c, false, v); sync(); refresh(); }
    function insertImages(files) {
      uploadMany(files, status).then(function (r) {
        if (!r.length) return;
        var alt = prompt('Görsel açıklaması (görme engelliler ve Google için, isteğe bağlı):', '') || '';
        exec('insertHTML', r.map(function (x) { return '<img src="' + esc(x.src) + '" alt="' + esc(alt) + '">'; }).join('') + '<p><br></p>');
      });
    }
    function refresh() {
      var block = (document.queryCommandValue('formatBlock') || '').toLowerCase();
      $$('[data-cmd]', bar).forEach(function (b) {
        var c = b.dataset.cmd, on = false;
        try {
          if (c === 'bold' || c === 'italic') on = document.queryCommandState(c);
          else if (c === 'h2' || c === 'h3') on = block === c;
          else if (c === 'quote') on = block === 'blockquote';
          else if (c === 'ul') on = document.queryCommandState('insertUnorderedList');
          else if (c === 'ol') on = document.queryCommandState('insertOrderedList');
          else if (c === 'source') on = !src.hidden;
        } catch (e) { /* ignore */ }
        b.classList.toggle('is-on', on);
      });
    }
    area.addEventListener('focus', function () { document.execCommand('defaultParagraphSeparator', false, 'p'); });
    area.addEventListener('input', sync);
    area.addEventListener('keyup', function () { remember(); refresh(); });
    area.addEventListener('mouseup', function () { remember(); refresh(); });
    area.addEventListener('blur', remember);
    area.addEventListener('paste', function (e) {
      var cd = e.clipboardData; if (!cd) return;
      var files = Array.prototype.slice.call(cd.files || []).filter(function (f) { return /^image\//.test(f.type); });
      e.preventDefault();
      if (files.length) { remember(); insertImages(files); return; }
      var h = cd.getData('text/html');
      document.execCommand('insertHTML', false, h ? sanitize(h, false) : textToHtml(cd.getData('text/plain')));
      sync();
    });
    area.addEventListener('drop', function (e) {
      var files = Array.prototype.slice.call((e.dataTransfer && e.dataTransfer.files) || []);
      if (!files.length) return;
      e.preventDefault();
      if (document.caretRangeFromPoint) { var r = document.caretRangeFromPoint(e.clientX, e.clientY); if (r) range = r; }
      insertImages(files);
    });
    area.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); remember(); bar.querySelector('[data-cmd=link]').click(); }
    });
    src.addEventListener('input', function () { setP(obj, path, src.value); markDirty(); });
    bar.addEventListener('mousedown', function (e) { if (e.target.closest('button')) e.preventDefault(); });
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cmd]'); if (!b) return;
      var c = b.dataset.cmd;
      if (c === 'source') {
        if (src.hidden) { src.value = pretty(area.innerHTML); src.hidden = false; area.hidden = true; src.focus(); }
        else { area.innerHTML = sanitize(src.value, true); setP(obj, path, area.innerHTML); src.hidden = true; area.hidden = false; area.focus(); }
        refresh(); return;
      }
      if (!src.hidden) { toast('Önce HTML görünümünden çıkın'); return; }
      if (c === 'p' || c === 'h2' || c === 'h3') exec('formatBlock', '<' + c + '>');
      else if (c === 'quote') exec('formatBlock', document.queryCommandValue('formatBlock') === 'blockquote' ? '<p>' : '<blockquote>');
      else if (c === 'bold' || c === 'italic') exec(c);
      else if (c === 'ul') exec('insertUnorderedList');
      else if (c === 'ol') exec('insertOrderedList');
      else if (c === 'hr') exec('insertHorizontalRule');
      else if (c === 'clear') { exec('removeFormat'); exec('formatBlock', '<p>'); }
      else if (c === 'link') {
        remember();
        var cur = range && range.startContainer.parentElement && range.startContainer.parentElement.closest('a');
        var url = prompt('Bağlantı adresi (boş bırakırsanız bağlantı kaldırılır):', cur ? cur.getAttribute('href') : 'https://');
        if (url === null) return;
        if (!url.trim() || url.trim() === 'https://') exec('unlink');
        else {
          url = url.trim();
          if (!/^(https?:|mailto:|\/|#)/i.test(url)) url = (/@/.test(url) ? 'mailto:' : 'https://') + url;
          if (range && range.collapsed && !cur) exec('insertHTML', '<a href="' + esc(url) + '">' + esc(url.replace(/^mailto:/, '')) + '</a>');
          else exec('createLink', url);
        }
      } else if (c === 'image') { remember(); pickFiles(true).then(function (f) { if (f.length) insertImages(f); }); }
    });
    return { getHtml: function () { return src.hidden ? area.innerHTML : src.value; } };
  }

  /* ------------------------------------------------------------------ products */
  function productThumb(p) {
    var im = (p.images || [])[0];
    return im ? '<img src="' + esc(im.src) + '" alt="" loading="lazy">' : ICON.ring;
  }
  function productList() {
    var ps = S.products;
    view.innerHTML = topBar('Ürünler', {
      sub: ps.length + ' ürün · Mağazadaki sırayı değiştirmek için kartları sürükleyin', save: false,
      extra: '<a class="btn btn--ink" href="#/products/new">+ Yeni ürün</a>'
    }) + (ps.length ? '<div class="pgrid" id="pgrid">' + ps.map(function (p) {
      var flags = (p.hidden ? '<span class="pill pill--warn">Gizli</span>' : '') +
        (!(p.images || []).length ? '<span class="pill">Fotoğraf yok</span>' : '') +
        (p.badge ? '<span class="pill pill--dark">' + esc(p.badge) + '</span>' : '');
      return '<a class="pcard" draggable="true" href="#/products/' + encodeURIComponent(p.handle) + '">' +
        '<div class="pcard__pic">' + productThumb(p) + '</div><span class="pcard__flags">' + flags + '</span>' +
        '<span class="pcard__grip" title="Sürükle">' + ICON.grip + '</span>' +
        '<div class="pcard__meta"><span class="pcard__type">' + esc(CATS[p.cat] || p.type) + '</span><span class="pcard__name">' + esc(p.name) + '</span>' +
        '<span class="pcard__price">' + eur(p.price) + (p.was ? '<s>' + eur(p.was) + '</s>' : '') + '</span></div></a>';
    }).join('') + '</div>' : '<div class="empty"><h3>Henüz ürün yok</h3><p>İlk ürününüzü ekleyin.</p></div>');
    sortable($('#pgrid'), '.pcard', function (from, to) {
      var l = S.products.slice(); l.splice(to, 0, l.splice(from, 1)[0]);
      api('PUT', '/api/products', l).then(function (j) { S.products = j.data; toast('Sıralama kaydedildi'); refreshGit(); productList(); }, fail);
    });
  }

  function productEdit(id) {
    var isNew = id === 'new';
    var orig = isNew ? null : S.products.filter(function (p) { return p.handle === id; })[0];
    if (!isNew && !orig) { view.innerHTML = '<div class="empty"><h3>Ürün bulunamadı</h3><a href="#/products">Ürünlere dön</a></div>'; return; }
    draft = isNew ? { handle: '', name: '', type: '', cat: 'rings', tags: 'new', material: '', price: '', was: null, badge: 'New', features: ['Water resistant', 'Nickel free'], sizes: null, desc: '', details: '', photos: [], pairs: [], images: [], hidden: false } : clone(orig);
    var handleTouched = !isNew;
    var others = S.products.filter(function (p) { return !orig || p.handle !== orig.handle; });

    view.innerHTML = topBar(isNew ? 'Yeni ürün' : esc(draft.name), {
      back: ['#/products', 'Ürünler'],
      extra: isNew ? '' : '<a class="btn btn--ghost" target="_blank" rel="noopener" href="' + previewUrl('/products/' + draft.handle) + '">Sitede gör ↗</a>'
    }) +
      '<div class="cols"><div>' +
      '<section class="panel"><h2 class="sec">Fotoğraflar</h2><p class="sec-sub">İlk fotoğraf ana görsel; ikincisi mağazada üzerine gelince görünür. Sıralamak için sürükleyin. Dikey (4:5) fotoğraflar en iyi sonucu verir.</p><div data-m="gallery"></div></section>' +
      '<section class="panel stack"><h2 class="sec">Ürün bilgileri</h2><p class="sec-sub" style="margin:-12px 0 0">Sitedeki metinler İngilizce.</p>' +
      F('Ürün adı', inp('name', 'placeholder="Lumière Stacking Ring"')) +
      F('Sayfa adresi', '<div class="prefix"><span>eclatbysev.com/products/</span><input class="in" data-k="handle" id="handle"></div>',
        isNew ? 'Ürün adından otomatik oluşur.' : 'Değiştirirseniz eski bağlantı çalışmaz.') +
      '<div class="row">' + F('Tür etiketi', inp('type', 'placeholder="' + esc(TYPE_DEFAULT[draft.cat]) + '"'), 'Kartta ürün adının üstünde görünür. Boşsa kategoriye göre doldurulur.') +
      F('Malzeme', inp('material', 'placeholder="18k gold plated · stainless steel"')) + '</div>' +
      F('Açıklama', ta('desc', 6)) +
      F('Detaylar', ta('details', 3), 'Ürün sayfasında “Details” bölümünde görünür.') +
      '</section>' +
      '<section class="panel stack"><h2 class="sec">Özellikler ve bedenler</h2>' +
      F('Özellik etiketleri', '<div data-m="features"></div>', 'Örn. Water resistant, Tarnish free, Nickel free') +
      F('Yüzük bedenleri', '<div data-m="sizes"></div>', 'Boş bırakırsanız beden seçimi gösterilmez. Örn. 50, 52, 54') +
      '</section></div>' +
      '<div><section class="panel stack"><h2 class="sec">Durum</h2>' +
      '<label class="switch"><span><b style="font-weight:500">Sitede göster</b><br><span class="muted small">Kapalıyken ürün mağazada görünmez.</span></span><input type="checkbox" id="visible"></label></section>' +
      '<section class="panel stack"><h2 class="sec">Fiyat</h2><div class="row">' +
      F('Fiyat (€)', inp('price', 'type="number" min="0" step="0.01" data-t="num"')) +
      F('Eski fiyat (€)', inp('was', 'type="number" min="0" step="0.01" data-t="numornull"'), 'İndirim için') + '</div>' +
      F('Rozet', inp('badge', 'list="badges" placeholder="Yok"'), 'Fotoğrafın köşesinde görünür.') +
      '<datalist id="badges"><option value="New"><option value="Sale"><option value="Gift"><option value="Bestseller"><option value="Limited"></datalist></section>' +
      '<section class="panel stack"><h2 class="sec">Kategori</h2>' +
      F('Kategori', '<select data-k="cat">' + Object.keys(CATS).map(function (k) { return '<option value="' + k + '">' + CATS[k] + '</option>'; }).join('') + '</select>') +
      F('Koleksiyonlar', '<div class="checks" id="tags">' + Object.keys(TAGS).map(function (k) {
        return '<label class="check"><input type="checkbox" value="' + k + '">' + TAGS[k] + '</label>';
      }).join('') + '</div>', '“Yeni” ve “Hediye” mağaza filtrelerinde kullanılır.') + '</section>' +
      '<section class="panel stack"><h2 class="sec">Birlikte önerilenler</h2><p class="sec-sub" style="margin:-12px 0 0">Ürün sayfasının altında en fazla 3 ürün.</p>' +
      '<div class="checks" id="pairs">' + others.map(function (p) {
        return '<label class="check"><input type="checkbox" value="' + esc(p.handle) + '">' + esc(p.name) + '</label>';
      }).join('') + '</div></section>' +
      (isNew ? '' : '<section class="panel"><button class="btn btn--danger btn--block" type="button" id="del">Ürünü sil</button></section>') +
      '</div></div>';

    bind(view, draft, function (k, v) {
      if (k === 'name' && !handleTouched) { draft.handle = slugify(v); $('#handle').value = draft.handle; }
      if (k === 'handle') handleTouched = true;
      if (k === 'cat') $('[data-k=type]').placeholder = TYPE_DEFAULT[v];
    });
    mountGallery($('[data-m=gallery]'), draft, 'images');
    mountChips($('[data-m=features]'), draft, 'features', 'Özellik yazıp Enter');
    mountChips($('[data-m=sizes]'), draft, 'sizes', 'Beden yazıp Enter');

    var vis = $('#visible'); vis.checked = !draft.hidden;
    vis.addEventListener('change', function () { draft.hidden = !vis.checked; markDirty(); });
    $$('#tags input').forEach(function (c) {
      c.checked = (draft.tags || '').split(' ').indexOf(c.value) > -1;
      c.addEventListener('change', function () {
        draft.tags = $$('#tags input:checked').map(function (x) { return x.value; }).join(' '); markDirty();
      });
    });
    function pairsLimit() {
      var n = $$('#pairs input:checked').length;
      $$('#pairs input').forEach(function (c) { c.disabled = !c.checked && n >= 3; });
    }
    $$('#pairs input').forEach(function (c) {
      c.checked = (draft.pairs || []).indexOf(c.value) > -1;
      c.addEventListener('change', function () {
        draft.pairs = $$('#pairs input:checked').map(function (x) { return x.value; }); markDirty(); pairsLimit();
      });
    });
    pairsLimit();

    wireSave(function () {
      if (!draft.name.trim()) throw new Error('Ürün adı gerekli');
      if (draft.price === '' || draft.price == null) throw new Error('Fiyat gerekli');
      if (!draft.type) draft.type = TYPE_DEFAULT[draft.cat];
      if (!draft.handle) draft.handle = slugify(draft.name);
      var list = S.products.slice();
      var renamed = orig && orig.handle !== draft.handle ? orig.handle : null;
      if (isNew) list.push(draft); else list[list.indexOf(orig)] = draft;
      if (renamed) list.forEach(function (p) { p.pairs = (p.pairs || []).map(function (h) { return h === renamed ? draft.handle : h; }); });
      return api('PUT', '/api/products', list).then(function (j) {
        S.products = j.data;
        if (renamed) return renameInSettings(renamed, draft.handle);
      }).then(function () {
        clean(); toast(isNew ? 'Ürün eklendi' : 'Kaydedildi');
        if (isNew || renamed) go('#/products/' + encodeURIComponent(draft.handle));
        else productEdit(draft.handle);
      });
    });
    var del = $('#del');
    if (del) del.addEventListener('click', function () {
      if (!confirm('“' + orig.name + '” silinsin mi? Bu işlem geri alınamaz (yayınlamadan önce git ile geri alınabilir).')) return;
      api('PUT', '/api/products', S.products.filter(function (p) { return p !== orig; })).then(function (j) {
        S.products = j.data; clean(); toast('Ürün silindi'); refreshGit(); go('#/products');
      }, fail);
    });
  }

  function renameInSettings(from, to) {
    var s = clone(S.settings), str = JSON.stringify(s);
    if (str.indexOf('"' + from + '"') < 0) return Promise.resolve();
    s = JSON.parse(str.split('"' + from + '"').join('"' + to + '"'));
    return api('PUT', '/api/settings', s).then(function (j) { S.settings = j.data; });
  }

  /* ------------------------------------------------------------------ home page */
  function productOptions(selected, allowNone) {
    return (allowNone ? '<option value="">—</option>' : '') + S.products.map(function (p) {
      return '<option value="' + esc(p.handle) + '"' + (p.handle === selected ? ' selected' : '') + '>' + esc(p.name) + (p.hidden ? ' (gizli)' : '') + '</option>';
    }).join('');
  }

  function homeEdit() {
    draft = clone(S.settings);
    var d = draft;
    var sections = [['hero', 'Giriş'], ['announce', 'Duyuru'], ['collections', 'Koleksiyonlar'], ['newin', 'Yeni gelenler'],
      ['philosophy', 'Felsefe'], ['feature', 'Öne çıkan set'], ['story', 'Hikaye'], ['insta', 'Instagram'], ['join', 'Bülten'], ['blog', 'Blog sayfası'], ['seo', 'SEO ve iletişim']];
    view.innerHTML = topBar('Ana sayfa', {
      sub: sections.map(function (s) { return '<a href="javascript:void 0" data-jump="' + s[0] + '" class="muted" style="margin-right:12px">' + s[1] + '</a>'; }).join(''),
      extra: '<a class="btn btn--ghost" target="_blank" rel="noopener" href="' + previewUrl('/') + '">Sitede gör ↗</a>'
    }) +
      '<div class="stack">' +
      '<section class="panel stack" id="s-hero"><h2 class="sec">Giriş bölümü (hero)</h2>' +
      '<div class="row"><div class="stack">' +
      F('Üst etiket', inp('hero.eyebrow')) +
      F('Başlık', ta('hero.title', 2), ITALIC_HINT) +
      F('Alt metin', ta('hero.lead', 3)) +
      F('Buton metni', inp('hero.cta')) +
      '</div><div class="stack">' +
      F('Fotoğraf', '<div data-m="hero.image"></div>') +
      F('Fotoğraf açıklaması', inp('hero.imageAlt')) +
      '</div></div>' +
      '<div><h2 class="sec" style="font-size:16px">Fotoğraf üzerindeki ürün noktaları</h2><p class="sec-sub">Bir noktayı seçin, sonra fotoğrafta ürünün olduğu yere tıklayın.</p><div data-m="hotspots"></div></div>' +
      '</section>' +
      '<section class="panel stack" id="s-announce"><h2 class="sec">Duyuru çubuğu ve vaatler</h2><div class="row">' +
      F('Sayfanın en üstündeki duyuru', '<div data-m="announce"></div>', 'Mobilde sadece ilk satır görünür.') +
      F('Vaatler şeridi (4 madde)', '<div class="stack" style="gap:8px">' + [0, 1, 2, 3].map(function (i) { return inp('promise.' + i); }).join('') + '</div>', 'Simgeler sırasıyla: yıldız, kargo, iade, saat.') +
      '</div></section>' +
      '<section class="panel stack" id="s-collections"><h2 class="sec">Koleksiyonlar</h2><div class="row">' +
      F('Üst etiket', inp('collections.eyebrow')) + F('Başlık', inp('collections.title'), 'İtalik için *kelime*') + '</div>' +
      '<div class="row row--3" style="grid-template-columns:repeat(auto-fill,minmax(250px,1fr))">' + d.collections.tiles.map(function (tl, i) {
        return '<div class="panel stack" style="box-shadow:none;padding:16px">' +
          F((i === 0 ? 'Büyük kutu' : (i + 1) + '. kutu') + ' — ad', inp('collections.tiles.' + i + '.name')) +
          F('Bağlantı', '<select data-k="collections.tiles.' + i + '.category">' + Object.keys(CATS).concat(['new', 'gifts']).map(function (k) {
            return '<option value="' + k + '">' + (CATS[k] || TAGS[k] || k) + '</option>';
          }).join('') + '</select>') +
          F('Fotoğraf', '<div data-m="collections.tiles.' + i + '.image"></div>') + '</div>';
      }).join('') + '</div></section>' +
      '<section class="panel stack" id="s-newin"><h2 class="sec">Yeni gelenler</h2><div class="row">' +
      F('Üst etiket', inp('newIn.eyebrow')) + F('Başlık', inp('newIn.title')) + '</div>' +
      '<div class="row" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">' + [0, 1, 2, 3].map(function (i) {
        return F((i + 1) + '. ürün', '<select data-k="newIn.products.' + i + '">' + productOptions(d.newIn.products[i], true) + '</select>');
      }).join('') + '</div></section>' +
      '<section class="panel stack" id="s-philosophy"><h2 class="sec">Felsefe (koyu bölüm)</h2><div class="row"><div class="stack">' +
      F('Üst etiket', inp('philosophy.eyebrow')) +
      F('Büyük alıntı', ta('philosophy.quote', 3), ITALIC_HINT) +
      F('Metin', ta('philosophy.body', 4), 'Her satır sırayla belirir.') +
      '</div>' + F('Fotoğraf', '<div data-m="philosophy.image"></div>') + '</div></section>' +
      '<section class="panel stack" id="s-feature"><h2 class="sec">Öne çıkan ürün / set</h2><div class="row"><div class="stack">' +
      F('Ürün', '<select data-k="feature.product">' + productOptions(d.feature.product, true) + '</select>', 'Fiyat ve bağlantı bu üründen alınır. Boş bırakırsanız bölüm gizlenir.') +
      F('Üst etiket', inp('feature.eyebrow')) + F('Başlık', inp('feature.title')) +
      F('Metin', ta('feature.text', 3)) + F('Buton metni', inp('feature.cta')) +
      '</div>' + F('Fotoğraf', '<div data-m="feature.image"></div>') + '</div></section>' +
      '<section class="panel stack" id="s-story"><h2 class="sec">Hikayemiz</h2><div class="row"><div class="stack">' +
      F('Üst etiket', inp('story.eyebrow')) + F('Başlık', ta('story.title', 2), ITALIC_HINT) +
      F('Metin', ta('story.body', 5)) +
      '<div class="row">' + F('Vurgulu kelime', inp('story.word')) + '</div>' +
      F('Kelimenin açıklaması', ta('story.definition', 3)) +
      '</div><div class="stack">' + F('Büyük fotoğraf', '<div data-m="story.images.0"></div>') + F('Küçük fotoğraf', '<div data-m="story.images.1"></div>') + '</div></div></section>' +
      '<section class="panel stack" id="s-insta"><h2 class="sec">Instagram ızgarası</h2><p class="sec-sub" style="margin:-12px 0 0">Ana sayfanın altındaki 6 kare.</p>' +
      '<div class="row" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr))">' + [0, 1, 2, 3, 4, 5].map(function (i) { return '<div data-m="instagram.images.' + i + '"></div>'; }).join('') + '</div></section>' +
      '<section class="panel stack" id="s-join"><h2 class="sec">Bülten bandı</h2><div class="row">' +
      F('Üst etiket', inp('join.eyebrow')) + F('Başlık', inp('join.title'), 'İtalik için *kelime*') + '</div>' + F('Metin', ta('join.text', 2)) + '</section>' +
      '<section class="panel stack" id="s-blog"><h2 class="sec">Blog sayfası</h2><div class="row">' +
      F('Menüdeki adı', inp('blog.navLabel'), 'Menüde ilk yayınlanan yazıdan sonra görünür.') + F('Başlık', inp('blog.title'), 'İtalik için *kelime*') + '</div>' +
      F('Giriş metni', ta('blog.intro', 2)) + F('Google açıklaması', ta('blog.description', 2)) + '</section>' +
      '<section class="panel stack" id="s-seo"><h2 class="sec">SEO ve iletişim</h2><div class="row"><div class="stack">' +
      F('Sayfa başlığı (Google)', inp('seo.title')) + F('Açıklama (Google)', ta('seo.description', 3), '150–160 karakter ideal.') +
      F('E-posta', inp('brand.email', 'type="email"')) + F('Instagram kullanıcı adı', '<div class="prefix"><span>@</span><input class="in" data-k="brand.instagram"></div>') +
      '</div>' + F('Paylaşım görseli', '<div data-m="seo.image"></div>', 'WhatsApp / sosyal medyada paylaşılınca görünür. Boşsa giriş fotoğrafı kullanılır.') + '</div></section>' +
      '</div>';

    bind(view, d);
    $$('[data-m]', view).forEach(function (el) {
      var k = el.dataset.m;
      if (k === 'announce') mountList(el, d, 'announce', { add: 'Duyuru ekle' });
      else if (k === 'hotspots') mountHotspots(el, d);
      else mountImage(el, d, k, { wide: k === 'hero.image', onChange: k === 'hero.image' ? function () { mountHotspots($('[data-m=hotspots]'), d); } : null });
    });
    $$('[data-jump]', view).forEach(function (a) {
      a.addEventListener('click', function () { $('#s-' + a.dataset.jump).scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    });

    wireSave(function () {
      d.newIn.products = d.newIn.products.filter(Boolean);
      d.announce = d.announce.filter(function (x) { return x.trim(); });
      return api('PUT', '/api/settings', d).then(function (j) { S.settings = j.data; clean(); toast('Ana sayfa kaydedildi'); homeEdit(); });
    });
  }

  function mountHotspots(el, d) {
    var active = 0;
    function render() {
      var hs = d.hero.hotspots || (d.hero.hotspots = []);
      el.innerHTML = '<div class="row"><div class="hot" id="hot">' +
        (d.hero.image ? '<img src="' + esc(d.hero.image) + '" alt="">' : '<div class="hot__empty">Önce giriş fotoğrafını yükleyin. Noktalar yine de kaydedilir.</div>') +
        hs.map(function (h, i) { return '<span class="hot__dot' + (i === active ? ' is-on' : '') + '" style="left:' + h.x + '%;top:' + h.y + '%">' + (i + 1) + '</span>'; }).join('') +
        '</div><div class="stack" style="gap:10px">' + hs.map(function (h, i) {
          return '<div class="list__row"><label class="check" style="padding:6px 10px"><input type="radio" name="hs" value="' + i + '"' + (i === active ? ' checked' : '') + '>' + (i + 1) + '</label>' +
            '<select class="in" data-hp="' + i + '">' + productOptions(h.product) + '</select>' +
            '<span class="muted small" style="white-space:nowrap">' + h.x + '%, ' + h.y + '%</span>' +
            '<button type="button" class="icon-btn" data-hrm="' + i + '" title="Sil">' + ICON.x + '</button></div>';
        }).join('') +
        (hs.length < 4 ? '<div><button type="button" class="btn btn--sm" data-hadd>+ Nokta ekle</button></div>' : '') + '</div></div>';
      $('#hot', el).addEventListener('click', function (e) {
        if (!hs[active]) return;
        var r = this.getBoundingClientRect();
        hs[active].x = Math.round((e.clientX - r.left) / r.width * 100);
        hs[active].y = Math.round((e.clientY - r.top) / r.height * 100);
        markDirty(); render();
      });
      $$('input[name=hs]', el).forEach(function (r) { r.addEventListener('change', function () { active = +r.value; render(); }); });
      $$('[data-hp]', el).forEach(function (s) { s.addEventListener('change', function () { hs[+s.dataset.hp].product = s.value; markDirty(); }); });
      $$('[data-hrm]', el).forEach(function (b) { b.addEventListener('click', function () { hs.splice(+b.dataset.hrm, 1); active = 0; markDirty(); render(); }); });
      var add = $('[data-hadd]', el);
      if (add) add.addEventListener('click', function () { hs.push({ product: (S.products[0] || {}).handle || '', x: 50, y: 50 }); active = hs.length - 1; markDirty(); render(); });
    }
    render();
  }

  /* ------------------------------------------------------------------ pages */
  function pageList() {
    view.innerHTML = topBar('Sayfalar', {
      sub: 'Hakkımızda, SSS, iletişim ve yasal sayfalar.', save: false,
      extra: '<a class="btn" href="#/pages/new">+ Yeni sayfa</a>'
    }) + '<div class="rows">' + S.pages.map(function (p) {
      return '<a class="rowlink" href="#/pages/' + encodeURIComponent(p.slug) + '"><span class="rowlink__main"><span class="rowlink__title">' + esc(p.title) +
        '</span><span class="rowlink__sub">/' + esc(p.slug) + (p.desc ? ' · ' + esc(p.desc) : '') + '</span></span>' +
        (CORE_PAGES.indexOf(p.slug) < 0 ? '<span class="pill">Özel</span>' : '') + '</a>';
    }).join('') + '</div>';
  }

  function pageEdit(slug) {
    var isNew = slug === 'new';
    var orig = isNew ? null : S.pages.filter(function (p) { return p.slug === slug; })[0];
    if (!isNew && !orig) { view.innerHTML = '<div class="empty"><h3>Sayfa bulunamadı</h3><a href="#/pages">Sayfalara dön</a></div>'; return; }
    draft = isNew ? { slug: '', title: '', desc: '', eyebrow: '', h1: '', intro: '', inner: '' } : clone(orig);
    var slugTouched = !isNew, core = !isNew && CORE_PAGES.indexOf(orig.slug) > -1;
    view.innerHTML = topBar(isNew ? 'Yeni sayfa' : esc(draft.title), {
      back: ['#/pages', 'Sayfalar'],
      extra: isNew ? '' : '<a class="btn btn--ghost" target="_blank" rel="noopener" href="' + previewUrl('/' + draft.slug) + '">Sitede gör ↗</a>'
    }) + '<div class="cols"><div class="stack">' +
      '<section class="panel stack">' +
      '<div class="row">' + F('Üst etiket', inp('eyebrow', 'placeholder="Help"')) + F('Sayfa başlığı', inp('h1'), 'İtalik için *kelime*') + '</div>' +
      F('Giriş metni', ta('intro', 3), 'Başlığın altındaki büyük metin. Basit HTML kullanılabilir.') + '</section>' +
      '<section class="panel"><h2 class="sec">İçerik</h2><p class="sec-sub">SSS ve iletişim sayfalarındaki özel kutular HTML görünümünde (&lt;/&gt;) düzenlenebilir.</p><div data-m="rte"></div></section>' +
      '</div><div><section class="panel stack"><h2 class="sec">Ayarlar</h2>' +
      F('Sekme / Google başlığı', inp('title')) +
      F('Google açıklaması', ta('desc', 3)) +
      F('Adres', '<div class="prefix"><span>/</span><input class="in" data-k="slug" id="slug"' + (core ? ' readonly' : '') + '></div>',
        core ? 'Bu temel sayfanın adresi sabittir.' : 'Yeni sayfalar menüde otomatik görünmez; bağlantıyı başka bir sayfaya ekleyebilirsiniz.') +
      '</section>' + (isNew || core ? '' : '<section class="panel"><button class="btn btn--danger btn--block" type="button" id="del">Sayfayı sil</button></section>') +
      '</div></div>';
    bind(view, draft, function (k, v) {
      if (k === 'h1' && !slugTouched) { draft.slug = slugify(v); $('#slug').value = draft.slug; }
      if (k === 'h1' && isNew && !draft.title) draft.title = v;
      if (k === 'slug') slugTouched = true;
    });
    mountRte($('[data-m=rte]'), draft, 'inner');
    wireSave(function () {
      if (!draft.title) draft.title = draft.h1.replace(/\*/g, '');
      var list = S.pages.slice();
      if (isNew) list.push(draft); else list[list.indexOf(orig)] = draft;
      return api('PUT', '/api/pages', list).then(function (j) {
        S.pages = j.data; clean(); toast('Sayfa kaydedildi');
        if (isNew || orig.slug !== draft.slug) go('#/pages/' + encodeURIComponent(draft.slug)); else pageEdit(draft.slug);
      });
    });
    var del = $('#del');
    if (del) del.addEventListener('click', function () {
      if (!confirm('Bu sayfa silinsin mi?')) return;
      api('PUT', '/api/pages', S.pages.filter(function (p) { return p !== orig; })).then(function (j) {
        S.pages = j.data; clean(); toast('Sayfa silindi'); refreshGit(); go('#/pages');
      }, fail);
    });
  }

  /* ------------------------------------------------------------------ blog */
  function postList() {
    var ps = S.posts.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    view.innerHTML = topBar('Blog', {
      sub: 'Yayınlanan yazılar sitede “' + esc(S.settings.blog.navLabel) + '” bölümünde görünür.', save: false,
      extra: (ps.some(function (p) { return p.status === 'published'; }) ? '<a class="btn btn--ghost" target="_blank" rel="noopener" href="' + previewUrl('/blog/') + '">Sitede gör ↗</a>' : '') +
        '<a class="btn btn--ink" href="#/blog/new">+ Yeni yazı</a>'
    }) + (ps.length ? '<div class="rows">' + ps.map(function (p) {
      return '<a class="rowlink" href="#/blog/' + encodeURIComponent(p.slug) + '"><span class="rowlink__pic">' + (p.cover && p.cover.src ? '<img src="' + esc(p.cover.src) + '" alt="">' : '') + '</span>' +
        '<span class="rowlink__main"><span class="rowlink__title">' + esc(p.title) + '</span><span class="rowlink__sub">' + esc(niceDate(p.date)) + (p.excerpt ? ' · ' + esc(p.excerpt) : '') + '</span></span>' +
        (p.status === 'published' ? '<span class="pill pill--ok">Yayında</span>' : '<span class="pill pill--warn">Taslak</span>') + '</a>';
    }).join('') + '</div>' : '<div class="empty"><h3>Henüz yazı yok</h3><p>Stil önerileri, bakım ipuçları, koleksiyon hikayeleri…</p><p><a class="btn btn--ink" href="#/blog/new">İlk yazıyı yaz</a></p></div>');
  }

  function postEdit(slug) {
    var isNew = slug === 'new';
    var orig = isNew ? null : S.posts.filter(function (p) { return p.slug === slug; })[0];
    if (!isNew && !orig) { view.innerHTML = '<div class="empty"><h3>Yazı bulunamadı</h3><a href="#/blog">Blog’a dön</a></div>'; return; }
    draft = isNew ? { slug: '', title: '', date: today(), author: 'Sev', status: 'draft', excerpt: '', seoDescription: '', cover: { src: '', alt: '' }, body: '' } : clone(orig);
    if (!draft.cover) draft.cover = { src: '', alt: '' };
    var slugTouched = !isNew;
    function statusExtra() {
      return draft.status === 'published' && !isNew ? '<a class="btn btn--ghost" target="_blank" rel="noopener" href="' + previewUrl('/blog/' + draft.slug) + '">Sitede gör ↗</a>' : '';
    }
    view.innerHTML = topBar(isNew ? 'Yeni yazı' : esc(draft.title), { back: ['#/blog', 'Blog'], extra: statusExtra() }) +
      '<div class="cols"><div class="stack">' +
      '<section class="panel stack">' +
      F('Başlık', '<input class="in" data-k="title" style="font:300 24px/1.3 var(--serif);min-height:52px" placeholder="How to stack rings like a stylist">', 'İtalik vurgu için *kelime*') +
      F('Kısa özet', ta('excerpt', 2), 'Blog listesinde ve başlığın altında görünür.') + '</section>' +
      '<section class="panel"><h2 class="sec">Yazı</h2><p class="sec-sub">Görselleri araç çubuğundan ekleyin ya da metnin içine sürükleyin. Word / Google Docs’tan yapıştırabilirsiniz.</p><div data-m="rte"></div></section>' +
      '</div><div><section class="panel stack"><h2 class="sec">Yayın</h2>' +
      '<label class="switch"><span><b style="font-weight:500">Yayında</b><br><span class="muted small">Kapalıyken taslak olarak saklanır.</span></span><input type="checkbox" id="pub"></label>' +
      '<div class="row">' + F('Tarih', inp('date', 'type="date"')) + F('Yazar', inp('author')) + '</div>' +
      F('Adres', '<div class="prefix"><span>/blog/</span><input class="in" data-k="slug" id="slug"></div>', isNew ? 'Başlıktan otomatik oluşur.' : 'Değiştirirseniz eski bağlantı çalışmaz.') +
      '</section><section class="panel stack"><h2 class="sec">Kapak görseli</h2><div data-m="cover"></div>' + F('Görsel açıklaması', inp('cover.alt')) + '</section>' +
      '<section class="panel stack"><h2 class="sec">Google</h2>' + F('Açıklama', ta('seoDescription', 3), 'Boşsa kısa özet kullanılır.') + '</section>' +
      (isNew ? '' : '<section class="panel"><button class="btn btn--danger btn--block" type="button" id="del">Yazıyı sil</button></section>') +
      '</div></div>';
    bind(view, draft, function (k, v) {
      if (k === 'title' && !slugTouched) { draft.slug = slugify(v.replace(/\*/g, '')); $('#slug').value = draft.slug; }
      if (k === 'slug') slugTouched = true;
    });
    var pub = $('#pub'); pub.checked = draft.status === 'published';
    pub.addEventListener('change', function () { draft.status = pub.checked ? 'published' : 'draft'; markDirty(); });
    mountImage($('[data-m=cover]'), draft, 'cover.src', { wide: true });
    mountRte($('[data-m=rte]'), draft, 'body', { placeholder: 'Yazmaya başlayın…' });
    wireSave(function () {
      if (!draft.title.trim()) throw new Error('Başlık gerekli');
      if (!draft.slug) draft.slug = slugify(draft.title.replace(/\*/g, '')) || 'post';
      var list = S.posts.slice();
      if (isNew) list.push(draft); else list[list.indexOf(orig)] = draft;
      return api('PUT', '/api/posts', list).then(function (j) {
        S.posts = j.data; clean();
        toast(draft.status === 'published' ? 'Kaydedildi — yazı sitede (önizlemede) görünüyor' : 'Taslak kaydedildi');
        if (isNew || orig.slug !== draft.slug) go('#/blog/' + encodeURIComponent(draft.slug)); else postEdit(draft.slug);
      });
    });
    var del = $('#del');
    if (del) del.addEventListener('click', function () {
      if (!confirm('“' + orig.title + '” silinsin mi?')) return;
      api('PUT', '/api/posts', S.posts.filter(function (p) { return p !== orig; })).then(function (j) {
        S.posts = j.data; clean(); toast('Yazı silindi'); refreshGit(); go('#/blog');
      }, fail);
    });
  }

  /* ------------------------------------------------------------------ media */
  function mediaView() {
    view.innerHTML = topBar('Medya', { sub: 'Yüklenen tüm görseller. Kullanılmayanları silebilirsiniz.', save: false }) +
      '<div class="drop" id="mdrop" style="margin-bottom:12px">' + ICON.upload + '<span><b>Görsel yükle</b> — tıklayın ya da sürükleyin</span></div>' +
      '<div class="uploading" hidden id="mstatus"></div><div id="mlist"><p class="muted">Yükleniyor…</p></div>';
    function load() {
      api('GET', '/api/uploads').then(function (items) {
        var unused = items.filter(function (m) { return !m.used; }).length;
        $('#mlist').innerHTML = items.length ? '<p class="muted small" style="margin:0 0 10px">' + items.length + ' görsel' + (unused ? ' · ' + unused + ' tanesi kullanılmıyor' : '') + '</p><div class="mgrid">' + items.map(function (m) {
          return '<div class="mitem"><a class="mitem__pic" href="' + esc(m.src) + '" target="_blank" rel="noopener"><img src="' + esc(m.src) + '" alt="" loading="lazy"></a>' +
            '<span class="mitem__name" title="' + esc(m.name) + '">' + esc(m.name) + '</span><span class="mitem__foot"><span class="small muted">' + kb(m.size) + '</span>' +
            (m.used ? '<span class="pill pill--ok">Kullanılıyor</span>' : '<button type="button" class="btn btn--sm btn--danger" data-del="' + esc(m.name) + '">Sil</button>') + '</span></div>';
        }).join('') + '</div>' : '<div class="empty"><h3>Henüz görsel yok</h3></div>';
      }, fail);
    }
    function add(files) { if (files.length) uploadMany(files, $('#mstatus')).then(function (r) { if (r.length) toast(r.length + ' görsel yüklendi'); load(); }); }
    $('#mdrop').addEventListener('click', function () { pickFiles(true).then(add); });
    dropzone($('#mdrop'), add);
    $('#mlist').addEventListener('click', function (e) {
      var b = e.target.closest('[data-del]'); if (!b) return;
      if (!confirm('Bu görsel kalıcı olarak silinsin mi?')) return;
      api('DELETE', '/api/uploads?name=' + encodeURIComponent(b.dataset.del)).then(function () { toast('Silindi'); refreshGit(); load(); }, fail);
    });
    load();
  }

  /* ------------------------------------------------------------------ publish */
  function refreshGit() {
    return api('GET', '/api/git').then(function (g) {
      var c = $('#publish-count'), n = g.available ? g.changes.length : 0;
      c.hidden = !n; c.textContent = n;
      return g;
    }, function () { return { available: false }; });
  }
  $('#publish-btn').addEventListener('click', function () {
    if (dirty && !confirm('Bu ekranda kaydedilmemiş değişiklikler var; bunlar yayınlanmayacak. Devam edilsin mi?')) return;
    refreshGit().then(function (g) {
      if (!g.available) {
        openModal('<h2>Yayınlama kullanılamıyor</h2><p>Bu klasör bir git deposu değil ya da git kurulu değil. ' + esc(g.error || '') + '</p><div class="modal__foot"><button class="btn" data-x>Kapat</button></div>');
        $('[data-x]', modalEl).onclick = closeModal; return;
      }
      var warn = g.branch !== 'main' ? '<p class="pill pill--warn" style="display:inline-flex;margin:0 0 10px">Şu an “' + esc(g.branch) + '” dalındasınız. Netlify yalnızca main dalını canlıya alır.</p>' : '';
      var box = openModal('<h2>Canlı siteye gönder</h2>' + warn +
        '<p class="muted">Kaydedilmiş tüm değişiklikler GitHub’a gönderilir; Netlify birkaç dakika içinde eclatbysev.com’u günceller.</p>' +
        (g.changes.length ? '<div class="changes">' + g.changes.map(esc).join('<br>') + '</div>' +
          F('Ne değişti? (kısa not)', '<input class="in" id="msg" placeholder="Örn. Yeni küpe eklendi, blog yazısı">')
          : '<p><span class="pill pill--ok">Yayınlanacak yeni değişiklik yok.</span> İsterseniz yine de GitHub ile eşitleyebilirsiniz.</p>') +
        '<p class="muted small">Son yayın: ' + esc(g.last || '—') + '</p><div id="plog"></div>' +
        '<div class="modal__foot"><button class="btn" data-x type="button">Vazgeç</button><button class="btn btn--ink" data-go type="button">' + (g.changes.length ? 'Yayınla' : 'Eşitle') + '</button></div>');
      $('[data-x]', box).onclick = closeModal;
      $('[data-go]', box).onclick = function () {
        var b = this; b.disabled = true; b.textContent = 'Gönderiliyor…';
        api('POST', '/api/publish', { message: ($('#msg', box) || {}).value || '' }).then(function () {
          closeModal(); toast('Yayınlandı! Site birkaç dakika içinde güncellenir.'); refreshGit();
        }, function (e) {
          b.disabled = false; b.textContent = 'Tekrar dene';
          $('#plog', box).innerHTML = '<div class="log">' + esc(e.message) + '</div>';
        });
      };
    });
  });

  /* ------------------------------------------------------------------ router */
  var lastHash = location.hash, skipNext = false;
  function go(hash) { clean(); if (location.hash === hash) route(); else location.hash = hash; }
  function route() {
    var parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
    var sec = parts[0] || 'products', id = parts[1];
    $$('#nav a').forEach(function (a) { a.classList.toggle('is-on', a.dataset.nav === sec); });
    clean(); saveFn = null; draft = null;
    var r = {
      products: id ? productEdit : productList, home: homeEdit, pages: id ? pageEdit : pageList,
      blog: id ? postEdit : postList, media: mediaView
    }[sec] || productList;
    r(id);
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', function () {
    if (skipNext) { skipNext = false; return; }
    if (dirty && !confirm('Kaydedilmemiş değişiklikler var. Sayfadan çıkılsın mı?')) { skipNext = true; location.hash = lastHash; return; }
    lastHash = location.hash; route();
  });
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (saveFn) saveFn(); }
  });

  api('GET', '/api/state').then(function (s) {
    S = s;
    $('#preview-link').href = previewUrl('/');
    route(); refreshGit();
  }, function (e) {
    view.innerHTML = '<div class="empty"><h3>Admin sunucusuna bağlanılamadı</h3><p>' + esc(e.message) + '</p></div>';
  });
})();
