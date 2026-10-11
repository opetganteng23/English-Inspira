/* English Inspira, shell bersama: preferensi peserta (uiPrefs), header, toast.
   Prototipe menyimpan uiPrefs di localStorage; di produksi: GET/PATCH /api/me/ui-prefs. */
(function () {
  var KEY = 'ei.prefs';
  var DEF = { theme: 'system', fontSize: 18, reduceMotion: false, timerDefault: 'shown',
              breakReminder: true, breakMin: 45, digest: 'daily', quietStart: '21:00', quietEnd: '07:00' };

  function load() { try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return Object.assign({}, DEF); } }
  function save(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} }
  function apply(p) {
    var r = document.documentElement;
    if (p.theme === 'system') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', p.theme);
    r.style.setProperty('--fs-read', p.fontSize + 'px');
    if (p.reduceMotion) r.setAttribute('data-motion', 'reduce'); else r.removeAttribute('data-motion');
  }

  var EI = { DEF: DEF, load: load, save: save, apply: apply, prefs: load() };
  apply(EI.prefs);

  EI.toast = function (msg) {
    var w = document.querySelector('.toast-wrap');
    if (!w) { w = document.createElement('div'); w.className = 'toast-wrap'; w.setAttribute('role', 'status'); document.body.appendChild(w); }
    var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; w.appendChild(t);
    setTimeout(function () { t.remove(); }, 3200);
  };

  var ICONS = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/>',
    learn: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 5.5V21"/>',
    tests: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 11h6M9 15h4"/>',
    coaching: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    counselor: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
    profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>'
  };
  var NAV = [
    ['home', 'Home', '04-home.html'], ['learn', 'Learn', '05-learn.html'], ['tests', 'Tests', '01-test-prepare.html'],
    ['coaching', 'Coaching', '06-coaching.html'], ['counselor', 'Counselor', '07-counselor.html'], ['profile', 'Profile', '09-profile.html']
  ];

  document.addEventListener('DOMContentLoaded', function () {
    var b = document.body;
    if (b.dataset.shell === 'off') return;
    b.dataset.shell = 'on';
    var cur = b.dataset.page || '';
    var nav = NAV.map(function (n) {
      return '<a href="' + n[2] + '"' + (n[0] === cur ? ' aria-current="page"' : '') + '>' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[n[0]] + '</svg><span>' + n[1] + '</span></a>';
    }).join('');
    var h = document.createElement('header'); h.className = 'app-header';
    h.innerHTML = '<div class="app-header-in"><a class="logo" href="04-home.html" aria-label="English Inspira home">' +
      '<img src="assets/logo-full.png" alt="English Inspira" width="93" height="38"></a>' +
      '<nav class="app-nav" aria-label="Main">' + nav + '</nav></div>';
    b.insertBefore(h, b.firstChild);
  });

  window.EI = EI;
})();
