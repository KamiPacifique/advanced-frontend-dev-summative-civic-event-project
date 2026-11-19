/**
 * CE.api — thin jQuery.ajax wrapper around the CivicEvents+ REST API.
 * ------------------------------------------------------------------
 *  - Prefixes every path with `${API_BASE_URL}/api`.
 *  - Attaches `Authorization: Bearer <token>` to every request when signed in.
 *  - Normalises errors to { status, message, errors[], network?, aborted? }.
 *  - 401 on an authenticated request → token expired/invalid → sign out with message.
 *  - 403 is passed to the caller so it can show a "forbidden" state.
 *  - upload() sends multipart/form-data and reports progress (XHR upload events).
 *
 * Every method returns a native Promise resolving to the parsed JSON body
 * (usually `{ status, message, data }`).
 */
(function (w, $) {
  'use strict';
  var CE = w.CE;

  function base() { return CE.config.API_BASE_URL + '/api'; }

  /** Turn backend / network failures into a friendly, consistent error object. */
  function normalizeError(xhr, textStatus) {
    if (textStatus === 'abort') return { status: 0, aborted: true, message: 'Request cancelled.' };
    if (!xhr || xhr.status === 0) {
      return {
        status: 0, network: true,
        message: 'Can’t reach the server. Check your internet connection and that the API is running at ' + CE.config.API_BASE_URL + '.'
      };
    }
    var body = xhr.responseJSON;
    if (!body) { try { body = JSON.parse(xhr.responseText); } catch (e) { body = {}; } }
    var status = xhr.status;
    var message = (body && body.message) || '';
    var errors = (body && Array.isArray(body.errors)) ? body.errors : [];

    // Validation errors from express-validator: surface the individual messages.
    if (errors.length && /validation failed/i.test(message)) {
      message = errors.map(function (e) { return e.message; }).join(' ');
    }

    // Map raw backend/database messages to something people can act on.
    if (/foreign key/i.test(message)) {
      message = 'This item is still linked to other records (for example, event registrations), so the server refused to delete it.';
    } else if (/file too large/i.test(message)) {
      message = 'That file is larger than the server allows.';
    } else if (/duplicate entry/i.test(message)) {
      message = 'This already exists — duplicates aren’t allowed.';
    } else if (/invalid input syntax for type uuid/i.test(message)) {
      status = 404; message = 'We couldn’t find that item.';
    }

    if (!message) {
      message = {
        400: 'Some of the information sent was invalid.',
        401: 'Please sign in to continue.',
        403: 'You don’t have permission to do that.',
        404: 'We couldn’t find what you were looking for.',
        409: 'That conflicts with existing data.',
        413: 'That file is too large.',
        500: 'Something went wrong on the server. Please try again in a moment.'
      }[status] || ('Request failed (' + status + ').');
    } else if (status >= 500 && /^internal server error$/i.test(message)) {
      message = 'Something went wrong on the server. Please try again in a moment.';
    }
    return { status: status, message: message, errors: errors, body: body };
  }

  function request(method, path, opts) {
    opts = opts || {};
    var token = CE.auth.token();
    var settings = {
      url: base() + path,
      method: method,
      dataType: 'json',
      headers: {},
      timeout: opts.timeout || 30000
    };
    // Attach the bearer token on every protected request.
    if (token) settings.headers.Authorization = 'Bearer ' + token;

    if (opts.formData) {
      settings.data = opts.formData;
      settings.processData = false;
      settings.contentType = false;
      settings.timeout = 0; // uploads can take a while
      settings.xhr = function () {
        var xhr = $.ajaxSettings.xhr();
        if (xhr.upload && opts.onProgress) {
          xhr.upload.addEventListener('progress', function (e) {
            if (e.lengthComputable) opts.onProgress(Math.round((e.loaded / e.total) * 100), e);
          });
        }
        return xhr;
      };
    } else if (opts.data !== undefined) {
      if (method === 'GET') { settings.data = opts.data; }
      else { settings.data = JSON.stringify(opts.data); settings.contentType = 'application/json'; }
    }

    var jq = $.ajax(settings);
    var promise = new Promise(function (resolve, reject) {
      jq.done(function (body) { resolve(body || {}); })
        .fail(function (xhr, textStatus) {
          var err = normalizeError(xhr, textStatus);
          // A 401 on a request that carried a token means the session is no longer valid.
          if (err.status === 401 && token && !opts.skipAuthRedirect) {
            CE.auth.expire();
          }
          reject(err);
        });
    });
    promise.abort = function () { jq.abort(); };
    return promise;
  }

  CE.api = {
    request: request,
    get: function (path, params, opts) { return request('GET', path, $.extend({ data: params }, opts)); },
    post: function (path, body, opts) { return request('POST', path, $.extend({ data: body || {} }, opts)); },
    put: function (path, body, opts) { return request('PUT', path, $.extend({ data: body || {} }, opts)); },
    patch: function (path, body, opts) { return request('PATCH', path, $.extend({ data: body || {} }, opts)); },
    del: function (path, opts) { return request('DELETE', path, opts); },
    /** multipart/form-data upload with progress. Returns a Promise with .abort(). */
    upload: function (method, path, formData, onProgress) {
      return request(method, path, { formData: formData, onProgress: onProgress });
    },
    /** Retry a request factory with simple exponential back-off on network errors only. */
    withRetry: function (factory, attempts) {
      attempts = attempts || 2;
      return factory().catch(function (err) {
        if (!err.network || attempts <= 1) throw err;
        return new Promise(function (r) { setTimeout(r, 800); }).then(function () { return CE.api.withRetry(factory, attempts - 1); });
      });
    },
    normalizeError: normalizeError
  };

  /* ------------------------------------------------------------------
   * Resource helpers — one place that knows every endpoint the UI uses.
   * ------------------------------------------------------------------ */
  var api = CE.api;
  CE.endpoints = {
    // auth
    login: function (email, password) { return api.post('/auth/login', { email: email, password: password }, { skipAuthRedirect: true }); },
    signup: function (body) { return api.post('/auth/signup', body, { skipAuthRedirect: true }); },

    // events
    events: function () { return api.get('/events'); },
    event: function (id) { return api.get('/events/' + encodeURIComponent(id)); },
    createEvent: function (fd, p) { return api.upload('POST', '/events', fd, p); },
    updateEvent: function (id, fd, p) { return api.upload('PUT', '/events/' + encodeURIComponent(id), fd, p); },
    deleteEvent: function (id) { return api.del('/events/' + encodeURIComponent(id)); },

    // registrations
    register: function (eventId) { return api.post('/event-registrations/register', { event_id: eventId }); },
    cancelRegistration: function (eventId) { return api.post('/event-registrations/cancel', { event_id: eventId }); },
    myRegistrations: function () { return api.get('/event-registrations/my-registrations'); },
    attendees: function (eventId) { return api.get('/event-registrations/event/' + encodeURIComponent(eventId) + '/attendees'); },

    // feedback
    createFeedback: function (body) { return api.post('/event-feedback', body); },
    updateFeedback: function (id, body) { return api.put('/event-feedback/' + encodeURIComponent(id), body); },
    myFeedback: function () { return api.get('/event-feedback/my-feedback'); },
    eventFeedback: function (eventId) { return api.get('/event-feedback/event/' + encodeURIComponent(eventId)); },

    // announcements
    announcements: function (params) { return api.get('/announcements', $.extend({ page: 1, limit: 100 }, params)); },
    announcement: function (id) { return api.get('/announcements/' + encodeURIComponent(id)); },
    createAnnouncement: function (fd, p) { return api.upload('POST', '/announcements', fd, p); },
    updateAnnouncement: function (id, body) { return api.put('/announcements/' + encodeURIComponent(id), body); },
    publishAnnouncement: function (id, on) { return api.patch('/announcements/' + encodeURIComponent(id) + (on ? '/publish' : '/unpublish')); },
    deleteAnnouncement: function (id) { return api.del('/announcements/' + encodeURIComponent(id)); },

    // promos
    promos: function (params) { return api.get('/promos', $.extend({ page: 1, limit: 100 }, params)); },
    promo: function (id) { return api.get('/promos/' + encodeURIComponent(id)); },
    createPromo: function (fd, p) { return api.upload('POST', '/promos', fd, p); },
    updatePromo: function (id, fd, p) { return api.upload('PUT', '/promos/' + encodeURIComponent(id), fd, p); },
    publishPromo: function (id, on) { return api.patch('/promos/' + encodeURIComponent(id) + (on ? '/publish' : '/unpublish')); },
    deletePromo: function (id) { return api.del('/promos/' + encodeURIComponent(id)); },

    // notifications
    notifications: function () { return api.get('/notifications'); },
    notification: function (id) { return api.get('/notifications/' + encodeURIComponent(id)); },
    deleteNotification: function (id) { return api.del('/notifications/' + encodeURIComponent(id)); },

    // users
    me: function () { return api.get('/users/profile/me'); },
    updateMe: function (body) { return api.patch('/users/profile/me', body); },
    users: function (page, limit) { return api.get('/users', { page: page || 1, limit: limit || 100 }); },
    user: function (id) { return api.get('/users/' + encodeURIComponent(id)); },
    setUserActive: function (id, active) { return api.patch('/users/' + encodeURIComponent(id) + (active ? '/enable' : '/disable')); },

    // dashboards
    adminDashboard: function () { return api.get('/dashboard/admin'); },
    myDashboard: function () { return api.get('/dashboard/me'); }
  };
})(window, jQuery);
