/**
 * Announcements list — GET /api/announcements (published only).
 * Cards show title, length (read from the audio file's metadata — the API
 * has no duration column), date and an inline play button.
 */
(function ($, CE) {
  'use strict';
  var ui = CE.ui, util = CE.util;
  var PAGE = 9;

  CE.boot({ auth: 'user', layout: 'public', nav: 'announcements' }, function () {
    var $grid = $('#grid'), all = [];
    var state = { q: util.param('q') || '', when: 'all', page: 1 };
    $('#q').val(state.q);

    var chipOpts = [{ value: 'all', label: 'All' }, { value: 'week', label: 'This week' }, { value: 'month', label: 'This month' }, { value: 'older', label: 'Older' }];
    ui.chips('#chips', chipOpts, 'all', function (v) { state.when = v; state.page = 1; render(); });

    function inWindow(a) {
      var age = (Date.now() - new Date(a.created_at).getTime()) / 86400000;
      if (state.when === 'week') return age <= 7;
      if (state.when === 'month') return age <= 31;
      if (state.when === 'older') return age > 31;
      return true;
    }

    function render() {
      var list = all.filter(function (a) { return inWindow(a) && util.matches(state.q, [a.title]); });
      var pg = ui.paginate(list, state.page, PAGE);
      state.page = pg.page;
      $('#result-count').text(pg.total ? 'Showing ' + pg.from + '–' + pg.to + ' of ' + util.plural(pg.total, 'announcement') : '');
      if (!pg.total) {
        $grid.html('<div class="sm:col-span-2 lg:col-span-3">' + ui.empty({
          icon: 'megaphone', title: all.length ? 'No announcements match' : 'No announcements yet',
          message: all.length ? 'Try another search or date filter.' : 'Official updates from your district will appear here.',
          actions: CE.auth.isAdmin() && !all.length ? '<a class="' + ui.btn('primary', 'sm') + '" href="' + util.url('admin/announcements.html') + '">Upload an announcement</a>' : ''
        }) + '</div>');
      } else {
        $grid.html(pg.items.map(function (a) { return CE.cards.announcementCard(a); }).join(''));
        CE.media.fillDurations($grid);
      }
      ui.pagination('#pager', { page: pg.page, pages: pg.pages, onChange: function (p) { state.page = p; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
    }

    function load(fresh) {
      ui.busy($grid, true); $grid.html(ui.skeleton.cards(6, { media: 'h-16' }));
      CE.data.announcements(fresh).then(function (rows) {
        all = rows.filter(function (a) { return a.published !== false; })
          .sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
        render();
      }).catch(function (err) {
        $grid.html('<div class="sm:col-span-2 lg:col-span-3">' + ui.errorState(err, { title: 'Couldn’t load announcements' }) + '</div>');
      }).finally(function () { ui.busy($grid, false); });
    }

    $('#q').on('input', util.debounce(function () { state.q = this.value; state.page = 1; render(); }, 200));
    $grid.on('click', '.ce-retry', function () { load(true); });
    $grid.on('click', '[data-action="play"]', function () {
      var $btn = $(this);
      CE.media.miniToggle($btn.data('src'), $btn, $btn.closest('[data-card]').find('.waveform'));
    });

    load(false);
  });
})(jQuery, window.CE);
