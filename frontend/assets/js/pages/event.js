/**
 * Event detail — GET /api/events/:id
 *  - Users: register (POST /event-registrations/register) or cancel
 *    (POST /event-registrations/cancel); leave ONE feedback per event
 *    (POST /event-feedback, edit via PUT /event-feedback/:id).
 *  - Admins: see registrants (GET /event-registrations/event/:id/attendees),
 *    all feedback + average rating (GET /event-feedback/event/:id), edit/delete.
 *
 * API limitation: the feedback list for an event is admin-only, so normal
 * users see their own review (from GET /event-feedback/my-feedback) only.
 */
(function ($, CE) {
  'use strict';
  var ui = CE.ui, util = CE.util, esc = util.esc, icon = CE.icon, kit = CE.eventsKit;

  CE.boot({ auth: 'user', layout: 'public', nav: 'events' }, function () {
    var id = util.param('id');
    var isAdmin = CE.auth.isAdmin();   // ROLE GUARD (UI) — switches admin vs user panels below
    var $root = $('#event-root');
    var ev = null, reg = null, myFb = null, attendees = [], feedback = [];

    if (!id) { notFound(); return; }

    function notFound(msg) {
      $root.attr('aria-busy', 'false').html(ui.empty({ icon: 'calendar', title: 'Event not found', message: msg || 'This event may have been removed or isn’t published yet.', actions: '<a class="' + ui.btn('primary', 'sm') + '" href="' + util.url('events.html') + '">Browse events</a>' }));
    }

    function load() {
      $root.attr('aria-busy', 'true');
      var jobs = [CE.endpoints.event(id).then(function (r) { return r.data; })];
      if (isAdmin) {
        jobs.push(CE.endpoints.attendees(id).then(function (r) { return r.data || []; }).catch(function () { return []; }));
        jobs.push(CE.endpoints.eventFeedback(id).then(function (r) { return r.data || []; }).catch(function () { return []; }));
      } else {
        jobs.push(CE.data.myRegistrations(true).catch(function () { return []; }));
        jobs.push(CE.data.myFeedback(true).catch(function () { return []; }));
      }
      Promise.all(jobs).then(function (res) {
        ev = res[0];
        // Normal users can't open drafts.
        if (!ev || (ev.published === false && !isAdmin)) { notFound(); return; }
        if (isAdmin) { attendees = res[1]; feedback = res[2]; }
        else {
          reg = res[1].find(function (r) { return r.event_id === ev.id; }) || null;
          myFb = res[2].find(function (f) { return f.event_id === ev.id; }) || null;
        }
        render();
      }).catch(function (err) {
        if (err.status === 404) return notFound();
        $root.attr('aria-busy', 'false').html(ui.errorState(err, { title: 'Couldn’t load this event' }));
      });
    }
    $root.on('click', '.ce-retry', load);

    /* ---------------- Render ---------------- */
    function render() {
      document.title = ev.title + ' · CivicConnect';
      var status = util.eventStatus(ev);
      var avg = feedback.length ? feedback.reduce(function (s, f) { return s + Number(f.rating || 0); }, 0) / feedback.length : 0;
      var meta = [];
      if (isAdmin) meta.push(icon('users', 'w-4 h-4') + util.plural(attendees.length, 'person', 'people') + ' registered');
      if (isAdmin && feedback.length) meta.push(CE.star(true, 'w-4 h-4') + avg.toFixed(1) + ' average rating');
      var dur = util.durationBetween(ev.starts_at, ev.ends_at);
      if (dur) meta.push(icon('clock', 'w-4 h-4') + dur);

      var desc = esc(ev.description || 'No description provided.').split(/\n{2,}/).map(function (p) { return '<p>' + p.replace(/\n/g, '<br>') + '</p>'; }).join('');

      $root.attr('aria-busy', 'false').html(
        '<div class="grid gap-8 lg:grid-cols-[1fr_22rem] items-start">' +
          '<article class="min-w-0">' +
            '<div class="relative h-56 sm:h-80 rounded-2xl overflow-hidden shadow-card">' + CE.cards.eventImage(ev) +
              '<div class="absolute left-4 bottom-4 flex flex-wrap gap-2">' + CE.cards.statusBadge(ev) + (isAdmin ? ui.badge(ev.published === false ? 'Draft' : 'Published', ev.published === false ? 'accent' : 'success') : '') + '</div></div>' +
            '<h1 class="mt-6 text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">' + esc(ev.title) + '</h1>' +
            (meta.length ? '<p class="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-secondary">' + meta.map(function (m) { return '<span class="inline-flex items-center gap-1.5">' + m + '</span>'; }).join('') + '</p>' : '') +
            '<section class="mt-8" aria-labelledby="about-h"><h2 id="about-h" class="text-xl font-bold">About this event</h2><div class="mt-3 space-y-3 text-ink-secondary leading-relaxed">' + desc + '</div></section>' +
            '<section id="feedback" class="mt-8 ' + ui.cls.card + ' p-5 sm:p-6 scroll-mt-24" aria-labelledby="fb-h"></section>' +
            (isAdmin ? '<section id="registrants" class="mt-8 rounded-2xl border-2 border-dashed border-accent bg-white p-5 sm:p-6" aria-labelledby="reg-h"></section>' : '') +
          '</article>' +
          '<aside class="lg:sticky lg:top-24 space-y-4" aria-label="Event details and registration"><div id="reg-card" class="' + ui.cls.card + ' p-5"></div><div id="reg-note"></div></aside>' +
        '</div>' +
        '<div id="mobile-bar" class="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-line p-3 flex gap-2 shadow-pop"></div>'
      );
      renderRegCard();
      renderFeedback();
      if (isAdmin) renderRegistrants();
      if (location.hash === '#feedback') setTimeout(function () { document.getElementById('feedback').scrollIntoView(); }, 50);
    }

    function renderRegCard() {
      var status = util.eventStatus(ev), html = '', bar = '';
      var shareBtn = '<button type="button" class="js-share ' + ui.cls.iconBtn + ' border border-line !w-11 !h-11 shrink-0" aria-label="Share this event">' + icon('share', 'w-4 h-4') + '</button>';

      if (isAdmin) {
        html += ui.alert('info', util.plural(attendees.length, 'resident') + ' registered so far.', 'Admin view');
      } else if (reg && reg.status === 'registered') {
        html += '<div class="flex gap-3 items-start rounded-xl bg-success-soft text-success p-3.5"><span class="w-7 h-7 rounded-full bg-success text-white flex items-center justify-center shrink-0">' + icon('check', 'w-4 h-4') + '</span><div><p class="text-sm font-semibold">You’re registered</p><p class="text-xs mt-0.5">Registered ' + esc(util.formatDateYear(reg.created_at)) + '. Confirmation is in your notifications.</p></div></div>';
      } else if (reg && reg.status === 'cancelled') {
        html += ui.alert('neutral', 'You cancelled your registration for this event.', 'Registration cancelled');
      } else if (status === 'past') {
        html += ui.alert('neutral', 'This event has ended.', 'Event ended');
      }

      html += '<ul class="mt-4 space-y-4 text-sm">' +
        '<li class="flex gap-3"><span class="w-10 h-10 rounded-lg bg-brand-soft text-brand flex items-center justify-center shrink-0">' + icon('calendar', 'w-5 h-5') + '</span><div><p class="font-semibold">' + esc(util.formatLongDate(ev.starts_at)) + '</p><p class="text-xs text-ink-muted mt-0.5">Starts ' + esc(util.formatTime(ev.starts_at)) + (ev.ends_at ? ' · Ends ' + esc(util.isSameDay(new Date(ev.starts_at), new Date(ev.ends_at)) ? util.formatTime(ev.ends_at) : util.formatDateTime(ev.ends_at)) : '') + '</p></div></li>' +
        '<li class="flex gap-3"><span class="w-10 h-10 rounded-lg bg-brand-soft text-brand flex items-center justify-center shrink-0">' + icon('map-pin', 'w-5 h-5') + '</span><div class="min-w-0"><p class="font-semibold break-words">' + esc(ev.location || 'Location to be announced') + '</p></div></li></ul>';

      if (ev.location) {
        html += '<div class="mt-4 rounded-xl overflow-hidden border border-line bg-success-soft h-40">' +
          '<iframe title="Map showing ' + esc(ev.location) + '" class="w-full h-full" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=' + encodeURIComponent(ev.location) + '&z=14&output=embed"></iframe></div>' +
          '<a href="' + kit.mapsUrl(ev.location) + '" target="_blank" rel="noopener" class="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">Open in Google Maps' + icon('external-link', 'w-3.5 h-3.5') + '<span class="sr-only">(opens in a new tab)</span></a>';
      }

      html += '<div class="mt-5 pt-5 border-t border-line space-y-2.5">';
      var primary = '';
      if (isAdmin) {
        // ROLE GUARD (UI): admin-only management actions
        primary = '<a href="' + util.url('admin/event-form.html?id=' + encodeURIComponent(ev.id)) + '" class="' + ui.btn('primary') + ' w-full">' + icon('pencil', 'w-4 h-4') + 'Edit event</a>';
        html += primary + '<button type="button" class="js-delete ' + ui.btn('dangerOutline') + ' w-full">' + icon('trash', 'w-4 h-4') + 'Delete event</button>';
      } else if (reg && reg.status === 'registered' && status !== 'past') {
        primary = '<button type="button" class="js-cancel ' + ui.btn('danger') + ' w-full">Cancel registration</button>';
        html += primary;
      } else if (reg && reg.status === 'registered') {
        primary = '<a href="#feedback" class="' + ui.btn('primary') + ' w-full">' + icon('star', 'w-4 h-4') + (myFb ? 'View your feedback' : 'Leave feedback') + '</a>';
        html += primary;
      } else if (!reg && status !== 'past') {
        primary = '<button type="button" class="js-register ' + ui.btn('primary') + ' w-full">Register for this event</button>';
        html += primary;
      }
      if (status !== 'past') html += '<button type="button" class="js-ics ' + ui.btn('secondary') + ' w-full">' + icon('calendar', 'w-4 h-4') + 'Add to calendar</button>';
      html += '<button type="button" class="js-share ' + ui.btn('secondary') + ' w-full">' + icon('share', 'w-4 h-4') + 'Share event</button></div>';

      $('#reg-card').html(html);
      $('#reg-note').html(!isAdmin && !reg && status !== 'past' ? '<p class="flex gap-2 text-xs text-ink-muted px-1">' + icon('info', 'w-4 h-4 shrink-0') + 'Registering sends you a confirmation and lets you leave feedback after the event.</p>' : '');

      // Sticky bottom action bar on mobile
      var $bar = $('#mobile-bar');
      if (primary) $bar.html(shareBtn + primary.replace('w-full', 'flex-1')).removeClass('hidden'); else $bar.addClass('hidden');
    }

    /* ---------------- Feedback ---------------- */
    function renderFeedback() {
      var $s = $('#feedback'), html = '';
      if (isAdmin) {
        var count = feedback.length, avg = count ? feedback.reduce(function (s, f) { return s + Number(f.rating || 0); }, 0) / count : 0;
        var dist = [5, 4, 3, 2, 1].map(function (n) { var c = feedback.filter(function (f) { return Number(f.rating) === n; }).length; return { n: n, c: c, pct: count ? Math.round((c / count) * 100) : 0 }; });
        html = '<div class="flex items-center justify-between gap-3"><h2 id="fb-h" class="text-xl font-bold">Feedback &amp; ratings</h2>' + ui.badge(util.plural(count, 'review'), 'neutral') + '</div>';
        if (!count) {
          html += '<div class="mt-4">' + ui.empty({ bare: true, icon: 'star', title: 'No feedback yet', message: 'Reviews from attendees will appear here.' }) + '</div>';
        } else {
          html += '<div class="mt-5 grid gap-6 sm:grid-cols-[9rem_1fr] items-center">' +
            '<div class="text-center"><p class="text-5xl font-extrabold">' + avg.toFixed(1) + '</p><div class="mt-1 flex justify-center">' + ui.stars(avg) + '</div><p class="mt-1 text-xs text-ink-muted">Average rating</p></div>' +
            '<ul class="space-y-1.5" aria-label="Rating distribution">' + dist.map(function (d) {
              return '<li class="flex items-center gap-2 text-xs"><span class="w-6 text-ink-muted">' + d.n + '★</span><span class="flex-1 h-2 rounded-full bg-subtle overflow-hidden"><span class="block h-full bg-accent rounded-full" style="width:' + d.pct + '%"></span></span><span class="w-10 text-right text-ink-muted">' + d.pct + '%</span><span class="sr-only">' + d.c + ' reviews</span></li>';
            }).join('') + '</ul></div>' +
            '<ul class="mt-6 divide-y divide-line border-t border-line">' + feedback.map(function (f) {
              return '<li class="py-4"><div class="flex items-center gap-3">' + ui.avatar(f.full_name, 'w-8 h-8 text-[11px]') + '<p class="flex-1 text-sm font-semibold">' + esc(f.full_name) + '</p>' + ui.stars(f.rating, 'w-3.5 h-3.5') + '<span class="text-xs text-ink-muted">' + esc(util.relative(f.created_at)) + '</span></div>' +
                (f.comment ? '<p class="mt-2 text-sm text-ink-secondary pl-11">' + esc(f.comment) + '</p>' : '') + '</li>';
            }).join('') + '</ul>';
        }
        $s.html(html);
        return;
      }

      html = '<h2 id="fb-h" class="text-xl font-bold">Feedback</h2>';
      if (myFb) {
        html += '<div class="mt-4 rounded-xl border border-line p-4"><div class="flex flex-wrap items-center gap-3"><p class="text-sm font-semibold flex-1">Your review</p>' + ui.stars(myFb.rating) +
          '<span class="text-xs text-ink-muted">' + esc(util.relative(myFb.updated_at || myFb.created_at)) + '</span></div>' +
          (myFb.comment ? '<p class="mt-2 text-sm text-ink-secondary">' + esc(myFb.comment) + '</p>' : '') +
          '<button type="button" class="js-edit-fb mt-3 ' + ui.btn('secondary', 'sm') + '">' + icon('pencil', 'w-3.5 h-3.5') + 'Edit review</button></div>' +
          '<p class="mt-3 text-xs text-ink-muted">You can submit one review per event. Thanks for helping organisers improve!</p>';
        $s.html(html);
        return;
      }
      if (!reg || reg.status !== 'registered') {
        html += '<p class="mt-2 text-sm text-ink-secondary">Feedback is open to registered attendees. ' + (util.eventStatus(ev) !== 'past' && !reg ? 'Register for this event to share your experience afterwards.' : '') + '</p>';
        $s.html(html);
        return;
      }
      $s.html(html + '<div class="fb-form mt-4"></div>');
      feedbackForm($s.find('.fb-form'), null);
    }

    /** Create (POST) or edit (PUT) the user's single feedback entry. */
    function feedbackForm($c, existing) {
      $c.html('<form class="rounded-xl border border-line bg-canvas p-4 sm:p-5" novalidate>' +
        '<h3 class="font-bold">' + (existing ? 'Edit your feedback' : 'Leave your feedback') + '</h3><p class="text-xs text-ink-muted mt-0.5" id="fb-rule">You can submit one review per event.</p>' +
        '<div class="fb-alert mt-3 empty:hidden"></div>' +
        '<div class="mt-4 flex flex-wrap items-center gap-3" data-field><span class="text-sm font-semibold" id="fb-rating-label">Your rating</span><div class="fb-stars"></div></div>' +
        '<div class="mt-4" data-field><label for="fb-comment" class="' + ui.cls.label + '">Comment <span class="font-normal text-ink-muted">(optional)</span></label>' +
          '<textarea id="fb-comment" rows="4" maxlength="500" class="' + ui.cls.textarea + '" placeholder="Share what went well or what could improve…">' + esc(existing ? existing.comment || '' : '') + '</textarea></div>' +
        '<div class="mt-3 flex items-center justify-between gap-3"><span class="fb-count text-xs text-ink-muted" aria-live="polite">0 / 500</span><div class="flex gap-2">' +
          (existing ? '<button type="button" class="fb-cancel ' + ui.btn('secondary') + '">Cancel</button>' : '') +
          '<button type="submit" class="' + ui.btn('primary') + '">' + (existing ? 'Save changes' : 'Submit feedback') + '</button></div></div></form>');
      var stars = CE.forms.starInput($c.find('.fb-stars'), { value: existing ? Number(existing.rating) : 0, label: 'Your rating, 1 to 5 stars', describedBy: 'fb-rule' });
      var $ta = $c.find('#fb-comment'), $form = $c.find('form');
      function count() { $c.find('.fb-count').text($ta.val().length + ' / 500'); }
      $ta.on('input', count); count();
      $c.find('.fb-cancel').on('click', renderFeedback);
      $form.on('submit', function (e) {
        e.preventDefault();
        var rating = stars.value(), comment = $.trim($ta.val());
        $c.find('.fb-alert').empty();
        if (!rating) { $c.find('.fb-alert').html(ui.alert('danger', 'Choose a rating from 1 to 5 stars.')); $c.find('[role=radio]').first().trigger('focus'); return; }
        var $btn = $form.find('[type=submit]');
        ui.setLoading($btn, true, 'Saving…');
        var req = existing ? CE.endpoints.updateFeedback(existing.id, { rating: rating, comment: comment })
                           : CE.endpoints.createFeedback({ event_id: ev.id, rating: rating, comment: comment });
        req.then(function (r) {
          CE.cache.invalidate('my-feedback');
          myFb = $.extend({}, existing || {}, r.data || { rating: rating, comment: comment });
          ui.toast('success', existing ? 'Feedback updated' : 'Thanks for your feedback!', 'Your ' + rating + '-star review was saved.');
          renderFeedback(); renderRegCard();
        }).catch(function (err) {
          ui.setLoading($btn, false);
          if (err.status === 409) {
            // One feedback per user per event (DB unique constraint) — load the existing one for editing.
            CE.data.myFeedback(true).then(function (rows) { myFb = rows.find(function (f) { return f.event_id === ev.id; }) || null; renderFeedback(); });
            ui.toast('warning', 'You’ve already reviewed this event', 'You can edit your existing review instead.');
            return;
          }
          // Text is preserved in the form so nothing is lost.
          $c.find('.fb-alert').html(ui.alert('danger', err.message + ' Your text is preserved — try again in a moment.', err.status >= 500 ? 'Server error (' + err.status + ')' : 'Couldn’t save feedback'));
        });
      });
    }

    /* ---------------- Registrants (admin only) ---------------- */
    // ROLE GUARD (UI): only rendered for admins; the endpoint itself is authorize(['admin']).
    function renderRegistrants() {
      var rows = attendees.map(function (a) {
        return '<tr class="border-t border-line"><td class="px-4 py-3 font-semibold whitespace-nowrap">' + esc(a.full_name) + '</td><td class="px-4 py-3 text-ink-secondary">' + esc(a.email) + '</td>' +
          '<td class="px-4 py-3 text-ink-secondary whitespace-nowrap">' + esc(util.formatDateYear(a.created_at)) + '</td><td class="px-4 py-3">' + ui.badge('Confirmed', 'success') + '</td></tr>';
      }).join('');
      $('#registrants').html('<div class="flex flex-wrap items-center justify-between gap-3"><h2 id="reg-h" class="text-xl font-bold flex items-center gap-2">' + icon('shield', 'w-5 h-5 text-warning') + 'Registrants</h2>' + ui.badge('Admin only · ' + attendees.length + ' confirmed', 'accent') + '</div>' +
        (attendees.length ? '<div class="mt-4 overflow-x-auto rounded-xl border border-line"><table class="w-full text-sm text-left"><caption class="sr-only">People registered for ' + esc(ev.title) + '</caption><thead class="bg-subtle text-overline uppercase text-ink-muted"><tr><th scope="col" class="px-4 py-2.5">Name</th><th scope="col" class="px-4 py-2.5">Email</th><th scope="col" class="px-4 py-2.5">Registered</th><th scope="col" class="px-4 py-2.5">Status</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
          '<button type="button" class="js-export mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">' + icon('download', 'w-4 h-4') + 'Export CSV</button>'
          : '<p class="mt-3 text-sm text-ink-secondary">No one has registered yet. Cancelled registrations are not listed.</p>'));
    }

    /* ---------------- Actions ---------------- */
    $root.on('click', '.js-register', function () {
      kit.register(ev, $(this)).then(function (r) { reg = r; renderRegCard(); renderFeedback(); }).catch(function () { load(); });
    });
    $root.on('click', '.js-cancel', function () {
      kit.cancel(ev, $(this)).then(function (r) { if (r) { reg = r; renderRegCard(); renderFeedback(); } }).catch(function () {});
    });
    $root.on('click', '.js-ics', function () { kit.addToCalendar(ev); });
    $root.on('click', '.js-share', function () {
      var url = location.href.split('#')[0];
      if (navigator.share) navigator.share({ title: ev.title, text: util.formatRange(ev.starts_at, ev.ends_at) + ' · ' + (ev.location || ''), url: url }).catch(function () {});
      else ui.copy(url, 'Event link copied');
    });
    $root.on('click', '.js-delete', function () {
      kit.remove(ev).then(function (ok) { if (ok) { util.flash.set('success', 'Event deleted', '“' + ev.title + '” was removed.'); location.href = util.url('admin/events.html'); } });
    });
    $root.on('click', '.js-edit-fb', function () { feedbackForm($('#feedback').find('.fb-form').length ? $('#feedback .fb-form') : $('<div class="fb-form mt-4">').appendTo($('#feedback').empty().append('<h2 id="fb-h" class="text-xl font-bold">Feedback</h2>')), myFb); });
    $root.on('click', '.js-export', function () {
      util.download('registrants-' + ev.title.replace(/\W+/g, '-').toLowerCase() + '.csv', util.toCSV(attendees, [
        { key: 'full_name', label: 'Name' }, { key: 'email', label: 'Email' },
        { label: 'Registered at', value: function (r) { return r.created_at; } }, { key: 'status', label: 'Status' }
      ]), 'text/csv');
    });

    load();
  });
})(jQuery, window.CE);
