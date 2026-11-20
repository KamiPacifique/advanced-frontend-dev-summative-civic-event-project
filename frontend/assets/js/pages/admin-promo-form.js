/**
 * Admin › Upload / edit promo
 *   create: POST /api/promos (multipart: title, description, caption_text,
 *           and either a `video` file or a `video_link` URL — YouTube, Vimeo or
 *           a direct video file link)
 *           — the API always creates promos as published, so if "Published" is
 *             off we follow up with PATCH /api/promos/:id/unpublish.
 *   edit:   PUT  /api/promos/:id (same fields + published; video optional)
 */
(function ($, CE) {
  'use strict';
  var ui = CE.ui, util = CE.util, media = CE.media;

  // ROLE GUARD: admin-only page.
  CE.boot({ auth: 'admin', layout: 'admin', nav: 'admin-promos', title: util.param('id') ? 'Edit promo' : 'New promo', crumb: 'Promos / ' + (util.param('id') ? 'Edit' : 'New') }, function () {
    var id = util.param('id'), existing = null, uploading = false, request = null, trackUrl = null, videoUrl = null, fileUrl = null;
    var $form = $('#promo-form'), $submit = $('#submit'), pv = document.getElementById('pv'), $embed = $('#pv-embed');

    var dz = CE.forms.dropzone($('#video-field'), {
      kind: 'video', id: 'video', label: 'Video file', required: !id,
      onChange: function (file, err, url) { fileUrl = url || null; syncVideoUrl(); }
    });

    function mode() { return $('input[name="video-source"]:checked').val(); }
    function isUploaded(url) { return /\/uploads\/promos\//.test(url || ''); }
    /** A pasted link is valid if it's an http(s) URL. */
    function linkValue() {
      var raw = $.trim($('#video-link').val());
      try { var u = new URL(raw); return /^https?:$/.test(u.protocol) ? u.toString() : null; } catch (e) { return null; }
    }
    /** Work out which video the preview should show for the current mode. */
    function syncVideoUrl() {
      var keep = existing && existing.video_url;
      if (mode() === 'link') videoUrl = linkValue() || (keep && !isUploaded(keep) ? keep : null);
      else videoUrl = fileUrl || (keep && isUploaded(keep) ? keep : null);
      updatePreview();
    }
    $('input[name="video-source"]').on('change', function () {
      var link = mode() === 'link';
      $('#video-field').toggleClass('hidden', link); $('#link-field').toggleClass('hidden', !link);
      // Captions are optional for linked videos (the provider's player has its own).
      $('#captions-req').toggleClass('hidden', link); $('#captions-opt').toggleClass('hidden', !link);
      $('#captions').prop('required', !link);
      ui.clearErrors($form);
      syncVideoUrl();
    });
    $('#video-link').on('input', util.debounce(syncVideoUrl, 400));

    /** Rebuild the preview (embedded player for YouTube/Vimeo, <video> with captions otherwise). */
    function updatePreview() {
      var ext = media.videoEmbed(videoUrl);
      $('#pv-empty').toggleClass('hidden', !!videoUrl);
      $(pv).toggleClass('hidden', !videoUrl || !!ext);
      $embed.toggleClass('hidden', !ext);
      if (ext) {
        if ($embed.data('src') !== videoUrl) { $embed.data('src', videoUrl).html(media.embedFrame(ext, 'Video preview', 'block w-full h-full border-0')); }
        pv.pause(); pv.removeAttribute('src');
        return;
      }
      $embed.data('src', null).empty();
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
      var useLink = mode() === 'link', link = useLink ? linkValue() : null;
      if (!v.caption_text && !useLink) { ui.fieldError('#captions', 'Captions are required for accessibility.'); ok = false; }
      var hasExistingLink = existing && !isUploaded(existing.video_url);
      if (useLink) {
        if (!$.trim($('#video-link').val())) { if (!hasExistingLink) { ui.fieldError('#video-link', 'Paste a video link.'); ok = false; } }
        else if (!link) { ui.fieldError('#video-link', 'Enter a full link starting with https://'); ok = false; }
      } else if (!dz.file() && !(existing && isUploaded(existing.video_url))) {
        ui.fieldError(dz.input, 'Choose a video file (MP4, MOV, AVI or MKV, max 8 MB).'); ok = false;
      }
      if (!ok) { ui.focusFirstError($form); return; }
      if (useLink && !link && hasExistingLink) link = existing.video_url;   // keep the current link

      var published = $('#published').is(':checked');
      var fd = new FormData();
      fd.append('title', v.title); fd.append('description', v.description); fd.append('caption_text', v.caption_text);
      if (id) fd.append('published', published ? 'true' : 'false');
      var file = useLink ? null : dz.file();
      if (file) fd.append('video', file);
      if (link) fd.append('video_link', link);

      uploading = true; dz.lock(true); ui.setLoading($submit, true, file ? 'Uploading…' : 'Saving…');
      request = id ? CE.endpoints.updatePromo(id, fd, dz.setProgress) : CE.endpoints.createPromo(fd, dz.setProgress);
      request.then(function (r) {
        var saved = r.data || {};
        if (!id && !published && saved.id) return CE.endpoints.publishPromo(saved.id, false).then(function () { return saved; });
        return saved;
      }).then(function (saved) {
        uploading = false;
        if (file) dz.setStatus('Uploaded', 'success');
        CE.cache.invalidate('promos');
        util.flash.set('success', id ? 'Promo updated' : 'Promo saved', published ? '“' + v.title + '” is live' + (v.caption_text ? ' with captions.' : '.') : '“' + v.title + '” was saved as unpublished.');
        location.href = util.url('promo.html?id=' + encodeURIComponent(saved.id || id));
      }).catch(function (err) {
        uploading = false; dz.lock(false); ui.setLoading($submit, false);
        if (err.aborted) return;
        if (file) dz.setStatus('Upload failed', 'danger');
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
        if (isUploaded(existing.video_url)) {
          dz.setCurrent({ name: existing.video_url.split('/').pop(), url: existing.video_url });
          $('#video-hint').append(' · Leave empty to keep the current video.');
        } else {
          $('#video-link').val(existing.video_url);
          $('input[name="video-source"][value="link"]').prop('checked', true).trigger('change');
        }
        syncVideoUrl();
      }).catch(function (err) { $('#form-alert').html(ui.alert('danger', err.message, 'Couldn’t load this promo')); });
    }
  });
})(jQuery, window.CE);
