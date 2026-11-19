/**
 * CE.eventsKit — event logic shared by the public list, detail page,
 * "My registrations" and the admin events table:
 *   - date filters / sorting (the API returns every event unfiltered)
 *   - register / cancel / delete flows with confirmations, toasts and cache invalidation
 */
(function (w, $) {
  'use strict';
  var CE = w.CE, util = CE.util, ui = CE.ui;

  function startOfDay(x) { var d = new Date(x); d.setHours(0, 0, 0, 0); return d; }

  /** Does the event fall inside the selected date window? */
  function matchesWhen(ev, when) {
    if (!when || when === 'all') return true;
    var s = util.toDate(ev.starts_at), e = util.toDate(ev.ends_at) || s, status = util.eventStatus(ev);
    if (!s) return false;
    var now = new Date(), today = startOfDay(now);
    var overlaps = function (from, to) { return s < to && e >= from; };
    switch (when) {
      case 'upcoming': return status !== 'past';
      case 'past': return status === 'past';
      case 'today': { var tmr = new Date(today); tmr.setDate(tmr.getDate() + 1); return overlaps(today, tmr); }
      case 'week': { var wk = new Date(today); wk.setDate(wk.getDate() + 7); return overlaps(now, wk); }
      case 'month': return overlaps(new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 1));
      case 'weekend': {
        var day = today.getDay(); // 0 Sun … 6 Sat
        var sat = new Date(today);
        if (day === 0) sat.setDate(sat.getDate() - 1); else sat.setDate(sat.getDate() + (6 - day));
        var mon = new Date(sat); mon.setDate(mon.getDate() + 2);
        return overlaps(sat, mon) && e >= now;
      }
      default: return true;
    }
  }

  function sortEvents(list, sort) {
    var t = function (v) { var d = util.toDate(v); return d ? d.getTime() : 0; };
    var out = list.slice();
    if (sort === 'latest') out.sort(function (a, b) { return t(b.starts_at) - t(a.starts_at); });
    else if (sort === 'newest') out.sort(function (a, b) { return t(b.created_at) - t(a.created_at); });
    else if (sort === 'title') out.sort(function (a, b) { return String(a.title).localeCompare(String(b.title)); });
    else {
      // soonest: upcoming/ongoing ascending, then past events (most recent first)
      out.sort(function (a, b) {
        var pa = util.eventStatus(a) === 'past', pb = util.eventStatus(b) === 'past';
        if (pa !== pb) return pa ? 1 : -1;
        return pa ? t(b.starts_at) - t(a.starts_at) : t(a.starts_at) - t(b.starts_at);
      });
    }
    return out;
  }

  /** Map of event_id → registration row for the signed-in user. */
  function registrationMap(rows) {
    var map = {};
    (rows || []).forEach(function (r) { map[r.event_id] = r; });
    return map;
  }

  function invalidateRegistrations() { CE.cache.invalidate('my-registrations'); }

  /** POST /event-registrations/register → resolves the new registration or rejects. */
  function register(ev, $btn) {
    ui.setLoading($btn, true, 'Registering…');
    return CE.endpoints.register(ev.id).then(function (res) {
      invalidateRegistrations();
      ui.toast('success', 'You’re registered!', 'See you at “' + ev.title + '”. It’s now in My Registrations.', {
        action: { label: 'Add to calendar', onClick: function () { addToCalendar(ev); } }
      });
      return res.data || { event_id: ev.id, status: 'registered' };
    }).catch(function (err) {
      ui.setLoading($btn, false);
      if (err.status === 409) {
        invalidateRegistrations();
        ui.toast('warning', 'Already registered', 'You already have a registration for this event. If you cancelled it before, the system doesn’t allow registering again — contact the organisers.');
      } else ui.toastError(err, 'Registration failed');
      throw err;
    });
  }

  /** Confirm then POST /event-registrations/cancel. */
  function cancel(ev, $btn) {
    return ui.confirm({
      title: 'Cancel your registration?', icon: 'ticket', confirmLabel: 'Yes, cancel', cancelLabel: 'Keep my spot',
      message: 'Your spot for “' + ev.title + '” will be released to others. Note: once cancelled, this event can’t be re-registered from your account.'
    }).then(function (ok) {
      if (!ok) return null;
      if ($btn) ui.setLoading($btn, true, 'Cancelling…');
      return CE.endpoints.cancelRegistration(ev.id).then(function (res) {
        invalidateRegistrations();
        ui.toast('success', 'Registration cancelled', 'You’re no longer registered for “' + ev.title + '”.');
        return res.data || { event_id: ev.id, status: 'cancelled' };
      }).catch(function (err) {
        if ($btn) ui.setLoading($btn, false);
        ui.toastError(err, 'Couldn’t cancel registration');
        throw err;
      });
    });
  }

  /** Admin only: confirm then DELETE /events/:id. */
  function remove(ev) {
    return ui.confirm({
      title: 'Delete “' + ev.title + '”?', confirmLabel: 'Delete event',
      message: 'This permanently removes the event, its image and its feedback. This action cannot be undone.'
    }).then(function (ok) {
      if (!ok) return false;
      return CE.endpoints.deleteEvent(ev.id).then(function () {
        CE.cache.invalidate('events');
        ui.toast('success', 'Event deleted', '“' + ev.title + '” was removed.');
        return true;
      }).catch(function (err) {
        ui.toastError(err, 'Couldn’t delete event');
        return false;
      });
    });
  }

  function addToCalendar(ev) {
    util.download((ev.title || 'event').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') + '.ics',
      util.toICS(ev, util.url('event.html?id=' + ev.id)), 'text/calendar');
  }

  function mapsUrl(location) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(location || ''); }

  CE.eventsKit = {
    matchesWhen: matchesWhen, sortEvents: sortEvents, registrationMap: registrationMap,
    register: register, cancel: cancel, remove: remove, addToCalendar: addToCalendar, mapsUrl: mapsUrl
  };
})(window, jQuery);
