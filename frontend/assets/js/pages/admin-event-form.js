/**
 * Admin › Create / edit event
 *   create: POST /api/events     (multipart/form-data, file key "image")
 *   edit:   PUT  /api/events/:id (same form; image optional)
 * Validates required fields, end-after-start, and image type/size (≤ 2 MB,
 * jpg/png/gif) before uploading. Shows upload progress and a live preview.
 */
(function ($, CE) {
  'use strict';
  var ui = CE.ui, util = CE.util;

  // ROLE GUARD: admin-only page (backend also enforces authorize(['admin'])).
  CE.boot({ auth: 'admin', layout: 'admin', nav: 'admin-events', title: util.param('id') ? 'Edit event' : 'Create event', crumb: 'Events / ' + (util.param('id') ? 'Edit' : 'New') }, function () {
    var id = util.param('id'), existing = null, previewUrl = null, uploading = false, dirty = false;
    var $form = $('#event-form'), $submit = $('#submit');

    var dz = CE.forms.dropzone($('#image-field'), {
      kind: 'image', id: 'image', label: 'Event image',
      onChange: function (file, err, url) { previewUrl = url || (existing && existing.metadata && existing.metadata.image_url) || null; dirty = true; renderPreview(); }
    });

    function values() {
      return {
        title: $.trim($('#title').val()), description: $.trim($('#description').val()), location: $.trim($('#location').val()),
        starts_at: $('#starts_at').val(), ends_at: $('#ends_at').val()
      };
    }
    function iso(v) { var d = v ? new Date(v) : null; return d && !isNaN(d) ? d.toISOString() : null; }

    function renderPreview() {
      var v = values();
      var ev = {
        id: id || 'preview', title: v.title || 'Your event title', description: v.description || 'A short description of your event appears here.',
        location: v.location || 'Location', starts_at: iso(v.starts_at) || new Date(Date.now() + 86400000).toISOString(), ends_at: iso(v.ends_at),
        metadata: previewUrl ? { image_url: previewUrl } : {}
      };
      $('#preview').html(CE.cards.eventCard(ev, {}));
      $('#preview').find('a, button').attr({ tabindex: '-1', 'aria-hidden': 'true' }).on('click', function (e) { e.preventDefault(); });
    }
    $form.on('input change', 'input:not([type=file]), textarea', util.debounce(function () { dirty = true; renderPreview(); }, 120));

    function validate() {
      ui.clearErrors($form); $('#form-alert').empty();
      var v = values(), ok = true;
      if (!v.title) { ui.fieldError('#title', 'Title is required.'); ok = false; }
      if (!v.description) { ui.fieldError('#description', 'Add a short description.'); ok = false; }
      if (!v.location) { ui.fieldError('#location', 'Location is required.'); ok = false; }
      if (!v.starts_at) { ui.fieldError('#starts_at', 'Start date & time is required.'); ok = false; }
      if (!v.ends_at) { ui.fieldError('#ends_at', 'End date & time is required.'); ok = false; }
      if (v.starts_at && v.ends_at && new Date(v.ends_at) <= new Date(v.starts_at)) { ui.fieldError('#ends_at', 'End time must be after start time.'); ok = false; }
      if (!id && v.starts_at && new Date(v.starts_at) < new Date()) { ui.fieldError('#starts_at', 'New events must start in the future.'); ok = false; }
      return ok;
    }

    $form.on('submit', function (e) {
      e.preventDefault();
      if (!validate()) { ui.focusFirstError($form); return; }
      var v = values(), fd = new FormData();
      fd.append('title', v.title); fd.append('description', v.description); fd.append('location', v.location);
      fd.append('starts_at', iso(v.starts_at)); fd.append('ends_at', iso(v.ends_at));
      if (dz.file()) fd.append('image', dz.file());

      uploading = true; dz.lock(true);
      ui.setLoading($submit, true, dz.file() ? 'Uploading…' : 'Saving…');
      var req = id ? CE.endpoints.updateEvent(id, fd, dz.setProgress) : CE.endpoints.createEvent(fd, dz.setProgress);
      req.then(function (r) {
        uploading = false; dirty = false;
        if (dz.file()) dz.setStatus('Uploaded · saved', 'success');
        CE.cache.invalidate('events');
        util.flash.set('success', id ? 'Event updated' : 'Event published', id ? '“' + v.title + '” was saved.' : '“' + v.title + '” is live and users have been notified.');
        location.href = util.url('event.html?id=' + encodeURIComponent((r.data && r.data.id) || id));
      }).catch(function (err) {
        uploading = false; dz.lock(false);
        ui.setLoading($submit, false);
        if (dz.file()) dz.setStatus('Upload failed', 'danger');
        $('#form-alert').html(ui.alert('danger', err.message, err.network ? 'Network error — your entries are kept, try again' : 'Couldn’t save the event'));
        $('#form-alert')[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });

    // Warn before leaving with unsaved changes or an upload in progress.
    window.addEventListener('beforeunload', function (e) { if (uploading || dirty) { e.preventDefault(); e.returnValue = ''; } });

    if (id) {
      $('#page-title').text('Edit event'); document.title = 'Edit event · CivicConnect Admin';
      $submit.text('Save changes');
      $form.find('input, textarea, button').prop('disabled', true);
      CE.endpoints.event(id).then(function (r) {
        existing = r.data;
        $('#title').val(existing.title); $('#description').val(existing.description || ''); $('#location').val(existing.location || '');
        $('#starts_at').val(util.toLocalInput(existing.starts_at)); $('#ends_at').val(util.toLocalInput(existing.ends_at));
        var img = existing.metadata && existing.metadata.image_url;
        previewUrl = img || null;
        if (img) dz.setCurrent({ name: img.split('/').pop(), url: img });
        $form.find('input:not([type=checkbox]), textarea, button').prop('disabled', false);
        dirty = false; renderPreview();
      }).catch(function (err) {
        $('#form-alert').html(ui.alert('danger', err.message, 'Couldn’t load this event'));
      });
    } else {
      renderPreview();
    }
  });
})(jQuery, window.CE);
