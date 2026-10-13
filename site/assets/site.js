(function () {
  // Mobile menu
  var menu = document.getElementById('mobile-menu');
  var openBtn = document.querySelector('[data-menu-open]');
  var closeBtn = document.querySelector('[data-menu-close]');
  function setMenu(open) {
    if (!menu) return;
    menu.hidden = !open;
    if (openBtn) openBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.style.overflow = open ? 'hidden' : '';
    document.body.classList.toggle('menu-open', open);
    if (open && closeBtn) closeBtn.focus();
    if (!open && openBtn) openBtn.focus();
  }
  if (openBtn) openBtn.addEventListener('click', function () { setMenu(true); });
  if (closeBtn) closeBtn.addEventListener('click', function () { setMenu(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menu && !menu.hidden) setMenu(false);
  });

  // Shop filters
  var chips = document.querySelectorAll('[data-filter]');
  if (chips.length) {
    var cards = document.querySelectorAll('[data-cat]');
    var heading = document.getElementById('shop-heading');
    var count = document.getElementById('shop-count');
    var sortSel = document.getElementById('sort');
    var gridEl = document.getElementById('shop-grid');
    function apply(cat) {
      var n = 0;
      chips.forEach(function (c) { c.setAttribute('aria-pressed', c.dataset.filter === cat ? 'true' : 'false'); });
      cards.forEach(function (card) {
        var show = cat === 'all' || card.dataset.cat === cat || (card.dataset.tags || '').split(' ').indexOf(cat) > -1;
        card.hidden = !show;
        if (show) n++;
      });
      var active = document.querySelector('[data-filter="' + cat + '"]');
      if (heading) heading.textContent = cat === 'all' ? 'Shop all' : (active ? active.textContent : 'Shop all');
      if (count) count.textContent = n + (n === 1 ? ' piece' : ' pieces');
    }
    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        apply(c.dataset.filter);
        var url = new URL(window.location.href);
        if (c.dataset.filter === 'all') url.searchParams.delete('category'); else url.searchParams.set('category', c.dataset.filter);
        history.replaceState(null, '', url);
      });
    });
    if (sortSel && gridEl) {
      sortSel.addEventListener('change', function () {
        var items = Array.prototype.slice.call(gridEl.children);
        items.sort(function (a, b) {
          var v = sortSel.value;
          if (v === 'low') return a.dataset.price - b.dataset.price;
          if (v === 'high') return b.dataset.price - a.dataset.price;
          return a.dataset.order - b.dataset.order;
        });
        items.forEach(function (i) { gridEl.appendChild(i); });
      });
    }
    var start = new URLSearchParams(window.location.search).get('category') || 'all';
    if (!document.querySelector('[data-filter="' + start + '"]')) start = 'all';
    apply(start);
  }

  // Product page
  var thumbs = document.querySelectorAll('[data-thumb]');
  var main = document.getElementById('gallery-main');
  thumbs.forEach(function (t) {
    t.addEventListener('click', function () {
      thumbs.forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
      t.setAttribute('aria-pressed', 'true');
      if (main) main.className = 'ph gallery__main ' + t.dataset.thumb;
      var mainImg = document.getElementById('gallery-img');
      if (mainImg && t.dataset.src && mainImg.getAttribute('src') !== t.dataset.src) {
        mainImg.classList.add('is-swapping');
        var next = new Image();
        next.onload = next.onerror = function () {
          mainImg.src = t.dataset.src;
          mainImg.alt = t.dataset.alt || '';
          mainImg.classList.remove('is-swapping');
        };
        next.src = t.dataset.src;
      }
    });
  });

  var sizeBtns = document.querySelectorAll('[data-size]');
  var orderLinks = document.querySelectorAll('[data-order]');
  var sizeLabel = document.getElementById('size-label');
  function updateOrder(size) {
    orderLinks.forEach(function (a) {
      var name = a.dataset.order;
      var body = 'Hello Éclat,%0D%0A%0D%0AI would like to order: ' + encodeURIComponent(name) + (size ? ' — size EU ' + size : '') + '%0D%0A%0D%0AName:%0D%0AAddress:%0D%0A';
      a.href = 'mailto:info@eclatbysev.com?subject=' + encodeURIComponent('Order: ' + name) + '&body=' + body;
      if (sizeBtns.length) {
        var ok = !!size;
        a.setAttribute('aria-disabled', ok ? 'false' : 'true');
        a.classList.toggle('is-off', !ok);
        a.textContent = ok ? 'Order by email · EU ' + size : 'Select a size';
      }
    });
  }
  sizeBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      sizeBtns.forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', 'true');
      if (sizeLabel) sizeLabel.textContent = '· EU ' + b.dataset.size;
      updateOrder(b.dataset.size);
    });
  });
  orderLinks.forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (a.getAttribute('aria-disabled') === 'true') {
        e.preventDefault();
        var first = document.querySelector('[data-size]');
        if (first) first.focus();
      }
    });
  });
  if (orderLinks.length) updateOrder('');
  /* ------------------------------------------------------------------
     v2 motion & ergonomics layer
  ------------------------------------------------------------------ */
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // Header: shrink + glass on scroll. Dock: hide while scrolling down, show on up.
  var header = document.querySelector('[data-header]');
  var dock = document.querySelector('.dock');
  var lastY = window.scrollY, ticking = false;
  function onScroll() {
    var y = window.scrollY;
    if (header) header.classList.toggle('is-scrolled', y > 24);
    if (dock) {
      var down = y > lastY + 4, up = y < lastY - 4;
      if (down && y > 240) dock.classList.add('is-hidden');
      else if (up || y < 240) dock.classList.remove('is-hidden');
    }
    if (header) document.documentElement.style.setProperty('--header-h', header.offsetHeight + 'px');
    lastY = y; ticking = false;
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  // Dock: mark current page
  if (dock) {
    var path = location.pathname.replace(/\/$/, '') || '/';
    var key = path === '/' ? (location.hash === '#collections' ? 'collections' : 'home') : (path.indexOf('/shop') === 0 ? 'shop' : '');
    var cur = key && dock.querySelector('[data-dock="' + key + '"]');
    if (cur) cur.setAttribute('aria-current', 'page');
  }

  // Scroll reveals (sections, cards, line-by-line text)
  var revealEls = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    revealEls.forEach(function (el, i) {
      // gentle stagger for siblings in grids
      if (!el.style.getPropertyValue('--d') && el.classList.contains('card')) {
        var idx = Array.prototype.indexOf.call(el.parentNode.children, el);
        el.style.setProperty('--d', (idx % 4) * 0.08 + 's');
      }
      io.observe(el);
    });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-in'); });
  }

  // Product cards: press-to-reveal second angle on touch
  if (!finePointer) {
    document.querySelectorAll('.card').forEach(function (c) {
      c.addEventListener('touchstart', function () { c.classList.add('is-pressed'); }, { passive: true });
      ['touchend', 'touchcancel', 'touchmove'].forEach(function (t) {
        c.addEventListener(t, function () { setTimeout(function () { c.classList.remove('is-pressed'); }, 450); }, { passive: true });
      });
    });
  }

  // Magnetic CTAs + gold glow that follows the pointer
  if (finePointer && !reduce) {
    document.querySelectorAll('[data-magnetic]').forEach(function (b) {
      var strength = 0.22, max = 8;
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        b.style.setProperty('--mx', Math.max(-max, Math.min(max, dx * strength)) + 'px');
        b.style.setProperty('--my', Math.max(-max, Math.min(max, dy * strength)) + 'px');
        b.style.setProperty('--gx', (e.clientX - r.left) + 'px');
        b.style.setProperty('--gy', (e.clientY - r.top) + 'px');
      });
      b.addEventListener('pointerleave', function () { b.style.setProperty('--mx', '0px'); b.style.setProperty('--my', '0px'); });
    });
  }

  // Hero hotspots + Quick View
  var spots = document.querySelectorAll('.spot__btn');
  var openSpot = null, hoverTimer = null;
  function closeQV(btn, focusBack) {
    if (!btn) return;
    var qv = document.getElementById(btn.getAttribute('aria-controls'));
    btn.setAttribute('aria-expanded', 'false');
    qv.classList.remove('is-open');
    setTimeout(function () { if (btn.getAttribute('aria-expanded') === 'false') qv.hidden = true; }, 350);
    btn.dataset.pinned = '';
    if (focusBack) btn.focus();
    if (openSpot === btn) openSpot = null;
  }
  function openQV(btn) {
    if (openSpot && openSpot !== btn) closeQV(openSpot);
    var qv = document.getElementById(btn.getAttribute('aria-controls'));
    qv.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(function () { requestAnimationFrame(function () { qv.classList.add('is-open'); }); });
    openSpot = btn;
  }
  spots.forEach(function (btn) {
    var qv = document.getElementById(btn.getAttribute('aria-controls'));
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = btn.getAttribute('aria-expanded') === 'true';
      if (isOpen && btn.dataset.pinned) { btn.dataset.pinned = ''; closeQV(btn); return; }
      openQV(btn); btn.dataset.pinned = '1';
      var first = qv.querySelector('a'); if (first && e.detail === 0) first.focus();
    });
    if (finePointer) {
      btn.addEventListener('mouseenter', function () { clearTimeout(hoverTimer); openQV(btn); });
      [btn, qv].forEach(function (el) {
        el.addEventListener('mouseleave', function () { hoverTimer = setTimeout(function () { if (!btn.dataset.pinned && !qv.matches(':hover') && !btn.matches(':hover')) closeQV(btn); }, 220); });
        el.addEventListener('mouseenter', function () { clearTimeout(hoverTimer); });
      });
    }
    qv.querySelector('.qv__close').addEventListener('click', function () { closeQV(btn, true); });
    qv.addEventListener('click', function (e) { e.stopPropagation(); });
  });
  document.addEventListener('click', function () { if (openSpot) closeQV(openSpot); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && openSpot) closeQV(openSpot, true); });
})();
