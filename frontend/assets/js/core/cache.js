/**
 * CE.cache — tiny TTL cache for list responses (events, promos, announcements…).
 * ------------------------------------------------------------------
 * Stored in sessionStorage (scoped per signed-in user) with an in-memory
 * fallback. Lists are served from cache for CACHE_TTL_MS and invalidated
 * explicitly whenever the admin creates / updates / deletes something.
 *
 *   CE.cache.remember('events', () => CE.endpoints.events().then(r => r.data))
 *   CE.cache.invalidate('events')
 */
(function (w) {
  'use strict';
  var CE = w.CE;
  var memory = {};
  var PREFIX = 'ce.cache.';

  function scope(key) {
    var u = CE.auth && CE.auth.user();
    return PREFIX + (u ? u.id : 'anon') + '.' + key;
  }

  var cache = {
    get: function (key) {
      var k = scope(key), entry = memory[k];
      if (!entry) {
        var raw = CE.util.safeStorage.get(w.sessionStorage, k);
        if (raw) { try { entry = JSON.parse(raw); } catch (e) { entry = null; } }
      }
      if (!entry) return undefined;
      if (Date.now() - entry.t > CE.config.CACHE_TTL_MS) { cache.invalidate(key); return undefined; }
      return entry.v;
    },
    set: function (key, value) {
      var k = scope(key), entry = { t: Date.now(), v: value };
      memory[k] = entry;
      CE.util.safeStorage.set(w.sessionStorage, k, JSON.stringify(entry));
      return value;
    },
    /** Return a cached value, or run loader() and cache its result. */
    remember: function (key, loader, opts) {
      if (!(opts && opts.fresh)) {
        var hit = cache.get(key);
        if (hit !== undefined) return Promise.resolve(hit);
      }
      return loader().then(function (v) { return cache.set(key, v); });
    },
    /** Remove every key that starts with `prefix` for the current user. */
    invalidate: function (prefix) {
      var p = scope(prefix);
      Object.keys(memory).forEach(function (k) { if (k.indexOf(p) === 0) delete memory[k]; });
      try {
        for (var i = w.sessionStorage.length - 1; i >= 0; i--) {
          var k = w.sessionStorage.key(i);
          if (k && k.indexOf(p) === 0) w.sessionStorage.removeItem(k);
        }
      } catch (e) { /* storage blocked */ }
    },
    clearAll: function () {
      memory = {};
      try {
        for (var i = w.sessionStorage.length - 1; i >= 0; i--) {
          var k = w.sessionStorage.key(i);
          if (k && k.indexOf(PREFIX) === 0) w.sessionStorage.removeItem(k);
        }
      } catch (e) { /* storage blocked */ }
    }
  };

  /* Shared cached loaders used by several pages. */
  CE.data = {
    events: function (fresh) {
      return cache.remember('events', function () { return CE.endpoints.events().then(function (r) { return r.data || []; }); }, { fresh: fresh });
    },
    announcements: function (fresh) {
      return cache.remember('announcements', function () { return CE.endpoints.announcements().then(function (r) { return r.data || []; }); }, { fresh: fresh });
    },
    promos: function (fresh) {
      return cache.remember('promos', function () { return CE.endpoints.promos().then(function (r) { return r.data || []; }); }, { fresh: fresh });
    },
    myRegistrations: function (fresh) {
      return cache.remember('my-registrations', function () { return CE.endpoints.myRegistrations().then(function (r) { return r.data || []; }); }, { fresh: fresh });
    },
    myFeedback: function (fresh) {
      return cache.remember('my-feedback', function () { return CE.endpoints.myFeedback().then(function (r) { return r.data || []; }); }, { fresh: fresh });
    },
    /** Admin: every user (the API paginates without totals, so we walk pages). */
    allUsers: function (fresh) {
      return cache.remember('users', function () {
        var all = [];
        function page(n) {
          return CE.endpoints.users(n, 100).then(function (r) {
            var rows = r.data || [];
            all = all.concat(rows);
            return rows.length === 100 && n < 50 ? page(n + 1) : all;
          });
        }
        return page(1);
      }, { fresh: fresh });
    }
  };

  CE.cache = cache;
})(window);
