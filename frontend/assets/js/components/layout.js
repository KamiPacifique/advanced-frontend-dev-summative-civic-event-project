/**
 * CE.layout + CE.boot — renders the shared chrome around each page:
 *   - public layout : sticky top navbar (+ mobile drawer) and footer
 *   - admin layout  : left sidebar (off-canvas < lg) and top bar
 * and runs the page's auth guard before any page code executes.
 *
 * Usage in a page script:
 *   CE.boot({ auth: 'user', layout: 'public', nav: 'events' }, function () { ...page code... });
 *   CE.boot({ auth: 'admin', layout: 'admin', nav: 'users', title: 'Users', crumb: 'Users' }, init);
 */
(function (w, $) {
  'use strict';
  var CE = w.CE, util = CE.util, esc = util.esc, icon = CE.icon, ui = CE.ui;
  var u = util.url;

  /* ---------------- Navigation model ---------------- */
  function publicNav(user) {
    var items = [];
    if (user && user.role !== 'admin') items.push({ key: 'home', label: 'Home', href: 'dashboard.html', icon: 'home' });
    items.push(
      { key: 'events', label: 'Events', href: 'events.html', icon: 'calendar' },
      { key: 'announcements', label: 'Announcements', href: 'announcements.html', icon: 'megaphone' },
      { key: 'promos', label: 'Promos', href: 'promos.html', icon: 'video' },
      { key: 'registrations', label: 'My Registrations', href: 'my-registrations.html', icon: 'ticket' }
    );
    return items;
  }

  // ROLE GUARD (UI): admin-only navigation. Only rendered when CE.auth.isAdmin().
  var ADMIN_NAV = [
    { key: 'admin-dashboard', label: 'Dashboard', href: 'admin/index.html', icon: 'grid' },
    { key: 'admin-events', label: 'Events', href: 'admin/events.html', icon: 'calendar' },
    { key: 'admin-announcements', label: 'Announcements', href: 'admin/announcements.html', icon: 'megaphone' },
    { key: 'admin-promos', label: 'Promos', href: 'admin/promos.html', icon: 'video' },
    { key: 'admin-notifications', label: 'Notifications', href: 'admin/notifications.html', icon: 'bell' },
    { key: 'admin-users', label: 'Users', href: 'admin/users.html', icon: 'users' },
    { key: 'admin-registrations', label: 'Registrations', href: 'admin/registrations.html', icon: 'ticket' }
  ];

  function logo(dark) {
    return '<a href="' + u(CE.auth.isAuthenticated() ? CE.auth.homeFor(CE.auth.user()) : 'login.html') + '" class="flex items-center gap-2.5 shrink-0 rounded-lg" aria-label="CivicConnect home">' +
      '<span class="w-9 h-9 rounded-xl ' + (dark ? 'bg-white text-brand' : 'bg-brand text-white') + ' flex items-center justify-center shadow-sm">' + icon('landmark', 'w-5 h-5') + '</span>' +
      '<span class="text-lg font-extrabold tracking-tight ' + (dark ? 'text-white' : 'text-ink') + '">CivicConnect</span></a>';
  }

  function bellButton() {
    return '<button type="button" class="ce-bell relative inline-flex items-center justify-center w-10 h-10 rounded-xl border border-line bg-white text-ink-secondary hover:text-ink hover:bg-subtle transition-colors" aria-label="Notifications" aria-haspopup="dialog">' +
      icon('bell', 'w-5 h-5') +
      '<span class="ce-bell-count hidden absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-danger text-white text-[11px] font-bold leading-5 text-center ring-2 ring-white"></span></button>';
  }

  function searchForm(id, placeholder, extra) {
    return '<form action="' + u('search.html') + '" method="get" role="search" class="relative ' + (extra || '') + '">' +
      '<label for="' + id + '" class="sr-only">Search events, announcements and promos</label>' +
      '<span class="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none">' + icon('search', 'w-4 h-4') + '</span>' +
      '<input id="' + id + '" name="q" type="search" autocomplete="off" placeholder="' + esc(placeholder || 'Search events, promos…') + '" class="ce-global-search w-full h-10 rounded-xl bg-subtle border border-transparent pl-9 pr-9 text-sm placeholder:text-ink-muted focus:bg-white focus:border-brand focus:ring-4 focus:ring-brand-soft focus-visible:outline-none" value="' + esc(util.param('q') || '') + '">' +
      '<kbd class="hidden lg:inline-flex absolute right-2.5 top-1/2 -translate-y-1/2 h-5 px-1.5 items-center rounded border border-line bg-white text-[11px] text-ink-muted font-sans" aria-hidden="true">/</kbd>' +
    '</form>';
  }

  function userMenu(user, compact) {
    var admin = user.role === 'admin';
    return '<div class="ce-menu relative">' +
      '<button type="button" class="ce-menu-btn flex items-center gap-2 h-10 pl-1.5 pr-2.5 rounded-xl border border-line bg-white hover:bg-subtle transition-colors" aria-haspopup="menu" aria-expanded="false" aria-label="Account menu for ' + esc(user.full_name) + '">' +
        ui.avatar(user.full_name, 'w-7 h-7 text-[11px]', admin) +
        '<span class="hidden ' + (compact ? 'xl' : 'sm') + ':inline text-sm font-semibold text-ink max-w-[9rem] truncate">' + esc(user.full_name) + '</span>' +
        (admin ? '<span class="hidden sm:inline">' + ui.badge('Admin', 'accent', '!h-5 !text-[11px]') + '</span>' : '') +
        icon('chevron-down', 'w-4 h-4 text-ink-muted') +
      '</button>' +
      '<div class="ce-menu-list hidden absolute right-0 mt-2 w-60 bg-white rounded-xl border border-line shadow-pop p-1.5 z-50" role="menu">' +
        '<div class="px-3 py-2.5 border-b border-line mb-1"><p class="text-sm font-semibold truncate">' + esc(user.full_name) + '</p><p class="text-xs text-ink-muted truncate">' + esc(user.email || '') + '</p></div>' +
        menuItem('profile.html', 'user', 'My profile') +
        menuItem('my-registrations.html', 'ticket', 'My registrations') +
        menuItem('notifications.html', 'bell', 'Notifications') +
        (admin ? '<div class="my-1 border-t border-line"></div>' + menuItem('admin/index.html', 'grid', 'Admin dashboard') + menuItem('events.html', 'external-link', 'View public site') : '') +
        '<div class="my-1 border-t border-line"></div>' +
        '<button type="button" role="menuitem" class="ce-signout w-full flex items-center gap-2.5 px-3 h-9 rounded-lg text-sm font-semibold text-danger hover:bg-danger-soft">' + icon('log-out', 'w-4 h-4') + 'Sign out</button>' +
      '</div></div>';
  }
  function menuItem(href, ic, label) {
    return '<a role="menuitem" href="' + u(href) + '" class="flex items-center gap-2.5 px-3 h-9 rounded-lg text-sm font-medium text-ink hover:bg-subtle">' + icon(ic, 'w-4 h-4 text-ink-muted') + esc(label) + '</a>';
  }

  /* ---------------- Public header ---------------- */
  function renderHeader(active) {
    var user = CE.auth.user();
    var links = publicNav(user).map(function (it) {
      var on = it.key === active;
      return '<a href="' + u(it.href) + '" class="h-9 px-3 inline-flex items-center whitespace-nowrap rounded-lg text-sm font-semibold transition-colors ' +
        (on ? 'bg-brand-soft text-brand' : 'text-ink-secondary hover:text-ink hover:bg-subtle') + '"' + (on ? ' aria-current="page"' : '') + '>' + esc(it.label) + '</a>';
    }).join('');
    // ROLE GUARD (UI): the "Dashboard" admin entry point is only added for admins.
    if (CE.auth.isAdmin()) {
      links += '<a href="' + u('admin/index.html') + '" class="h-9 px-3 inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg text-sm font-semibold text-accent-text hover:bg-accent-soft">' + icon('grid', 'w-4 h-4') + 'Dashboard</a>';
    }
    var html =
      '<header class="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-line">' +
        '<div class="max-w-content mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-3 lg:gap-6">' +
          '<button type="button" class="ce-open-nav lg:hidden ' + ui.cls.iconBtn + ' border border-line -ml-1" aria-label="Open navigation menu" aria-haspopup="dialog">' + icon('menu', 'w-5 h-5') + '</button>' +
          logo() +
          '<nav class="hidden lg:flex items-center gap-1" aria-label="Main">' + links + '</nav>' +
          '<div class="ml-auto flex items-center gap-2">' +
            searchForm('ce-search-header', 'Search events, promos…', 'hidden xl:block w-56 2xl:w-72') +
            '<a href="' + u('search.html') + '" class="xl:hidden ' + ui.cls.iconBtn + ' border border-line" aria-label="Search">' + icon('search', 'w-5 h-5') + '</a>' +
            bellButton() +
            '<div class="hidden lg:block">' + userMenu(user) + '</div>' +
          '</div>' +
        '</div>' +
      '</header>';
    $('#app-header').replaceWith(html);
  }

  /* ---------------- Mobile nav drawer ---------------- */
  function openMobileNav(active) {
    var user = CE.auth.user();
    var item = function (it) {
      var on = it.key === active;
      return '<a href="' + u(it.href) + '" class="flex items-center gap-3 h-11 px-3 rounded-lg text-sm font-semibold ' + (on ? 'bg-brand-soft text-brand' : 'text-ink hover:bg-subtle') + '"' + (on ? ' aria-current="page"' : '') + '>' + icon(it.icon, 'w-5 h-5') + esc(it.label) + '</a>';
    };
    var body = '<nav class="p-4 space-y-1" aria-label="Mobile">' +
      '<p class="px-3 pb-1 text-overline uppercase text-ink-muted">Browse</p>' +
      publicNav(user).map(item).join('') +
      item({ key: 'profile', label: 'My Profile', href: 'profile.html', icon: 'user' }) +
      item({ key: 'notifications', label: 'Notifications', href: 'notifications.html', icon: 'bell' }) +
      // ROLE GUARD (UI): admin section only visible when role === 'admin'
      (CE.auth.isAdmin() ? '<p class="px-3 pt-4 pb-1 text-overline uppercase text-danger">Admin <span class="normal-case tracking-normal font-medium text-ink-muted">· visible to admins</span></p>' + ADMIN_NAV.map(item).join('') : '') +
      '</nav>';
    var header = '<div class="flex items-center gap-3 px-4 py-4 border-b border-line">' + ui.avatar(user.full_name, 'w-10 h-10 text-sm', user.role === 'admin') +
      '<div class="flex-1 min-w-0"><p class="text-sm font-bold truncate">' + esc(user.full_name) + '</p>' + (user.role === 'admin' ? ui.badge('Admin', 'accent', '!h-5 !text-[11px]') : '<p class="text-xs text-ink-muted truncate">' + esc(user.email || '') + '</p>') + '</div>' +
      '<button type="button" class="ce-close ' + ui.cls.iconBtn + ' border border-line" aria-label="Close menu">' + icon('x', 'w-5 h-5') + '</button></div>';
    var footer = '<div class="p-4 border-t border-line"><button type="button" class="ce-signout w-full flex items-center gap-3 h-11 px-3 rounded-lg text-sm font-semibold text-danger hover:bg-danger-soft">' + icon('log-out', 'w-5 h-5') + 'Sign out</button></div>';
    ui.drawer({ title: 'Navigation menu', side: 'left', width: 'sm:w-80 max-w-[85vw]', header: header, body: body, footer: footer });
  }

  /* ---------------- Footer ---------------- */
  function renderFooter() {
    var c = CE.config.CONTACT;
    var col = function (title, links) {
      return '<div><h2 class="text-overline uppercase text-accent mb-4">' + title + '</h2><ul class="space-y-2.5 text-sm">' +
        links.map(function (l) { return '<li><a href="' + l[1] + '" class="text-slate-300 hover:text-white">' + esc(l[0]) + '</a></li>'; }).join('') + '</ul></div>';
    };
    var html = '<footer class="on-dark bg-inverse text-white mt-auto" role="contentinfo">' +
      '<div class="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">' +
        '<div>' + logo(false).replace('text-ink', 'text-white') + '<p class="mt-4 text-sm text-slate-300 leading-relaxed max-w-xs">Connecting residents with local events, public announcements and community programs.</p></div>' +
        col('Explore', [['Events', u('events.html')], ['Announcements', u('announcements.html')], ['Promos', u('promos.html')], ['My Registrations', u('my-registrations.html')]]) +
        col('Help', [['Help Center', u('help.html#help')], ['Accessibility', u('help.html#accessibility')], ['Privacy Policy', u('help.html#privacy')], ['Terms of Use', u('help.html#terms')]]) +
        '<div><h2 class="text-overline uppercase text-accent mb-4">Contact</h2><ul class="space-y-2.5 text-sm text-slate-300">' +
          '<li><a class="hover:text-white inline-flex items-center gap-2" href="mailto:' + esc(c.email) + '">' + icon('mail', 'w-4 h-4') + esc(c.email) + '</a></li>' +
          '<li><a class="hover:text-white inline-flex items-center gap-2" href="tel:' + esc(c.phone.replace(/\s/g, '')) + '">' + icon('phone', 'w-4 h-4') + esc(c.phone) + '</a></li>' +
          '<li class="inline-flex items-center gap-2">' + icon('map-pin', 'w-4 h-4') + esc(c.address) + '</li></ul></div>' +
      '</div>' +
      '<div class="max-w-content mx-auto px-4 sm:px-6 lg:px-8"><div class="border-t border-white/15 py-6 flex flex-col sm:flex-row gap-2 justify-between text-xs text-slate-400">' +
        '<p>© ' + new Date().getFullYear() + ' CivicConnect. All rights reserved.</p></div></div>' +
    '</footer>';
    $('#app-footer').replaceWith(html);
  }

  /* ---------------- Admin shell ---------------- */
  function sidebarHTML(active) {
    var item = function (it) {
      var on = it.key === active;
      return '<a href="' + u(it.href) + '" class="flex items-center gap-3 h-10 px-3 rounded-lg text-sm font-semibold transition-colors ' + (on ? 'bg-brand-soft text-brand' : 'text-ink-secondary hover:text-ink hover:bg-subtle') + '"' + (on ? ' aria-current="page"' : '') + '>' + icon(it.icon, 'w-[18px] h-[18px]') + esc(it.label) + '</a>';
    };
    return '<div class="flex flex-col h-full">' +
      '<div class="h-16 px-5 flex items-center border-b border-line lg:border-0">' + logo() + '</div>' +
      '<nav class="flex-1 overflow-y-auto thin-scroll px-3 py-4 space-y-1" aria-label="Admin">' +
        '<p class="px-3 pb-2 text-overline uppercase text-ink-muted">Admin</p>' + ADMIN_NAV.map(item).join('') + '</nav>' +
      '<div class="px-3 py-4 border-t border-line space-y-1">' +
        '<a href="' + u('events.html') + '" class="flex items-center gap-3 h-10 px-3 rounded-lg text-sm font-semibold text-ink-secondary hover:text-ink hover:bg-subtle">' + icon('external-link', 'w-[18px] h-[18px]') + 'View public site</a>' +
        '<button type="button" class="ce-signout w-full flex items-center gap-3 h-10 px-3 rounded-lg text-sm font-semibold text-ink-secondary hover:text-danger hover:bg-danger-soft">' + icon('log-out', 'w-[18px] h-[18px]') + 'Sign out</button>' +
      '</div></div>';
  }

  function renderAdminShell(opts) {
    var user = CE.auth.user();
    $('body').prepend('<aside class="hidden lg:block fixed inset-y-0 left-0 w-64 bg-white border-r border-line z-30" aria-label="Admin sidebar">' + sidebarHTML(opts.nav) + '</aside>');
    var crumbs = '<nav aria-label="Breadcrumb"><ol class="flex items-center gap-1.5 text-xs text-ink-muted"><li><a class="hover:text-ink" href="' + u('admin/index.html') + '">Admin</a></li>' +
      (opts.crumb ? opts.crumb.split('/').map(function (c, i, arr) { return '<li aria-hidden="true">/</li><li' + (i === arr.length - 1 ? ' aria-current="page"' : '') + '>' + esc(c.trim()) + '</li>'; }).join('') : '') + '</ol></nav>';
    var top = '<header class="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-line">' +
      '<div class="h-16 px-4 sm:px-6 lg:px-8 flex items-center gap-3">' +
        '<button type="button" class="ce-open-sidebar lg:hidden ' + ui.cls.iconBtn + ' border border-line" aria-label="Open admin menu" aria-haspopup="dialog">' + icon('menu', 'w-5 h-5') + '</button>' +
        '<div class="min-w-0">' + crumbs + '<p class="text-base font-bold text-ink truncate">' + esc(opts.title || '') + '</p></div>' +
        '<div class="ml-auto flex items-center gap-2">' + searchForm('ce-search-admin', 'Search…', 'hidden md:block w-56') + bellButton() + userMenu(user, true) + '</div>' +
      '</div></header>';
    $('#app-topbar').replaceWith(top);
  }

  function openAdminSidebar(active) {
    var d = ui.drawer({ title: 'Admin menu', side: 'left', width: 'sm:w-72 max-w-[85vw]', header: '<button type="button" class="ce-close absolute right-3 top-3.5 z-10 ' + ui.cls.iconBtn + '" aria-label="Close admin menu">' + icon('x', 'w-5 h-5') + '</button>', body: sidebarHTML(active) });
    d.$el.find('.ce-body').addClass('!overflow-hidden');
  }

  /* ---------------- Forbidden (403) ---------------- */
  // ROLE GUARD (UI): rendered when a signed-in non-admin opens an /admin/* page.
  function renderForbidden() {
    $('body').attr('data-layout', 'public').removeClass('lg:pl-64').html(
      '<a href="#main" class="skip-link">Skip to content</a><div id="app-header"></div>' +
      '<main id="main" tabindex="-1" class="flex-1 max-w-content w-full mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">' +
        '<span class="mx-auto w-20 h-20 rounded-full bg-accent-soft text-warning flex items-center justify-center">' + icon('shield-alert', 'w-9 h-9') + '</span>' +
        '<p class="mt-5">' + ui.badge('Error 403 · Forbidden', 'accent') + '</p>' +
        '<h1 class="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight">This area is for administrators</h1>' +
        '<p class="mt-3 text-ink-secondary max-w-md mx-auto">Your account (role: ' + esc(CE.auth.role()) + ') doesn’t have permission to open the Admin Dashboard. If you think this is a mistake, contact an administrator.</p>' +
        '<div class="mt-7 flex flex-wrap justify-center gap-3"><a class="' + ui.btn('secondary') + '" href="mailto:' + esc(CE.config.CONTACT.email) + '?subject=Admin%20access%20request">Contact admin</a><a class="' + ui.btn('primary') + '" href="' + u('events.html') + '">Back to events</a></div>' +
      '</main><div id="app-footer"></div>');
    $('body').addClass('min-h-screen flex flex-col');
    renderHeader(null); renderFooter(); bindGlobal(null);
    if (CE.notifications) CE.notifications.init();
    $('body').addClass('ce-ready');
    document.title = 'Access denied · CivicConnect';
  }

  /* ---------------- Global events ---------------- */
  function bindGlobal(active, isAdminLayout) {
    var $doc = $(document);
    $doc.off('.celayout');

    // Profile dropdown (click, Esc, arrow keys)
    $doc.on('click.celayout', '.ce-menu-btn', function (e) {
      e.stopPropagation();
      var $btn = $(this), $list = $btn.siblings('.ce-menu-list'), open = $list.hasClass('hidden');
      $('.ce-menu-list').addClass('hidden'); $('.ce-menu-btn').attr('aria-expanded', 'false');
      if (open) { $list.removeClass('hidden'); $btn.attr('aria-expanded', 'true'); $list.find('[role=menuitem]').first().trigger('focus'); }
    });
    $doc.on('keydown.celayout', '.ce-menu-list', function (e) {
      var $items = $(this).find('[role=menuitem]'), i = $items.index(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); $items.eq((i + 1) % $items.length).trigger('focus'); }
      if (e.key === 'ArrowUp') { e.preventDefault(); $items.eq((i - 1 + $items.length) % $items.length).trigger('focus'); }
      if (e.key === 'Escape') { $(this).addClass('hidden'); $(this).siblings('.ce-menu-btn').attr('aria-expanded', 'false').trigger('focus'); }
    });
    $doc.on('click.celayout', function (e) {
      if (!$(e.target).closest('.ce-menu').length) { $('.ce-menu-list').addClass('hidden'); $('.ce-menu-btn').attr('aria-expanded', 'false'); }
    });

    $doc.on('click.celayout', '.ce-signout', function () {
      ui.confirm({ title: 'Sign out?', message: 'You’ll need to sign in again to register for events or see notifications.', confirmLabel: 'Sign out', tone: 'primary', icon: 'log-out' })
        .then(function (ok) { if (ok) CE.auth.logout('signed-out'); });
    });
    $doc.on('click.celayout', '.ce-open-nav', function () { openMobileNav(active); });
    $doc.on('click.celayout', '.ce-open-sidebar', function () { openAdminSidebar(active); });

    // "/" focuses the global search (unless typing in a field)
    $doc.on('keydown.celayout', function (e) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey) return;
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
      var $s = $('.ce-global-search:visible').first();
      if ($s.length) { e.preventDefault(); $s.trigger('focus'); }
    });
  }

  /* ---------------- Boot ---------------- */
  /**
   * opts.auth   'guest' | 'user' | 'admin'  — which guard to run
   * opts.layout 'public' | 'admin' | 'none'
   * opts.nav    key of the active nav item
   */
  CE.boot = function (opts, init) {
    $(function () {
      opts = opts || {};
      $('body').attr('data-auth', opts.auth || 'user');

      if (opts.auth === 'guest') {
        if (!CE.auth.guestOnly()) return;
      } else if (opts.auth === 'admin') {
        // ROLE GUARD: admin pages. Not signed in → login; signed in as user → 403 screen.
        var res = CE.auth.requireAdmin();
        if (res === false) return;
        if (res === 'forbidden') { renderForbidden(); return; }
      } else {
        // ROLE GUARD: any authenticated user (all API routes except /auth require a token).
        if (!CE.auth.requireAuth()) return;
      }

      if (opts.layout === 'public') { renderHeader(opts.nav); renderFooter(); }
      if (opts.layout === 'admin') { renderAdminShell(opts); }
      if (opts.layout === 'public' || opts.layout === 'admin') {
        bindGlobal(opts.nav, opts.layout === 'admin');
        if (CE.notifications) CE.notifications.init();
      }

      ui.hydrateIcons();
      $('body').addClass('ce-ready');
      var flash = util.flash.consume();
      if (flash) ui.toast(flash.type, flash.title, flash.message);

      try { init && init(); }
      catch (e) { console.error(e); ui.toast('error', 'Something went wrong', 'This page hit an unexpected error. Try reloading.'); }
    });
  };

  CE.layout = { renderForbidden: renderForbidden, ADMIN_NAV: ADMIN_NAV };
})(window, jQuery);
