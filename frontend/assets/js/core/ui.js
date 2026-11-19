/**
 * CE.ui — reusable UI building blocks (jQuery + Tailwind classes):
 * buttons, badges, toasts, modal / confirm dialogs, drawers, loading
 * skeletons, empty / error / forbidden states, pagination, form errors.
 */
(function (w, $) {
  'use strict';
  var CE = w.CE, esc = CE.util.esc, icon = CE.icon;

  /* ---------------- Class tokens ---------------- */
  var BTN = 'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed';
  var cls = {
    btn: BTN,
    md: 'h-10 px-4 text-sm',
    sm: 'h-8 px-3 text-xs',
    lg: 'h-11 px-5 text-sm',
    primary: 'bg-brand text-white hover:bg-brand-hover shadow-sm',
    secondary: 'bg-white text-ink border border-line hover:bg-subtle hover:border-line-strong',
    danger: 'bg-danger text-white hover:bg-red-800 shadow-sm',
    dangerOutline: 'bg-white text-danger border border-red-200 hover:bg-danger-soft',
    ghost: 'text-brand hover:bg-brand-soft',
    iconBtn: 'inline-flex items-center justify-center w-9 h-9 rounded-lg text-ink-secondary hover:bg-subtle hover:text-ink transition-colors',
    input: 'block w-full h-11 rounded-lg border border-line bg-white px-3.5 text-sm text-ink placeholder:text-ink-muted shadow-sm transition focus:border-brand focus:ring-4 focus:ring-brand-soft focus-visible:outline-none aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger-soft disabled:bg-subtle disabled:text-ink-muted',
    textarea: 'block w-full rounded-lg border border-line bg-white px-3.5 py-3 text-sm text-ink placeholder:text-ink-muted shadow-sm transition focus:border-brand focus:ring-4 focus:ring-brand-soft focus-visible:outline-none aria-[invalid=true]:border-danger',
    label: 'block text-sm font-semibold text-ink mb-1.5',
    card: 'bg-white rounded-2xl border border-line shadow-card',
    chip: 'h-8 px-3.5 rounded-full text-xs font-semibold border transition-colors',
    chipOn: 'bg-inverse text-white border-inverse',
    chipOff: 'bg-white text-ink-secondary border-line hover:border-line-strong hover:text-ink'
  };
  function btn(variant, size) { return [BTN, cls[size || 'md'], cls[variant || 'primary']].join(' '); }

  /* ---------------- Badges ---------------- */
  var TONES = {
    brand: 'bg-brand-soft text-brand',
    success: 'bg-success-soft text-success',
    danger: 'bg-danger-soft text-danger',
    warning: 'bg-warning-soft text-warning',
    info: 'bg-info-soft text-info',
    accent: 'bg-accent-soft text-accent-text',
    neutral: 'bg-subtle text-ink-secondary',
    dark: 'bg-inverse text-white'
  };
  function badge(label, tone, extra) {
    return '<span class="inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-xs font-semibold ' + (TONES[tone] || TONES.neutral) + ' ' + (extra || '') + '">' + esc(label) + '</span>';
  }

  /* ---------------- Avatar ---------------- */
  function avatar(name, size, dark) {
    var s = size || 'w-8 h-8 text-xs';
    return '<span class="inline-flex items-center justify-center rounded-full font-bold shrink-0 ' + s + ' ' +
      (dark ? 'bg-inverse text-white' : 'bg-brand-soft text-brand') + '" aria-hidden="true">' + esc(CE.util.initials(name)) + '</span>';
  }

  /* ---------------- Toasts ---------------- */
  function toastRegion() {
    var $r = $('#ce-toasts');
    if (!$r.length) {
      $r = $('<div id="ce-toasts" class="fixed z-[80] top-4 right-4 left-4 sm:left-auto flex flex-col gap-3 items-stretch sm:items-end pointer-events-none" aria-live="polite" aria-relevant="additions"></div>');
      $('body').append($r);
    }
    return $r;
  }
  /**
   * toast('success'|'error'|'info'|'warning', title, message, { action: { label, onClick }, duration })
   */
  function toast(type, title, message, opts) {
    opts = opts || {};
    var map = {
      success: { ic: 'check', wrap: 'bg-success-soft text-success' },
      error: { ic: 'alert-circle', wrap: 'bg-danger-soft text-danger' },
      warning: { ic: 'alert-circle', wrap: 'bg-warning-soft text-warning' },
      info: { ic: 'info', wrap: 'bg-info-soft text-info' }
    }[type] || { ic: 'info', wrap: 'bg-info-soft text-info' };
    var $t = $(
      '<div class="toast-enter pointer-events-auto w-full sm:w-96 bg-white rounded-xl border border-line shadow-pop p-4 flex gap-3" role="' + (type === 'error' ? 'alert' : 'status') + '">' +
        '<span class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 ' + map.wrap + '">' + icon(map.ic, 'w-4 h-4') + '</span>' +
        '<div class="flex-1 min-w-0"><p class="text-sm font-semibold text-ink">' + esc(title) + '</p>' +
          (message ? '<p class="text-sm text-ink-secondary mt-0.5 break-words">' + esc(message) + '</p>' : '') +
          (opts.action ? '<button type="button" class="ce-toast-action mt-1.5 text-sm font-semibold text-brand hover:underline">' + esc(opts.action.label) + '</button>' : '') +
        '</div>' +
        '<button type="button" class="ce-toast-close ' + cls.iconBtn + ' !w-7 !h-7 -mr-1 -mt-1" aria-label="Dismiss notification">' + icon('x', 'w-4 h-4') + '</button>' +
      '</div>');
    function close() { $t.removeClass('toast-enter').addClass('toast-leave'); setTimeout(function () { $t.remove(); }, 180); }
    $t.find('.ce-toast-close').on('click', close);
    if (opts.action) $t.find('.ce-toast-action').on('click', function () { opts.action.onClick(); close(); });
    toastRegion().append($t);
    var ms = opts.duration === 0 ? 0 : (opts.duration || (type === 'error' ? 7000 : 4500));
    if (ms) {
      var timer = setTimeout(close, ms);
      $t.on('mouseenter focusin', function () { clearTimeout(timer); })
        .on('mouseleave focusout', function () { clearTimeout(timer); timer = setTimeout(close, 2500); });
    }
    return { close: close };
  }
  function toastError(err, title) { return toast('error', title || 'Something went wrong', (err && err.message) || String(err)); }

  /* ---------------- Focus trap (modals + drawers) ---------------- */
  var FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  function trapFocus($container, onEscape) {
    function handler(e) {
      if (e.key === 'Escape') { e.preventDefault(); onEscape(); return; }
      if (e.key !== 'Tab') return;
      var $f = $container.find(FOCUSABLE).filter(':visible');
      if (!$f.length) return;
      var first = $f[0], last = $f[$f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    $container.on('keydown', handler);
  }

  var openLayers = 0;
  function lockScroll(on) {
    openLayers += on ? 1 : -1;
    if (openLayers < 0) openLayers = 0;
    $('html').toggleClass('overflow-hidden', openLayers > 0);
  }

  /* ---------------- Modal ---------------- */
  /**
   * modal({ title, body, footer, size: 'sm'|'md'|'lg', onClose, labelIcon })
   * Returns { $el, close }. Esc / backdrop click close it; focus is trapped and restored.
   */
  function modal(o) {
    var id = 'm' + Math.random().toString(36).slice(2, 8);
    var size = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' }[o.size || 'md'];
    var returnFocus = document.activeElement;
    var $m = $(
      '<div class="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4" role="presentation">' +
        '<div class="ce-backdrop absolute inset-0 bg-inverse/50 fade-in"></div>' +
        '<div class="pop-in relative w-full ' + size + ' bg-white rounded-t-2xl sm:rounded-2xl shadow-pop max-h-[92vh] flex flex-col" role="dialog" aria-modal="true" aria-labelledby="' + id + '-t">' +
          '<div class="flex items-start gap-3 p-5 sm:p-6 pb-0">' +
            (o.labelIcon || '') +
            '<h2 id="' + id + '-t" class="flex-1 text-lg sm:text-xl font-bold text-ink pt-1">' + esc(o.title) + '</h2>' +
            '<button type="button" class="ce-close ' + cls.iconBtn + ' border border-line" aria-label="Close dialog">' + icon('x', 'w-4 h-4') + '</button>' +
          '</div>' +
          '<div class="ce-body px-5 sm:px-6 py-4 overflow-y-auto thin-scroll">' + (o.body || '') + '</div>' +
          (o.footer ? '<div class="ce-footer px-5 sm:px-6 pb-5 sm:pb-6 pt-1 flex flex-wrap justify-end gap-2">' + o.footer + '</div>' : '') +
        '</div>' +
      '</div>');
    var closed = false;
    function close(result) {
      if (closed) return; closed = true;
      $m.remove(); lockScroll(false);
      if (returnFocus && returnFocus.focus) returnFocus.focus();
      if (o.onClose) o.onClose(result);
    }
    $m.find('.ce-close, .ce-backdrop').on('click', function () { close(); });
    $m.find('[data-close]').on('click', function () { close(); });
    $('body').append($m); lockScroll(true);
    trapFocus($m, function () { close(); });
    setTimeout(function () {
      var $auto = $m.find('[autofocus]').first();
      ($auto.length ? $auto : $m.find('.ce-footer button, .ce-close').last()).trigger('focus');
    }, 30);
    return { $el: $m, close: close };
  }

  /** confirm({ title, message, confirmLabel, cancelLabel, tone: 'danger'|'primary', icon }) → Promise<boolean> */
  function confirmDialog(o) {
    return new Promise(function (resolve) {
      var tone = o.tone || 'danger';
      var ic = '<span class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 ' + (tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-brand-soft text-brand') + '">' + icon(o.icon || (tone === 'danger' ? 'trash' : 'info'), 'w-5 h-5') + '</span>';
      var settled = false;
      var m = modal({
        title: o.title, size: 'sm', labelIcon: ic,
        body: '<p class="text-sm text-ink-secondary leading-relaxed">' + esc(o.message) + '</p>',
        footer: '<button type="button" class="ce-cancel ' + btn('secondary') + '">' + esc(o.cancelLabel || 'Cancel') + '</button>' +
                '<button type="button" class="ce-ok ' + btn(tone === 'danger' ? 'danger' : 'primary') + '">' + esc(o.confirmLabel || 'Confirm') + '</button>',
        onClose: function () { if (!settled) { settled = true; resolve(false); } }
      });
      m.$el.find('.ce-cancel').on('click', function () { m.close(); });
      m.$el.find('.ce-ok').on('click', function () { settled = true; resolve(true); m.close(); });
      setTimeout(function () { m.$el.find('.ce-cancel').trigger('focus'); }, 40);
    });
  }

  /* ---------------- Drawer (right side panel) ---------------- */
  function drawer(o) {
    var id = 'd' + Math.random().toString(36).slice(2, 8);
    var returnFocus = document.activeElement;
    var $d = $(
      '<div class="fixed inset-0 z-[60]" role="presentation">' +
        '<div class="ce-backdrop absolute inset-0 bg-inverse/40 fade-in"></div>' +
        '<aside class="drawer-panel translate-x-full absolute ' + (o.side === 'left' ? 'left-0' : 'right-0') + ' top-0 h-full w-full ' + (o.width || 'sm:w-[26rem]') + ' bg-white shadow-pop flex flex-col" role="dialog" aria-modal="true" aria-labelledby="' + id + '-t">' +
          (o.header || '<div class="flex items-center justify-between gap-3 px-5 py-4 border-b border-line"><h2 id="' + id + '-t" class="text-lg font-bold">' + esc(o.title) + '</h2><button type="button" class="ce-close ' + cls.iconBtn + '" aria-label="Close panel">' + icon('x', 'w-5 h-5') + '</button></div>') +
          '<div class="ce-body flex-1 overflow-y-auto thin-scroll">' + (o.body || '') + '</div>' +
          (o.footer || '') +
        '</aside>' +
      '</div>');
    if (o.header) $d.find('aside').attr('aria-labelledby', null).attr('aria-label', o.title);
    if (o.side === 'left') $d.find('aside').removeClass('translate-x-full').addClass('-translate-x-full');
    var closed = false;
    function close() {
      if (closed) return; closed = true;
      $d.find('aside').addClass(o.side === 'left' ? '-translate-x-full' : 'translate-x-full');
      setTimeout(function () { $d.remove(); }, 240);
      lockScroll(false);
      if (returnFocus && returnFocus.focus) returnFocus.focus();
      if (o.onClose) o.onClose();
    }
    $d.on('click', '.ce-close, .ce-backdrop', close);
    $('body').append($d); lockScroll(true);
    trapFocus($d, close);
    requestAnimationFrame(function () {
      $d.find('aside').removeClass('translate-x-full -translate-x-full');
      setTimeout(function () { $d.find('.ce-close').first().trigger('focus'); }, 60);
    });
    return { $el: $d, close: close };
  }

  /* ---------------- Loading button ---------------- */
  function setLoading($btn, loading, label) {
    $btn = $($btn);
    if (loading) {
      if (!$btn.data('ce-html')) $btn.data('ce-html', $btn.html());
      $btn.prop('disabled', true).attr('aria-busy', 'true')
        .html('<span class="spinner" aria-hidden="true"></span><span>' + esc(label || 'Working…') + '</span>');
    } else {
      $btn.prop('disabled', false).removeAttr('aria-busy');
      if ($btn.data('ce-html')) { $btn.html($btn.data('ce-html')); $btn.removeData('ce-html'); }
    }
  }

  /* ---------------- States ---------------- */
  function stateBlock(o) {
    var tones = { brand: 'bg-brand-soft text-brand', danger: 'bg-danger-soft text-danger', warning: 'bg-accent-soft text-accent-text', neutral: 'bg-subtle text-ink-muted' };
    return '<div class="' + (o.bare ? '' : cls.card + ' ') + 'px-6 py-12 text-center flex flex-col items-center ' + (o.extra || '') + '" role="' + (o.role || 'status') + '">' +
      '<span class="w-14 h-14 rounded-full flex items-center justify-center mb-4 ' + (tones[o.tone] || tones.brand) + '">' + icon(o.icon || 'info', 'w-6 h-6') + '</span>' +
      '<h3 class="text-base font-bold text-ink">' + esc(o.title) + '</h3>' +
      (o.message ? '<p class="mt-1.5 text-sm text-ink-secondary max-w-sm">' + esc(o.message) + '</p>' : '') +
      (o.actions ? '<div class="mt-5 flex flex-wrap justify-center gap-2">' + o.actions + '</div>' : '') +
    '</div>';
  }
  function empty(o) { return stateBlock($.extend({ tone: 'brand' }, o)); }

  /** Network / API error with a Retry button. Bind retry via $(container).on('click', '.ce-retry', fn). */
  function errorState(err, o) {
    o = o || {};
    var network = err && err.network;
    return stateBlock({
      tone: 'danger', role: 'alert', icon: network ? 'wifi-off' : 'alert-circle', extra: o.extra, bare: o.bare,
      title: o.title || (network ? 'You appear to be offline' : 'We couldn’t load this'),
      message: (err && err.message) || 'Please try again.',
      actions: '<button type="button" class="ce-retry ' + btn('primary', 'sm') + '">' + icon('refresh', 'w-3.5 h-3.5') + 'Retry</button>'
    });
  }

  /** Inline alert banner (form-level errors, info notes). */
  function alert(tone, message, title) {
    var map = {
      danger: ['bg-danger-soft border-red-200 text-danger', 'alert-circle'],
      warning: ['bg-accent-soft border-amber-200 text-accent-text', 'alert-circle'],
      info: ['bg-info-soft border-sky-200 text-info', 'info'],
      success: ['bg-success-soft border-green-200 text-success', 'check-circle']
    }[tone] || ['bg-subtle border-line text-ink-secondary', 'info'];
    return '<div class="flex gap-2.5 items-start rounded-xl border px-4 py-3 text-sm ' + map[0] + '" role="' + (tone === 'danger' ? 'alert' : 'status') + '">' +
      icon(map[1], 'w-4 h-4 mt-0.5 shrink-0') + '<div>' + (title ? '<p class="font-semibold">' + esc(title) + '</p>' : '') + '<p>' + esc(message) + '</p></div></div>';
  }

  /* ---------------- Skeletons ---------------- */
  var skeleton = {
    cards: function (n, opts) {
      var out = '';
      for (var i = 0; i < (n || 3); i++) {
        out += '<div class="' + cls.card + ' overflow-hidden" aria-hidden="true">' +
          '<div class="skeleton !rounded-none ' + ((opts && opts.media) || 'h-40') + '"></div>' +
          '<div class="p-5 space-y-3"><div class="skeleton h-5 w-20 rounded-full"></div><div class="skeleton h-5 w-3/4"></div>' +
          '<div class="skeleton h-3.5 w-1/2"></div><div class="skeleton h-3.5 w-2/3"></div>' +
          '<div class="flex gap-2 pt-2"><div class="skeleton h-8 w-24"></div><div class="skeleton h-8 w-20"></div></div></div></div>';
      }
      return out;
    },
    rows: function (n, cols) {
      var out = '';
      for (var i = 0; i < (n || 5); i++) {
        out += '<tr aria-hidden="true">';
        for (var c = 0; c < (cols || 4); c++) out += '<td class="px-4 py-4"><div class="skeleton h-4 ' + (c === 0 ? 'w-40' : 'w-20') + '"></div></td>';
        out += '</tr>';
      }
      return out;
    },
    list: function (n) {
      var out = '';
      for (var i = 0; i < (n || 4); i++) {
        out += '<div class="' + cls.card + ' p-4 flex gap-4 items-center" aria-hidden="true"><div class="skeleton w-16 h-16 !rounded-xl"></div>' +
          '<div class="flex-1 space-y-2.5"><div class="skeleton h-4 w-1/2"></div><div class="skeleton h-3 w-1/3"></div></div><div class="skeleton h-8 w-20"></div></div>';
      }
      return out;
    },
    block: function (h) { return '<div class="skeleton ' + (h || 'h-40') + ' w-full" aria-hidden="true"></div>'; }
  };

  /** Mark a container busy while loading (screen readers announce it). */
  function busy($el, on) { $($el).attr('aria-busy', on ? 'true' : 'false'); }

  /* ---------------- Pagination ---------------- */
  /** pagination($container, { page, pages, onChange(page) }) */
  function pagination($c, o) {
    $c = $($c);
    if (!o.pages || o.pages <= 1) { $c.empty(); return; }
    var p = o.page, n = o.pages, items = [];
    var range = [1];
    for (var i = Math.max(2, p - 1); i <= Math.min(n - 1, p + 1); i++) range.push(i);
    if (n > 1) range.push(n);
    var last = 0;
    range.forEach(function (x) { if (x - last > 1) items.push('…'); items.push(x); last = x; });
    var b = 'inline-flex items-center justify-center h-9 min-w-9 px-3 rounded-lg text-sm font-semibold border transition-colors';
    var html = '<nav class="flex flex-wrap items-center justify-center gap-1.5" aria-label="Pagination">' +
      '<button type="button" data-page="' + (p - 1) + '" class="' + b + ' bg-white border-line text-ink hover:bg-subtle disabled:opacity-50" ' + (p <= 1 ? 'disabled' : '') + ' aria-label="Previous page">' + icon('chevron-left', 'w-4 h-4') + '<span class="hidden sm:inline">Previous</span></button>';
    items.forEach(function (x) {
      if (x === '…') html += '<span class="' + b + ' border-transparent text-ink-muted" aria-hidden="true">…</span>';
      else html += '<button type="button" data-page="' + x + '" class="' + b + ' ' + (x === p ? 'bg-brand border-brand text-white' : 'bg-white border-line text-ink hover:bg-subtle') + '" ' + (x === p ? 'aria-current="page"' : '') + ' aria-label="Page ' + x + '">' + x + '</button>';
    });
    html += '<button type="button" data-page="' + (p + 1) + '" class="' + b + ' bg-white border-line text-ink hover:bg-subtle disabled:opacity-50" ' + (p >= n ? 'disabled' : '') + ' aria-label="Next page"><span class="hidden sm:inline">Next</span>' + icon('chevron-right', 'w-4 h-4') + '</button></nav>';
    $c.html(html).off('click.pg').on('click.pg', 'button[data-page]', function () {
      var to = Number($(this).data('page'));
      if (to >= 1 && to <= n && to !== p) o.onChange(to);
    });
  }

  /** Slice helper for client-side pagination. */
  function paginate(items, page, size) {
    var pages = Math.max(1, Math.ceil(items.length / size));
    page = Math.min(Math.max(1, page), pages);
    return { page: page, pages: pages, total: items.length, from: items.length ? (page - 1) * size + 1 : 0, to: Math.min(items.length, page * size), items: items.slice((page - 1) * size, page * size) };
  }

  /* ---------------- Filter chips ---------------- */
  /** chips($container, [{value,label,count?}], active, onChange) — role=radiogroup-like toggle buttons */
  function chips($c, options, active, onChange) {
    $c = $($c);
    function render() {
      $c.html(options.map(function (o) {
        var on = o.value === active;
        return '<button type="button" data-value="' + esc(o.value) + '" aria-pressed="' + on + '" class="' + cls.chip + ' ' + (on ? cls.chipOn : cls.chipOff) + '">' +
          esc(o.label) + (o.count !== undefined ? ' <span class="ml-1 opacity-70">' + o.count + '</span>' : '') + '</button>';
      }).join(''));
    }
    render();
    $c.off('click.chips').on('click.chips', 'button[data-value]', function () {
      active = String($(this).data('value'));
      render(); onChange(active);
    });
    return { set: function (opts, act) { options = opts; if (act !== undefined) active = act; render(); } };
  }

  /* ---------------- Form helpers ---------------- */
  function fieldError($input, message) {
    $input = $($input);
    var id = $input.attr('id') + '-error';
    var $wrap = $input.closest('[data-field]');
    $wrap.find('.ce-field-error').remove();
    if (message) {
      $input.attr({ 'aria-invalid': 'true', 'aria-describedby': id });
      var $msg = $('<p class="ce-field-error mt-1.5 text-xs font-medium text-danger flex items-center gap-1" id="' + id + '">' + icon('alert-circle', 'w-3.5 h-3.5') + '<span></span></p>');
      $msg.find('span').text(message);
      ($wrap.length ? $wrap : $input.parent()).append($msg);
    } else {
      $input.removeAttr('aria-invalid');
      var hint = $input.data('hint-id');
      if (hint) $input.attr('aria-describedby', hint); else $input.removeAttr('aria-describedby');
    }
  }
  function clearErrors($form) {
    $form = $($form);
    $form.find('.ce-field-error').remove();
    $form.find('[aria-invalid]').each(function () { fieldError(this, null); });
    $form.find('.ce-form-alert').empty();
  }
  function focusFirstError($form) { $($form).find('[aria-invalid=true]').first().trigger('focus'); }

  /** Star display (read-only). */
  function stars(rating, cls2) {
    var r = Math.round(Number(rating) || 0), out = '';
    for (var i = 1; i <= 5; i++) out += CE.star(i <= r, cls2 || 'w-4 h-4');
    return '<span class="inline-flex items-center gap-0.5" role="img" aria-label="' + (Number(rating) || 0).toFixed(1) + ' out of 5 stars">' + out + '</span>';
  }

  /** Copy text to clipboard with a toast. */
  function copy(text, label) {
    var done = function () { toast('success', (label || 'Copied') + ' to clipboard'); };
    if (navigator.clipboard && w.isSecureContext) navigator.clipboard.writeText(text).then(done, function () { toast('error', 'Couldn’t copy'); });
    else {
      var $t = $('<textarea class="sr-only">').val(text).appendTo('body'); $t[0].select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('error', 'Couldn’t copy'); }
      $t.remove();
    }
  }

  /**
   * Replace static <span data-icon="name"> placeholders in page HTML with SVGs.
   * Size: data-icon-size, or w-5 h-5 inside sized containers, else w-4 h-4.
   */
  function hydrateIcons($root) {
    $($root || document).find('[data-icon]').each(function () {
      var size = this.getAttribute('data-icon-size') || (/(^|\s)w-\d/.test(this.className) ? 'w-5 h-5' : 'w-4 h-4');
      this.innerHTML = icon(this.getAttribute('data-icon'), size);
      this.removeAttribute('data-icon');
    });
  }

  CE.ui = {
    hydrateIcons: hydrateIcons,
    cls: cls, btn: btn, badge: badge, avatar: avatar, stars: stars, copy: copy,
    toast: toast, toastError: toastError,
    modal: modal, confirm: confirmDialog, drawer: drawer,
    setLoading: setLoading, busy: busy,
    empty: empty, errorState: errorState, stateBlock: stateBlock, alert: alert, skeleton: skeleton,
    pagination: pagination, paginate: paginate, chips: chips,
    fieldError: fieldError, clearErrors: clearErrors, focusFirstError: focusFirstError
  };
})(window, jQuery);
