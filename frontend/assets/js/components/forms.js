/**
 * CE.forms — form widgets:
 *  - dropzone(): accessible file picker with drag & drop, client-side
 *    type/size validation (mirrors the backend multer limits), preview and
 *    upload progress.
 *  - passwordRules / strength(): signup password policy + meter.
 *  - starInput(): keyboard-accessible 1–5 rating (radiogroup).
 */
(function (w, $) {
  'use strict';
  var CE = w.CE, util = CE.util, esc = util.esc, icon = CE.icon, ui = CE.ui;

  /* ---------------- File dropzone ---------------- */
  /**
   * dropzone($container, { kind: 'image'|'audio'|'video', id, label, required, current: { name, url }, onChange(file) })
   */
  function dropzone($c, o) {
    var cfg = CE.config.UPLOADS[o.kind];
    var kindIcon = { image: 'image', audio: 'music', video: 'video' }[o.kind];
    var file = null, objectUrl = null;
    $c.html(
      '<div data-field>' +
        '<p class="' + ui.cls.label + '" id="' + o.id + '-label">' + esc(o.label) + (o.required ? ' <span class="text-danger" aria-hidden="true">*</span>' : '') + '</p>' +
        '<div class="dz rounded-xl border-2 border-dashed border-line-strong bg-canvas hover:bg-brand-soft/30 hover:border-brand/60 transition-colors px-4 py-7 text-center">' +
          '<span class="mx-auto w-11 h-11 rounded-full bg-brand-soft text-brand flex items-center justify-center">' + icon('upload', 'w-5 h-5') + '</span>' +
          '<p class="mt-3 text-sm text-ink-secondary"><button type="button" class="dz-pick font-semibold text-brand hover:underline" aria-describedby="' + o.id + '-hint">Click to upload</button> or drag and drop</p>' +
          '<p class="mt-1 text-xs text-ink-muted" id="' + o.id + '-hint">' + esc(cfg.label) + '</p>' +
          '<input type="file" id="' + o.id + '" class="sr-only" accept="' + esc(cfg.accept) + '" aria-labelledby="' + o.id + '-label" aria-describedby="' + o.id + '-hint" tabindex="-1">' +
        '</div>' +
        '<div class="dz-file mt-3 space-y-3" aria-live="polite"></div>' +
      '</div>');
    var $input = $c.find('input[type=file]'), $dz = $c.find('.dz'), $file = $c.find('.dz-file');
    $input.data('hint-id', o.id + '-hint');

    function row(f, url) {
      var thumb = o.kind === 'image' && url
        ? '<img src="' + esc(url) + '" alt="Preview of selected image" class="w-12 h-12 rounded-lg object-cover">'
        : '<span class="w-12 h-12 rounded-lg ' + (o.kind === 'video' ? 'bg-inverse text-white' : 'bg-brand text-white') + ' flex items-center justify-center">' + icon(kindIcon, 'w-5 h-5') + '</span>';
      return '<div class="dz-row flex items-center gap-3 p-3 rounded-xl border border-line bg-white">' + thumb +
        '<div class="flex-1 min-w-0"><div class="flex items-center justify-between gap-2"><p class="text-sm font-semibold truncate">' + esc(f.name) + '</p><p class="text-xs text-ink-muted shrink-0">' + esc(f.size ? util.formatBytes(f.size) : '') + '</p></div>' +
          '<div class="mt-1.5 h-1.5 rounded-full bg-subtle overflow-hidden" role="progressbar" aria-label="Upload progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="dz-bar h-full w-0 bg-brand transition-all"></div></div>' +
          '<p class="dz-status mt-1 text-xs text-ink-muted">' + (f.current ? 'Current file' : 'Ready to upload') + '</p></div>' +
        '<button type="button" class="dz-remove ' + ui.cls.iconBtn + ' !w-8 !h-8" aria-label="Remove ' + esc(f.name) + '">' + icon('x', 'w-4 h-4') + '</button></div>';
    }
    function errorRow(f, msg) {
      return '<div class="flex items-center gap-3 p-3 rounded-xl border border-red-300 bg-white" role="alert"><span class="w-12 h-12 rounded-lg bg-danger-soft text-danger flex items-center justify-center">' + icon('alert-circle', 'w-5 h-5') + '</span>' +
        '<div class="flex-1 min-w-0"><p class="text-sm font-semibold truncate">' + esc(f.name) + '</p><p class="text-xs text-danger font-medium">' + esc(msg) + '</p></div>' +
        '<button type="button" class="dz-clear-err ' + ui.cls.iconBtn + ' !w-8 !h-8" aria-label="Dismiss error">' + icon('x', 'w-4 h-4') + '</button></div>';
    }

    function validate(f) {
      var ext = util.fileExt(f.name);
      if (cfg.exts.indexOf(ext) === -1) return 'Unsupported file type (.' + (ext || '?') + '). Allowed: ' + cfg.exts.map(function (e) { return '.' + e; }).join(', ') + '.';
      if (f.size > cfg.maxBytes) return 'File is ' + util.formatBytes(f.size) + ' — the limit is ' + util.formatBytes(cfg.maxBytes) + '.';
      return null;
    }

    function set(f) {
      if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
      var err = validate(f);
      if (err) {
        file = null;
        $file.html(errorRow(f, err) + (o.current ? row(o.current, o.current.url) : ''));
        if (o.onChange) o.onChange(null, err);
        return;
      }
      file = f;
      objectUrl = URL.createObjectURL(f);
      $file.html(row(f, objectUrl));
      ui.fieldError($input, null);
      if (o.onChange) o.onChange(f, null, objectUrl);
    }
    function reset(silent) {
      file = null; if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
      $input.val('');
      $file.html(o.current ? row($.extend({ current: true }, o.current), o.current.url) : '');
      $file.find('.dz-row .dz-remove').toggle(!o.current);
      if (o.current) $file.find('.dz-bar').css('width', '100%').addClass('!bg-success');
      if (o.onChange && silent !== true) o.onChange(null);
    }

    $c.on('click', '.dz-pick', function () { $input.trigger('click'); });
    $input.on('change', function () { if (this.files && this.files[0]) set(this.files[0]); });
    $dz.on('dragover dragenter', function (e) { e.preventDefault(); $dz.addClass('!border-brand !bg-brand-soft/40'); })
       .on('dragleave drop', function (e) { e.preventDefault(); $dz.removeClass('!border-brand !bg-brand-soft/40'); })
       .on('drop', function (e) { var f = e.originalEvent.dataTransfer.files[0]; if (f) set(f); });
    $c.on('click', '.dz-remove', function () { reset(); });
    $c.on('click', '.dz-clear-err', function () { reset(); });
    reset(true);

    return {
      file: function () { return file; },
      objectUrl: function () { return objectUrl; },
      input: $input,
      setProgress: function (pct) {
        $file.find('.dz-bar').css('width', pct + '%');
        $file.find('[role=progressbar]').attr('aria-valuenow', pct);
        $file.find('.dz-status').text(pct < 100 ? 'Uploading… ' + pct + '%' : 'Processing…');
      },
      setStatus: function (text, tone) {
        $file.find('.dz-status').text(text).removeClass('text-ink-muted text-success text-danger').addClass(tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : 'text-ink-muted');
        if (tone === 'success') $file.find('.dz-bar').css('width', '100%').addClass('!bg-success');
        if (tone === 'danger') $file.find('.dz-bar').addClass('!bg-danger');
      },
      lock: function (on) { $c.find('button').prop('disabled', on); },
      reset: function () { reset(); },
      setCurrent: function (cur) { o.current = cur; reset(true); }
    };
  }

  /* ---------------- Password policy ---------------- */
  // Same policy the backend enforces in auth.controller.js (PASSWORD_REGEX).
  var passwordRules = [
    { key: 'len', label: '8+ characters', test: function (p) { return p.length >= 8; } },
    { key: 'case', label: 'Upper & lowercase', test: function (p) { return /[a-z]/.test(p) && /[A-Z]/.test(p); } },
    { key: 'num', label: 'A number', test: function (p) { return /\d/.test(p); } },
    { key: 'special', label: 'A special character', test: function (p) { return /[\W_]/.test(p); } }
  ];
  function strength(p) {
    var passed = passwordRules.filter(function (r) { return r.test(p || ''); }).length;
    var labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
    var tones = ['bg-danger', 'bg-danger', 'bg-accent', 'bg-success', 'bg-success'];
    var text = ['text-danger', 'text-danger', 'text-warning', 'text-success', 'text-success'];
    return { score: passed, label: labels[passed], bar: tones[passed], text: text[passed], ok: passed === 4 };
  }

  /* ---------------- Star rating input ---------------- */
  function starInput($c, o) {
    var value = o.value || 0, labels = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'];
    function render() {
      $c.html('<div class="star-input flex items-center gap-1" role="radiogroup" aria-label="' + esc(o.label || 'Your rating') + '" ' + (o.describedBy ? 'aria-describedby="' + o.describedBy + '"' : '') + '>' +
        [1, 2, 3, 4, 5].map(function (i) {
          var on = i <= value;
          return '<button type="button" role="radio" aria-checked="' + (i === value) + '" aria-label="' + i + ' star' + (i > 1 ? 's' : '') + ' — ' + labels[i - 1] + '" tabindex="' + ((value ? i === value : i === 1) ? 0 : -1) + '" data-v="' + i + '" class="p-1 rounded-md ' + (on ? 'bg-accent-soft' : '') + '">' + CE.star(on, 'w-6 h-6') + '</button>';
        }).join('') + '<span class="ml-2 text-sm text-ink-muted" aria-hidden="true">' + (value ? value + ' of 5 · ' + labels[value - 1] : 'Select a rating') + '</span></div>');
    }
    function set(v, focus) { value = v; render(); if (focus) $c.find('[data-v="' + v + '"]').trigger('focus'); if (o.onChange) o.onChange(v); }
    render();
    $c.on('click', '[data-v]', function () { set(Number($(this).data('v')), true); });
    $c.on('keydown', '[role=radio]', function (e) {
      var v = Number($(this).data('v'));
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); set(Math.min(5, v + 1), true); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); set(Math.max(1, v - 1), true); }
    });
    return { value: function () { return value; }, set: set };
  }

  CE.forms = { dropzone: dropzone, passwordRules: passwordRules, strength: strength, starInput: starInput };
})(window, jQuery);
