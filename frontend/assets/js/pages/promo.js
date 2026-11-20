/**
 * Promo detail — GET /api/promos/:id
 * <video src=video_url controls> with <track kind="captions" srclang="en"
 * label="English" default>. The API stores captions as `caption_text`, so we
 * convert that to WebVTT in the browser (Blob URL) and turn it on by default.
 * A readable transcript (click a line to jump there) is shown underneath.
 */
(function ($, CE) {
  'use strict';
  var ui = CE.ui, util = CE.util, esc = util.esc, icon = CE.icon, media = CE.media;

  CE.boot({ auth: 'user', layout: 'public', nav: 'promos' }, function () {
    var id = util.param('id'), isAdmin = CE.auth.isAdmin();
    var $root = $('#root'), item = null, trackUrl = null;

    function notFound() {
      $root.attr('aria-busy', 'false').html(ui.empty({ icon: 'video', title: 'Promo not found', message: 'It may have been removed or unpublished.', actions: '<a class="' + ui.btn('primary', 'sm') + '" href="' + util.url('promos.html') + '">All promos</a>' }));
    }
    if (!id) { notFound(); return; }

    function attachTrack(video, duration) {
      if (!item.caption_text) return;
      $(video).find('track').remove();
      if (trackUrl) URL.revokeObjectURL(trackUrl);
      trackUrl = media.trackURL(item.caption_text, duration);
      var t = document.createElement('track');
      t.kind = 'captions'; t.srclang = 'en'; t.label = 'English'; t.default = true; t.src = trackUrl;
      video.appendChild(t);
      // Make sure captions are visible by default.
      setTimeout(function () { if (video.textTracks[0]) { video.textTracks[0].mode = 'showing'; syncCcButton(video); } }, 0);
    }
    function syncCcButton(video) {
      var on = video.textTracks[0] && video.textTracks[0].mode === 'showing';
      $('.js-cc').attr('aria-pressed', on ? 'true' : 'false').toggleClass('bg-accent text-inverse border-accent', !!on)
        .find('.js-cc-label').text(on ? 'Captions on' : 'Captions off');
    }

    function render() {
      document.title = item.title + ' · CivicConnect';
      var cues = media.transcript(item.caption_text);
      // YouTube / Vimeo links play in the provider's own player (with its own captions).
      var ext = media.videoEmbed(item.video_url), cc = item.caption_text && !ext;
      $root.attr('aria-busy', 'false').html(
        (isAdmin ? '<div id="admin-bar" class="mb-5">' + CE.adminContent.toolbar('promo', item) + '</div>' : '') +
        '<div class="rounded-2xl overflow-hidden bg-inverse shadow-pop">' +
          (ext ? media.embedFrame(ext, item.title, 'block w-full aspect-video bg-black border-0') :
          '<video id="video" class="w-full aspect-video bg-black" controls playsinline preload="metadata" aria-label="' + esc(item.title) + '">' +
            '<source src="' + esc(item.video_url) + '">' +
            'Your browser doesn’t support HTML5 video. <a href="' + esc(item.video_url) + '" download>Download the video</a>.' +
          '</video>') + '</div>' +
        '<div id="fallback" class="mt-3 hidden"></div>' +
        '<div class="mt-4 flex flex-wrap items-center gap-2">' +
          (item.caption_text ? ui.badge(ext ? 'Transcript available' : 'Captions available', 'brand') : ui.badge('No captions', 'neutral')) +
          (ext ? ui.badge(ext.provider === 'youtube' ? 'YouTube' : 'Vimeo', 'neutral') : '') +
          (item.published === false ? ui.badge('Unpublished', 'accent') : '') +
          '<span class="text-xs text-ink-muted ml-1">Added ' + esc(util.formatDateYear(item.created_at)) + '</span>' +
          '<span class="ml-auto flex gap-2">' +
            (cc ? '<button type="button" class="js-cc inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-line text-xs font-semibold" aria-pressed="true">' + icon('captions', 'w-4 h-4') + '<span class="js-cc-label">Captions on</span></button>' : '') +
            (ext ? '<a href="' + esc(item.video_url) + '" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-line bg-white text-xs font-semibold hover:bg-subtle">Watch on ' + (ext.provider === 'youtube' ? 'YouTube' : 'Vimeo') + '<span class="sr-only"> (opens in a new tab)</span></a>' :
            '<button type="button" class="js-fs inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-line bg-white text-xs font-semibold hover:bg-subtle">' + icon('maximize', 'w-4 h-4') + 'Fullscreen</button>') +
          '</span></div>' +
        '<h1 class="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">' + esc(item.title) + '</h1>' +
        (item.description ? '<p class="mt-3 text-ink-secondary leading-relaxed">' + esc(item.description) + '</p>' : '') +
        '<section class="mt-6 ' + ui.cls.card + ' p-5" aria-labelledby="tr-h">' +
          '<div class="flex items-center justify-between gap-3"><h2 id="tr-h" class="font-bold flex items-center gap-2">' + icon('file-text', 'w-5 h-5') + 'Video transcript</h2>' +
            (cues.length ? '<button type="button" class="js-tr-toggle text-sm font-semibold text-brand hover:underline" aria-expanded="true" aria-controls="transcript">Hide</button>' : '') + '</div>' +
          '<div id="transcript" class="mt-3">' + (cues.length ? '<ol class="space-y-1">' + cues.map(function (c) {
            return '<li>' + (c.time !== null ? '<button type="button" data-seek="' + c.seconds + '" class="w-full text-left flex gap-3 rounded-lg px-2 py-1.5 hover:bg-subtle"><span class="w-12 shrink-0 text-xs font-semibold text-brand tabular-nums pt-0.5">' + esc(c.time) + '</span><span class="text-sm text-ink-secondary">' + esc(c.text) + '</span></button>'
              : '<p class="text-sm text-ink-secondary leading-relaxed whitespace-pre-line">' + esc(c.text) + '</p>') + '</li>';
          }).join('') + '</ol>' : '<p class="text-sm text-ink-muted">No transcript was provided for this video. ' + esc(item.description || '') + '</p>') + '</div>' +
        '</section>'
      );

      if (isAdmin) CE.adminContent.bindToolbar($('#admin-bar'), 'promo', function () { return item; }, {
        onUpdate: function (u) { item = $.extend(item, u); render(); },
        onDelete: function () { util.flash.set('success', 'Promo deleted'); location.href = util.url('promos.html'); }
      });
      if (ext) return;

      var video = document.getElementById('video');
      attachTrack(video, null);
      video.addEventListener('loadedmetadata', function () {
        // Plain-text captions get re-timed to the real duration.
        if (item.caption_text && !media.isVTT(item.caption_text) && !/-->/.test(item.caption_text)) attachTrack(video, video.duration);
      }, { once: true });
      if (video.textTracks) video.textTracks.addEventListener('change', function () { syncCcButton(video); });
      video.addEventListener('error', showFallback, true);
      $(video).find('source').on('error', showFallback);
    }

    function showFallback() {
      $('#fallback').removeClass('hidden').html('<div class="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-accent-soft text-accent-text px-4 py-3 text-sm" role="alert">' +
        icon('alert-circle', 'w-4 h-4') + '<span class="flex-1">This video can’t be played in your browser (unsupported format or unavailable file).</span>' +
        '<a href="' + esc(item.video_url) + '" download class="' + ui.btn('secondary', 'sm') + '">Download video</a></div>');
    }

    $root.on('click', '.js-cc', function () {
      var v = document.getElementById('video'), t = v.textTracks[0]; if (!t) return;
      t.mode = t.mode === 'showing' ? 'hidden' : 'showing'; syncCcButton(v);
    });
    $root.on('click', '.js-fs', function () {
      var v = document.getElementById('video');
      (v.requestFullscreen || v.webkitEnterFullscreen || v.webkitRequestFullscreen || function () {}).call(v);
    });
    $root.on('click', '[data-seek]', function () {
      var sec = Number($(this).data('seek')), ext = media.videoEmbed(item.video_url);
      if (ext) { $root.find('iframe').attr('src', ext.embed(sec, true)); return; }
      var v = document.getElementById('video'); if (!v) return; v.currentTime = sec; v.play().catch(function () {});
    });
    $root.on('click', '.js-tr-toggle', function () {
      var open = $(this).attr('aria-expanded') === 'true';
      $('#transcript').toggleClass('hidden', open);
      $(this).attr('aria-expanded', String(!open)).text(open ? 'Show' : 'Hide');
    });

    function renderNext(rows) {
      var others = rows.filter(function (p) { return p.id !== id && p.published !== false; }).slice(0, 4);
      $('#next').html(others.length ? others.map(function (p) {
        return '<li data-card><a href="' + util.url('promo.html?id=' + encodeURIComponent(p.id)) + '" class="flex gap-3 items-center p-2 rounded-xl hover:bg-white hover:shadow-card transition">' +
          '<span class="relative w-28 aspect-video rounded-lg overflow-hidden shrink-0 ' + util.gradientFor(p.id) + '"><video data-lazy-src="' + esc(p.video_url) + '" muted playsinline preload="none" class="absolute inset-0 w-full h-full object-cover" aria-hidden="true" tabindex="-1"></video>' +
            '<span class="absolute inset-0 flex items-center justify-center text-white">' + icon('play', 'w-5 h-5') + '</span></span>' +
          '<span class="min-w-0"><span class="block text-sm font-semibold clamp-2">' + esc(p.title) + '</span><span class="block text-xs text-ink-muted mt-0.5"><span class="ce-vdur">' + '' + '</span>' + (p.caption_text ? ' CC' : '') + '</span></span></a></li>';
      }).join('') : '<li class="text-sm text-ink-muted">No other promos yet.</li>');
      media.lazyVideos($('#next'));
    }

    function load() {
      CE.endpoints.promo(id).then(function (r) {
        item = r.data;
        if (!item || (item.published === false && !isAdmin)) return notFound();
        render();
      }).catch(function (err) {
        if (err.status === 404) return notFound();
        $root.attr('aria-busy', 'false').html(ui.errorState(err, { title: 'Couldn’t load this promo' }));
      });
      CE.data.promos().then(renderNext).catch(function () { $('#next').html('<li class="text-sm text-ink-muted">Couldn’t load more promos.</li>'); });
    }
    $root.on('click', '.ce-retry', load);
    load();
  });
})(jQuery, window.CE);
