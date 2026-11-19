/**
 * Sign-up page — POST /api/auth/signup { full_name, email, password }
 * Enforces the same strong-password policy as the backend, shows a live
 * strength meter, and on success redirects to login with a toast.
 * NOTE: the UI never sends `role` — every self-registered account is a normal user.
 */
(function ($, CE) {
  'use strict';
  var ui = CE.ui, util = CE.util, forms = CE.forms, icon = CE.icon;

  CE.boot({ auth: 'guest', layout: 'none' }, function () {
    var $form = $('#signup-form'), $alert = $('#signup-alert');
    var touched = false;

    function renderStrength() {
      var p = $('#password').val(), s = forms.strength(p);
      $('.pw-bar').each(function (i) {
        this.className = 'pw-bar h-1.5 rounded-full transition-colors ' + (p && i < Math.max(1, s.score) ? s.bar : 'bg-line');
      });
      $('#pw-label').text(p ? s.label : '—').attr('class', 'font-semibold ' + (p ? s.text : 'text-ink-muted'));
      $('#pw-rules').html(forms.passwordRules.map(function (r) {
        var ok = r.test(p || '');
        var show = ok || touched || p;
        return '<li class="flex items-center gap-1 ' + (ok ? 'text-success' : (show ? 'text-danger' : 'text-ink-muted')) + '">' +
          icon(ok ? 'check' : (show ? 'x' : 'info'), 'w-3.5 h-3.5') + r.label + '<span class="sr-only">' + (ok ? ' — met' : ' — not met') + '</span></li>';
      }).join(''));
    }
    function checkMatch(force) {
      var a = $('#password').val(), b = $('#confirm_password').val();
      if (!b && !force) { ui.fieldError('#confirm_password', null); return true; }
      if (a !== b) { ui.fieldError('#confirm_password', 'Passwords don’t match.'); return false; }
      ui.fieldError('#confirm_password', null); return true;
    }
    renderStrength();

    $('#password').on('input', function () { renderStrength(); if ($('#confirm_password').val()) checkMatch(); });
    $('#confirm_password').on('input blur', function () { checkMatch(); });

    $('.js-toggle-pw').on('click', function () {
      var $pw = $($(this).data('target')), show = $pw.attr('type') === 'password';
      $pw.add('#confirm_password').attr('type', show ? 'text' : 'password');
      $(this).attr('aria-label', show ? 'Hide passwords' : 'Show password').html(icon(show ? 'eye-off' : 'eye', 'w-4 h-4'));
    });

    $form.on('submit', function (e) {
      e.preventDefault();
      touched = true; renderStrength();
      ui.clearErrors($form); $alert.empty();
      var body = {
        full_name: $.trim($('#full_name').val()),
        email: $.trim($('#email').val()),
        password: $('#password').val()
      };
      var ok = true;
      if (body.full_name.length < 2) { ui.fieldError('#full_name', 'Enter your full name.'); ok = false; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) { ui.fieldError('#email', 'Enter a valid email, like name@example.com.'); ok = false; }
      if (!forms.strength(body.password).ok) { ui.fieldError('#password', 'Your password doesn’t meet all the requirements below.'); ok = false; }
      if (!checkMatch(true)) ok = false;
      if (!ok) { ui.focusFirstError($form); return; }

      var $btn = $form.find('[type=submit]');
      ui.setLoading($btn, true, 'Creating account…');
      CE.endpoints.signup(body).then(function () {
        util.flash.set('success', 'Account created', 'You can now sign in with your email.');
        window.location.href = util.url('login.html?email=' + encodeURIComponent(body.email));
      }).catch(function (err) {
        ui.setLoading($btn, false);
        if (err.status === 409) { ui.fieldError('#email', 'An account with this email already exists.'); $('#email').trigger('focus'); $alert.html(ui.alert('danger', 'That email is already registered. Try signing in instead.')); return; }
        $alert.html(ui.alert('danger', err.message, err.network ? 'Can’t reach the server' : 'We couldn’t create your account'));
      });
    });
  });
})(jQuery, window.CE);
