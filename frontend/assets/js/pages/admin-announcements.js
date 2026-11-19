/**
 * Admin › Announcements
 *   upload:  POST  /api/announcements (multipart: title, published, audio)
 *   manage:  PATCH /api/announcements/:id/publish | /unpublish,
 *            PUT   /api/announcements/:id (title), DELETE /api/announcements/:id
 */
(function ($, CE) {
  'use strict';
  var ui = CE.ui, util = CE.util, esc = util.esc, icon = CE.icon, admin = CE.adminContent;

  // ROLE GUARD: admin-only page.
  CE.boot({ auth: 'admin', layout: 'admin', nav: 'admin-announcements', title: 'New announcement', crumb: 'Announcements / New' }, function () {
    var $form = $('#ann-form'), $submit = $('#submit'), $list = $('#list'), all = [], uploading = false, q = '';

    var dz = CE.forms.dropzone($('#audio-field'), {
      kind: 'audio', id: 'audio', label: 'Audio file', required: true,
      onChange: function (file, err, url) {
        $('#audio-preview').toggleClass('hidden', !url);
        $('#preview-audio').attr('src', url || null);
        if (file && !$.trim($('#title').val())) $('#title').val(file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '));
      }
    });
    $('#published').on('change', function () {
      $submit.html(icon('upload', 'w-4 h-4') + (this.checked ? 'Upload &amp; publish' : 'Upload as draft'));
    });

    $form.on('reset', function () { setTimeout(function () { dz.reset(); ui.clearErrors($form); $('#published').trigger('change'); }, 0); });

    $form.on('submit', function (e) {
      e.preventDefault();
      ui.clearErrors($form); $('#form-alert').empty();
      var title = $.trim($('#title').val()), ok = true;
      if (!title) { ui.fieldError('#title', 'Title is required.'); ok = false; }
      if (!dz.file()) { ui.fieldError(dz.input, 'Choose an audio file (MP3, WAV, M4A or OGG, max 5 MB).'); ok = false; }
      if (!ok) { ui.focusFirstError($form); if (!dz.file()) $('.dz-pick').trigger('focus'); return; }

      var fd = new FormData();
      fd.append('title', title);
      fd.append('published', $('#published').is(':checked') ? 'true' : 'false');
      fd.append('audio', dz.file());
      uploading = true; dz.lock(true); ui.setLoading($submit, true, 'Uploading…');
      CE.endpoints.createAnnouncement(fd, dz.setProgress).then(function (r) {
        uploading = false; dz.setStatus('Uploaded', 'success');
        CE.cache.invalidate('announcements');
        ui.toast('success', 'Announcement published', $('#published').is(':checked') ? 'Users have been notified in-app.' : 'Saved as a draft.');
        all.unshift(r.data); renderList();
        CE.notifications.load(true).catch(function () {});
        setTimeout(function () { $form[0].reset(); }, 600);
      }).catch(function (err) {
        uploading = false; dz.setStatus('Upload failed', 'danger');
        $('#form-alert').html(ui.alert('danger', err.message, 'Upload failed'));
      }).finally(function () { dz.lock(false); ui.setLoading($submit, false); });
    });
    window.addEventListener('beforeunload', function (e) { if (uploading) { e.preventDefault(); e.returnValue = ''; } });

    function item(a) {
      var sid = 'sw-' + a.id;
      return '<li class="px-5 py-3.5 flex items-center gap-3" data-id="' + esc(a.id) + '">' +
        '<div class="min-w-0 flex-1"><a href="' + util.url('announcement.html?id=' + encodeURIComponent(a.id)) + '" class="block text-sm font-semibold hover:text-brand truncate">' + esc(a.title) + '</a>' +
          '<p class="text-xs text-ink-muted"><span data-duration-src="' + esc(a.audio_url) + '">--:--</span> · ' + esc(util.formatDateYear(a.created_at)) + (a.published === false ? ' · <span class="text-warning font-semibold">Draft</span>' : '') + '</p></div>' +
        '<label for="' + sid + '" class="sr-only">Published: ' + esc(a.title) + '</label><span class="switch"><input id="' + sid + '" type="checkbox" role="switch" data-pub ' + (a.published !== false ? 'checked' : '') + '><span class="track"></span><span class="thumb"></span></span>' +
        '<button type="button" data-edit class="' + ui.cls.iconBtn + ' !w-8 !h-8" aria-label="Edit title of ' + esc(a.title) + '">' + icon('pencil', 'w-4 h-4') + '</button>' +
        '<button type="button" data-del class="' + ui.cls.iconBtn + ' !w-8 !h-8 !text-danger hover:!bg-danger-soft" aria-label="Delete ' + esc(a.title) + '">' + icon('trash', 'w-4 h-4') + '</button></li>';
    }
    function renderList() {
      var rows = all.filter(function (a) { return util.matches(q, [a.title]); });
      $list.html(rows.length ? rows.map(item).join('') : '<li class="p-6">' + ui.empty({ bare: true, icon: 'megaphone', title: all.length ? 'No matches' : 'No announcements yet', message: all.length ? '' : 'Upload your first one using the form.' }) + '</li>');
      CE.media.fillDurations($list);
    }
    function find(el) { var id = String($(el).closest('[data-id]').data('id')); return all.find(function (a) { return a.id === id; }); }

    function load() {
      ui.busy($list, true); $list.html('<li class="p-5">' + ui.skeleton.list(3) + '</li>');
      CE.data.announcements(true).then(function (rows) { all = rows; renderList(); })
        .catch(function (err) { $list.html('<li class="p-5">' + ui.errorState(err, { bare: true }) + '</li>'); })
        .finally(function () { ui.busy($list, false); });
    }

    $('#q').on('input', util.debounce(function () { q = this.value; renderList(); }, 150));
    $list.on('click', '.ce-retry', load);
    $list.on('change', '[data-pub]', function () {
      var $sw = $(this), a = find(this), on = $sw.is(':checked');
      $sw.prop('disabled', true);
      admin.setPublished('announcement', a, on).then(function (u) { $.extend(a, u); renderList(); })
        .catch(function () { $sw.prop('checked', !on); }).finally(function () { $sw.prop('disabled', false); });
    });
    $list.on('click', '[data-edit]', function () { var a = find(this); admin.renameAnnouncement(a).then(function (u) { if (u) { $.extend(a, u); renderList(); } }); });
    $list.on('click', '[data-del]', function () {
      var a = find(this);
      admin.remove('announcement', a).then(function (ok) { if (ok) { all = all.filter(function (x) { return x.id !== a.id; }); renderList(); } });
    });
    load();
  });
})(jQuery, window.CE);
