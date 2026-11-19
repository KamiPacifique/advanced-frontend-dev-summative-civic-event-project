/**
 * Admin › Notifications — table of notifications with delete
 * (DELETE /api/notifications/:id, admin only). Uses the shared
 * CE.notifications store so the bell count updates immediately.
 */
(function ($, CE) {
  'use strict';
  var ui = CE.ui, util = CE.util, esc = util.esc, icon = CE.icon;

  // ROLE GUARD: admin-only page.
  CE.boot({ auth: 'admin', layout: 'admin', nav: 'admin-notifications', title: 'Notifications', crumb: 'Notifications' }, function () {
    var N = CE.notifications, $rows = $('#rows'), state = { q: '', type: 'all', page: 1 }, chips = null;

    function opts() {
      var c = {}; N.state.items.forEach(function (n) { c[n.type] = (c[n.type] || 0) + 1; });
      return [{ value: 'all', label: 'All', count: N.state.items.length }].concat(Object.keys(c).sort().map(function (t) { return { value: t, label: N.typeMeta(t).label, count: c[t] }; }));
    }

    function render() {
      if (N.state.error && !N.state.loaded) { $rows.html('<tr><td colspan="4" class="p-6">' + ui.errorState(N.state.error, { bare: true }) + '</td></tr>'); return; }
      if (!N.state.loaded) { $rows.html(ui.skeleton.rows(5, 4)); return; }
      ui.busy($rows, false);
      if (!chips) chips = ui.chips('#chips', opts(), 'all', function (v) { state.type = v; state.page = 1; render(); });
      else chips.set(opts());
      var list = N.state.items.filter(function (n) { return (state.type === 'all' || n.type === state.type) && util.matches(state.q, [n.title, n.message]); });
      var pg = ui.paginate(list, state.page, CE.config.ADMIN_PAGE_SIZE);
      state.page = pg.page;
      $('#count').text(pg.total ? 'Showing ' + pg.from + '–' + pg.to + ' of ' + util.plural(pg.total, 'notification') : '');
      $rows.html(pg.total ? pg.items.map(function (n) {
        var t = N.typeMeta(n.type);
        return '<tr class="border-t border-line hover:bg-canvas" data-id="' + esc(n.id) + '">' +
          '<td class="px-4 py-3"><button type="button" data-open class="text-left flex gap-3 items-start"><span class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 ' + t.tone + '">' + icon(t.icon, 'w-4 h-4') + '</span>' +
            '<span><span class="flex flex-wrap items-center gap-2"><span class="font-semibold hover:text-brand">' + esc(n.title) + '</span>' + ui.badge(t.label, t.badge, '!h-5 !text-[11px]') + '</span><span class="block text-xs text-ink-muted mt-0.5 clamp-2 max-w-md">' + esc(n.message) + '</span></span></button></td>' +
          '<td class="px-4 py-3 text-ink-secondary">' + (n.recipient_id ? 'Targeted user' : 'All users') + '</td>' +
          '<td class="px-4 py-3 text-ink-secondary whitespace-nowrap">' + esc(util.formatDateYear(n.created_at)) + '<span class="block text-xs text-ink-muted">' + esc(util.formatTime(n.created_at)) + '</span></td>' +
          '<td class="px-4 py-3 text-right"><button type="button" data-del class="' + ui.cls.iconBtn + ' !text-danger hover:!bg-danger-soft" aria-label="Delete notification ' + esc(n.title) + '">' + icon('trash', 'w-4 h-4') + '</button></td></tr>';
      }).join('') : '<tr><td colspan="4" class="p-6">' + ui.empty({ bare: true, icon: 'bell', title: N.state.items.length ? 'No notifications match' : 'No notifications yet', message: 'Publishing an event, announcement or promo creates one automatically.' }) + '</td></tr>');
      ui.pagination('#pager', { page: pg.page, pages: pg.pages, onChange: function (p) { state.page = p; render(); } });
    }
    function find(el) { var id = String($(el).closest('[data-id]').data('id')); return N.state.items.find(function (n) { return n.id === id; }); }

    ui.busy($rows, true);
    N.onChange(render);
    render();
    N.load().catch(function () {});

    $('#q').on('input', util.debounce(function () { state.q = this.value; state.page = 1; render(); }, 150));
    $rows.on('click', '.ce-retry', function () { N.load(true).catch(function () {}); });
    $rows.on('click', '[data-open]', function () { var n = find(this); if (n) N.openDetail(n); });
    $rows.on('click', '[data-del]', function () { var n = find(this); if (n) N.remove(n); });
  });
})(jQuery, window.CE);
