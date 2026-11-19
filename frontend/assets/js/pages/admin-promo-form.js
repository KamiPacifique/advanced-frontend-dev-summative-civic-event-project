/**
 * Admin › Upload / edit promo
 *   create: POST /api/promos (multipart: title, description, caption_text, video)
 *           — the API always creates promos as published, so if "Published" is
 *             off we follow up with PATCH /api/promos/:id/unpublish.
 *   edit:   PUT  /api/promos/:id (same fields + published; video optional)
 */
(function ($, CE) {
  'use strict';
  var ui = CE.ui, util = CE.util, media = CE.media;

  // ROLE GUARD: admin-only page.
  CE.boot({ auth: 'admin', layout: 'admin', nav: 'admin-promos', title: util.param('id') ? 'Edit promo' : 'New promo', crumb: 'Promos / ' + (util.param('id') ? 'Edit' : 'New') }, function () {
    var id = util.param('id'), existing = null, uploading = false, request = null, trackUrl = null, videoUrl = null;
    var $form = $('#promo-form'), $submit = $('#submit'), pv = document.getElementById('pv');

    var dz = CE.forms.dropzone($('#video-field'), {
      kind: 'video', id: 'video', label: 'Video file', required: !id,
      onChange: function (file, err, url) { videoUrl = url || (existing && existing.video_url) || null; updatePreview(); }
    });

    /** Rebuild the preview <video> with captions from the textarea. */
    function updatePreview() {
      $('#pv-empty').toggleClass('hidden', !!videoUrl); $(pv).toggleClass('hidden', !videoUrl);
      if (!videoUrl) { pv.removeAttribute('src'); return; }
      if (pv.getAttribute('src') !== videoUrl) pv.src = videoUrl;
      $(pv).find('track').remove();
      if (trackUrl) URL.revokeObjectURL(trackUrl);
      trackUrl = media.trackURL($('#captions').val(), isFinite(pv.duration) ? pv.duration : null);
      if (!trackUrl) return;
      var t = document.createElement('track');
      t.kind = 'captions'; t.srclang = 'en'; t.label = 'English'; t.default = true; t.src = trackUrl;
      pv.appendChild(t);
      setTimeout(function () { if (pv.textTracks[0]) pv.textTracks[0].mode = 'showing'; }, 0);
    }
    pv.addEventListener('loadedmetadata', updatePreview);
    $('#captions').on('input', util.debounce(updatePreview, 400));
    $('#vtt-template').on('click', function () {
      var $c = $('#captions');
      if ($.trim($c.val()) && !window.confirm('Replace the current captions with a template?')) return;
      $c.val('WEBVTT\n\n00:00:00.000 --> 00:00:04.000\nFirst caption line\n\n00:00:04.000 --> 00:00:08.000\nSecond caption line').trigger('input').trigger('focus');
    });

    $form.on('submit', function (e) {
      e.preventDefault();
      ui.clearErrors($form); $('#form-alert').empty();
      var v = { title: $.trim($('#title').val()), description: $.trim($('#description').val()), caption_text: $.trim($('#captions').val()) }, ok = true;
      if (!v.title) { ui.fieldError('#title', 'Title is required.'); ok = false; }
      if (!v.description) { ui.fieldError('#description', 'Description is required.'); ok = false; }
      if (!v.caption_text) { ui.fieldError('#captions', 'Captions are required for accessibility.'); ok = false; }
      if (!id && !dz.file()) { ui.fieldError(dz.input, 'Choose a video file (MP4, MOV, AVI or MKV, max 8 MB).'); ok = false; }
      if (!ok) { ui.focusFirstError($form); return; }

      var published = $('#published').is(':checked');
      var fd = new FormData();
      fd.append('title', v.title); fd.append('description', v.description); fd.append('caption_text', v.caption_text);
      if (id) fd.append('published', published ? 'true' : 'false');
      if (dz.file()) fd.append('video', dz.file());

      uploading = true; dz.lock(true); ui.setLoading($submit, true, dz.file() ? 'Uploading…' : 'Saving…');
      request = id ? CE.endpoints.updatePromo(id, fd, dz.setProgress) : CE.endpoints.createPromo(fd, dz.setProgress);
      request.then(function (r) {
        var saved = r.data || {};
        if (!id && !published && saved.id) return CE.endpoints.publishPromo(saved.id, false).then(function () { return saved; });
        return saved;
      }).then(function (saved) {
        uploading = false;
        if (dz.file()) dz.setStatus('Uploaded', 'success');
        CE.cache.invalidate('promos');
        util.flash.set('success', id ? 'Promo updated' : 'Promo saved', published ? '“' + v.title + '” is live with captions.' : '“' + v.title + '” was saved as unpublished.');
        location.href = util.url('promo.html?id=' + encodeURIComponent(saved.id || id));
      }).catch(function (err) {
        uploading = false; dz.lock(false); ui.setLoading($submit, false);
        if (err.aborted) return;
        if (dz.file()) dz.setStatus('Upload failed', 'danger');
        $('#form-alert').html(ui.alert('danger', err.message, 'Couldn’t save the promo'));
      });
    });

    window.addEventListener('beforeunload', function (e) { if (uploading) { e.preventDefault(); e.returnValue = ''; } });
    window.addEventListener('pagehide', function () { if (uploading && request) request.abort(); });

    if (id) {
      $('#page-title').text('Edit promo'); document.title = 'Edit promo · CivicConnect Admin';
      CE.endpoints.promo(id).then(function (r) {
        existing = r.data;
        $('#title').val(existing.title); $('#description').val(existing.description || ''); $('#captions').val(existing.caption_text || '');
        $('#published').prop('checked', existing.published !== false);
        dz.setCurrent({ name: existing.video_url.split('/').pop(), url: existing.video_url });
        $('#video-hint').append(' · Leave empty to keep the current video.');
        videoUrl = existing.video_url; updatePreview();
      }).catch(function (err) { $('#form-alert').html(ui.alert('danger', err.message, 'Couldn’t load this promo')); });
    }
  });
})(jQuery, window.CE);
