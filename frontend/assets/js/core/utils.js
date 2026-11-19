/**
 * CE.util — small, dependency-free helpers shared by every page:
 * escaping, URL helpers, date/time formatting, CSV export, flash messages.
 */
(function (w) {
  'use strict';
  var CE = w.CE;

  var util = {};

  /* ---------------- Safety ---------------- */

  /** Escape a value for safe interpolation into HTML strings. */
  util.esc = function (value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  util.safeStorage = {
    get: function (store, key) { try { return store.getItem(key); } catch (e) { return null; } },
    set: function (store, key, val) { try { store.setItem(key, val); return true; } catch (e) { return false; } },
    remove: function (store, key) { try { store.removeItem(key); } catch (e) { /* ignore */ } }
  };

  /* ---------------- URLs ---------------- */

  /** Build an app-relative URL that works from any folder depth. */
  util.url = function (path) { return CE.config.APP_ROOT + String(path || '').replace(/^\/+/, ''); };
  util.go = function (path) { w.location.href = util.url(path); };
  util.param = function (name) { return new URLSearchParams(w.location.search).get(name); };

  /** Path of the current page relative to the app root (used for ?next=). */
  util.currentPath = function () {
    var full = w.location.href.split('#')[0];
    return full.indexOf(CE.config.APP_ROOT) === 0 ? full.slice(CE.config.APP_ROOT.length) : 'dashboard.html';
  };

  /** Only allow redirecting to a relative in-app page (prevents open redirects). */
  util.safeNext = function (next) {
    if (!next) return null;
    if (/^[a-z0-9_\-/]+\.html(\?[^#]*)?$/i.test(next) && next.indexOf('//') === -1) return next;
    return null;
  };

  /* ---------------- Dates ---------------- */

  function d(v) { var x = v instanceof Date ? v : new Date(v); return isNaN(x.getTime()) ? null : x; }
  util.toDate = d;

  util.formatDate = function (v) { var x = d(v); return x ? x.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '—'; };
  util.formatDateYear = function (v) { var x = d(v); return x ? x.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'; };
  util.formatLongDate = function (v) { var x = d(v); return x ? x.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '—'; };
  util.formatTime = function (v) { var x = d(v); return x ? x.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''; };
  util.formatMonthYear = function (v) { var x = d(v); return x ? x.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'; };
  util.monthShort = function (v) { var x = d(v); return x ? x.toLocaleDateString('en-US', { month: 'short' }).toUpperCase() : '—'; };
  util.dayNum = function (v) { var x = d(v); return x ? String(x.getDate()).padStart(2, '0') : '--'; };

  util.formatDateTime = function (v) { var x = d(v); return x ? util.formatDate(x) + ' · ' + util.formatTime(x) : '—'; };

  /** "Sat, Nov 28 · 8:00 AM – 12:00 PM" (or a two-date range when it spans days). */
  util.formatRange = function (start, end) {
    var s = d(start), e = d(end);
    if (!s) return 'Date to be announced';
    if (!e) return util.formatDateTime(s);
    if (s.toDateString() === e.toDateString()) return util.formatDate(s) + ' · ' + util.formatTime(s) + ' – ' + util.formatTime(e);
    return util.formatDateTime(s) + ' – ' + util.formatDateTime(e);
  };

  /** "4 hours", "1 h 30 min", "2 days" */
  util.durationBetween = function (start, end) {
    var s = d(start), e = d(end);
    if (!s || !e || e <= s) return '';
    var mins = Math.round((e - s) / 60000);
    if (mins >= 2 * 1440) return Math.round(mins / 1440) + ' days';
    var h = Math.floor(mins / 60), m = mins % 60;
    if (!h) return m + ' min';
    if (!m) return h + (h === 1 ? ' hour' : ' hours');
    return h + ' h ' + m + ' min';
  };

  /** "just now", "5 min ago", "3 hr ago", "Yesterday", "Nov 12" */
  util.relative = function (v) {
    var x = d(v); if (!x) return '';
    var diff = (Date.now() - x.getTime()) / 1000;
    if (diff < 45) return 'just now';
    if (diff < 3600) return Math.round(diff / 60) + ' min ago';
    if (diff < 86400) return Math.round(diff / 3600) + ' hr ago';
    if (diff < 172800) return 'Yesterday';
    if (diff < 7 * 86400) return Math.round(diff / 86400) + ' days ago';
    return util.formatDateYear(x);
  };

  /** Seconds → "2:45" / "1:02:09" */
  util.formatDuration = function (sec) {
    if (!isFinite(sec) || sec < 0) return '--:--';
    sec = Math.floor(sec);
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
  };

  /** ISO → value for <input type="datetime-local"> in the user's timezone. */
  util.toLocalInput = function (v) {
    var x = d(v); if (!x) return '';
    var off = x.getTimezoneOffset() * 60000;
    return new Date(x.getTime() - off).toISOString().slice(0, 16);
  };

  /** upcoming | ongoing | past, based on starts_at / ends_at. */
  util.eventStatus = function (ev) {
    var now = Date.now(), s = d(ev.starts_at), e = d(ev.ends_at) || s;
    if (e && e.getTime() < now) return 'past';
    if (s && s.getTime() <= now) return 'ongoing';
    return 'upcoming';
  };

  util.isSameDay = function (a, b) { return a.toDateString() === b.toDateString(); };

  /* ---------------- Text / numbers ---------------- */

  util.initials = function (name) {
    var parts = String(name || '?').trim().split(/\s+/);
    return ((parts[0] || '')[0] + ((parts.length > 1 ? parts[parts.length - 1][0] : '') || '')).toUpperCase();
  };
  util.firstName = function (name) { return String(name || '').trim().split(/\s+/)[0] || 'there'; };
  util.plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); };
  util.num = function (v) { var n = Number(v); return isFinite(n) ? n : 0; };
  util.formatNumber = function (v) { return util.num(v).toLocaleString('en-US'); };
  util.formatBytes = function (b) {
    if (!b && b !== 0) return '';
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(0) + ' KB';
    return (b / 1024 / 1024).toFixed(1) + ' MB';
  };
  util.truncate = function (s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };

  /** Stable hash → used to pick a deterministic fallback gradient per item. */
  util.hash = function (str) {
    var h = 0; str = String(str || '');
    for (var i = 0; i < str.length; i++) { h = ((h << 5) - h + str.charCodeAt(i)) | 0; }
    return Math.abs(h);
  };

  var GRADIENTS = [
    'from-blue-700 via-blue-600 to-sky-400',
    'from-emerald-700 via-emerald-600 to-emerald-400',
    'from-amber-700 via-amber-500 to-yellow-400',
    'from-sky-800 via-sky-600 to-sky-300',
    'from-rose-800 via-rose-600 to-pink-400',
    'from-slate-700 via-slate-500 to-slate-300',
    'from-indigo-800 via-indigo-600 to-violet-400',
    'from-teal-800 via-teal-600 to-teal-300'
  ];
  util.gradientFor = function (key) { return 'bg-gradient-to-br ' + GRADIENTS[util.hash(key) % GRADIENTS.length]; };

  util.debounce = function (fn, ms) {
    var t; return function () { var ctx = this, args = arguments; clearTimeout(t); t = setTimeout(function () { fn.apply(ctx, args); }, ms); };
  };

  /** Case-insensitive "does any field contain the query" matcher. */
  util.matches = function (query, fields) {
    var q = String(query || '').trim().toLowerCase();
    if (!q) return true;
    return fields.some(function (f) { return String(f || '').toLowerCase().indexOf(q) !== -1; });
  };

  util.fileExt = function (name) { var m = /\.([a-z0-9]+)$/i.exec(name || ''); return m ? m[1].toLowerCase() : ''; };

  /* ---------------- Files / downloads ---------------- */

  util.download = function (filename, content, mime) {
    var blob = new Blob([content], { type: mime || 'text/plain' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  };

  /** columns: [{ key, label, value?(row) }] */
  util.toCSV = function (rows, columns) {
    function cell(v) { v = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    var head = columns.map(function (c) { return cell(c.label); }).join(',');
    var body = rows.map(function (r) { return columns.map(function (c) { return cell(c.value ? c.value(r) : r[c.key]); }).join(','); });
    return [head].concat(body).join('\n');
  };

  /** Build an .ics file so users can add an event to their calendar. */
  util.toICS = function (ev, pageUrl) {
    function stamp(v) { var x = d(v); return x ? x.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '') : ''; }
    function txt(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;'); }
    return [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CivicConnect//Events//EN', 'BEGIN:VEVENT',
      'UID:' + ev.id + '@civicconnect', 'DTSTAMP:' + stamp(new Date()),
      'DTSTART:' + stamp(ev.starts_at), 'DTEND:' + stamp(ev.ends_at || ev.starts_at),
      'SUMMARY:' + txt(ev.title), 'LOCATION:' + txt(ev.location),
      'DESCRIPTION:' + txt((ev.description || '') + (pageUrl ? '\n' + pageUrl : '')),
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
  };

  /* ---------------- Flash messages (toast after redirect) ---------------- */

  util.flash = {
    set: function (type, title, message) {
      util.safeStorage.set(w.sessionStorage, 'ce.flash', JSON.stringify({ type: type, title: title, message: message }));
    },
    consume: function () {
      var raw = util.safeStorage.get(w.sessionStorage, 'ce.flash');
      if (!raw) return null;
      util.safeStorage.remove(w.sessionStorage, 'ce.flash');
      try { return JSON.parse(raw); } catch (e) { return null; }
    }
  };

  CE.util = util;
})(window);
