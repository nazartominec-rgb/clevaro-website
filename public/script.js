(function () {
  'use strict';
  var ENDPOINT = '/.netlify/functions/submit-quote';
  var SEND_TIMEOUT_MS = 20000;

  function $(id) { return document.getElementById(id); }
  function on(el, type, fn, opts) { if (el) el.addEventListener(type, fn, opts); }

  // Obrazy: brak pliku -> usuń <img>, zostaje placeholder
  document.querySelectorAll('.photo img').forEach(function (img) {
    function drop() { img.remove(); }
    img.addEventListener('error', drop);
    if (img.complete && img.naturalWidth === 0) drop();
  });

  // Menu mobilne
  var burger = document.querySelector('.burger'), menu = $('menu');
  function setMenu(open) {
    if (!burger || !menu) return;
    menu.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  on(burger, 'click', function () { if (menu) setMenu(!menu.classList.contains('open')); });
  on(menu, 'click', function (e) { if (e.target.closest && e.target.closest('a')) setMenu(false); });

  // Szybki kontakt
  var fab = $('fab'), fb = fab ? fab.querySelector('.fab-main') : null;
  function setFab(open) {
    if (!fab || !fb) return;
    fab.classList.toggle('open', open);
    fb.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  on(fb, 'click', function () { setFab(!fab.classList.contains('open')); });
  on(fab, 'click', function (e) { if (e.target.closest && e.target.closest('a')) setFab(false); });
  document.addEventListener('click', function (e) { if (fab && !fab.contains(e.target)) setFab(false); });

  var hd = document.querySelector('header');
  if (hd) window.addEventListener('scroll', function () { hd.classList.toggle('sc', window.scrollY > 10); }, { passive: true });

  // Animacje przy przewijaniu
  var els = document.querySelectorAll('.rv');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } });
    }, { threshold: .12 });
    els.forEach(function (el) { io.observe(el); });
  } else { els.forEach(function (el) { el.classList.add('in'); }); }

  var yr = $('yr');
  if (yr) yr.textContent = new Date().getFullYear();

  // Preferencje prywatności. Obecnie brak aktywnych narzędzi analitycznych i marketingowych.
  var CONSENT_KEY = 'clevaro-privacy-choice-v1';
  var banner = $('cookie-banner');
  var modal = $('cookie-modal');
  var storedChoice = null;
  var lastFocus = null;
  try { storedChoice = localStorage.getItem(CONSENT_KEY); } catch (e) {}

  function closeCookieModal() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    if (lastFocus && document.contains(lastFocus) && typeof lastFocus.focus === 'function') lastFocus.focus();
    lastFocus = null;
  }
  function openCookieModal() {
    if (!modal) return;
    lastFocus = document.activeElement;
    modal.hidden = false;
    var first = $('cookie-close') || modal.querySelector('button');
    if (first) first.focus();
  }
  function saveChoice(choice) {
    try { localStorage.setItem(CONSENT_KEY, JSON.stringify({ necessary: true, analytics: false, marketing: false, choice: choice, savedAt: new Date().toISOString() })); } catch (e) {}
    if (banner) banner.hidden = true;
    closeCookieModal();
  }
  if (banner && !storedChoice) banner.hidden = false;

  on($('cookie-accept'), 'click', function () { saveChoice('all-currently-available'); });
  on($('cookie-reject'), 'click', function () { saveChoice('necessary-only'); });
  on($('cookie-settings'), 'click', openCookieModal);
  on($('open-cookie-settings'), 'click', openCookieModal);
  on($('cookie-modal-reject'), 'click', function () { saveChoice('necessary-only'); });
  on($('cookie-save'), 'click', function () { saveChoice('custom'); });
  on($('cookie-close'), 'click', closeCookieModal);
  on(modal, 'click', function (e) { if (e.target === modal) closeCookieModal(); });

  // Klawiatura: Esc zamyka okno cookies, menu i szybki kontakt; Tab nie opuszcza otwartego okna cookies
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (modal && !modal.hidden) { closeCookieModal(); return; }
      if (menu && menu.classList.contains('open')) { setMenu(false); if (burger) burger.focus(); }
      if (fab && fab.classList.contains('open')) { setFab(false); if (fb) fb.focus(); }
      return;
    }
    if (e.key === 'Tab' && modal && !modal.hidden) {
      var f = modal.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // Formularz
  var form = $('quote');
  if (!form) return;
  var okBox = form.querySelector('.ok'), failBox = form.querySelector('.fail');
  var btn = form.querySelector('button[type=submit]');
  var loadedAt = Date.now();   // czas wypełniania liczymy lokalnie (bez porównywania zegara klienta z zegarem serwera)
  var sending = false;

  function show(box, msg) { if (!box) return; if (msg) box.textContent = msg; box.style.display = 'block'; }
  function hide(box) { if (box) box.style.display = 'none'; }

  var rules = {
    name: function (v) { return v.trim().length >= 2 || 'Podaj imię (min. 2 znaki).'; },
    company: function (v) { return v.trim().length >= 2 || 'Podaj nazwę firmy.'; },
    phone: function (v) { return /^\+?[0-9 ()-]{9,17}$/.test(v.trim()) || 'Podaj poprawny numer telefonu.'; },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || 'Podaj poprawny adres e-mail.'; },
    area: function (v) { v = v.trim(); return (/^\d{1,7}([.,]\d{1,2})?$/.test(v) && parseFloat(v.replace(',', '.')) > 0) || 'Podaj powierzchnię w m².'; },
    type: function (v) { return v !== '' || 'Wybierz rodzaj obiektu.'; }
  };
  // tylko pola, które faktycznie istnieją w DOM
  var ids = Object.keys(rules).filter(function (id) {
    var el = $(id);
    return el && el.closest('.f') && el.closest('.f').querySelector('.err');
  });
  ids.forEach(function (id) {
    var el = $(id), err = el.closest('.f').querySelector('.err');
    err.id = id + '-err';
    el.setAttribute('aria-describedby', err.id);
  });
  function check(id) {
    var el = $(id), f = el.closest('.f'), r = rules[id](el.value), ok = r === true;
    f.classList.toggle('bad', !ok);
    f.querySelector('.err').textContent = ok ? '' : r;
    el.setAttribute('aria-invalid', ok ? 'false' : 'true');
    return ok;
  }
  ids.forEach(function (id) { on($(id), 'blur', function () { check(id); }); });

  on(form, 'submit', function (e) {
    e.preventDefault();
    if (sending) return;                       // blokada podwójnego wysłania
    hide(okBox); hide(failBox);
    var valid = ids.map(check).every(Boolean);
    if (!valid) {
      var b = form.querySelector('.bad');
      if (b) {
        var inp = b.querySelector('input,select,textarea');
        if (inp) inp.focus({ preventScroll: true });
        b.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      return;
    }
    var data = Object.fromEntries(new FormData(form).entries());
    data._e = String(Date.now() - loadedAt);   // czas wypełniania (ms) – weryfikowany na serwerze
    sending = true;
    var label = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Wysyłanie…'; }

    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, SEND_TIMEOUT_MS);

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: ctrl ? ctrl.signal : undefined
    })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, body: j || {} }; }); })
      .then(function (res) {
        if (res.status === 200 && res.body.ok) {
          show(okBox); form.reset(); loadedAt = Date.now();
          if (okBox) okBox.scrollIntoView({ block: 'center', behavior: 'smooth' });
        } else {
          var msg = res.status === 429 ? 'Zbyt wiele prób. Spróbuj ponownie za kilka minut.'
            : res.status === 400 && res.body.error ? res.body.error
            : 'Nie udało się wysłać zapytania. Spróbuj ponownie lub skontaktuj się z nami bezpośrednio.';
          show(failBox, msg);
        }
      })
      .catch(function (err) {
        show(failBox, err && err.name === 'AbortError'
          ? 'Serwer nie odpowiedział na czas. Spróbuj ponownie lub skontaktuj się z nami bezpośrednio.'
          : 'Błąd połączenia. Sprawdź internet i spróbuj ponownie.');
      })
      .then(function () {
        clearTimeout(timer);
        sending = false;
        if (btn) { btn.disabled = false; btn.textContent = label; }
      });
  });
})();
