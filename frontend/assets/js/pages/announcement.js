/**
 * Announcement detail — GET /api/announcements/:id
 * HTML5 <audio src=audio_url> wrapped in an accessible custom player
 * (CE.media.AudioPlayer) with a fallback download when the format can't play.
 */
(function ($, CE) {
  'use strict';
  var ui = CE.ui, util = CE.util, esc = util.esc, icon = CE.icon;

  CE.boot({ auth: 'user', layout: 'public', nav: 'announcements' }, function () {
    var id = util.param('id'), isAdmin = CE.auth.isAdmin();
    var $root = $('#root'), item = null;

    function notFound() {
      $root.attr('aria-busy', 'false').html(ui.empty({ icon: 'megaphone', title: 'Announcement not found', message: 'It may have been removed or unpublished.', actions: '<a class="' + ui.btn('primary', 'sm') + '" href="' + util.url('announcements.html') + '">All announcements</a>' }));
    }
    if (!id) { notFound(); return; }

    function render() {
      document.title = item.title + ' · CivicConnect';
      $root.attr('aria-busy', 'false').html(
        // ROLE GUARD (UI): admin toolbar only for admins
        (isAdmin ? '<div id="admin-bar" class="mb-5">' + CE.adminContent.toolbar('announcement', item) + '</div>' : '') +
        '<div class="flex flex-wrap gap-2">' + ui.badge('Audio announcement', 'info') + (item.published === false ? ui.badge('Unpublished', 'accent') : ui.badge('Published', 'success')) + '</div>' +
        '<h1 class="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">' + esc(item.title) + '</h1>' +
        '<p class="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-muted">' +
          '<span class="inline-flex items-center gap-1.5">' + icon('calendar', 'w-4 h-4') + 'Posted <time datetime="' + esc(item.created_at) + '">' + esc(util.formatDateYear(item.created_at)) + ' · ' + esc(util.formatTime(item.created_at)) + '</time></span>' +
          '<span class="inline-flex items-center gap-1.5">' + icon('clock', 'w-4 h-4') + 'Duration <span data-duration-src="' + esc(item.audio_url) + '">--:--</span></span></p>' +
        '<div id="player" class="mt-6"></div>' +
        '<div id="fallback" class="mt-4 hidden"></div>' +
        '<section class="mt-6 ' + ui.cls.card + ' p-5 sm:p-6" aria-labelledby="acc-h">' +
          '<h2 id="acc-h" class="font-bold flex items-center gap-2">' + icon('file-text', 'w-5 h-5') + 'About this recording</h2>' +
          '<dl class="mt-4 grid sm:grid-cols-3 gap-4 text-sm">' +
            '<div><dt class="text-ink-muted">Title</dt><dd class="font-semibold mt-0.5">' + esc(item.title) + '</dd></div>' +
            '<div><dt class="text-ink-muted">Published</dt><dd class="font-semibold mt-0.5">' + esc(util.formatLongDate(item.created_at)) + '</dd></div>' +
            '<div><dt class="text-ink-muted">Format</dt><dd class="font-semibold mt-0.5 uppercase">' + esc(util.fileExt(item.audio_url) || 'audio') + '</dd></div></dl>' +
          '<a href="' + esc(item.audio_url) + '" download class="mt-5 ' + ui.btn('secondary', 'sm') + '">' + icon('download', 'w-3.5 h-3.5') + 'Download audio</a>' +
        '</section>'
      );
      new CE.media.AudioPlayer($('#player'), {
        src: item.audio_url, title: item.title,
        onError: function () {
          $('#fallback').removeClass('hidden').html('<div class="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-accent-soft text-accent-text px-4 py-3 text-sm" role="alert">' +
            icon('alert-circle', 'w-4 h-4') + '<span class="flex-1">Your browser can’t play this audio format (or the file is unavailable).</span>' +
            '<a href="' + esc(item.audio_url) + '" download class="' + ui.btn('secondary', 'sm') + '">Download ' + esc((util.fileExt(item.audio_url) || 'audio').toUpperCase()) + '</a></div>');
        }
      });
      CE.media.fillDurations($root);
      if (isAdmin) CE.adminContent.bindToolbar($('#admin-bar'), 'announcement', function () { return item; }, {
        onUpdate: function (u) { item = $.extend(item, u); render(); },
        onDelete: function () { util.flash.set('success', 'Announcement deleted'); location.href = util.url('announcements.html'); }
      });
    }

    function renderMore(rows) {
      var others = rows.filter(function (a) { return a.id !== id && a.published !== false; }).slice(0, 4);
      $('#more').html(others.length ? others.map(function (a) {
        return '<li><a href="' + util.url('announcement.html?id=' + encodeURIComponent(a.id)) + '" class="flex items-center gap-3 p-3 rounded-xl bg-white border border-line hover:border-brand/50 hover:shadow-card transition">' +
          '<span class="w-9 h-9 rounded-full bg-brand-soft text-brand flex items-center justify-center shrink-0">' + icon('play', 'w-3.5 h-3.5 ml-0.5') + '</span>' +
          '<span class="min-w-0"><span class="block text-sm font-semibold truncate">' + esc(a.title) + '</span><span class="block text-xs text-ink-muted"><span data-duration-src="' + esc(a.audio_url) + '">--:--</span> · ' + esc(util.formatDateYear(a.created_at)) + '</span></span></a></li>';
      }).join('') : '<li class="text-sm text-ink-muted">No other announcements yet.</li>');
      CE.media.fillDurations($('#more'));
    }

    function load() {
      CE.endpoints.announcement(id).then(function (r) {
        item = r.data;
        if (!item || (item.published === false && !isAdmin)) return notFound();
        render();
      }).catch(function (err) {
        if (err.status === 404) return notFound();
        $root.attr('aria-busy', 'false').html(ui.errorState(err, { title: 'Couldn’t load this announcement' }));
      });
      CE.data.announcements().then(renderMore).catch(function () { $('#more').html('<li class="text-sm text-ink-muted">Couldn’t load more announcements.</li>'); });
    }
    $root.on('click', '.ce-retry', load);
    load();
  });
})(jQuery, window.CE);
