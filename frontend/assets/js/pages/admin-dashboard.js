/**
 * Admin dashboard — GET /api/dashboard/admin (admin only).
 * Stat cards + "new users per month" bar chart (user_growth), plus
 * top events and recent registrations compiled from
 * GET /api/event-registrations/event/:id/attendees for upcoming events.
 * Auto-refreshes every 60s and on "Refresh" so the numbers follow the data.
 */
(function ($, CE) {
  'use strict';
  var ui = CE.ui, util = CE.util, esc = util.esc, icon = CE.icon, num = util.num;

  // ROLE GUARD: auth 'admin' → non-admins get the 403 screen, guests go to login.
  CE.boot({ auth: 'admin', layout: 'admin', nav: 'admin-dashboard', title: 'Dashboard', crumb: 'Overview' }, function () {
    var user = CE.auth.user(), h = new Date().getHours(), timer = null;
    $('#greeting').text((h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening') + ', ' + util.firstName(user.full_name));

    function card(ic, tone, label, value, sub, href) {
      return '<a href="' + href + '" class="' + ui.cls.card + ' p-5 block hover:shadow-pop transition">' +
        '<div class="flex items-center gap-2.5"><span class="w-9 h-9 rounded-lg flex items-center justify-center ' + tone + '">' + icon(ic, 'w-5 h-5') + '</span><span class="text-sm font-semibold text-ink-secondary">' + esc(label) + '</span></div>' +
        '<p class="mt-3 text-3xl font-extrabold tabular-nums">' + esc(util.formatNumber(value)) + '</p>' +
        (sub ? '<p class="mt-1.5 text-xs text-ink-muted">' + sub + '</p>' : '') + '</a>';
    }
    function mini(ic, tone, label, value, href) {
      return '<a href="' + href + '" class="' + ui.cls.card + ' p-4 flex items-center gap-3 hover:shadow-pop transition"><span class="w-9 h-9 rounded-lg flex items-center justify-center ' + tone + '">' + icon(ic, 'w-4 h-4') + '</span>' +
        '<span class="text-2xl font-extrabold tabular-nums">' + esc(util.formatNumber(value)) + '</span><span class="text-sm text-ink-secondary">' + esc(label) + '</span></a>';
    }

    function renderStats(d) {
      var ev = d.events || {}, us = d.users || {};
      $('#stats').attr('aria-busy', 'false').html(
        card('calendar', 'bg-brand-soft text-brand', 'Total events', ev.total_events, '<span class="text-success font-semibold">' + num(ev.upcoming_events) + ' upcoming</span> · ' + num(ev.past_events) + ' past', 'events.html') +
        card('video', 'bg-accent-soft text-accent-text', 'Total promos', d.promos && d.promos.total_promos, 'Captioned community videos', 'promos.html') +
        card('users', 'bg-success-soft text-success', 'Users', us.total_users, '<span class="text-success font-semibold">' + num(us.active_users) + ' active</span> · ' + num(us.inactive_users) + ' disabled', 'users.html') +
        card('ticket', 'bg-info-soft text-info', 'Registrations', d.registrations && d.registrations.total_registrations, 'All-time event sign-ups', 'registrations.html')
      );
      $('#mini-stats').html(
        mini('megaphone', 'bg-info-soft text-info', 'Announcements', d.announcements && d.announcements.total_announcements, 'announcements.html') +
        mini('bell', 'bg-danger-soft text-danger', 'Notifications sent', d.notifications && d.notifications.total_notifications, 'notifications.html') +
        mini('star', 'bg-accent-soft text-accent-text', 'Feedback received', d.feedbacks && d.feedbacks.total_feedback, 'registrations.html')
      );
    }

    /* Single-series bar chart: one brand hue, current month emphasised, hover/focus tooltip, table view. */
    function renderGrowth(rows) {
      var months = [], now = new Date();
      for (var i = 5; i >= 0; i--) {
        var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        var hit = (rows || []).find(function (r) { return r.month === key; });
        months.push({ key: key, label: d.toLocaleDateString('en-US', { month: 'short' }), full: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), value: hit ? num(hit.new_users) : 0 });
      }
      var max = Math.max.apply(null, months.map(function (m) { return m.value; }).concat([1]));
      var nice = Math.max(4, Math.ceil(max / 4) * 4), ticks = [0, nice / 4, nice / 2, (3 * nice) / 4, nice];
      var grid = ticks.slice().reverse().map(function (t) {
        return '<div class="flex items-center gap-2 h-0"><span class="w-8 text-right text-[11px] text-ink-muted tabular-nums -translate-y-px">' + t + '</span><span class="flex-1 border-t border-line"></span></div>';
      }).join('<div class="flex-1"></div>');
      var bars = months.map(function (m, idx) {
        var pct = (m.value / nice) * 100, current = idx === months.length - 1;
        return '<div class="group relative flex-1 h-full flex flex-col justify-end items-center" tabindex="0" role="img" aria-label="' + esc(m.full) + ': ' + m.value + ' new users">' +
          '<div class="pointer-events-none absolute z-10 -top-2 -translate-y-full hidden group-hover:block group-focus:block whitespace-nowrap rounded-lg bg-inverse text-white px-2.5 py-1.5 text-xs shadow-pop"><span class="block text-slate-300">' + esc(m.full) + '</span><span class="font-bold">' + m.value + ' new users</span></div>' +
          '<div class="w-full max-w-[2.75rem] rounded-t ' + (current ? 'bg-brand' : 'bg-brand/25 group-hover:bg-brand/45') + ' transition-colors" style="height:' + Math.max(pct, m.value ? 2 : 0) + '%"></div></div>';
      }).join('');
      $('#growth-chart').html(
        '<div class="relative h-56">' +
          '<div class="absolute inset-0 flex flex-col" aria-hidden="true">' + grid + '</div>' +
          '<div class="absolute inset-0 left-10 flex items-end gap-[2px] sm:gap-3">' + bars + '</div>' +
        '</div>' +
        '<div class="ml-10 mt-2 flex gap-[2px] sm:gap-3" aria-hidden="true">' + months.map(function (m, i) { return '<span class="flex-1 text-center text-xs ' + (i === months.length - 1 ? 'font-bold text-ink' : 'text-ink-muted') + '">' + m.label + '</span>'; }).join('') + '</div>');
      $('#growth-table').html('<table class="w-full text-sm"><caption class="sr-only">New users per month</caption><thead class="text-left text-overline uppercase text-ink-muted"><tr><th scope="col" class="py-2">Month</th><th scope="col" class="py-2 text-right">New users</th></tr></thead><tbody>' +
        months.map(function (m) { return '<tr class="border-t border-line"><td class="py-2">' + esc(m.full) + '</td><td class="py-2 text-right tabular-nums font-semibold">' + m.value + '</td></tr>'; }).join('') + '</tbody></table>');
    }

    /* Top events + recent registrations from attendee lists of upcoming events. */
    function renderEventsSide() {
      $('#top-events').html('<li>' + ui.skeleton.block('h-32') + '</li>');
      $('#recent').html(ui.skeleton.rows(4, 4));
      CE.data.events(true).then(function (events) {
        var pick = events.filter(function (e) { return util.eventStatus(e) !== 'past'; })
          .sort(function (a, b) { return new Date(a.starts_at) - new Date(b.starts_at); }).slice(0, 10);
        if (pick.length < 10) pick = pick.concat(events.filter(function (e) { return pick.indexOf(e) === -1; }).slice(0, 10 - pick.length));
        return Promise.all(pick.map(function (e) {
          return CE.endpoints.attendees(e.id).then(function (r) { return { ev: e, rows: r.data || [] }; }).catch(function () { return { ev: e, rows: [] }; });
        }));
      }).then(function (list) {
        var top = list.filter(function (x) { return util.eventStatus(x.ev) !== 'past'; }).sort(function (a, b) { return b.rows.length - a.rows.length; }).slice(0, 5);
        var max = Math.max.apply(null, top.map(function (t) { return t.rows.length; }).concat([1]));
        $('#top-events').html(top.length ? top.map(function (t) {
          return '<li><a href="' + util.url('event.html?id=' + encodeURIComponent(t.ev.id)) + '" class="block group"><div class="flex justify-between gap-3 text-sm"><span class="truncate group-hover:text-brand">' + esc(t.ev.title) + '</span><span class="font-bold tabular-nums">' + t.rows.length + '</span></div>' +
            '<div class="mt-1.5 h-2 rounded-full bg-subtle overflow-hidden" aria-hidden="true"><div class="h-full rounded-full bg-accent" style="width:' + Math.round((t.rows.length / max) * 100) + '%"></div></div></a></li>';
        }).join('') : '<li class="text-sm text-ink-muted">No upcoming events yet.</li>');

        var recent = [];
        list.forEach(function (x) { x.rows.forEach(function (r) { recent.push($.extend({ event_title: x.ev.title }, r)); }); });
        recent.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
        $('#recent').html(recent.length ? recent.slice(0, 6).map(function (r) {
          return '<tr class="border-t border-line"><td class="px-4 py-3 font-semibold whitespace-nowrap">' + esc(r.full_name) + '</td><td class="px-4 py-3 text-ink-secondary">' + esc(r.event_title) + '</td>' +
            '<td class="px-4 py-3 text-ink-secondary whitespace-nowrap">' + esc(util.formatDateYear(r.created_at)) + '</td><td class="px-4 py-3">' + ui.badge('Confirmed', 'success') + '</td></tr>';
        }).join('') : '<tr><td colspan="4" class="px-4 py-8 text-center text-ink-muted">No registrations yet.</td></tr>');
      }).catch(function (err) {
        $('#top-events').html('<li class="text-sm text-danger">' + esc(err.message) + '</li>');
        $('#recent').html('<tr><td colspan="4" class="px-4 py-6 text-center text-danger">' + esc(err.message) + '</td></tr>');
      });
    }

    function load(manual) {
      var $btn = $('#refresh');
      if (manual) ui.setLoading($btn, true, 'Refreshing…');
      if (!$('#stats').children().length) $('#stats').html(new Array(5).join('<div class="skeleton h-36 !rounded-2xl"></div>'));
      CE.endpoints.adminDashboard().then(function (r) {
        $('#dash-error').empty();
        renderStats(r.data || {}); renderGrowth((r.data || {}).user_growth);
        if (manual) ui.toast('success', 'Dashboard refreshed');
      }).catch(function (err) {
        $('#dash-error').html(ui.alert('danger', err.message + ' The numbers below may be out of date.', 'Couldn’t load dashboard data'));
        if (!$('#stats a').length) $('#stats').empty();
      }).finally(function () { if (manual) ui.setLoading($btn, false); });
      renderEventsSide();
    }

    $('#refresh').on('click', function () { load(true); });
    $('#toggle-table').on('click', function () {
      var open = $(this).attr('aria-expanded') === 'true';
      $('#growth-table').toggleClass('hidden', open); $('#growth-chart').toggleClass('hidden', !open);
      $(this).attr('aria-expanded', String(!open)).text(open ? 'Show as table' : 'Show as chart');
    });
    timer = setInterval(function () { if (!document.hidden) load(false); }, 60000);
    load(false);
  });
})(jQuery, window.CE);
