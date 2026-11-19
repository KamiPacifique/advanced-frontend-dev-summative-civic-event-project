/**
 * Admin › Events — every event (drafts included) with view / edit / delete.
 * Registration counts are fetched per visible row from the attendees endpoint.
 */
(function ($, CE) {
  'use strict';
  var ui = CE.ui, util = CE.util, esc = util.esc, icon = CE.icon, kit = CE.eventsKit;

  // ROLE GUARD: admin-only page.
  CE.boot({ auth: 'admin', layout: 'admin', nav: 'admin-events', title: 'Events', crumb: 'Events' }, function () {
    var $rows = $('#rows'), all = [], counts = {}, state = { q: '', f: 'all', page: 1 };
    var chips = null;

    function chipOpts() {
      var c = { all: all.length, upcoming: 0, past: 0, draft: 0 };
      all.forEach(function (e) { if (util.eventStatus(e) === 'past') c.past++; else c.upcoming++; if (e.published === false) c.draft++; });
      return [{ value: 'all', label: 'All', count: c.all }, { value: 'upcoming', label: 'Upcoming', count: c.upcoming }, { value: 'past', label: 'Past', count: c.past }, { value: 'draft', label: 'Drafts', count: c.draft }];
    }

    function row(e) {
      var st = util.eventStatus(e), view = util.url('event.html?id=' + encodeURIComponent(e.id));
      return '<tr class="border-t border-line hover:bg-canvas">' +
        '<td class="px-4 py-3 sticky left-0 bg-white"><div class="flex items-center gap-3"><span class="w-12 h-12 rounded-lg overflow-hidden shrink-0">' + CE.cards.eventImage(e) + '</span>' +
          '<div class="min-w-0"><a href="' + view + '" class="font-semibold hover:text-brand line-clamp-1">' + esc(e.title) + '</a><p class="text-xs text-ink-muted truncate max-w-[16rem]">' + esc(e.location || '—') + '</p></div></div></td>' +
        '<td class="px-4 py-3 text-ink-secondary whitespace-nowrap">' + esc(util.formatDateYear(e.starts_at)) + '<span class="block text-xs text-ink-muted">' + esc(util.formatTime(e.starts_at)) + '</span></td>' +
        '<td class="px-4 py-3"><div class="flex flex-wrap gap-1.5">' + ui.badge(e.published === false ? 'Draft' : 'Published', e.published === false ? 'accent' : 'success') + CE.cards.statusBadge(e) + '</div></td>' +
        '<td class="px-4 py-3 tabular-nums font-semibold" data-count="' + esc(e.id) + '">' + (counts[e.id] !== undefined ? counts[e.id] : '<span class="skeleton inline-block h-4 w-6 align-middle"></span>') + '</td>' +
        '<td class="px-4 py-3"><div class="flex justify-end gap-1">' +
          '<a href="' + view + '" class="' + ui.cls.iconBtn + '" aria-label="View ' + esc(e.title) + '">' + icon('eye', 'w-4 h-4') + '</a>' +
          '<a href="event-form.html?id=' + encodeURIComponent(e.id) + '" class="' + ui.cls.iconBtn + '" aria-label="Edit ' + esc(e.title) + '">' + icon('pencil', 'w-4 h-4') + '</a>' +
          '<button type="button" data-del="' + esc(e.id) + '" class="' + ui.cls.iconBtn + ' !text-danger hover:!bg-danger-soft" aria-label="Delete ' + esc(e.title) + '">' + icon('trash', 'w-4 h-4') + '</button>' +
        '</div></td></tr>';
    }

    function render() {
      var list = all.filter(function (e) {
        if (state.f === 'upcoming' && util.eventStatus(e) === 'past') return false;
        if (state.f === 'past' && util.eventStatus(e) !== 'past') return false;
        if (state.f === 'draft' && e.published !== false) return false;
        return util.matches(state.q, [e.title, e.location, e.description]);
      });
      list = kit.sortEvents(list, 'soonest');
      var pg = ui.paginate(list, state.page, CE.config.ADMIN_PAGE_SIZE);
      state.page = pg.page;
      $('#count').text(pg.total ? 'Showing ' + pg.from + '–' + pg.to + ' of ' + util.plural(pg.total, 'event') : '');
      $rows.html(pg.total ? pg.items.map(row).join('') :
        '<tr><td colspan="5" class="p-6">' + ui.empty({ bare: true, icon: 'calendar', title: all.length ? 'No events match' : 'No events yet', message: all.length ? 'Try another search or filter.' : 'Create your first event to get started.', actions: all.length ? '' : '<a href="event-form.html" class="' + ui.btn('primary', 'sm') + '">Create event</a>' }) + '</td></tr>');
      ui.pagination('#pager', { page: pg.page, pages: pg.pages, onChange: function (p) { state.page = p; render(); } });
      // lazy registration counts for visible rows
      pg.items.forEach(function (e) {
        if (counts[e.id] !== undefined) return;
        CE.endpoints.attendees(e.id).then(function (r) { counts[e.id] = (r.data || []).length; }).catch(function () { counts[e.id] = '—'; })
          .then(function () { $rows.find('[data-count="' + e.id + '"]').text(counts[e.id]); });
      });
    }

    function load(fresh) {
      ui.busy($rows, true); $rows.html(ui.skeleton.rows(5, 5));
      CE.data.events(fresh).then(function (rows) {
        all = rows;
        if (!chips) chips = ui.chips('#chips', chipOpts(), state.f, function (v) { state.f = v; state.page = 1; render(); });
        else chips.set(chipOpts());
        render();
      }).catch(function (err) {
        $rows.html('<tr><td colspan="5" class="p-6">' + ui.errorState(err, { bare: true, title: 'Couldn’t load events' }) + '</td></tr>');
      }).finally(function () { ui.busy($rows, false); });
    }

    $('#q').on('input', util.debounce(function () { state.q = this.value; state.page = 1; render(); }, 200));
    $rows.on('click', '.ce-retry', function () { load(true); });
    $rows.on('click', '[data-del]', function () {
      var id = String($(this).data('del')), ev = all.find(function (e) { return e.id === id; });
      kit.remove(ev).then(function (ok) {
        if (!ok) return;
        all = all.filter(function (e) { return e.id !== id; });
        chips.set(chipOpts()); render();
      });
    });
    load(true);
  });
})(jQuery, window.CE);
