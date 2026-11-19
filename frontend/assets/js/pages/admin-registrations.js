/**
 * Admin › Registrations — per-event attendee list + feedback summary.
 * (The API has no "all registrations" endpoint, so the admin picks an event.)
 */
(function ($, CE) {
  'use strict';
  var ui = CE.ui, util = CE.util, esc = util.esc, icon = CE.icon;

  // ROLE GUARD: admin-only page (both endpoints are authorize(['admin'])).
  CE.boot({ auth: 'admin', layout: 'admin', nav: 'admin-registrations', title: 'Registrations', crumb: 'Registrations' }, function () {
    var events = [], current = null, attendees = [];

    function stat(label, value, ic, tone) {
      return '<div class="' + ui.cls.card + ' p-4 flex items-center gap-3"><span class="w-10 h-10 rounded-lg flex items-center justify-center ' + tone + '">' + icon(ic, 'w-5 h-5') + '</span><div><p class="text-2xl font-extrabold tabular-nums">' + value + '</p><p class="text-xs text-ink-muted">' + label + '</p></div></div>';
    }

    function loadEvent(id) {
      current = events.find(function (e) { return e.id === id; });
      history.replaceState(null, '', '?event=' + encodeURIComponent(id));
      $('#att').html(ui.skeleton.rows(4, 4)); $('#fb').html('<li class="py-3">' + ui.skeleton.list(1) + '</li>'); $('#summary').empty();
      $('#export').prop('disabled', true);
      Promise.all([
        CE.endpoints.attendees(id).then(function (r) { return r.data || []; }),
        CE.endpoints.eventFeedback(id).then(function (r) { return r.data || []; }).catch(function () { return []; })
      ]).then(function (res) {
        attendees = res[0]; var fb = res[1];
        var avg = fb.length ? fb.reduce(function (s, f) { return s + Number(f.rating); }, 0) / fb.length : 0;
        $('#summary').html(stat('Confirmed attendees', attendees.length, 'users', 'bg-brand-soft text-brand') +
          stat('Reviews', fb.length, 'message', 'bg-info-soft text-info') +
          stat('Average rating', fb.length ? avg.toFixed(1) + ' ★' : '—', 'star', 'bg-accent-soft text-accent-text'));
        $('#att').html(attendees.length ? attendees.map(function (a) {
          return '<tr class="border-t border-line"><td class="px-4 py-3 font-semibold">' + esc(a.full_name) + '</td><td class="px-4 py-3 text-ink-secondary">' + esc(a.email) + '</td><td class="px-4 py-3 text-ink-secondary whitespace-nowrap">' + esc(util.formatDateTime(a.created_at)) + '</td><td class="px-4 py-3">' + ui.badge('Confirmed', 'success') + '</td></tr>';
        }).join('') : '<tr><td colspan="4" class="px-4 py-10 text-center text-ink-muted">No confirmed registrations for this event yet.</td></tr>');
        $('#fb').html(fb.length ? fb.map(function (f) {
          return '<li class="py-3"><div class="flex items-center gap-2"><p class="flex-1 text-sm font-semibold">' + esc(f.full_name) + '</p>' + ui.stars(f.rating, 'w-3.5 h-3.5') + '</div>' +
            (f.comment ? '<p class="mt-1 text-sm text-ink-secondary">' + esc(f.comment) + '</p>' : '') + '<p class="mt-1 text-xs text-ink-muted">' + esc(util.relative(f.created_at)) + '</p></li>';
        }).join('') : '<li class="py-6 text-center text-sm text-ink-muted">No feedback yet.</li>');
        $('#export').prop('disabled', !attendees.length);
      }).catch(function (err) {
        $('#att').html('<tr><td colspan="4" class="p-6">' + ui.errorState(err, { bare: true }) + '</td></tr>'); $('#fb').empty();
      });
    }

    CE.data.events(true).then(function (rows) {
      events = CE.eventsKit.sortEvents(rows, 'soonest');
      if (!events.length) {
        $('#event').html('<option>No events yet</option>');
        $('#att').html('<tr><td colspan="4" class="p-6">' + ui.empty({ bare: true, icon: 'calendar', title: 'No events yet', actions: '<a class="' + ui.btn('primary', 'sm') + '" href="event-form.html">Create event</a>' }) + '</td></tr>');
        return;
      }
      $('#event').prop('disabled', false).html(events.map(function (e) {
        return '<option value="' + esc(e.id) + '">' + esc(e.title) + ' — ' + esc(util.formatDateYear(e.starts_at)) + (util.eventStatus(e) === 'past' ? ' (past)' : '') + '</option>';
      }).join(''));
      var pre = util.param('event');
      var first = pre && events.some(function (e) { return e.id === pre; }) ? pre : events[0].id;
      $('#event').val(first); loadEvent(first);
    }).catch(function (err) { $('#event').html('<option>Couldn’t load events</option>'); ui.toastError(err); });

    $('#event').on('change', function () { loadEvent(this.value); });
    $('#att').on('click', '.ce-retry', function () { loadEvent(current.id); });
    $('#export').on('click', function () {
      util.download('attendees-' + current.title.replace(/\W+/g, '-').toLowerCase() + '.csv', util.toCSV(attendees, [
        { key: 'full_name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'created_at', label: 'Registered at' }, { key: 'status', label: 'Status' }
      ]), 'text/csv');
    });
  });
})(jQuery, window.CE);
