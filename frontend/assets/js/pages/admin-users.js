/**
 * Admin › Users
 *   list:   GET   /api/users?page&limit (walked page by page, cached)
 *   view:   GET   /api/users/:id
 *   toggle: PATCH /api/users/:id/enable | /api/users/:id/disable
 *
 * ROLE RULES (UI): roles are shown read-only — there is deliberately no
 * control to change a role. Admins also can't disable their own account here.
 */
(function ($, CE) {
  'use strict';
  var ui = CE.ui, util = CE.util, esc = util.esc, icon = CE.icon;

  CE.boot({ auth: 'admin', layout: 'admin', nav: 'admin-users', title: 'Users', crumb: 'Users' }, function () {
    var me = CE.auth.user(), $rows = $('#rows'), all = [], state = { q: '', f: 'all', page: 1 }, chips = null;

    function opts() {
      var active = all.filter(function (u) { return u.is_active; }).length;
      return [{ value: 'all', label: 'All', count: all.length }, { value: 'active', label: 'Active', count: active },
        { value: 'disabled', label: 'Disabled', count: all.length - active }, { value: 'admin', label: 'Admins', count: all.filter(function (u) { return u.role === 'admin'; }).length }];
    }

    function row(u) {
      var self = u.id === me.id, sid = 'us-' + u.id;
      return '<tr class="border-t border-line hover:bg-canvas" data-id="' + esc(u.id) + '">' +
        '<td class="px-4 py-3 sticky left-0 bg-white"><div class="flex items-center gap-3">' + ui.avatar(u.full_name, 'w-9 h-9 text-xs', u.role === 'admin') +
          '<div class="min-w-0"><p class="font-semibold">' + esc(u.full_name) + (self ? ' <span class="text-xs text-ink-muted font-normal">(you)</span>' : '') + '</p><p class="text-xs text-ink-muted truncate">' + esc(u.email) + '</p></div></div></td>' +
        '<td class="px-4 py-3"><span class="inline-flex items-center gap-1.5">' + ui.badge(u.role, u.role === 'admin' ? 'accent' : 'neutral') + '<span class="text-ink-muted" title="Role can’t be changed from the UI">' + icon('lock', 'w-3.5 h-3.5') + '</span><span class="sr-only">(read-only)</span></span></td>' +
        '<td class="px-4 py-3"><label for="' + sid + '" class="inline-flex items-center gap-2.5 ' + (self ? 'opacity-60' : '') + '"><span class="switch"><input id="' + sid + '" type="checkbox" role="switch" data-toggle ' + (u.is_active ? 'checked' : '') + (self ? ' disabled aria-describedby="self-note"' : '') + '><span class="track"></span><span class="thumb"></span></span>' +
          '<span class="text-sm font-semibold ' + (u.is_active ? 'text-success' : 'text-ink-muted') + '">' + (u.is_active ? 'Active' : 'Disabled') + '</span><span class="sr-only"> — account access for ' + esc(u.full_name) + '</span></label>' +
          (self ? '<span id="self-note" class="sr-only">You can’t disable your own account.</span>' : '') + '</td>' +
        '<td class="px-4 py-3 text-ink-secondary whitespace-nowrap">' + esc(util.formatDateYear(u.created_at)) + '</td>' +
        '<td class="px-4 py-3 text-right"><button type="button" data-view class="' + ui.cls.iconBtn + '" aria-label="View profile of ' + esc(u.full_name) + '">' + icon('eye', 'w-4 h-4') + '</button></td></tr>';
    }

    function filtered() {
      return all.filter(function (u) {
        if (state.f === 'active' && !u.is_active) return false;
        if (state.f === 'disabled' && u.is_active) return false;
        if (state.f === 'admin' && u.role !== 'admin') return false;
        return util.matches(state.q, [u.full_name, u.email]);
      });
    }
    function render() {
      var pg = ui.paginate(filtered(), state.page, CE.config.ADMIN_PAGE_SIZE);
      state.page = pg.page;
      $('#count').text(pg.total ? 'Showing ' + pg.from + '–' + pg.to + ' of ' + util.plural(pg.total, 'user') : '');
      $rows.html(pg.total ? pg.items.map(row).join('') : '<tr><td colspan="5" class="p-6">' + ui.empty({ bare: true, icon: 'users', title: 'No users match', message: 'Try another search or filter.' }) + '</td></tr>');
      ui.pagination('#pager', { page: pg.page, pages: pg.pages, onChange: function (p) { state.page = p; render(); } });
      if (chips) chips.set(opts());
    }
    function find(el) { var id = String($(el).closest('[data-id]').data('id')); return all.find(function (u) { return u.id === id; }); }

    function load() {
      ui.busy($rows, true); $rows.html(ui.skeleton.rows(6, 5));
      CE.data.allUsers(true).then(function (rows) {
        all = rows;
        chips = chips || ui.chips('#chips', opts(), 'all', function (v) { state.f = v; state.page = 1; render(); });
        render();
      }).catch(function (err) { $rows.html('<tr><td colspan="5" class="p-6">' + ui.errorState(err, { bare: true, title: 'Couldn’t load users' }) + '</td></tr>'); })
        .finally(function () { ui.busy($rows, false); });
    }

    /** Optimistic enable/disable with revert on failure and an Undo action. */
    function setActive(u, active, $sw) {
      if (u.id === me.id) { ui.toast('warning', 'Not allowed', 'You can’t disable your own account.'); return; }
      var prev = u.is_active;
      u.is_active = active; render();
      CE.endpoints.setUserActive(u.id, active).then(function (r) {
        if (r.data) $.extend(u, r.data);
        CE.cache.invalidate('users');
        ui.toast('success', active ? 'User enabled' : 'User disabled', u.full_name + (active ? ' can sign in again.' : ' can no longer sign in.'), {
          action: { label: 'Undo', onClick: function () { setActive(u, prev); } }
        });
      }).catch(function (err) {
        u.is_active = prev; render();
        ui.toastError(err, 'Couldn’t update ' + u.full_name);
      });
    }

    function view(u) {
      var d = ui.drawer({ title: 'User profile', body: '<div class="p-5">' + ui.skeleton.list(1) + '</div>' });
      CE.endpoints.user(u.id).then(function (r) {
        var x = r.data || u;
        var dl = function (k, v) { return '<div class="flex justify-between gap-4 py-2.5 text-sm"><dt class="text-ink-muted">' + k + '</dt><dd class="font-semibold text-right break-all">' + v + '</dd></div>'; };
        d.$el.find('.ce-body').html('<div class="p-5"><div class="flex flex-col items-center text-center">' + ui.avatar(x.full_name, 'w-16 h-16 text-lg', x.role === 'admin') +
          '<p class="mt-3 text-lg font-bold">' + esc(x.full_name) + '</p><p class="text-sm text-ink-muted">' + esc(x.email) + '</p></div>' +
          '<dl class="mt-6 divide-y divide-line border-y border-line">' +
            dl('Role', ui.badge(x.role, x.role === 'admin' ? 'accent' : 'neutral') + ' ' + icon('lock', 'w-3.5 h-3.5 inline text-ink-muted')) +
            dl('Status', ui.badge(x.is_active ? 'Active' : 'Disabled', x.is_active ? 'success' : 'danger')) +
            dl('Joined', esc(util.formatLongDate(x.created_at))) +
            dl('Last updated', esc(util.formatDateTime(x.updated_at))) +
            dl('User ID', '<code class="text-xs">' + esc(x.id) + '</code>') +
          '</dl>' +
          '<p class="mt-4 text-xs text-ink-muted flex gap-2">' + icon('info', 'w-4 h-4 shrink-0') + 'Roles are managed outside the UI. You can enable or disable this account from the users table.</p></div>');
      }).catch(function (err) { d.$el.find('.ce-body').html('<div class="p-5">' + ui.alert('danger', err.message) + '</div>'); });
    }

    $('#q').on('input', util.debounce(function () { state.q = this.value; state.page = 1; render(); }, 150));
    $rows.on('click', '.ce-retry', load);
    $rows.on('change', '[data-toggle]', function () { setActive(find(this), $(this).is(':checked'), $(this)); });
    $rows.on('click', '[data-view]', function () { view(find(this)); });
    $('#export').on('click', function () {
      util.download('users.csv', util.toCSV(filtered(), [
        { key: 'full_name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'role', label: 'Role' },
        { label: 'Status', value: function (u) { return u.is_active ? 'active' : 'disabled'; } }, { key: 'created_at', label: 'Joined' }
      ]), 'text/csv');
    });
    load();
  });
})(jQuery, window.CE);
