/**
 * CE.media — audio/video helpers.
 *  - AudioPlayer: accessible custom player for announcements (keyboard, speed,
 *    volume, seek, current time / duration, fallback when format unsupported).
 *  - miniPlayer: one shared <audio> for the "play" buttons on list cards.
 *  - captions: the API stores `caption_text`; we convert it to WebVTT and
 *    attach it as <track kind="captions"> via a Blob URL.
 *  - probeDuration / lazyVideos: metadata-only loading for lists.
 */
(function (w, $) {
  'use strict';
  var CE = w.CE, util = CE.util, esc = util.esc, icon = CE.icon, ui = CE.ui;

  /* ---------------- Duration probing ---------------- */
  var durationCache = {};
  function probeDuration(url, kind) {
    if (!url) return Promise.reject();
    if (durationCache[url]) return durationCache[url];
    durationCache[url] = new Promise(function (resolve, reject) {
      var el = document.createElement(kind || 'audio');
      el.preload = 'metadata';
      el.onloadedmetadata = function () { resolve(el.duration); el.removeAttribute('src'); el.load(); };
      el.onerror = function () { reject(new Error('unplayable')); };
      el.src = url;
    });
    return durationCache[url];
  }
  /** Fill every [data-duration-src] inside $root with the media length. */
  function fillDurations($root) {
    $($root).find('[data-duration-src]').each(function () {
      var $el = $(this);
      probeDuration($el.data('duration-src'), $el.data('kind')).then(function (sec) { $el.text(util.formatDuration(sec)); })
        .catch(function () { $el.text('--:--'); });
    });
  }

  /* ---------------- Waveform (decorative) ---------------- */
  function waveform(seed, bars, dark, cls) {
    var h = util.hash(seed), out = '';
    for (var i = 0; i < (bars || 48); i++) {
      h = (h * 9301 + 49297) % 233280;
      var v = 20 + Math.round((h / 233280) * 80);
      out += '<span style="height:' + v + '%"></span>';
    }
    return '<div class="waveform ' + (dark ? 'dark ' : '') + (cls || '') + '" aria-hidden="true">' + out + '</div>';
  }
  function setWaveProgress($wave, pct) {
    var $bars = $($wave).children(), on = Math.round($bars.length * pct);
    $bars.each(function (i) { this.classList.toggle('on', i < on); });
  }

  /* ---------------- Captions → WebVTT ---------------- */
  function isVTT(text) { return /^﻿?WEBVTT/.test(String(text || '').trim()); }
  /**
   * Accepts WebVTT, SRT-style cues ("00:00:01,000 --> ..."), or plain text.
   * Plain text is split into sentences and spread across the video duration
   * (or ~3.5s per sentence if unknown) so captions still appear in sync-ish.
   */
  function toVTT(text, duration) {
    text = String(text || '').trim();
    if (!text) return '';
    if (isVTT(text)) return text;
    if (/\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->/.test(text)) {
      return 'WEBVTT\n\n' + text.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2').replace(/^\d+\s*$/gm, '').trim();
    }
    var parts = text.split(/(?<=[.!?])\s+|\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
    var per = duration && isFinite(duration) ? duration / parts.length : 3.5;
    var stamp = function (s) {
      var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = (s % 60).toFixed(3);
      return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + sec.padStart(6, '0');
    };
    return 'WEBVTT\n\n' + parts.map(function (p, i) { return stamp(i * per) + ' --> ' + stamp((i + 1) * per) + '\n' + p; }).join('\n\n');
  }
  function trackURL(text, duration) {
    var vtt = toVTT(text, duration);
    return vtt ? URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' })) : null;
  }
  /** Caption text → [{ time: '0:04', text }] for a readable transcript. */
  function transcript(text) {
    text = String(text || '').trim();
    if (!text) return [];
    if (isVTT(text) || /-->/.test(text)) {
      var cues = [];
      text.replace(/^﻿?WEBVTT.*$/m, '').split(/\n\s*\n/).forEach(function (block) {
        var lines = block.trim().split('\n'), idx = lines.findIndex(function (l) { return /-->/.test(l); });
        if (idx === -1) return;
        var start = lines[idx].split('-->')[0].trim().replace(',', '.');
        var p = start.split(':').map(Number), secs = p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
        var body = lines.slice(idx + 1).join(' ').replace(/<[^>]+>/g, '').trim();
        if (body) cues.push({ time: util.formatDuration(secs), seconds: secs, text: body });
      });
      return cues;
    }
    return [{ time: null, text: text }];
  }

  /* ---------------- Shared mini player for list cards ---------------- */
  var mini = { audio: null, url: null, $btn: null, $wave: null };
  function resetMiniBtn() {
    if (mini.$btn) mini.$btn.html(icon('play', 'w-4 h-4 ml-0.5')).attr('aria-label', mini.$btn.data('label-play')).attr('aria-pressed', 'false');
    if (mini.$wave) setWaveProgress(mini.$wave, 0);
  }
  function miniToggle(url, $btn, $wave) {
    if (!mini.audio) {
      mini.audio = new Audio(); mini.audio.preload = 'none';
      mini.audio.addEventListener('timeupdate', function () { if (mini.$wave && mini.audio.duration) setWaveProgress(mini.$wave, mini.audio.currentTime / mini.audio.duration); });
      mini.audio.addEventListener('ended', resetMiniBtn);
      mini.audio.addEventListener('error', function () { resetMiniBtn(); ui.toast('warning', 'Can’t play this audio', 'Your browser can’t play this format — open the announcement to download it.'); });
    }
    if (mini.url === url && !mini.audio.paused) { mini.audio.pause(); resetMiniBtn(); return; }
    if (mini.url !== url) { mini.audio.pause(); resetMiniBtn(); mini.audio.src = url; mini.url = url; }
    mini.$btn = $btn; mini.$wave = $wave;
    if (!$btn.data('label-play')) $btn.data('label-play', $btn.attr('aria-label'));
    mini.audio.play().then(function () {
      $btn.html(icon('pause', 'w-4 h-4')).attr('aria-label', 'Pause').attr('aria-pressed', 'true');
    }).catch(function () { /* error handler shows toast */ });
  }

  /* ---------------- Full audio player ---------------- */
  /**
   * new AudioPlayer($container, { src, title }) — renders the dark "Now playing"
   * player and wires up keyboard: Space/K play-pause, ←/→ seek 10s, ↑/↓ volume, M mute.
   */
  function AudioPlayer($c, o) {
    var id = 'ap' + Math.random().toString(36).slice(2, 7);
    var speeds = [0.75, 1, 1.25, 1.5, 2], si = 1;
    $c.html(
      '<div class="ce-player on-dark bg-inverse rounded-2xl p-5 sm:p-6 text-white shadow-pop" role="region" aria-label="Audio player: ' + esc(o.title) + '" tabindex="0">' +
        '<audio preload="metadata" src="' + esc(o.src) + '">Your browser does not support the audio element. <a href="' + esc(o.src) + '" download>Download the audio</a>.</audio>' +
        '<div class="flex flex-wrap items-center gap-3 sm:gap-4">' +
          '<div class="flex items-center gap-2">' +
            '<button type="button" class="ap-back w-10 h-10 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/10" aria-label="Back 10 seconds">' + icon('rotate-ccw', 'w-4 h-4') + '</button>' +
            '<button type="button" class="ap-play w-14 h-14 rounded-full bg-accent text-inverse flex items-center justify-center hover:bg-amber-400 shadow-lg" aria-label="Play">' + icon('play', 'w-6 h-6 ml-0.5') + '</button>' +
            '<button type="button" class="ap-fwd w-10 h-10 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/10" aria-label="Forward 10 seconds">' + icon('rotate-cw', 'w-4 h-4') + '</button>' +
          '</div>' +
          '<div class="flex-1 min-w-[10rem]"><p class="text-overline uppercase text-accent ap-state">Ready to play</p><p class="font-semibold leading-snug">' + esc(o.title) + '</p></div>' +
          '<div class="flex items-center gap-2">' +
            '<button type="button" class="ap-speed h-8 px-2.5 rounded-md bg-white/10 text-xs font-bold hover:bg-white/20" aria-label="Playback speed: 1 times">1.0×</button>' +
            '<button type="button" class="ap-mute w-8 h-8 rounded-md flex items-center justify-center hover:bg-white/10" aria-label="Mute">' + icon('volume', 'w-4 h-4') + '</button>' +
            '<label for="' + id + '-vol" class="sr-only">Volume</label><input id="' + id + '-vol" type="range" class="ap-vol range w-20 sm:w-24" min="0" max="1" step="0.05" value="1" style="--pct:100%">' +
          '</div>' +
        '</div>' +
        '<div class="ap-wave mt-5 cursor-pointer">' + waveform(o.src, 72, true, '!h-14') + '</div>' +
        '<label for="' + id + '-seek" class="sr-only">Seek</label>' +
        '<input id="' + id + '-seek" type="range" class="ap-seek range mt-2" min="0" max="100" step="0.1" value="0" aria-valuetext="0:00 of unknown length">' +
        '<div class="flex justify-between text-xs text-slate-300 mt-1 tabular-nums"><span class="ap-cur">0:00</span><span class="ap-dur">--:--</span></div>' +
        '<p class="mt-4 text-xs text-slate-400 flex items-center gap-2">' + icon('keyboard', 'w-4 h-4 shrink-0') + 'Keyboard: Space = play/pause · ← / → = seek 10s · ↑ / ↓ = volume · M = mute.</p>' +
      '</div>');

    var $p = $c.find('.ce-player'), audio = $p.find('audio')[0];
    var $play = $p.find('.ap-play'), $seek = $p.find('.ap-seek'), $vol = $p.find('.ap-vol'), $wave = $p.find('.waveform');

    function setPct($r, pct) { $r[0].style.setProperty('--pct', pct + '%'); }
    function sync() {
      var d = audio.duration, t = audio.currentTime;
      if (isFinite(d) && d > 0) {
        var pct = (t / d) * 100;
        $seek.val(pct); setPct($seek, pct); setWaveProgress($wave, t / d);
        $p.find('.ap-dur').text(util.formatDuration(d));
        $seek.attr('aria-valuetext', util.formatDuration(t) + ' of ' + util.formatDuration(d));
      }
      $p.find('.ap-cur').text(util.formatDuration(t));
    }
    function setPlaying(on) {
      $play.html(icon(on ? 'pause' : 'play', 'w-6 h-6' + (on ? '' : ' ml-0.5'))).attr('aria-label', on ? 'Pause' : 'Play');
      $p.find('.ap-state').text(on ? 'Now playing' : (audio.currentTime ? 'Paused' : 'Ready to play'));
    }
    function toggle() {
      if (audio.paused) audio.play().catch(function () { /* handled by error */ }); else audio.pause();
    }
    function seekBy(s) { if (isFinite(audio.duration)) audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + s)); }
    function setVol(v) { audio.volume = Math.max(0, Math.min(1, v)); audio.muted = audio.volume === 0; }

    audio.addEventListener('loadedmetadata', sync);
    audio.addEventListener('timeupdate', sync);
    audio.addEventListener('play', function () { setPlaying(true); });
    audio.addEventListener('pause', function () { setPlaying(false); });
    audio.addEventListener('ended', function () { setPlaying(false); });
    audio.addEventListener('volumechange', function () {
      var v = audio.muted ? 0 : audio.volume;
      $vol.val(v); setPct($vol, v * 100);
      $p.find('.ap-mute').html(icon(v === 0 ? 'volume-x' : 'volume', 'w-4 h-4')).attr('aria-label', v === 0 ? 'Unmute' : 'Mute');
    });
    audio.addEventListener('error', function () { if (o.onError) o.onError(); });

    $play.on('click', toggle);
    $p.find('.ap-back').on('click', function () { seekBy(-10); });
    $p.find('.ap-fwd').on('click', function () { seekBy(10); });
    $p.find('.ap-speed').on('click', function () {
      si = (si + 1) % speeds.length; audio.playbackRate = speeds[si];
      $(this).text(speeds[si].toFixed(speeds[si] % 1 ? 2 : 1).replace(/0$/, '') + '×').attr('aria-label', 'Playback speed: ' + speeds[si] + ' times');
    });
    $p.find('.ap-mute').on('click', function () { audio.muted = !audio.muted; if (!audio.muted && audio.volume === 0) audio.volume = 0.8; });
    $vol.on('input', function () { setVol(Number(this.value)); });
    $seek.on('input', function () { if (isFinite(audio.duration)) audio.currentTime = (Number(this.value) / 100) * audio.duration; });
    $p.find('.ap-wave').on('click', function (e) {
      if (!isFinite(audio.duration)) return;
      var r = this.getBoundingClientRect(); audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
    });
    // Keyboard shortcuts when focus is anywhere inside the player (but not on the sliders, which handle arrows natively)
    $p.on('keydown', function (e) {
      var onRange = e.target.type === 'range';
      if (e.key === ' ' || e.key === 'k') { if (e.target.tagName === 'BUTTON' && e.key === ' ') return; e.preventDefault(); toggle(); }
      else if (!onRange && e.key === 'ArrowLeft') { e.preventDefault(); seekBy(-10); }
      else if (!onRange && e.key === 'ArrowRight') { e.preventDefault(); seekBy(10); }
      else if (!onRange && e.key === 'ArrowUp') { e.preventDefault(); setVol(audio.volume + 0.1); }
      else if (!onRange && e.key === 'ArrowDown') { e.preventDefault(); setVol(audio.volume - 0.1); }
      else if (e.key === 'm' || e.key === 'M') { audio.muted = !audio.muted; }
    });

    this.audio = audio;
    this.seekTo = function (s) { audio.currentTime = s; audio.play().catch(function () {}); };
  }

  /* ---------------- External video links (YouTube / Vimeo) ---------------- */
  /**
   * Recognise YouTube and Vimeo links. Returns
   *   { provider, id, embed(startSeconds, autoplay), thumb }
   * or null for anything else (direct video files play in a normal <video>).
   */
  function videoEmbed(url) {
    var u;
    try { u = new URL(String(url || '')); } catch (e) { return null; }
    var host = u.hostname.replace(/^(www\.|m\.)/, ''), id = null, m;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (u.pathname === '/watch') id = u.searchParams.get('v');
      else if ((m = u.pathname.match(/^\/(embed|shorts|live|v)\/([^/?#]+)/))) id = m[2];
    }
    if (id && /^[\w-]{6,}$/.test(id)) {
      return {
        provider: 'youtube', id: id,
        thumb: 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg',
        embed: function (start, autoplay) {
          return 'https://www.youtube-nocookie.com/embed/' + id + '?rel=0&cc_load_policy=1' +
            (start ? '&start=' + Math.floor(start) : '') + (autoplay ? '&autoplay=1' : '');
        }
      };
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      m = u.pathname.match(/(?:^|\/)(\d{5,})(?:\/|$)/);
      if (m) {
        var vid = m[1];
        return {
          provider: 'vimeo', id: vid, thumb: null,
          embed: function (start, autoplay) {
            return 'https://player.vimeo.com/video/' + vid + '?texttrack=en' + (autoplay ? '&autoplay=1' : '') + (start ? '#t=' + Math.floor(start) + 's' : '');
          }
        };
      }
    }
    return null;
  }

  /** Accessible <iframe> player for an embeddable link. */
  function embedFrame(info, title, cls) {
    return '<iframe class="' + (cls || 'w-full aspect-video bg-black') + '" src="' + esc(info.embed()) + '" title="' + esc(title || 'Video') + '"' +
      ' allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>';
  }

  /* ---------------- Lazy video thumbnails ---------------- */
  /** Videos with [data-lazy-src] only start fetching metadata once scrolled into view. */
  function lazyVideos($root) {
    var vids = $($root).find('video[data-lazy-src]').toArray();
    function load(v) {
      // YouTube / Vimeo links can't be loaded into <video>: show their thumbnail instead.
      var ext = videoEmbed(v.getAttribute('data-lazy-src'));
      if (ext) {
        v.removeAttribute('data-lazy-src');
        if (ext.thumb) $(v).replaceWith('<img src="' + esc(ext.thumb) + '" alt="" loading="lazy" class="' + esc(v.className) + '" aria-hidden="true">');
        else $(v).addClass('hidden');
        return;
      }
      v.preload = 'metadata';
      v.src = v.getAttribute('data-lazy-src') + '#t=0.5';   // render the first frame as thumbnail
      v.removeAttribute('data-lazy-src');
      v.addEventListener('loadedmetadata', function () {
        var $d = $(v).closest('[data-card]').find('.ce-vdur');
        $d.text(util.formatDuration(v.duration)).removeClass('hidden');
      }, { once: true });
      v.addEventListener('error', function () { $(v).addClass('hidden'); }, { once: true });
    }
    if (!('IntersectionObserver' in w)) { vids.forEach(load); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { load(en.target); io.unobserve(en.target); } });
    }, { rootMargin: '200px' });
    vids.forEach(function (v) { io.observe(v); });
  }

  CE.media = {
    probeDuration: probeDuration, fillDurations: fillDurations,
    waveform: waveform, setWaveProgress: setWaveProgress,
    toVTT: toVTT, trackURL: trackURL, transcript: transcript, isVTT: isVTT,
    miniToggle: miniToggle, AudioPlayer: AudioPlayer, lazyVideos: lazyVideos,
    videoEmbed: videoEmbed, embedFrame: embedFrame
  };
})(window, jQuery);
