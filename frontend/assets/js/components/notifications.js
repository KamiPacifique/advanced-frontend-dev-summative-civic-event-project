/**
 * CE.notifications — in-app notifications (bell + drawer + detail modal).
 * ------------------------------------------------------------------
 * Data:  GET /api/notifications returns broadcast items (recipient_id = null)
 *        plus items targeted at the signed-in user.
 * Read state: the API has no "mark as read" endpoint, so read/unread is kept
 *        per user in localStorage. Marking as read is OPTIMISTIC: the UI
 *        updates immediately, then GET /api/notifications/:id confirms the
 *        notification still exists; if that fails we revert and show an error.
 * Delete: admin only (DELETE /api/notifications/:id).
 */
(function (w, $) {
  'use strict';
  var CE = w.CE, util = CE.util, esc = util.esc, icon = CE.icon, ui = CE.ui;

  var state = { items: [], loaded: false, loading: null, error: null };
  var listeners = [];
  var pollTimer = null;

  function readKey() { var u = CE.auth.user(); return 'ce.notif.read.' + (u ? u.id : 'anon'); }
  function readSet() {
    var raw = util.safeStorage.get(w.localStorage, readKey());
    try { return new Set(raw ? JSON.parse(raw) : []); } catch (e) { return new Set(); }
  }
  function saveReadSet(set) {
    // keep the list bounded
    var arr = Array.from(set).slice(-500);
    if (!util.safeStorage.set(w.localStorage, readKey(), JSON.stringify(arr))) throw new Error('storage');
  }

  var TYPES = {
    event: { icon: 'calendar', tone: 'bg-brand-soft text-brand', label: 'Event', badge: 'brand' },
    announcement: { icon: 'megaphone', tone: 'bg-info-soft text-info', label: 'Announcement', badge: 'info' },
    promo: { icon: 'video', tone: 'bg-accent-soft text-accent-text', label: 'Promo', badge: 'accent' },
    registration: { icon: 'check', tone: 'bg-success-soft text-success', label: 'Registration', badge: 'success' },
    system: { icon: 'bell', tone: 'bg-subtle text-ink-secondary', label: 'System', badge: 'neutral' }
  };
  function typeMeta(type) { return TYPES[type] || $.extend({}, TYPES.system, { label: type ? type.charAt(0).toUpperCase() + type.slice(1) : 'General' }); }

  /** Map notification metadata to the related page. */
  function linkFor(n) {
    var m = n.metadata || {};
    if (m.event_id) return { href: util.url('event.html?id=' + encodeURIComponent(m.event_id)), label: 'Open event' };
    if (m.announcement_id) return { href: util.url('announcement.html?id=' + encodeURIComponent(m.announcement_id)), label: 'Listen to announcement' };
    if (m.promo_id) return { href: util.url('promo.html?id=' + encodeURIComponent(m.promo_id)), label: 'Watch promo' };
    return null;
  }

  function isRead(n, set) { return n.read === true || (set || readSet()).has(n.id); }
  function unreadCount() { var s = readSet(); return state.items.filter(function (n) { return !isRead(n, s); }).length; }

  function emit() { updateBadge(); listeners.forEach(function (fn) { try { fn(state); } catch (e) { /* ignore */ } }); }

  function updateBadge() {
    var n = unreadCount();
    var $c = $('.ce-bell-count');
    $c.text(n > 9 ? '9+' : n).toggleClass('hidden', n === 0);
    $('.ce-bell').attr('aria-label', n ? 'Notifications, ' + n + ' unread' : 'Notifications');
  }

  function load(fresh) {
    if (state.loading && !fresh) return state.loading;
    state.loading = CE.endpoints.notifications().then(function (r) {
      state.items = (r.data || []).slice().sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
      state.loaded = true; state.error = null; emit();
      return state.items;
    }).catch(function (err) {
      state.error = err; emit(); throw err;
    }).finally(function () { state.loading = null; });
    return state.loading;
  }

  /** Optimistic mark-as-read with server confirmation + revert on failure. */
  function markRead(id) {
    var set = readSet();
    if (set.has(id)) return Promise.resolve();
    set.add(id);
    try { saveReadSet(set); } catch (e) { ui.toast('error', 'Couldn’t mark as read', 'Your browser blocked local storage.'); return Promise.resolve(); }
    emit();
    return CE.endpoints.notification(id).catch(function (err) {
      var s = readSet(); s.delete(id); try { saveReadSet(s); } catch (e) { /* ignore */ }
      emit();
      if (err.status === 404) { state.items = state.items.filter(function (n) { return n.id !== id; }); emit(); }
      ui.toast('error', 'Couldn’t update notification', err.message);
    });
  }

  function markAllRead() {
    var set = readSet(), before = Array.from(set);
    state.items.forEach(function (n) { set.add(n.id); });
    try { saveReadSet(set); emit(); ui.toast('success', 'All caught up', 'Every notification is marked as read.'); }
    catch (e) { try { saveReadSet(new Set(before)); } catch (x) { /* ignore */ } emit(); ui.toast('error', 'Couldn’t mark all as read'); }
  }

  /** Admin-only delete (UI hidden for normal users; backend enforces authorize(['admin'])). */
  function remove(n) {
    return ui.confirm({ title: 'Delete “' + n.title + '”?', message: 'This removes the notification for every recipient. This can’t be undone.', confirmLabel: 'Delete notification' })
      .then(function (ok) {
        if (!ok) return false;
        var prev = state.items.slice();
        state.items = state.items.filter(function (x) { return x.id !== n.id; }); emit();   // optimistic
        return CE.endpoints.deleteNotification(n.id).then(function () {
          ui.toast('success', 'Notification deleted', '“' + n.title + '” was removed.');
          return true;
        }).catch(function (err) { state.items = prev; emit(); ui.toastError(err, 'Couldn’t delete notification'); return false; });
      });
  }

  /* ---------------- Rendering ---------------- */
  function itemHTML(n, set, opts) {
    var t = typeMeta(n.type), read = isRead(n, set);
    return '<li><button type="button" data-id="' + esc(n.id) + '" class="ce-notif w-full text-left flex gap-3 px-4 sm:px-5 py-3.5 transition-colors ' + (read ? 'hover:bg-subtle' : 'bg-brand-soft/40 hover:bg-brand-soft/70') + '">' +
      '<span class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 ' + t.tone + '">' + icon(t.icon, 'w-4 h-4') + '</span>' +
      '<span class="flex-1 min-w-0"><span class="flex items-start gap-2"><span class="flex-1 text-sm ' + (read ? 'font-medium text-ink-secondary' : 'font-semibold text-ink') + '">' + esc(n.title) + '</span>' +
        (read ? '' : '<span class="mt-1.5 w-2 h-2 rounded-full bg-brand shrink-0" aria-hidden="true"></span><span class="sr-only">(unread)</span>') + '</span>' +
        '<span class="block text-sm text-ink-secondary mt-0.5 ' + (opts && opts.full ? '' : 'clamp-2') + '">' + esc(n.message) + '</span>' +
        '<span class="block text-xs text-ink-muted mt-1">' + esc(util.relative(n.created_at)) + ' · ' + esc(t.label) + (n.recipient_id ? ' · For you' : ' · Broadcast') + '</span></span>' +
    '</button></li>';
  }

  function filterItems(tab) {
    var set = readSet();
    return state.items.filter(function (n) {
      if (tab === 'unread') return !isRead(n, set);
      if (tab === 'all') return true;
      return n.type === tab;
    });
  }

  /** Render list grouped into Today / Earlier into $list. */
  function renderList($list, tab, opts) {
    var set = readSet(), items = filterItems(tab);
    if (state.error && !state.loaded) { $list.html('<div class="p-5">' + ui.errorState(state.error, { title: 'Couldn’t load notifications' }) + '</div>'); return; }
    if (!state.loaded) { $list.html('<div class="p-5 space-y-3">' + ui.skeleton.list(4) + '</div>'); return; }
    if (!items.length) {
      $list.html('<div class="p-5">' + ui.empty({ bare: true, icon: 'bell', title: tab === 'unread' ? 'You’re all caught up' : 'No notifications yet', message: tab === 'unread' ? 'New updates will show up here.' : 'When events, announcements or promos are published you’ll be notified here.' }) + '</div>');
      return;
    }
    var today = new Date(), groups = { Today: [], Earlier: [] };
    items.forEach(function (n) { (util.isSameDay(new Date(n.created_at), today) ? groups.Today : groups.Earlier).push(n); });
    var html = '';
    ['Today', 'Earlier'].forEach(function (g) {
      if (!groups[g].length) return;
      html += '<h3 class="px-4 sm:px-5 pt-4 pb-1.5 text-overline uppercase text-ink-muted">' + g + '</h3><ul class="divide-y divide-line border-y border-line">' +
        groups[g].map(function (n) { return itemHTML(n, set, opts); }).join('') + '</ul>';
    });
    $list.html(html);
  }

  function tabsHTML(active) {
    var unread = unreadCount();
    var tabs = [['all', 'All'], ['unread', 'Unread (' + unread + ')'], ['event', 'Events'], ['announcement', 'Announcements'], ['promo', 'Promos']];
    return '<div class="flex gap-1 overflow-x-auto thin-scroll" role="tablist" aria-label="Filter notifications">' + tabs.map(function (t) {
      var on = t[0] === active;
      return '<button type="button" role="tab" aria-selected="' + on + '" data-tab="' + t[0] + '" class="shrink-0 h-9 px-3 text-sm font-semibold border-b-2 ' + (on ? 'border-brand text-brand' : 'border-transparent text-ink-secondary hover:text-ink') + '">' + esc(t[1]) + '</button>';
    }).join('') + '</div>';
  }

  /* ---------------- Drawer ---------------- */
  function openDrawer() {
    var tab = 'all';
    var header = '<div class="px-5 pt-4 border-b border-line"><div class="flex items-center gap-2"><h2 class="flex-1 text-lg font-bold" id="ce-notif-title">Notifications</h2>' +
      '<button type="button" class="ce-mark-all inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-sm font-semibold text-brand hover:bg-brand-soft">' + icon('check-check', 'w-4 h-4') + 'Mark all read</button>' +
      '<button type="button" class="ce-close ' + ui.cls.iconBtn + ' border border-line" aria-label="Close notifications">' + icon('x', 'w-4 h-4') + '</button></div>' +
      '<div class="ce-tabs mt-2"></div></div>';
    var d = ui.drawer({
      title: 'Notifications', header: header,
      body: '<div class="ce-notif-list" aria-live="polite"></div>',
      footer: '<div class="border-t border-line p-3 text-center"><a href="' + util.url('notifications.html') + '" class="inline-flex h-9 items-center px-3 rounded-lg text-sm font-semibold text-brand hover:bg-brand-soft">View all notifications</a></div>',
      onClose: function () { listeners = listeners.filter(function (f) { return f !== refresh; }); }
    });
    var $el = d.$el;
    function refresh() { $el.find('.ce-tabs').html(tabsHTML(tab)); renderList($el.find('.ce-notif-list'), tab); }
    listeners.push(refresh);
    refresh();
    $el.on('click', '[data-tab]', function () { tab = $(this).data('tab'); refresh(); $el.find('[data-tab="' + tab + '"]').trigger('focus'); });
    $el.on('click', '.ce-mark-all', markAllRead);
    $el.on('click', '.ce-retry', function () { load(true).catch(function () {}); });
    $el.on('click', '.ce-notif', function () {
      var n = state.items.find(function (x) { return x.id === String($(this).data('id')); }, this);
      if (n) openDetail(n);
    });
    if (!state.loaded) load().catch(function () {});
  }

  /* ---------------- Detail modal ---------------- */
  function openDetail(n) {
    markRead(n.id);
    var t = typeMeta(n.type), link = linkFor(n);
    var ic = '<span class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ' + t.tone + '">' + icon(t.icon, 'w-5 h-5') + '</span>';
    var body = '<div class="flex flex-wrap items-center gap-2 -mt-1 mb-3">' + ui.badge(t.label, t.badge) + '<span class="text-xs text-ink-muted">' + esc(util.formatLongDate(n.created_at)) + ' · ' + esc(util.formatTime(n.created_at)) + '</span>' +
      ui.badge(n.recipient_id ? 'Sent to you' : 'Broadcast', 'neutral') + '</div>' +
      '<p class="text-[15px] text-ink-secondary leading-relaxed whitespace-pre-line">' + esc(n.message) + '</p>' +
      '<div class="ce-resource mt-4"></div>';
    var footer = (CE.auth.isAdmin() ? '<button type="button" class="ce-del mr-auto ' + ui.btn('dangerOutline') + '">' + icon('trash', 'w-4 h-4') + 'Delete</button>' : '') +
      '<button type="button" data-close class="' + ui.btn('secondary') + '">Close</button>' +
      (link ? '<a href="' + link.href + '" class="' + ui.btn('primary') + '">' + esc(link.label) + icon('arrow-right', 'w-4 h-4') + '</a>' : '');
    var m = ui.modal({ title: n.title, body: body, footer: footer, labelIcon: ic });
    // Rich preview of the linked event (from the cached event list)
    var evId = n.metadata && n.metadata.event_id;
    if (evId) {
      CE.data.events().then(function (events) {
        var ev = events.find(function (e) { return e.id === evId; });
        if (!ev) return;
        var img = ev.metadata && ev.metadata.image_url;
        m.$el.find('.ce-resource').html('<a href="' + link.href + '" class="flex items-center gap-3 p-3 rounded-xl border border-line hover:border-brand hover:bg-brand-soft/30 transition-colors">' +
          (img ? '<img src="' + esc(img) + '" alt="" class="w-14 h-14 rounded-lg object-cover">' : '<span class="w-14 h-14 rounded-lg ' + util.gradientFor(ev.id) + '"></span>') +
          '<span class="flex-1 min-w-0"><span class="block text-sm font-semibold truncate">' + esc(ev.title) + '</span><span class="block text-xs text-ink-muted mt-0.5">' + esc(util.formatDateTime(ev.starts_at)) + ' · ' + esc(ev.location || '') + '</span></span>' +
          icon('arrow-right', 'w-4 h-4 text-brand') + '</a>');
      }).catch(function () {});
    }
    // ROLE GUARD (UI): delete button only rendered for admins.
    m.$el.on('click', '.ce-del', function () { m.close(); remove(n); });
  }

  /* ---------------- Init ---------------- */
  function init() {
    $(document).off('click.cenotif').on('click.cenotif', '.ce-bell', openDrawer);
    load().catch(function () { /* badge stays hidden; drawer shows retry */ });
    clearInterval(pollTimer);
    pollTimer = setInterval(function () { if (!document.hidden && CE.auth.isAuthenticated()) load(true).catch(function () {}); }, CE.config.NOTIFICATION_POLL_MS);
  }

  CE.notifications = {
    init: init, load: load, state: state, onChange: function (fn) { listeners.push(fn); },
    markRead: markRead, markAllRead: markAllRead, remove: remove, isRead: isRead, readSet: readSet,
    unreadCount: unreadCount, openDetail: openDetail, openDrawer: openDrawer,
    renderList: renderList, tabsHTML: tabsHTML, typeMeta: typeMeta, linkFor: linkFor
  };
})(window, jQuery);
