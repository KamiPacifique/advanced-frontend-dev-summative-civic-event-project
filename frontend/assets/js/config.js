/**
 * CivicConnect — global configuration
 * ------------------------------------------------------------------
 * API_BASE_URL is the origin of the provided Express backend
 * (default http://localhost:4000). All API calls go to `${API_BASE_URL}/api/...`
 * and uploaded media is served by the backend from `${API_BASE_URL}/uploads/...`.
 *
 * Ways to point the UI at another backend (highest priority first):
 *   1. define `window.CIVIC_API_BASE_URL = 'http://host:port'` before this script
 *   2. run `localStorage.setItem('ce.apiBaseUrl', 'http://host:port')` in DevTools
 *   3. edit DEFAULT_API_BASE_URL below
 */
(function (w) {
  'use strict';

  var DEFAULT_API_BASE_URL = 'http://localhost:4000';

  // Work out the app root from this script's own URL so pages in sub-folders
  // (e.g. /admin/*.html) can build links without hard-coding "../".
  var script = document.currentScript;
  var appRoot = script ? script.src.replace(/assets\/js\/config\.js(\?.*)?$/, '') : '/';

  var stored = null;
  try { stored = w.localStorage.getItem('ce.apiBaseUrl'); } catch (e) { /* storage blocked */ }

  var MB = 1024 * 1024;

  w.CE = w.CE || {};
  w.CE.config = {
    APP_NAME: 'CivicConnect',
    API_BASE_URL: String(w.CIVIC_API_BASE_URL || stored || DEFAULT_API_BASE_URL).replace(/\/+$/, ''),
    APP_ROOT: appRoot,

    // UI behaviour
    PAGE_SIZE: 6,                 // cards per page on public lists
    ADMIN_PAGE_SIZE: 10,          // rows per page on admin tables
    CACHE_TTL_MS: 2 * 60 * 1000,  // list cache lifetime (invalidated on writes)
    NOTIFICATION_POLL_MS: 60 * 1000,

    // Mirrors backend/src/middlewares/upload.middleware.js so we can reject
    // bad files *before* uploading them.
    UPLOADS: {
      image: { field: 'image', maxBytes: 2 * MB, exts: ['jpg', 'jpeg', 'png', 'gif'], accept: '.jpg,.jpeg,.png,.gif,image/jpeg,image/png,image/gif', label: 'JPG, PNG or GIF · max 2 MB' },
      audio: { field: 'audio', maxBytes: 5 * MB, exts: ['mp3', 'wav', 'm4a', 'ogg'], accept: '.mp3,.wav,.m4a,.ogg,audio/*', label: 'MP3, WAV, M4A or OGG · max 5 MB' },
      video: { field: 'video', maxBytes: 8 * MB, exts: ['mp4', 'mov', 'avi', 'mkv'], accept: '.mp4,.mov,.avi,.mkv,video/*', label: 'MP4, MOV, AVI or MKV · max 8 MB' }
    },

    CONTACT: {
      email: 'support@civicconnect.rw',
      phone: '+250 788 000 000',
      address: 'KN 3 Ave, Kigali'
    }
  };
})(window);
