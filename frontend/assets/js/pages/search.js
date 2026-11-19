/**
 * Global search — the API has no search endpoint, so we search the cached
 * lists of events, announcements and promos client-side (published only).
 */
(function ($, CE) {
  'use strict';
  var ui = CE.ui, util = CE.util, esc = util.esc;

  CE.boot({ auth: 'user', layout: 'public', nav: null }, function () {
    var data = null, isAdmin = CE.auth.isAdmin();
    var q = util.param('q') || '';
    $('#sq').val(q).trigger('focus');

    function section(title, count, inner, href) {
      return '<section><div class="flex items-center justify-between gap-3"><h2 class="text-lg font-bold">' + esc(title) + ' <span class="text-ink-muted font-semibold">(' + count + ')</span></h2>' +
        (href ? '<a href="' + util.url(href) + '" class="text-sm font-semibold text-brand hover:underline">See all</a>' : '') + '</div>' + inner + '</section>';
    }

    function render() {
      var term = $.trim(q);
      if (!term) { $('#summary').text(''); $('#results').html(ui.empty({ icon: 'search', title: 'Search events, announcements and promos', message: 'Type a keyword above. Tip: press “/” anywhere to jump to search.' })); return; }
      var ev = data.events.filter(function (e) { return util.matches(term, [e.title, e.description, e.location]); });
      var an = data.announcements.filter(function (a) { return util.matches(term, [a.title]); });
      var pr = data.promos.filter(function (p) { return util.matches(term, [p.title, p.description, p.caption_text]); });
      var total = ev.length + an.length + pr.length;
      $('#summary').text(total ? util.plural(total, 'result') + ' for “' + term + '”' : 'No results for “' + term + '”');
      if (!total) { $('#results').html(ui.empty({ icon: 'search', title: 'Nothing found', message: 'Try a shorter or different keyword.' })); return; }
      var html = '';
      if (ev.length) html += section('Events', ev.length, '<div class="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">' + CE.eventsKit.sortEvents(ev, 'soonest').slice(0, 6).map(function (e) { return CE.cards.eventCard(e, { isAdmin: isAdmin }); }).join('') + '</div>', 'events.html?q=' + encodeURIComponent(term));
      if (an.length) html += section('Announcements', an.length, '<div class="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">' + an.slice(0, 6).map(function (a) { return CE.cards.announcementCard(a); }).join('') + '</div>', 'announcements.html?q=' + encodeURIComponent(term));
      if (pr.length) html += section('Promos', pr.length, '<div class="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">' + pr.slice(0, 6).map(function (p) { return CE.cards.promoCard(p); }).join('') + '</div>', 'promos.html?q=' + encodeURIComponent(term));
      $('#results').html(html);
      CE.media.fillDurations($('#results')); CE.media.lazyVideos($('#results'));
    }

    function load() {
      $('#results').html('<div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">' + ui.skeleton.cards(3) + '</div>');
      var pub = function (rows) { return rows.filter(function (r) { return r.published !== false; }); };
      Promise.all([CE.data.events(), CE.data.announcements(), CE.data.promos()]).then(function (res) {
        data = { events: pub(res[0]), announcements: pub(res[1]), promos: pub(res[2]) };
        render();
      }).catch(function (err) { $('#results').html(ui.errorState(err, { title: 'Search is unavailable' })); });
    }

    $('#search-form').on('submit', function (e) { e.preventDefault(); });
    $('#sq').on('input', util.debounce(function () {
      q = this.value; history.replaceState(null, '', q ? '?q=' + encodeURIComponent(q) : location.pathname);
      if (data) render();
    }, 200));
    $('#results').on('click', '.ce-retry', load);
    $('#results').on('click', '[data-action="play"]', function () { CE.media.miniToggle($(this).data('src'), $(this), $(this).closest('[data-card]').find('.waveform')); });
    $('#results').on('click', '[data-action="register"]', function () {
      var $b = $(this), e = data.events.find(function (x) { return x.id === String($b.data('id')); });
      CE.eventsKit.register(e, $b).then(function () { $b.replaceWith('<span class="inline-flex items-center h-8 px-3 rounded-lg bg-success-soft text-success text-xs font-semibold">Registered</span>'); }).catch(function () {});
    });
    load();
  });
})(jQuery, window.CE);
