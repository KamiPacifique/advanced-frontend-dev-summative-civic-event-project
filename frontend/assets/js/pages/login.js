/**
 * Login page — POST /api/auth/login
 * On success the token + { id, full_name, email, role } are saved through
 * CE.auth.save() (localStorage when "Keep me signed in", else sessionStorage)
 * and the user is redirected to their dashboard (admin → admin/index.html).
 */
(function ($, CE) {
  'use strict';
  var ui = CE.ui, util = CE.util;

  CE.boot({ auth: 'guest', layout: 'none' }, function () {
    var $form = $('#login-form'), $alert = $('#login-alert');
    var reason = util.param('reason');

    if (util.param('email')) $('#password').trigger('focus');
    $('#email').val(util.param('email') || '');

    // Why the user landed here (expired token, disabled account, signed out)
    if (reason === 'expired') $alert.html(ui.alert('warning', 'Your session expired. Please sign in again to continue.'));
    if (reason === 'disabled') $alert.html(ui.alert('danger', 'Your account has been disabled by an administrator. Contact support if you think this is a mistake.'));
    if (reason === 'signed-out') ui.toast('info', 'Signed out', 'You have been signed out safely.');

    // Show / hide password
    $('.js-toggle-pw').on('click', function () {
      var $pw = $('#password'), show = $pw.attr('type') === 'password';
      $pw.attr('type', show ? 'text' : 'password');
      $(this).attr('aria-label', show ? 'Hide password' : 'Show password').html(CE.icon(show ? 'eye-off' : 'eye', 'w-4 h-4'));
    });

    $form.on('submit', function (e) {
      e.preventDefault();
      ui.clearErrors($form); $alert.empty();
      var email = $.trim($('#email').val()), password = $('#password').val();
      var ok = true;
      if (!email) { ui.fieldError('#email', 'Enter your email address.'); ok = false; }
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { ui.fieldError('#email', 'Enter a valid email, like name@example.com.'); ok = false; }
      if (!password) { ui.fieldError('#password', 'Enter your password.'); ok = false; }
      if (!ok) { ui.focusFirstError($form); return; }

      var $btn = $form.find('[type=submit]');
      ui.setLoading($btn, true, 'Signing in…');
      var remember = $('#remember').is(':checked');

      CE.endpoints.login(email, password).then(function (res) {
        var data = res.data || {};
        CE.auth.save(data.token, data.user, remember);
        // The API doesn't block disabled accounts at login, so check is_active ourselves.
        return CE.endpoints.me().then(function (me) {
          if (me.data && me.data.is_active === false) {
            CE.auth.clear();
            throw { status: 403, message: 'Your account has been disabled by an administrator. Contact support if you think this is a mistake.' };
          }
          return data.user;
        }, function () { return data.user; /* profile check is best-effort */ });
      }).then(function (user) {
        util.flash.set('success', 'Welcome back, ' + util.firstName(user.full_name) + '!', 'You are signed in.');
        var next = util.safeNext(util.param('next'));
        // ROLE GUARD: a normal user is never sent to an admin page via ?next=
        if (next && /^admin\//.test(next) && user.role !== 'admin') next = null;
        window.location.replace(util.url(next || CE.auth.homeFor(user)));
      }).catch(function (err) {
        ui.setLoading($btn, false);
        var msg = err.status === 401 ? 'Incorrect email or password. Please try again.' : err.message;
        $alert.html(ui.alert('danger', msg, err.network ? 'Can’t reach the server' : null));
        if (err.status === 401) $('#password').val('').trigger('focus');
      });
    });
  });
})(jQuery, window.CE);
