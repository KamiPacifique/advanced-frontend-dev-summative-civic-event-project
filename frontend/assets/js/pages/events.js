/**
 * Events list — GET /api/events
 * Shows only published events, with client-side search, date / location
 * filters, sorting and pagination (the API returns the full list unpaginated).
 * Normal users get a Register button; admins get Edit / Delete instead.
 * Filter state is mirrored in the URL so a filtered view can be shared.
 */
(function ($, CE) {
  'use strict';
  var ui = CE.ui, util = CE.util, kit = CE.eventsKit;

  CE.boot({ auth: 'user', layout: 'public', nav: 'events' }, function () {
    var isAdmin = CE.auth.isAdmin();   // ROLE GUARD (UI): decides Register vs Edit/Delete on cards
    var $grid = $('#event-grid');
    var all = [], regs = {};
    var state = {
      q: util.param('q') || '', when: util.param('when') || 'all', loc: util.param('loc') || '',
      sort: util.param('sort') || 'soonest', page: Number(util.param('page')) || 1
    };

    $('#q').val(state.q); $('#when').val(state.when); $('#sort').val(state.sort);

    var chipOpts = [['all', 'All'], ['today', 'Today'], ['weekend', 'This weekend'], ['week', 'Next 7 days'], ['upcoming', 'Upcoming'], ['past', 'Past']]
      .map(function (c) { return { value: c[0], label: c[1] }; });
    var chips = ui.chips('#chips', chipOpts, state.when, function (v) { state.when = v; state.page = 1; $('#when').val(v); render(); });

    function syncUrl() {
      var p = new URLSearchParams();
      if (state.q) p.set('q', state.q);
      if (state.when !== 'all') p.set('when', state.when);
      if (state.loc) p.set('loc', state.loc);
      if (state.sort !== 'soonest') p.set('sort', state.sort);
      if (state.page > 1) p.set('page', state.page);
      history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : ''));
    }

    function filtered() {
      return kit.sortEvents(all.filter(function (ev) {
        return util.matches(state.q, [ev.title, ev.description, ev.location]) &&
          kit.matchesWhen(ev, state.when) &&
          (!state.loc || ev.location === state.loc);
      }), state.sort);
    }

    function render() {
      var list = filtered(), pg = ui.paginate(list, state.page, CE.config.PAGE_SIZE);
      state.page = pg.page; syncUrl();
      $('#result-count').text(pg.total ? 'Showing ' + pg.from + '–' + pg.to + ' of ' + util.plural(pg.total, 'event') : 'No events found');
      if (!pg.total) {
        var filteredOut = all.length > 0;
        $grid.html('<div class="sm:col-span-2 lg:col-span-3">' + ui.empty({
          icon: 'calendar', title: filteredOut ? 'No events match your filters' : 'No events published yet',
          message: filteredOut ? 'Try a different keyword, date or location.' : 'Check back soon — new community events are added regularly.',
          actions: filteredOut ? '<button type="button" class="js-clear ' + ui.btn('secondary', 'sm') + '">Clear filters</button>' :
            (isAdmin ? '<a href="' + util.url('admin/event-form.html') + '" class="' + ui.btn('primary', 'sm') + '">Create an event</a>' : '')
        }) + '</div>');
      } else {
        $grid.html(pg.items.map(function (ev) { return CE.cards.eventCard(ev, { isAdmin: isAdmin, registration: regs[ev.id] }); }).join(''));
      }
      ui.pagination('#pager', { page: pg.page, pages: pg.pages, onChange: function (p) { state.page = p; render(); $('#results-title').get(0).scrollIntoView({ behavior: 'smooth' }); $grid.find('a').first().trigger('focus'); } });
    }

    function load(fresh) {
      ui.busy($grid, true);
      $grid.html(ui.skeleton.cards(6));
      Promise.all([
        CE.data.events(fresh),
        isAdmin ? Promise.resolve([]) : CE.data.myRegistrations(fresh).catch(function () { return []; })
      ]).then(function (res) {
        // Users only ever see published events on the public list.
        all = res[0].filter(function (ev) { return ev.published !== false; });
        regs = kit.registrationMap(res[1]);
        var locs = Array.from(new Set(all.map(function (e) { return e.location; }).filter(Boolean))).sort();
        $('#loc').html('<option value="">All locations</option>' + locs.map(function (l) { return '<option>' + util.esc(l) + '</option>'; }).join('')).val(state.loc);
        if (state.loc && locs.indexOf(state.loc) === -1) state.loc = '';
        render();
      }).catch(function (err) {
        $grid.html('<div class="sm:col-span-2 lg:col-span-3">' + ui.errorState(err, { title: 'Couldn’t load events' }) + '</div>');
        $('#result-count').text('');
      }).finally(function () { ui.busy($grid, false); });
    }

    /* Filters */
    $('#q').on('input', util.debounce(function () { state.q = this.value; state.page = 1; render(); }, 200));
    $('#when').on('change', function () { state.when = this.value; state.page = 1; chips.set(chipOpts, state.when); render(); });
    $('#loc').on('change', function () { state.loc = this.value; state.page = 1; render(); });
    $('#sort').on('change', function () { state.sort = this.value; render(); });
    $('#filters').on('submit', function (e) { e.preventDefault(); });
    function clearAll() {
      state = { q: '', when: 'all', loc: '', sort: state.sort, page: 1 };
      $('#q').val(''); $('#when').val('all'); $('#loc').val(''); chips.set(chipOpts, 'all'); render();
    }
    $('#filters').on('reset', function (e) { e.preventDefault(); clearAll(); });
    $grid.on('click', '.js-clear', clearAll);
    $grid.on('click', '.ce-retry', function () { load(true); });

    /* Card actions */
    $grid.on('click', '[data-action="register"]', function () {
      var $btn = $(this), ev = all.find(function (e) { return e.id === String($btn.data('id')); });
      if (!ev) return;
      kit.register(ev, $btn).then(function (reg) { regs[ev.id] = reg; render(); }, function () {
        CE.data.myRegistrations(true).then(function (rows) { regs = kit.registrationMap(rows); render(); }).catch(function () {});
      });
    });
    // ROLE GUARD (UI): delete buttons only exist on admin cards; backend also requires role=admin.
    $grid.on('click', '[data-action="delete"]', function () {
      if (!isAdmin) return;
      var ev = all.find(function (e) { return e.id === String($(this).data('id')); }, this);
      if (ev) kit.remove(ev).then(function (ok) { if (ok) { all = all.filter(function (e) { return e.id !== ev.id; }); render(); } });
    });

    load(false);
  });
})(jQuery, window.CE);
