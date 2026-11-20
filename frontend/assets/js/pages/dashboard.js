/**
 * Resident dashboard (landing page after login for role "user").
 *   GET /api/dashboard/me              → personal counters
 *   GET /api/event-registrations/my-registrations, /api/events,
 *   /api/announcements, /api/promos   → the content sections
 * Admins are redirected to the admin dashboard.
 */
(function ($, CE) {
  'use strict';
  var ui = CE.ui, util = CE.util, esc = util.esc, icon = CE.icon, kit = CE.eventsKit;

  CE.boot({ auth: 'user', layout: 'public', nav: 'home' }, function () {
    // ROLE GUARD (UI): admins have their own dashboard.
    if (CE.auth.isAdmin()) { location.replace(util.url('admin/index.html')); return; }

    var user = CE.auth.user(), h = new Date().getHours();
    $('#greeting').text((h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening') + ', ' + util.firstName(user.full_name));

    function statCard(ic, tone, label, value, href) {
      return '<a href="' + util.url(href) + '" class="' + ui.cls.card + ' p-4 sm:p-5 hover:shadow-pop hover:-translate-y-0.5 transition block">' +
        '<span class="w-9 h-9 rounded-lg flex items-center justify-center ' + tone + '">' + icon(ic, 'w-5 h-5') + '</span>' +
        '<p class="mt-3 text-2xl sm:text-3xl font-extrabold tabular-nums">' + esc(value) + '</p><p class="text-sm text-ink-secondary">' + esc(label) + '</p></a>';
    }
    function renderStats(s) {
      s = s || {};
      $('#stats').attr('aria-busy', 'false').html(
        statCard('ticket', 'bg-brand-soft text-brand', 'Events registered', s.registrations ? util.formatNumber(s.registrations.total_registered_events) : '—', 'my-registrations.html') +
        statCard('star', 'bg-accent-soft text-accent-text', 'Feedback given', s.feedbacks ? util.formatNumber(s.feedbacks.total_feedbacks) : '—', 'my-registrations.html?tab=past') +
        '<a href="' + util.url('notifications.html?tab=unread') + '" class="' + ui.cls.card + ' p-4 sm:p-5 hover:shadow-pop hover:-translate-y-0.5 transition block"><span class="w-9 h-9 rounded-lg flex items-center justify-center bg-danger-soft text-danger">' + icon('bell', 'w-5 h-5') + '</span><p class="js-unread mt-3 text-2xl sm:text-3xl font-extrabold tabular-nums">' + CE.notifications.unreadCount() + '</p><p class="text-sm text-ink-secondary">Unread notifications</p></a>' +
        statCard('megaphone', 'bg-info-soft text-info', 'Announcements', s.announcements ? util.formatNumber(s.announcements.total_announcements) : '—', 'announcements.html')
      );
    }
    $('#stats').html(new Array(5).join('<div class="skeleton h-32 !rounded-2xl"></div>'));
    CE.endpoints.myDashboard().then(function (r) { renderStats(r.data); }).catch(function () { renderStats(null); });
    CE.notifications.onChange(function () { $('.js-unread').text(CE.notifications.unreadCount()); });

    /* Registrations + upcoming events */
    $('#my-events').html(ui.skeleton.list(2));
    $('#soon').html(ui.skeleton.cards(2));
    Promise.all([CE.data.myRegistrations(), CE.data.events()]).then(function (res) {
      var regs = res[0], regMap = kit.registrationMap(regs);
      var mine = regs.filter(function (r) { return r.status === 'registered' && util.eventStatus({ starts_at: r.starts_at, ends_at: r.ends_at }) !== 'past'; })
        .sort(function (a, b) { return new Date(a.starts_at) - new Date(b.starts_at); }).slice(0, 3);
      $('#my-events').html(mine.length ? mine.map(function (r) {
        return '<li><a href="' + util.url('event.html?id=' + encodeURIComponent(r.event_id)) + '" class="' + ui.cls.card + ' p-3.5 flex items-center gap-4 hover:border-brand/50 hover:shadow-pop transition">' + CE.cards.dateBlock(r.starts_at, r.event_id) +
          '<span class="min-w-0 flex-1"><span class="block font-bold truncate">' + esc(r.title) + '</span><span class="block text-sm text-ink-secondary mt-0.5">' + esc(util.formatDateTime(r.starts_at)) + '</span><span class="block text-sm text-ink-muted truncate">' + esc(r.location || '') + '</span></span>' +
          ui.badge('Confirmed', 'success') + '</a></li>';
      }).join('') : '<li>' + ui.empty({ icon: 'ticket', title: 'No upcoming registrations', message: 'Find an event below and save your spot.', extra: '!py-8' }) + '</li>');

      var soon = kit.sortEvents(res[1].filter(function (e) { return e.published !== false && util.eventStatus(e) !== 'past' && !regMap[e.id]; }), 'soonest').slice(0, 4);
      $('#soon').html(soon.length ? soon.map(function (e) { return CE.cards.eventCard(e, { registration: regMap[e.id] }); }).join('')
        : '<div class="sm:col-span-2">' + ui.empty({ icon: 'calendar', title: 'You’re all set', message: 'No other upcoming events right now.', extra: '!py-8' }) + '</div>');

      $('#soon').off('click.reg').on('click.reg', '[data-action="register"]', function () {
        var $b = $(this), ev = soon.find(function (x) { return x.id === String($b.data('id')); });
        kit.register(ev, $b).then(function () { location.reload(); }).catch(function () {});
      });
    }).catch(function (err) {
      $('#my-events').html('<li>' + ui.errorState(err) + '</li>'); $('#soon').empty();
      $('#my-events').one('click', '.ce-retry', function () { location.reload(); });
    });

    /* Announcements */
    $('#ann').html(ui.skeleton.list(3));
    CE.data.announcements().then(function (rows) {
      var list = rows.filter(function (a) { return a.published !== false; }).slice(0, 4);
      $('#ann').html(list.length ? list.map(function (a) {
        return '<li data-card class="' + ui.cls.card + ' p-3 flex items-center gap-3"><button type="button" data-action="play" data-src="' + esc(a.audio_url) + '" class="w-10 h-10 rounded-full bg-brand text-white flex items-center justify-center shrink-0 hover:bg-brand-hover" aria-label="Play ' + esc(a.title) + '" aria-pressed="false">' + icon('play', 'w-4 h-4 ml-0.5') + '</button>' +
          '<a class="min-w-0 flex-1" href="' + util.url('announcement.html?id=' + encodeURIComponent(a.id)) + '"><span class="block text-sm font-semibold truncate hover:text-brand">' + esc(a.title) + '</span><span class="block text-xs text-ink-muted"><span data-duration-src="' + esc(a.audio_url) + '">--:--</span> · ' + esc(util.relative(a.created_at)) + '</span></a></li>';
      }).join('') : '<li class="text-sm text-ink-muted">No announcements yet.</li>');
      CE.media.fillDurations($('#ann'));
    }).catch(function () { $('#ann').html('<li class="text-sm text-ink-muted">Couldn’t load announcements.</li>'); });
    $('#ann').on('click', '[data-action="play"]', function () { CE.media.miniToggle($(this).data('src'), $(this), $()); });

    /* Promos */
    $('#promos').html(ui.skeleton.cards(1, { media: 'aspect-video' }));
    CE.data.promos().then(function (rows) {
      var list = rows.filter(function (p) { return p.published !== false; }).slice(0, 2);
      $('#promos').html(list.length ? list.map(function (p) { return CE.cards.promoCard(p); }).join('') : '<p class="text-sm text-ink-muted">No promos yet.</p>');
      CE.media.lazyVideos($('#promos'));
    }).catch(function () { $('#promos').html('<p class="text-sm text-ink-muted">Couldn’t load promos.</p>'); });
  });
})(jQuery, window.CE);
