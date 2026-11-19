/**
 * CE.auth — global auth context.
 * ------------------------------------------------------------------
 * Holds { token, user: { id, full_name, email, role } } for the whole app and
 * exposes the client-side ROLE GUARDS used by every page.
 *
 * Token storage rules
 *   - "Keep me signed in" checked   → localStorage  (survives browser restarts;
 *     trade-off: readable by any script on this origin, so XSS could steal it —
 *     we mitigate by escaping all rendered data with CE.util.esc).
 *   - unchecked (default)            → sessionStorage (cleared when the tab/browser closes).
 *
 * The backend issues JWTs that expire after 1 hour. We decode the `exp` claim
 * and schedule an automatic sign-out with a "session expired" message; any 401
 * from the API also triggers the same flow (see core/api.js).
 *
 * SECURITY NOTE: these guards only shape the UX (hide/show controls, redirect).
 * Real enforcement happens on the backend via authenticate() + authorize(['admin']).
 */
(function (w) {
  'use strict';
  var CE = w.CE, util = CE.util;

  var KEY = 'ce.session';
  var listeners = [];
  var expiryTimer = null;

  function read(store) {
    var raw = util.safeStorage.get(store, KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  /** Decode the JWT payload (no signature check — that's the server's job). */
  function decodeJwt(token) {
    try {
      var part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      while (part.length % 4) part += '=';
      return JSON.parse(w.atob(part));
    } catch (e) { return null; }
  }

  function emit() {
    var s = auth.getSession();
    listeners.forEach(function (fn) { try { fn(s); } catch (e) { /* listener error */ } });
  }

  var auth = {
    getSession: function () { return read(w.sessionStorage) || read(w.localStorage); },
    token: function () { var s = auth.getSession(); return s ? s.token : null; },
    user: function () { var s = auth.getSession(); return s ? s.user : null; },
    role: function () { var u = auth.user(); return u ? u.role : null; },
    isPersistent: function () { var s = auth.getSession(); return !!(s && s.persist); },

    /** ROLE CHECK: true only for users whose role (from the login response) is "admin". */
    isAdmin: function () { return auth.role() === 'admin'; },

    expiresAt: function () {
      var t = auth.token(); if (!t) return null;
      var p = decodeJwt(t);
      return p && p.exp ? p.exp * 1000 : null;
    },
    isExpired: function () { var e = auth.expiresAt(); return !!(e && Date.now() >= e); },
    isAuthenticated: function () { return !!auth.token() && !auth.isExpired(); },

    /** Persist the session after a successful login. */
    save: function (token, user, remember) {
      auth.clear(true);
      var payload = JSON.stringify({
        token: token,
        user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role },
        persist: !!remember,
        saved_at: new Date().toISOString()
      });
      util.safeStorage.set(remember ? w.localStorage : w.sessionStorage, KEY, payload);
      auth.scheduleExpiry();
      emit();
    },

    /** Merge profile changes (e.g. after PATCH /users/profile/me) into the stored user. */
    updateUser: function (patch) {
      var s = auth.getSession(); if (!s) return;
      // role / is_active are never taken from client edits
      s.user = $.extend({}, s.user, { full_name: patch.full_name || s.user.full_name, email: patch.email || s.user.email });
      util.safeStorage.set(s.persist ? w.localStorage : w.sessionStorage, KEY, JSON.stringify(s));
      emit();
    },

    clear: function (silent) {
      util.safeStorage.remove(w.localStorage, KEY);
      util.safeStorage.remove(w.sessionStorage, KEY);
      clearTimeout(expiryTimer);
      if (CE.cache) CE.cache.clearAll();
      if (!silent) emit();
    },

    /** Sign out and go to the login page. reason: 'signed-out' | 'expired' | 'disabled' */
    logout: function (reason, next) {
      auth.clear();
      var q = '?reason=' + encodeURIComponent(reason || 'signed-out');
      if (next) q += '&next=' + encodeURIComponent(next);
      w.location.replace(util.url('login.html' + q));
    },

    /** Called on 401 or when the JWT `exp` passes. */
    expire: function () {
      if (auth._expiring) return;
      auth._expiring = true;
      auth.logout('expired', util.currentPath());
    },

    scheduleExpiry: function () {
      clearTimeout(expiryTimer);
      var exp = auth.expiresAt(); if (!exp) return;
      var ms = exp - Date.now();
      if (ms <= 0) return;
      // setTimeout overflows above ~24.8 days; JWTs here last 1h so that's fine.
      expiryTimer = setTimeout(auth.expire, Math.min(ms, 2147483000));
    },

    onChange: function (fn) { listeners.push(fn); },

    /** Where a user lands after login. */
    homeFor: function (user) { return user && user.role === 'admin' ? 'admin/index.html' : 'dashboard.html'; },

    /* ==============================================================
     * ROLE-BASED ACCESS GUARDS (client side)
     * --------------------------------------------------------------
     * requireAuth()  → any signed-in user (role 'user' or 'admin').
     *                  Not signed in  → redirect to login.html?next=…
     *                  Token expired  → redirect with "session expired".
     * requireAdmin() → only role === 'admin'.
     *                  A normal user is NOT redirected silently; the page body
     *                  is replaced with a 403 "This area is for administrators"
     *                  screen (rendered by CE.layout.renderForbidden).
     * guestOnly()    → login/signup pages: already signed-in users are sent home.
     * ============================================================== */
    requireAuth: function () {
      var s = auth.getSession();
      if (!s || !s.token) {
        w.location.replace(util.url('login.html?next=' + encodeURIComponent(util.currentPath())));
        return false;
      }
      if (auth.isExpired()) { auth.expire(); return false; }
      auth.scheduleExpiry();
      return true;
    },

    requireAdmin: function () {
      if (!auth.requireAuth()) return false;
      if (!auth.isAdmin()) return 'forbidden';   // caller renders the 403 state
      return true;
    },

    guestOnly: function () {
      if (auth.isAuthenticated()) {
        w.location.replace(util.url(auth.homeFor(auth.user())));
        return false;
      }
      return true;
    }
  };

  // Keep tabs in sync: signing out in one tab signs out persistent sessions everywhere.
  w.addEventListener('storage', function (e) {
    if (e.key === KEY && !e.newValue && document.body && document.body.getAttribute('data-auth') !== 'guest') {
      w.location.replace(util.url('login.html?reason=signed-out'));
    }
  });

  CE.auth = auth;
})(window);
