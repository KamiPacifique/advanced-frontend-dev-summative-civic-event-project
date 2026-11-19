/**
 * CE.adminContent — admin actions shared by announcements and promos
 * (publish / unpublish, rename, delete) used on both the admin tables and
 * the public detail pages.
 *
 * ROLE GUARD (UI): every function bails out unless CE.auth.isAdmin(); the
 * backend independently rejects non-admins with 403 (authorize(['admin'])).
 */
(function (w, $) {
  'use strict';
  var CE = w.CE, util = CE.util, esc = util.esc, icon = CE.icon, ui = CE.ui;

  var KINDS = {
    announcement: { label: 'announcement', cache: 'announcements', publish: CE.endpoints.publishAnnouncement, del: CE.endpoints.deleteAnnouncement },
    promo: { label: 'promo', cache: 'promos', publish: CE.endpoints.publishPromo, del: CE.endpoints.deletePromo }
  };

  function guard() { if (!CE.auth.isAdmin()) { ui.toast('error', 'Admins only', 'You don’t have permission to do that.'); return false; } return true; }

  /** PATCH /:id/publish | /:id/unpublish. Publishing also sends a broadcast notification (server side). */
  function setPublished(kind, item, on) {
    if (!guard()) return Promise.reject();
    var k = KINDS[kind];
    return k.publish(item.id, on).then(function (r) {
      CE.cache.invalidate(k.cache);
      ui.toast('success', on ? 'Published' : 'Unpublished', on ? '“' + item.title + '” is live — users have been notified in-app.' : '“' + item.title + '” is hidden from users.');
      return r.data || $.extend({}, item, { published: on });
    }).catch(function (err) { ui.toastError(err, 'Couldn’t update ' + k.label); throw err; });
  }

  function remove(kind, item) {
    if (!guard()) return Promise.resolve(false);
    var k = KINDS[kind];
    return ui.confirm({ title: 'Delete “' + item.title + '”?', message: 'This permanently removes the ' + k.label + ' for everyone. This action cannot be undone.', confirmLabel: 'Delete ' + k.label })
      .then(function (ok) {
        if (!ok) return false;
        return k.del(item.id).then(function () {
          CE.cache.invalidate(k.cache);
          ui.toast('success', 'Deleted', '“' + item.title + '” was removed.');
          return true;
        }).catch(function (err) { ui.toastError(err, 'Couldn’t delete ' + k.label); return false; });
      });
  }

  /** Announcements can only have their title edited (the API's PUT ignores new audio files). */
  function renameAnnouncement(item) {
    if (!guard()) return Promise.resolve(null);
    return new Promise(function (resolve) {
      var done = false;
      var m = ui.modal({
        title: 'Edit announcement', size: 'sm',
        body: '<form id="rename-form" novalidate><div data-field><label for="rename-title" class="' + ui.cls.label + '">Title <span class="text-danger" aria-hidden="true">*</span></label>' +
          '<input id="rename-title" class="' + ui.cls.input + '" value="' + esc(item.title) + '" maxlength="200" required autofocus></div>' +
          '<p class="mt-2 text-xs text-ink-muted">To replace the audio, delete this announcement and upload a new one.</p></form>',
        footer: '<button type="button" data-close class="' + ui.btn('secondary') + '">Cancel</button><button type="submit" form="rename-form" class="' + ui.btn('primary') + '">Save</button>',
        onClose: function () { if (!done) resolve(null); }
      });
      m.$el.find('#rename-form').on('submit', function (e) {
        e.preventDefault();
        var title = $.trim($('#rename-title').val());
        if (!title) { ui.fieldError('#rename-title', 'Title is required.'); return; }
        var $btn = m.$el.find('[type=submit]'); ui.setLoading($btn, true, 'Saving…');
        CE.endpoints.updateAnnouncement(item.id, { title: title }).then(function (r) {
          CE.cache.invalidate('announcements');
          ui.toast('success', 'Announcement updated');
          done = true; resolve(r.data || $.extend({}, item, { title: title })); m.close();
        }).catch(function (err) { ui.setLoading($btn, false); ui.fieldError('#rename-title', err.message); });
      });
    });
  }

  /** Small admin toolbar shown on public detail pages (admins only). */
  function toolbar(kind, item) {
    var id = 'pub-' + item.id;
    return '<div class="rounded-2xl border-2 border-dashed border-accent bg-white p-4 flex flex-wrap items-center gap-3">' +
      '<span class="inline-flex items-center gap-1.5 text-sm font-bold text-warning">' + icon('shield', 'w-4 h-4') + 'Admin</span>' +
      '<label for="' + id + '" class="flex items-center gap-2 text-sm font-semibold mr-auto"><span class="switch"><input type="checkbox" role="switch" id="' + id + '" class="js-pub" ' + (item.published !== false ? 'checked' : '') + '><span class="track"></span><span class="thumb"></span></span><span class="js-pub-label">' + (item.published !== false ? 'Published' : 'Unpublished') + '</span></label>' +
      (kind === 'promo' ? '<a href="' + util.url('admin/promo-form.html?id=' + encodeURIComponent(item.id)) + '" class="' + ui.btn('secondary', 'sm') + '">' + icon('pencil', 'w-3.5 h-3.5') + 'Edit</a>'
                        : '<button type="button" class="js-rename ' + ui.btn('secondary', 'sm') + '">' + icon('pencil', 'w-3.5 h-3.5') + 'Edit title</button>') +
      '<button type="button" class="js-del ' + ui.btn('dangerOutline', 'sm') + '">' + icon('trash', 'w-3.5 h-3.5') + 'Delete</button></div>';
  }

  /** Bind toolbar events. hooks: { onUpdate(item), onDelete() } */
  function bindToolbar($c, kind, getItem, hooks) {
    $c.on('change', '.js-pub', function () {
      var $sw = $(this), on = $sw.is(':checked'), item = getItem();
      $sw.prop('disabled', true);
      $c.find('.js-pub-label').text(on ? 'Published' : 'Unpublished');   // optimistic
      setPublished(kind, item, on).then(function (u) { hooks.onUpdate && hooks.onUpdate(u); })
        .catch(function () { $sw.prop('checked', !on); $c.find('.js-pub-label').text(!on ? 'Published' : 'Unpublished'); })
        .finally(function () { $sw.prop('disabled', false); });
    });
    $c.on('click', '.js-rename', function () { renameAnnouncement(getItem()).then(function (u) { if (u) hooks.onUpdate && hooks.onUpdate(u); }); });
    $c.on('click', '.js-del', function () { remove(kind, getItem()).then(function (ok) { if (ok) hooks.onDelete && hooks.onDelete(); }); });
  }

  CE.adminContent = { setPublished: setPublished, remove: remove, renameAnnouncement: renameAnnouncement, toolbar: toolbar, bindToolbar: bindToolbar };
})(window, jQuery);
