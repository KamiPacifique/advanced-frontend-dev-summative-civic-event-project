/**
 * CE.cards — HTML renderers for list items (events, announcements, promos).
 * Pure functions: data in, escaped HTML string out. Behaviour is attached by
 * the page scripts through delegated events on [data-action] buttons.
 */
(function (w, $) {
  'use strict';
  var CE = w.CE, util = CE.util, esc = util.esc, icon = CE.icon, ui = CE.ui;
  var u = util.url;

  function dateTile(iso, size) {
    var big = size === 'lg';
    return '<div class="bg-white rounded-lg shadow-sm text-center ' + (big ? 'w-14 py-1.5' : 'w-11 py-1') + '" aria-hidden="true">' +
      '<p class="text-[10px] font-bold tracking-wider text-danger">' + esc(util.monthShort(iso)) + '</p>' +
      '<p class="' + (big ? 'text-2xl' : 'text-xl') + ' font-extrabold leading-none text-ink pb-0.5">' + esc(util.dayNum(iso)) + '</p></div>';
  }

  /** Solid date block used in "My registrations" rows. */
  function dateBlock(iso, key) {
    return '<div class="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-xl ' + util.gradientFor(key || iso) + ' text-white flex flex-col items-center justify-center shrink-0" aria-hidden="true">' +
      '<span class="text-[10px] font-bold tracking-wider opacity-90">' + esc(util.monthShort(iso)) + '</span><span class="text-2xl font-extrabold leading-none">' + esc(util.dayNum(iso)) + '</span></div>';
  }

  function eventImage(ev, cls) {
    var img = ev.metadata && ev.metadata.image_url;
    if (img) return '<img src="' + esc(img) + '" alt="' + esc('Image for ' + ev.title) + '" loading="lazy" class="w-full h-full object-cover ' + (cls || '') + '" onerror="this.replaceWith(Object.assign(document.createElement(\'div\'),{className:\'w-full h-full ' + util.gradientFor(ev.id) + '\'}))">';
    return '<div class="w-full h-full ' + util.gradientFor(ev.id) + ' ' + (cls || '') + '" role="img" aria-label="' + esc(ev.title) + ' (no image)"></div>';
  }

  var STATUS_BADGE = { upcoming: ['Upcoming', 'brand'], ongoing: ['Happening now', 'success'], past: ['Ended', 'neutral'] };
  function statusBadge(ev) { var s = STATUS_BADGE[util.eventStatus(ev)]; return ui.badge(s[0], s[1]); }

  /**
   * eventCard(ev, { registration, isAdmin })
   * registration: undefined | { status: 'registered' | 'cancelled' }
   */
  function eventCard(ev, ctx) {
    ctx = ctx || {};
    var status = util.eventStatus(ev), reg = ctx.registration;
    var actions = '<a href="' + u('event.html?id=' + encodeURIComponent(ev.id)) + '" class="' + ui.btn('secondary', 'sm') + '">View details<span class="sr-only"> for ' + esc(ev.title) + '</span></a>';

    if (ctx.isAdmin) {
      // ROLE GUARD (UI): edit / delete only for admins.
      actions += '<a href="' + u('admin/event-form.html?id=' + encodeURIComponent(ev.id)) + '" class="' + ui.btn('secondary', 'sm') + '">' + icon('pencil', 'w-3.5 h-3.5') + 'Edit<span class="sr-only"> ' + esc(ev.title) + '</span></a>' +
        '<button type="button" data-action="delete" data-id="' + esc(ev.id) + '" class="' + ui.btn('dangerOutline', 'sm') + ' !px-2.5" aria-label="Delete ' + esc(ev.title) + '">' + icon('trash', 'w-3.5 h-3.5') + '</button>';
    } else if (reg && reg.status === 'registered') {
      actions += '<span class="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-success-soft text-success text-xs font-semibold">' + icon('check', 'w-3.5 h-3.5') + 'Registered</span>';
    } else if (reg && reg.status === 'cancelled') {
      actions += '<span class="inline-flex items-center h-8 px-3 rounded-lg bg-subtle text-ink-muted text-xs font-semibold">Cancelled</span>';
    } else if (status === 'past') {
      actions += '<span class="inline-flex items-center h-8 px-3 rounded-lg bg-subtle text-ink-muted text-xs font-semibold">Event ended</span>';
    } else {
      actions += '<button type="button" data-action="register" data-id="' + esc(ev.id) + '" class="' + ui.btn('primary', 'sm') + '">Register<span class="sr-only"> for ' + esc(ev.title) + '</span></button>';
    }

    return '<article data-card data-id="' + esc(ev.id) + '" class="group ' + ui.cls.card + ' overflow-hidden flex flex-col hover:shadow-pop hover:-translate-y-0.5 transition">' +
      '<div class="relative h-44 overflow-hidden">' + eventImage(ev, 'group-hover:scale-[1.03] transition-transform duration-300') +
        '<div class="absolute top-3 left-3">' + dateTile(ev.starts_at) + '</div>' +
        (ctx.isAdmin && ev.published === false ? '<div class="absolute top-3 right-3">' + ui.badge('Draft', 'accent') + '</div>' : '') +
      '</div>' +
      '<div class="p-5 flex-1 flex flex-col">' +
        '<div class="flex flex-wrap gap-1.5 mb-2.5">' + statusBadge(ev) + '</div>' +
        '<h3 class="text-lg font-bold leading-snug"><a href="' + u('event.html?id=' + encodeURIComponent(ev.id)) + '" class="hover:text-brand">' + esc(ev.title) + '</a></h3>' +
        '<ul class="mt-2.5 space-y-1.5 text-sm text-ink-secondary">' +
          '<li class="flex items-start gap-2">' + icon('calendar', 'w-4 h-4 mt-0.5 shrink-0 text-ink-muted') + '<span>' + esc(util.formatRange(ev.starts_at, ev.ends_at)) + '</span></li>' +
          '<li class="flex items-start gap-2">' + icon('map-pin', 'w-4 h-4 mt-0.5 shrink-0 text-ink-muted') + '<span>' + esc(ev.location || 'Location to be announced') + '</span></li>' +
        '</ul>' +
        (ev.description ? '<p class="mt-3 text-sm text-ink-muted clamp-2">' + esc(ev.description) + '</p>' : '') +
        '<div class="mt-auto pt-5 flex flex-wrap items-center gap-2">' + actions + '</div>' +
      '</div></article>';
  }

  /** Announcement card with inline play button and decorative waveform. */
  function announcementCard(a, ctx) {
    ctx = ctx || {};
    var href = u('announcement.html?id=' + encodeURIComponent(a.id));
    return '<article data-card data-id="' + esc(a.id) + '" class="' + ui.cls.card + ' p-5 flex flex-col hover:shadow-pop hover:border-brand/40 transition">' +
      '<div class="flex items-start gap-3">' +
        '<button type="button" data-action="play" data-src="' + esc(a.audio_url) + '" class="w-11 h-11 rounded-full bg-brand text-white flex items-center justify-center shrink-0 hover:bg-brand-hover shadow-sm" aria-label="Play ' + esc(a.title) + '" aria-pressed="false">' + icon('play', 'w-4 h-4 ml-0.5') + '</button>' +
        '<div class="min-w-0 flex-1"><h3 class="font-bold leading-snug"><a href="' + href + '" class="hover:text-brand">' + esc(a.title) + '</a></h3>' +
          '<p class="mt-1 text-xs text-ink-muted flex items-center gap-1.5">' + icon('clock', 'w-3.5 h-3.5') + '<span data-duration-src="' + esc(a.audio_url) + '">--:--</span><span aria-hidden="true">·</span><time datetime="' + esc(a.created_at) + '">' + esc(util.formatDateYear(a.created_at)) + '</time></p></div>' +
      '</div>' +
      '<div class="mt-4">' + CE.media.waveform(a.id, 44) + '</div>' +
      '<div class="mt-4 flex items-center justify-between gap-2">' +
        (ctx.isAdmin && a.published === false ? ui.badge('Unpublished', 'accent') : ui.badge('Audio', 'info')) +
        '<a href="' + href + '" class="text-sm font-semibold text-brand hover:underline">Open player<span class="sr-only"> for ' + esc(a.title) + '</span></a>' +
      '</div></article>';
  }

  /** Promo card: lazily loaded first-frame thumbnail, CC + duration badges. */
  function promoCard(p, ctx) {
    ctx = ctx || {};
    var href = u('promo.html?id=' + encodeURIComponent(p.id));
    return '<article data-card data-id="' + esc(p.id) + '" class="group ' + ui.cls.card + ' overflow-hidden flex flex-col hover:shadow-pop transition">' +
      '<a href="' + href + '" class="relative block aspect-video ' + util.gradientFor(p.id) + ' overflow-hidden" aria-label="Watch ' + esc(p.title) + '">' +
        '<video data-lazy-src="' + esc(p.video_url) + '" muted playsinline preload="none" class="absolute inset-0 w-full h-full object-cover" aria-hidden="true" tabindex="-1"></video>' +
        '<span class="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></span>' +
        '<span class="absolute inset-0 flex items-center justify-center"><span class="w-14 h-14 rounded-full bg-white text-brand flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">' + icon('play', 'w-6 h-6 ml-0.5') + '</span></span>' +
        (p.caption_text ? '<span class="absolute left-3 bottom-3 h-6 px-2 rounded bg-black/70 text-white text-[11px] font-bold flex items-center" title="Captions available">CC</span>' : '') +
        '<span class="ce-vdur hidden absolute right-3 bottom-3 h-6 px-2 rounded bg-black/70 text-white text-[11px] font-bold flex items-center tabular-nums"></span>' +
        (ctx.isAdmin && p.published === false ? '<span class="absolute right-3 top-3">' + ui.badge('Unpublished', 'accent') + '</span>' : '') +
      '</a>' +
      '<div class="p-4 sm:p-5"><h3 class="font-bold leading-snug"><a href="' + href + '" class="hover:text-brand">' + esc(p.title) + '</a></h3>' +
        (p.description ? '<p class="mt-1.5 text-sm text-ink-muted clamp-2">' + esc(p.description) + '</p>' : '') +
      '</div></article>';
  }

  CE.cards = {
    dateTile: dateTile, dateBlock: dateBlock, eventImage: eventImage, statusBadge: statusBadge,
    eventCard: eventCard, announcementCard: announcementCard, promoCard: promoCard
  };
})(window, jQuery);
