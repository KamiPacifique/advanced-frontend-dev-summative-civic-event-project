/**
 * Notifications inbox — full-page version of the bell drawer.
 * GET /api/notifications (broadcast + targeted for the signed-in user).
 */
(function ($, CE) {
  'use strict';
  var N, ui = CE.ui, util = CE.util;

  CE.boot({ auth: 'user', layout: 'public', nav: 'notifications' }, function () {
    N = CE.notifications;
    var tab = util.param('tab') || 'all';

    function render() {
      $('#tabs').html(N.tabsHTML(tab));
      N.renderList($('#list'), tab, { full: true });
    }
    N.onChange(render);
    render();
    N.load().catch(function () { render(); });

    // ROLE GUARD (UI): admins get a pointer to the management screen.
    if (CE.auth.isAdmin()) {
      $('#admin-note').html('<div class="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-accent bg-white px-4 py-3 text-sm">' + CE.icon('shield', 'w-4 h-4 text-warning') +
        '<span class="flex-1">You can delete notifications for everyone from the admin panel.</span><a class="font-semibold text-brand hover:underline" href="' + util.url('admin/notifications.html') + '">Manage notifications</a></div>');
    }

    $('#tabs').on('click', '[data-tab]', function () { tab = $(this).data('tab'); render(); $('#tabs [data-tab="' + tab + '"]').trigger('focus'); });
    $('#list').on('click', '.ce-notif', function () {
      var nid = String($(this).data('id'));
      var n = N.state.items.find(function (x) { return x.id === nid; });
      if (n) N.openDetail(n);
    });
    $('#list').on('click', '.ce-retry', function () { N.load(true).catch(function () {}); });
    $('#mark-all').on('click', function () { if (N.state.items.length) N.markAllRead(); else ui.toast('info', 'Nothing to mark', 'You have no notifications yet.'); });
    $('#refresh').on('click', function () {
      var $b = $(this); ui.setLoading($b, true, 'Refreshing…');
      N.load(true).then(function () { ui.toast('success', 'Up to date'); }).catch(function (e) { ui.toastError(e); }).finally(function () { ui.setLoading($b, false); });
    });
  });
})(jQuery, window.CE);
