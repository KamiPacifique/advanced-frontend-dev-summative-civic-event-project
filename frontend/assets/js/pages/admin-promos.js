/**
 * Admin › Promos — every promo (published or not) with publish toggle,
 * edit (promo-form.html) and delete.
 */
(function ($, CE) {
  'use strict';
  var ui = CE.ui, util = CE.util, esc = util.esc, icon = CE.icon, admin = CE.adminContent;

  // ROLE GUARD: admin-only page.
  CE.boot({ auth: 'admin', layout: 'admin', nav: 'admin-promos', title: 'Promos', crumb: 'Promos' }, function () {
    var $rows = $('#rows'), all = [], state = { q: '', f: 'all', page: 1 }, chips = null;

    function opts() {
      var pub = all.filter(function (p) { return p.published !== false; }).length;
      return [{ value: 'all', label: 'All', count: all.length }, { value: 'pub', label: 'Published', count: pub }, { value: 'draft', label: 'Unpublished', count: all.length - pub }];
    }

    function row(p) {
      var sid = 'pp-' + p.id;
      return '<tr class="border-t border-line hover:bg-canvas" data-id="' + esc(p.id) + '" data-card>' +
        '<td class="px-4 py-3"><div class="flex items-center gap-3"><span class="relative w-24 aspect-video rounded-lg overflow-hidden shrink-0 ' + util.gradientFor(p.id) + '"><video data-lazy-src="' + esc(p.video_url) + '" muted playsinline preload="none" class="absolute inset-0 w-full h-full object-cover" aria-hidden="true" tabindex="-1"></video><span class="ce-vdur hidden absolute right-1 bottom-1 px-1 rounded bg-black/70 text-white text-[10px] font-bold"></span></span>' +
          '<div class="min-w-0"><a href="' + util.url('promo.html?id=' + encodeURIComponent(p.id)) + '" class="font-semibold hover:text-brand">' + esc(p.title) + '</a><p class="text-xs text-ink-muted clamp-2 max-w-xs">' + esc(p.description || '') + '</p></div></div></td>' +
        '<td class="px-4 py-3">' + (p.caption_text ? ui.badge('CC · English', 'brand') : ui.badge('None', 'neutral')) + '</td>' +
        '<td class="px-4 py-3 text-ink-secondary whitespace-nowrap">' + esc(util.formatDateYear(p.created_at)) + '</td>' +
        '<td class="px-4 py-3"><label for="' + sid + '" class="flex items-center gap-2"><span class="switch"><input id="' + sid + '" type="checkbox" role="switch" data-pub ' + (p.published !== false ? 'checked' : '') + '><span class="track"></span><span class="thumb"></span></span><span class="text-xs font-semibold ' + (p.published !== false ? 'text-success' : 'text-ink-muted') + '">' + (p.published !== false ? 'Published' : 'Unpublished') + '</span></label></td>' +
        '<td class="px-4 py-3"><div class="flex justify-end gap-1">' +
          '<a href="' + util.url('promo.html?id=' + encodeURIComponent(p.id)) + '" class="' + ui.cls.iconBtn + '" aria-label="Watch ' + esc(p.title) + '">' + icon('eye', 'w-4 h-4') + '</a>' +
          '<a href="promo-form.html?id=' + encodeURIComponent(p.id) + '" class="' + ui.cls.iconBtn + '" aria-label="Edit ' + esc(p.title) + '">' + icon('pencil', 'w-4 h-4') + '</a>' +
          '<button type="button" data-del class="' + ui.cls.iconBtn + ' !text-danger hover:!bg-danger-soft" aria-label="Delete ' + esc(p.title) + '">' + icon('trash', 'w-4 h-4') + '</button></div></td></tr>';
    }

    function render() {
      var list = all.filter(function (p) {
        if (state.f === 'pub' && p.published === false) return false;
        if (state.f === 'draft' && p.published !== false) return false;
        return util.matches(state.q, [p.title, p.description]);
      });
      var pg = ui.paginate(list, state.page, CE.config.ADMIN_PAGE_SIZE);
      state.page = pg.page;
      $('#count').text(pg.total ? 'Showing ' + pg.from + '–' + pg.to + ' of ' + util.plural(pg.total, 'promo') : '');
      $rows.html(pg.total ? pg.items.map(row).join('') : '<tr><td colspan="5" class="p-6">' + ui.empty({ bare: true, icon: 'video', title: all.length ? 'No promos match' : 'No promos yet', actions: all.length ? '' : '<a class="' + ui.btn('primary', 'sm') + '" href="promo-form.html">Upload promo</a>' }) + '</td></tr>');
      CE.media.lazyVideos($rows);
      ui.pagination('#pager', { page: pg.page, pages: pg.pages, onChange: function (p) { state.page = p; render(); } });
      if (chips) chips.set(opts());
    }
    function find(el) { var id = String($(el).closest('[data-id]').data('id')); return all.find(function (p) { return p.id === id; }); }

    function load() {
      ui.busy($rows, true); $rows.html(ui.skeleton.rows(4, 5));
      CE.data.promos(true).then(function (rows) {
        all = rows;
        chips = chips || ui.chips('#chips', opts(), 'all', function (v) { state.f = v; state.page = 1; render(); });
        render();
      }).catch(function (err) { $rows.html('<tr><td colspan="5" class="p-6">' + ui.errorState(err, { bare: true }) + '</td></tr>'); })
        .finally(function () { ui.busy($rows, false); });
    }

    $('#q').on('input', util.debounce(function () { state.q = this.value; state.page = 1; render(); }, 150));
    $rows.on('click', '.ce-retry', load);
    $rows.on('change', '[data-pub]', function () {
      var $sw = $(this), p = find(this), on = $sw.is(':checked');
      $sw.prop('disabled', true);
      admin.setPublished('promo', p, on).then(function (u) { $.extend(p, u); render(); })
        .catch(function () { $sw.prop('checked', !on); }).finally(function () { $sw.prop('disabled', false); });
    });
    $rows.on('click', '[data-del]', function () {
      var p = find(this);
      admin.remove('promo', p).then(function (ok) { if (ok) { all = all.filter(function (x) { return x.id !== p.id; }); render(); } });
    });
    load();
  });
})(jQuery, window.CE);
