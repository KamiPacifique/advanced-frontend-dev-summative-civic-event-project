/**
 * My registrations — GET /api/event-registrations/my-registrations
 * Tabs: Upcoming / Past / Cancelled. Joined client-side with:
 *   - GET /api/event-feedback/my-feedback  → "Feedback submitted · 5★" vs "Leave feedback"
 * Cancel calls POST /api/event-registrations/cancel after an inline confirmation.
 */
(function ($, CE) {
  'use strict';
  var ui = CE.ui, util = CE.util, esc = util.esc, icon = CE.icon, kit = CE.eventsKit;

  CE.boot({ auth: 'user', layout: 'public', nav: 'registrations' }, function () {
    var $list = $('#list'), regs = [], fb = {}, tab = util.param('tab') || 'upcoming';

    function asEvent(r) { return { id: r.event_id, title: r.title, starts_at: r.starts_at, ends_at: r.ends_at, location: r.location }; }
    function groups() {
      var g = { upcoming: [], past: [], cancelled: [] };
      regs.forEach(function (r) {
        if (r.status === 'cancelled') g.cancelled.push(r);
        else if (util.eventStatus(asEvent(r)) === 'past') g.past.push(r);
        else g.upcoming.push(r);
      });
      g.upcoming.sort(function (a, b) { return new Date(a.starts_at) - new Date(b.starts_at); });
      g.past.sort(function (a, b) { return new Date(b.starts_at) - new Date(a.starts_at); });
      g.cancelled.sort(function (a, b) { return new Date(b.updated_at) - new Date(a.updated_at); });
      return g;
    }

    function renderTabs(g) {
      var tabs = [['upcoming', 'Upcoming'], ['past', 'Past'], ['cancelled', 'Cancelled']];
      $('#tabs').html(tabs.map(function (t) {
        var on = t[0] === tab;
        return '<button type="button" role="tab" id="tab-' + t[0] + '" aria-selected="' + on + '" aria-controls="list" data-tab="' + t[0] + '" class="shrink-0 inline-flex items-center gap-2 h-11 px-3 border-b-2 text-sm font-semibold ' + (on ? 'border-brand text-brand' : 'border-transparent text-ink-secondary hover:text-ink') + '">' +
          t[1] + '<span class="min-w-5 h-5 px-1.5 rounded-full text-[11px] leading-5 text-center ' + (on ? 'bg-brand-soft text-brand' : 'bg-subtle text-ink-muted') + '">' + (g ? g[t[0]].length : '–') + '</span></button>';
      }).join(''));
      $list.attr('aria-labelledby', 'tab-' + tab);
    }

    function row(r, kind) {
      var href = util.url('event.html?id=' + encodeURIComponent(r.event_id));
      var f = fb[r.event_id], badge, actions = '<a href="' + href + '" class="' + ui.btn('secondary', 'sm') + '">View event<span class="sr-only">: ' + esc(r.title) + '</span></a>';
      if (kind === 'upcoming') {
        badge = ui.badge('Confirmed', 'success');
        actions += '<button type="button" data-cancel="' + esc(r.event_id) + '" class="' + ui.btn('danger', 'sm') + '">Cancel<span class="sr-only"> registration for ' + esc(r.title) + '</span></button>';
      } else if (kind === 'past') {
        badge = ui.badge('Attended', 'neutral');
        actions += f ? '<span class="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-success-soft text-success text-xs font-semibold">' + icon('check', 'w-3.5 h-3.5') + 'Feedback submitted · ' + Number(f.rating) + '★</span>'
                     : '<a href="' + href + '#feedback" class="' + ui.btn('primary', 'sm') + '">Leave feedback</a>';
      } else {
        badge = ui.badge('Cancelled', 'danger');
      }
      return '<li class="' + ui.cls.card + ' p-4 flex flex-col sm:flex-row sm:items-center gap-4" data-row="' + esc(r.event_id) + '">' +
        '<div class="flex items-center gap-4 flex-1 min-w-0">' + CE.cards.dateBlock(r.starts_at, r.event_id) +
          '<div class="min-w-0"><div class="flex flex-wrap items-center gap-2"><h3 class="font-bold truncate"><a href="' + href + '" class="hover:text-brand">' + esc(r.title) + '</a></h3>' + badge + '</div>' +
            '<p class="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-secondary"><span class="inline-flex items-center gap-1.5">' + icon('calendar', 'w-4 h-4 text-ink-muted') + esc(util.formatDateTime(r.starts_at)) + '</span>' +
            '<span class="inline-flex items-center gap-1.5">' + icon('map-pin', 'w-4 h-4 text-ink-muted') + esc(r.location || 'TBA') + '</span></p></div></div>' +
        '<div class="flex flex-wrap gap-2 sm:justify-end">' + actions + '</div>' +
        '<div class="js-confirm basis-full hidden"></div></li>';
    }

    function render() {
      var g = groups();
      renderTabs(g);
      if (!regs.length) {
        $list.html(ui.empty({ icon: 'ticket', title: 'No registrations yet', message: 'When you register for an event it will show up here with quick cancel and feedback actions.', actions: '<a class="' + ui.btn('primary', 'sm') + '" href="' + util.url('events.html') + '">Browse events</a>' }));
        return;
      }
      var html = '';
      if (tab === 'upcoming') {
        html += section('Upcoming', g.upcoming, 'upcoming', 'Nothing coming up. Find something new on the Events page.');
        var awaiting = g.past.filter(function (r) { return !fb[r.event_id]; });
        if (awaiting.length) html += section('Past · awaiting your feedback', awaiting, 'past');
      } else if (tab === 'past') html += section('Past events', g.past, 'past', 'You haven’t attended any events yet.');
      else html += section('Cancelled', g.cancelled, 'cancelled', 'You haven’t cancelled any registrations.');
      $list.html(html);
    }
    function section(title, rows, kind, emptyMsg) {
      return '<div><h2 class="text-overline uppercase text-ink-muted mb-3">' + esc(title) + '</h2>' +
        (rows.length ? '<ul class="space-y-3">' + rows.map(function (r) { return row(r, kind); }).join('') + '</ul>'
                     : '<p class="text-sm text-ink-muted bg-white border border-line rounded-xl px-4 py-6 text-center">' + esc(emptyMsg) + '</p>') + '</div>';
    }

    function load(fresh) {
      ui.busy($list, true); renderTabs(null); $list.html(ui.skeleton.list(4));
      Promise.all([CE.data.myRegistrations(fresh), CE.data.myFeedback(fresh).catch(function () { return []; })])
        .then(function (res) {
          regs = res[0];
          fb = {}; res[1].forEach(function (f) { fb[f.event_id] = f; });
          render();
        }).catch(function (err) { $list.html(ui.errorState(err, { title: 'Couldn’t load your registrations' })); })
        .finally(function () { ui.busy($list, false); });
    }

    $('#tabs').on('click', '[data-tab]', function () {
      tab = $(this).data('tab'); history.replaceState(null, '', '?tab=' + tab); render(); $('#tab-' + tab).trigger('focus');
    });
    $('#tabs').on('keydown', '[role=tab]', function (e) {
      var order = ['upcoming', 'past', 'cancelled'], i = order.indexOf(tab);
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault(); tab = order[(i + (e.key === 'ArrowRight' ? 1 : 2)) % 3]; render(); $('#tab-' + tab).trigger('focus');
      }
    });
    $list.on('click', '.ce-retry', function () { load(true); });

    // Inline cancel confirmation banner (as in the design), then POST /cancel
    $list.on('click', '[data-cancel]', function () {
      var eid = String($(this).data('cancel')), r = regs.find(function (x) { return x.event_id === eid; });
      var $box = $(this).closest('li').find('.js-confirm');
      $('.js-confirm').not($box).addClass('hidden').empty();
      $box.removeClass('hidden').html('<div class="mt-1 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-danger-soft px-4 py-3" role="alertdialog" aria-labelledby="cx-' + esc(eid) + '">' +
        icon('alert-circle', 'w-5 h-5 text-danger shrink-0') + '<div class="flex-1 min-w-[12rem]"><p id="cx-' + esc(eid) + '" class="text-sm font-semibold text-danger">Cancel your registration for ' + esc(r.title) + '?</p>' +
        '<p class="text-xs text-danger/80">Your spot will be released to others. Cancelled registrations can’t be re-activated.</p></div>' +
        '<button type="button" class="js-keep ' + ui.btn('secondary', 'sm') + '">Keep my spot</button><button type="button" class="js-yes ' + ui.btn('danger', 'sm') + '" data-id="' + esc(eid) + '">Yes, cancel</button></div>');
      $box.find('.js-keep').trigger('focus');
    });
    $list.on('click', '.js-keep', function () { $(this).closest('.js-confirm').addClass('hidden').empty(); });
    $list.on('click', '.js-yes', function () {
      var $b = $(this), eid = String($b.data('id')), r = regs.find(function (x) { return x.event_id === eid; });
      ui.setLoading($b, true, 'Cancelling…');
      CE.endpoints.cancelRegistration(eid).then(function () {
        CE.cache.invalidate('my-registrations');
        r.status = 'cancelled'; r.updated_at = new Date().toISOString();
        ui.toast('success', 'Registration cancelled', 'You’re no longer registered for “' + r.title + '”.');
        render();
      }).catch(function (err) { ui.setLoading($b, false); ui.toastError(err, 'Couldn’t cancel registration'); });
    });

    load(false);
  });
})(jQuery, window.CE);
