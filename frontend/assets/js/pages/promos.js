/**
 * Promos list — GET /api/promos (published only, cached).
 * Thumbnails are the video's first frame, fetched lazily (metadata only)
 * once a card scrolls into view.
 */
(function ($, CE) {
  'use strict';
  var ui = CE.ui, util = CE.util;
  var PAGE = 9;

  CE.boot({ auth: 'user', layout: 'public', nav: 'promos' }, function () {
    var $grid = $('#grid'), all = [];
    var state = { q: util.param('q') || '', filter: 'all', page: 1 };
    $('#q').val(state.q);

    ui.chips('#chips', [{ value: 'all', label: 'All' }, { value: 'new', label: 'New this month' }, { value: 'cc', label: 'With captions' }], 'all',
      function (v) { state.filter = v; state.page = 1; render(); });

    function render() {
      var list = all.filter(function (p) {
        if (state.filter === 'cc' && !p.caption_text) return false;
        if (state.filter === 'new' && (Date.now() - new Date(p.created_at)) / 86400000 > 31) return false;
        return util.matches(state.q, [p.title, p.description, p.caption_text]);
      });
      var pg = ui.paginate(list, state.page, PAGE);
      state.page = pg.page;
      $('#result-count').text(pg.total ? 'Showing ' + pg.from + '–' + pg.to + ' of ' + util.plural(pg.total, 'video') : '');
      if (!pg.total) {
        $grid.html('<div class="sm:col-span-2 lg:col-span-3">' + ui.empty({
          icon: 'video', title: all.length ? 'No promos match' : 'No promo videos yet',
          message: all.length ? 'Try a different search or filter.' : 'Community campaign videos will appear here.',
          actions: CE.auth.isAdmin() && !all.length ? '<a class="' + ui.btn('primary', 'sm') + '" href="' + util.url('admin/promo-form.html') + '">Upload a promo</a>' : ''
        }) + '</div>');
      } else {
        $grid.html(pg.items.map(function (p) { return CE.cards.promoCard(p); }).join(''));
        CE.media.lazyVideos($grid);
      }
      ui.pagination('#pager', { page: pg.page, pages: pg.pages, onChange: function (p) { state.page = p; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
    }

    function load(fresh) {
      ui.busy($grid, true); $grid.html(ui.skeleton.cards(6, { media: 'aspect-video' }));
      CE.data.promos(fresh).then(function (rows) {
        all = rows.filter(function (p) { return p.published !== false; });
        render();
      }).catch(function (err) {
        $grid.html('<div class="sm:col-span-2 lg:col-span-3">' + ui.errorState(err, { title: 'Couldn’t load promos' }) + '</div>');
      }).finally(function () { ui.busy($grid, false); });
    }

    $('#q').on('input', util.debounce(function () { state.q = this.value; state.page = 1; render(); }, 200));
    $grid.on('click', '.ce-retry', function () { load(true); });
    load(false);
  });
})(jQuery, window.CE);
