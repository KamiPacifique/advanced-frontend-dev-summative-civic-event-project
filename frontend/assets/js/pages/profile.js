/**
 * My profile — GET /api/users/profile/me, PATCH /api/users/profile/me
 * Only full_name and email are editable. role / is_active are displayed
 * read-only and are never sent (the API also rejects them).
 * A 409 from the API means the email belongs to another account.
 */
(function ($, CE) {
  'use strict';
  var ui = CE.ui, util = CE.util, esc = util.esc, icon = CE.icon;

  CE.boot({ auth: 'user', layout: 'public', nav: 'profile' }, function () {
    var me = null, stats = null;
    var $form = $('#profile-form'), $save = $form.find('[type=submit]'), $discard = $('#discard');

    function dirty() {
      return me && ($.trim($('#full_name').val()) !== me.full_name || $.trim($('#email').val()) !== me.email);
    }
    function syncButtons() { var d = dirty(); $save.prop('disabled', !d); $discard.prop('disabled', !d); }

    function fill() {
      $('#full_name').val(me.full_name); $('#email').val(me.email);
      $('#role').val(me.role); $('#status').val(me.is_active ? 'Active (is_active = true)' : 'Disabled (is_active = false)');
      syncButtons();
    }

    function renderSummary() {
      var persist = CE.auth.isPersistent();
      var s = stats || {};
      var stat = function (label, val) { return '<div class="flex justify-between py-2 text-sm"><dt class="text-ink-secondary">' + label + '</dt><dd class="font-semibold">' + (val === undefined ? '—' : esc(val)) + '</dd></div>'; };
      $('#summary').attr('aria-busy', 'false').html(
        '<div class="flex flex-col items-center text-center">' +
          '<span class="w-20 h-20 rounded-full bg-gradient-to-br from-brand to-sky-400 text-white text-2xl font-extrabold flex items-center justify-center shadow-pop" aria-hidden="true">' + esc(util.initials(me.full_name)) + '</span>' +
          '<p class="mt-4 text-xl font-bold">' + esc(me.full_name) + '</p><p class="text-sm text-ink-muted break-all">' + esc(me.email) + '</p>' +
          '<div class="mt-3 flex gap-2">' + ui.badge('Role: ' + me.role, me.role === 'admin' ? 'accent' : 'brand') + ui.badge(me.is_active ? 'Active' : 'Disabled', me.is_active ? 'success' : 'danger') + '</div></div>' +
        '<dl class="mt-6 pt-4 border-t border-line divide-y divide-line">' +
          stat('Member since', util.formatMonthYear(me.created_at)) +
          stat('Events registered', s.registrations ? util.formatNumber(s.registrations.total_registered_events) : undefined) +
          stat('Feedback given', s.feedbacks ? util.formatNumber(s.feedbacks.total_feedbacks) : undefined) +
        '</dl>' +
        '<div class="mt-5 rounded-xl bg-subtle p-4"><p class="flex gap-2 text-xs text-ink-secondary">' + icon('key', 'w-4 h-4 shrink-0') +
          (persist ? 'Session stored in localStorage — you stay signed in after closing the browser.' : 'Session stored in sessionStorage — ends when you close the browser.') + '</p>' +
          '<p class="mt-1.5 text-xs text-ink-muted pl-6">Token expires ' + esc(util.formatTime(CE.auth.expiresAt())) + '.</p>' +
          '<button type="button" class="ce-signout mt-3 w-full ' + ui.btn('secondary', 'sm') + '">' + icon('log-out', 'w-3.5 h-3.5') + 'Sign out</button></div>'
      );
    }

    function load() {
      Promise.all([CE.endpoints.me(), CE.endpoints.myDashboard().catch(function () { return {}; })]).then(function (res) {
        me = res[0].data; stats = res[1].data || null;
        fill(); renderSummary();
      }).catch(function (err) {
        $('#summary').attr('aria-busy', 'false').html(ui.errorState(err, { bare: true, title: 'Couldn’t load your profile' }));
      });
    }
    $('#summary').on('click', '.ce-retry', load);

    $form.on('input', 'input', syncButtons);
    $discard.on('click', function () { ui.clearErrors($form); $('#form-alert').empty(); fill(); });

    $form.on('submit', function (e) {
      e.preventDefault();
      ui.clearErrors($form); $('#form-alert').empty();
      var body = {}, name = $.trim($('#full_name').val()), email = $.trim($('#email').val()), ok = true;
      if (name.length < 2) { ui.fieldError('#full_name', 'Full name cannot be empty.'); ok = false; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { ui.fieldError('#email', 'Enter a valid email address.'); ok = false; }
      if (!ok) { ui.focusFirstError($form); return; }
      // Only send what changed — never role / is_active.
      if (name !== me.full_name) body.full_name = name;
      if (email !== me.email) body.email = email;
      if ($.isEmptyObject(body)) return;

      var go = body.email
        ? ui.confirm({ title: 'Change your sign-in email?', message: 'You’ll use ' + email + ' to sign in from now on.', confirmLabel: 'Yes, change it', tone: 'primary', icon: 'mail' })
        : Promise.resolve(true);
      go.then(function (yes) {
        if (!yes) return;
        ui.setLoading($save, true, 'Saving…');
        CE.endpoints.updateMe(body).then(function (r) {
          me = r.data || $.extend(me, body);
          CE.auth.updateUser(me);
          ui.setLoading($save, false); fill(); renderSummary();
          ui.toast('success', 'Profile updated', 'Your changes have been saved.');
          // refresh header name
          $('.ce-menu-btn .truncate').text(me.full_name);
        }).catch(function (err) {
          ui.setLoading($save, false); syncButtons();
          if (err.status === 409) {
            ui.fieldError('#email', 'Email already in use.');
            $('#form-alert').html(ui.alert('danger', 'That email is already used by another account (409 Conflict). Try a different address.'));
            $('#email').trigger('focus');
          } else {
            $('#form-alert').html(ui.alert('danger', err.message, 'Couldn’t save your profile'));
          }
        });
      });
    });

    load();
  });
})(jQuery, window.CE);
