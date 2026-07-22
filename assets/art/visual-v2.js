(() => {
  'use strict';

  if (window.__HIPHOP_VISUAL_V2__) return;
  window.__HIPHOP_VISUAL_V2__ = true;

  const ink = '#07080b';
  const paper = '#f1eadb';
  const red = '#e02b38';
  const darkRed = '#69131b';
  const gold = '#f4b942';
  const steel = '#8e949e';

  const titleBackdrop = new Image();
  titleBackdrop.decoding = 'async';
  titleBackdrop.src = 'assets/art/generated/scenes/title_cypher_v3.webp?v=20260718-art-v3';

  const reclaimBackdrop = new Image();
  reclaimBackdrop.decoding = 'async';
  reclaimBackdrop.src = 'assets/art/generated/scenes/reclaim_all_crew_v3.webp?v=20260720-grounded-group-r5';

  function installRuntimeArt(id, src, buttonId) {
    if (typeof ASSET_SRC !== 'undefined') ASSET_SRC[id] = src;
    if (typeof IMGS !== 'undefined') {
      const img = new Image();
      IMGS[id] = { img, ready: false };
      img.onload = () => { IMGS[id].ready = true; };
      img.onerror = () => { delete IMGS[id]; };
      img.src = src;
    }
    const button = buttonId && document.getElementById(buttonId);
    const icon = button && button.querySelector('.tool-icon');
    if (icon) icon.style.backgroundImage = 'url("' + src + '")';
  }

  installRuntimeArt(
    'tower_sniper',
    'assets/art/redesign/v3/runtime_ready/object_slots_v1/mic_v1_enemy_style_rgba.png',
    't-sniper'
  );

  installRuntimeArt(
    'anim30_didi_appear',
    'assets/art/generated/animation30/sheets/didi_appear_30.png?v=20260720-framepass'
  );
  installRuntimeArt(
    'anim30_didi_transform',
    'assets/art/generated/animation30/sheets/didi_transform_30.png?v=20260720-framepass'
  );
  for (const action of ['idle', 'move', 'attack', 'exit']) {
    installRuntimeArt(
      'anim30_didi_' + action,
      'assets/art/generated/animation30/sheets/didi_' + action + '_30.png?v=20260720-framepass'
    );
  }

  function drawDidiTransitionSheet(action, cx, feetY, targetH, progress, flip) {
    const sheet = IMGS['anim30_didi_' + action];
    if (!sheet || !sheet.ready || !sheet.img.naturalWidth) return false;

    const frame = Math.min(29, Math.floor(Math.max(0, Math.min(.9999, progress)) * 30));
    const cellW = sheet.img.naturalWidth / 10;
    const cellH = sheet.img.naturalHeight / 3;
    const sourceX = (frame % 10) * cellW;
    const sourceY = Math.floor(frame / 10) * cellH;
    const crop = sheet.frameCrop || (sheet.frameCrop = anim30SheetCrop('didi', sheet, cellW, cellH));
    const renderH = characterRigHeight('didi', targetH, false);
    const renderW = renderH * crop.w / crop.h;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.translate(cx, feetY);
    if (flip) ctx.scale(-1, 1);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(
      sheet.img,
      sourceX + crop.x, sourceY + crop.y, crop.w, crop.h,
      -renderW / 2, -renderH, renderW, renderH
    );
    ctx.restore();
    return true;
  }

  // Presentation cadence only: this retimes sprite sampling without touching
  // movement, attacks, cooldowns, hitboxes, summon lifetime, or game state.
  const heroVisualCadence = Object.freeze({
    didi: .82,
    dj: .70,
    savagem: .76,
    frankie: .82,
    southkid: .82,
    twkid: .76,
    hkid: .84,
    skater: .92,
    bboy: .86,
    yacht: .72
  });
  const heroPresentationIds = new Set(Object.keys(heroVisualCadence));

  function heroTransitionEase(value) {
    const p = Math.max(0, Math.min(1, value));
    return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  }

  function paceHeroTransition(opts) {
    const paced = Object.assign({}, opts || {});
    if (paced.enter !== undefined && paced.enter < 1) {
      paced.enter = heroTransitionEase(paced.enter);
    }
    if (paced.exit !== undefined && paced.exit < 1) {
      paced.exit = 1 - heroTransitionEase(1 - paced.exit);
    }
    return paced;
  }

  const originalDrawAnimatedV2 = drawAnimated;
  drawAnimated = function(id, x, y, targetH, opts) {
    if (!heroPresentationIds.has(id)) {
      return originalDrawAnimatedV2(id, x, y, targetH, opts);
    }
    const paced = paceHeroTransition(opts);
    const action = paced.action || 'idle';
    if (paced.progress === undefined && (action === 'idle' || action === 'move')) {
      const clock = paced.phase === undefined ? animClock : paced.phase;
      paced.phase = clock * heroVisualCadence[id];
    }
    return originalDrawAnimatedV2(id, x, y, targetH, paced);
  };

  const originalDrawComicHeroV2 = drawComicHero;
  drawComicHero = function(type, x, y, scale, opts) {
    const pacedOpts = heroPresentationIds.has(type) ? paceHeroTransition(opts) : opts;
    if (type === 'didi') {
      const o = pacedOpts || {};
      const enter = o.enter === undefined ? 1 : Math.max(0, Math.min(1, o.enter));
      const exit = o.exit === undefined ? 1 : Math.max(0, Math.min(1, o.exit));
      const heroScale = CHARACTER_DISPLAY_SCALE.didi || 1;
      const targetH = 138 * scale * heroScale;
      const feetY = y + 25 * scale * heroScale;

      if (enter < 1) {
        const split = .44;
        const action = enter < split ? 'appear' : 'transform';
        const progress = enter < split ? enter / split : (enter - split) / (1 - split);
        if (drawDidiTransitionSheet(action, x, feetY, targetH, progress, o.flip)) return;
      } else if (exit < 1) {
        if (drawDidiTransitionSheet('exit', x, feetY, targetH, 1 - exit, o.flip)) return;
      }
    }
    return originalDrawComicHeroV2(type, x, y, scale, pacedOpts);
  };

  function drawCover(image, x, y, w, h) {
    const sourceRatio = image.naturalWidth / image.naturalHeight;
    const targetRatio = w / h;
    let sx = 0;
    let sy = 0;
    let sw = image.naturalWidth;
    let sh = image.naturalHeight;
    if (sourceRatio > targetRatio) {
      sw = sh * targetRatio;
      sx = (image.naturalWidth - sw) / 2;
    } else {
      sh = sw / targetRatio;
      sy = (image.naturalHeight - sh) / 2;
    }
    ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
  }

  function polygon(points, fill, stroke, lineWidth) {
    ctx.beginPath();
    points.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth || 1; ctx.stroke(); }
  }

  function halftone(x, y, w, h, color, alpha, step) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    const s = step || 8;
    for (let py = y; py < y + h + s; py += s) {
      for (let px = x; px < x + w + s; px += s) {
        const r = 1 + ((px + py) / s % 3) * .22;
        ctx.beginPath();
        ctx.arc(px + ((py / s) % 2) * s * .5, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function recordGrooves(cx, cy, radius, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = paper;
    for (let r = 22; r < radius; r += 10) {
      ctx.lineWidth = r % 20 === 2 ? 1.5 : .7;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = red;
    ctx.beginPath();
    ctx.arc(cx, cy, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function titleType(text, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-.018);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'bevel';
    ctx.font = '900 ' + size + 'px Impact, "Arial Black", sans-serif';
    ctx.lineWidth = 15;
    ctx.strokeStyle = ink;
    ctx.strokeText(text, 0, 0);
    ctx.lineWidth = 4;
    ctx.strokeStyle = paper;
    ctx.strokeText(text, 0, 0);
    ctx.fillStyle = gold;
    ctx.fillText(text, 0, 0);
    ctx.globalAlpha = .68;
    ctx.fillStyle = red;
    ctx.fillText(text, 5, 5);
    ctx.globalAlpha = 1;
    ctx.fillStyle = gold;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  function crewPose(hero, x, groundY, targetH, phase) {
    const cycle = (animClock + phase) % 9.6;
    let action = 'idle';
    let progress = (cycle / 3.4) % 1;
    if (cycle < 1.45) {
      action = 'move';
      progress = cycle / 1.45;
    } else if (cycle >= 5 && cycle < 8.15) {
      action = 'attack';
      progress = (cycle - 5) / 3.15;
    }
    const bob = action === 'idle' ? Math.sin((animClock + phase) * Math.PI * 1.4) * 1.35 : 0;
    if (!drawAnimated30(hero, x, groundY + bob, targetH, {
      action,
      progress,
      anchor: 'feet'
    })) {
      drawComicHero(hero, x, groundY + bob, targetH / 150);
    }
  }

  function crewName(name, x, y, accent) {
    const width = Math.max(92, name.length * 8 + 24);
    ctx.save();
    ctx.translate(x, y);
    polygon([
      [-width / 2, -11], [width / 2 - 8, -11], [width / 2, -3],
      [width / 2, 11], [-width / 2 + 8, 11], [-width / 2, 3]
    ], 'rgba(7,8,11,.94)', accent, 2);
    ctx.fillStyle = accent;
    ctx.fillRect(-width / 2, -11, 4, 22);
    ctx.fillStyle = paper;
    ctx.font = '800 12px "Avenir Next Condensed", "PingFang TC", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 2, 1);
    ctx.restore();
  }

  drawStickerLabel = function(txt, x, y, col) {
    crewName(txt, x, y, col || red);
  };

  const codexKeyArt = {
    didi: {
      src: 'assets/art/redesign/v3/portraits/rgba/didi_v3_portrait_rgba.png',
      accent: gold,
      alt: 'DIDI 戰鬥型態頭肩大頭貼'
    },
    dj: {
      src: 'assets/art/redesign/v3/portraits/rgba/dj_mrskin_v3_portrait_rgba.png',
      accent: red,
      alt: 'DJ MR.SKIN 頭肩大頭貼'
    },
    savagem: {
      src: 'assets/art/redesign/v3/portraits/rgba/savagem_v3_portrait_rgba.png',
      accent: '#e65f58',
      alt: 'SAVAGE.M 頭肩大頭貼'
    },
    frankie: {
      src: 'assets/art/redesign/v3/portraits/rgba/frankie_v3_portrait_rgba.png',
      accent: '#a679d8',
      alt: 'FRANKIE ALPHA 頭肩大頭貼'
    }
  };

  // The blackbook favors clean production key art over shrinking a full
  // animation cell until clothing and facial traits become unreadable.
  const originalBuildCodex = window.buildCodex;
  if (typeof originalBuildCodex === 'function') {
    window.buildCodex = function() {
      originalBuildCodex();
      document.querySelectorAll('img[data-cdx-id]').forEach((portrait) => {
        const id = portrait.dataset.cdxId || '';
        const keyArt = codexKeyArt[id];
        if (!keyArt) {
          portrait.classList.add('cdx-static-art', 'cdx-art-' + id.replace(/[^a-z0-9_-]/gi, ''));
          return;
        }
        portrait.className = 'cdx-keyart';
        portrait.src = keyArt.src;
        portrait.alt = keyArt.alt;
        portrait.decoding = 'async';
        const row = portrait.closest('.cdx-row');
        if (row) {
          row.classList.add('cdx-row-core');
          row.style.setProperty('--cdx-accent', keyArt.accent);
        }
      });
    };
  }

  function drawTacticalPreview(countdown) {
    const pv = nextWavePreview();
    const nextWave = state.wave + 1;
    const queue = buildWave(nextWave);
    const counts = {};
    for (const kind of queue) counts[kind] = (counts[kind] || 0) + 1;
    const kinds = Object.keys(counts);
    const iconMap = {
      normal: 'zombieA', runner: 'runner', crawler: 'crawler', hype: 'hype',
      tank: 'tank', elite: 'elite', bouncer: 'bouncer', boss: 'boss',
      tagger: 'tagger', lowrider: 'lowrider', hypebeast: 'hypebeast',
      drillmask: 'drillmask', screwtank: 'screwtank', bassdancer: 'bassdancer',
      technodrone: 'technodrone', ghostrider: 'ghostrider'
    };

    const x = 82;
    const y = 146;
    const width = W - x * 2;
    const height = 224;
    const timerWidth = 132;
    ctx.save();
    // 倒數面板可能緊接在上一個特效後繪製，先把 Canvas 狀態完整
    // 拉回正常不透明合成，避免黑底把下一波角色一起變成幽靈。
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = true;
    polygon([
      [x, y + 14], [x + 14, y], [x + width - 22, y], [x + width, y + 22],
      [x + width, y + height - 14], [x + width - 14, y + height],
      [x + 20, y + height], [x, y + height - 20]
    ], 'rgba(7,8,11,.93)', pv.neon, 2);
    ctx.fillStyle = 'rgba(224,43,56,.16)';
    ctx.fillRect(x + 2, y + 2, timerWidth, height - 4);
    halftone(x + 2, y + 2, timerWidth, height - 4, paper, .08, 7);
    ctx.fillStyle = red;
    ctx.fillRect(x + timerWidth, y + 14, 3, height - 28);
    ctx.fillStyle = gold;
    ctx.fillRect(x + timerWidth + 3, y + 14, 1, height - 28);

    ctx.textAlign = 'center';
    ctx.fillStyle = gold;
    ctx.font = '900 12px "Avenir Next Condensed", "PingFang TC", Arial, sans-serif';
    ctx.fillText('NEXT WAVE', x + timerWidth / 2, y + 40);
    ctx.fillStyle = paper;
    ctx.font = '900 68px Impact, "Arial Black", sans-serif';
    ctx.fillText(String(Math.max(1, Math.ceil(countdown))), x + timerWidth / 2, y + 112);
    ctx.fillStyle = steel;
    ctx.font = '800 11px "Avenir Next Condensed", "PingFang TC", Arial, sans-serif';
    ctx.fillText('BUILD / UPGRADE', x + timerWidth / 2, y + 140);
    ctx.fillStyle = pv.neon;
    ctx.font = '900 16px "Avenir Next Condensed", "PingFang TC", Arial, sans-serif';
    ctx.fillText('W' + nextWave, x + timerWidth / 2, y + 182);

    const infoX = x + timerWidth + 24;
    const infoWidth = width - timerWidth - 40;
    ctx.textAlign = 'left';
    ctx.fillStyle = pv.newCity ? gold : pv.neon;
    ctx.font = '900 12px "Avenir Next Condensed", "PingFang TC", Arial, sans-serif';
    ctx.fillText(pv.newCity ? 'NEW DISTRICT / 道路重劃' : 'DISTRICT INTEL', infoX, y + 25);
    ctx.fillStyle = paper;
    ctx.font = '900 18px "Avenir Next Condensed", "PingFang TC", Arial, sans-serif';
    ctx.fillText(pv.city, infoX, y + 49, infoWidth);
    ctx.fillStyle = gold;
    ctx.font = '800 12px "Avenir Next Condensed", "PingFang TC", Arial, sans-serif';
    ctx.fillText(pv.tacticLabel + '  /  ' + pv.entries, infoX, y + 69, infoWidth);

    ctx.fillStyle = 'rgba(241,234,219,.12)';
    ctx.fillRect(infoX, y + 79, infoWidth, 1);
    ctx.fillStyle = steel;
    ctx.font = '800 10px "Avenir Next Condensed", "PingFang TC", Arial, sans-serif';
    ctx.fillText('ENEMY LINEUP', infoX, y + 96);

    const slotWidth = Math.min(72, infoWidth / Math.max(1, kinds.length));
    const lineupWidth = slotWidth * kinds.length;
    let slotX = infoX + Math.max(0, (infoWidth - lineupWidth) / 2) + slotWidth / 2;
    for (const kind of kinds) {
      const isBoss = kind === 'boss';
      const kindLabel = (typeof KIND_NAMES !== 'undefined' && KIND_NAMES[kind]) || kind;
      const color = isBoss ? red : (pv.threats.includes(kindLabel) ? gold : paper);
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      // 每個角色都有自己的鋼板讀圖區，讓黑色服裝和深色場景分離。
      // 圖片仍然是透明去背圖，底板只負責對比，不會污染角色 alpha。
      const plateY = y + 168;
      const plateW = Math.min(31, slotWidth * .46);
      const plateH = isBoss ? 48 : 40;
      const plate = ctx.createRadialGradient(slotX, plateY - 8, 3, slotX, plateY, plateW * 1.5);
      plate.addColorStop(0, 'rgba(45,55,77,.96)');
      plate.addColorStop(.58, 'rgba(17,23,36,.94)');
      plate.addColorStop(1, 'rgba(8,10,17,.86)');
      ctx.fillStyle = plate;
      ctx.beginPath(); ctx.ellipse(slotX, plateY, plateW, plateH, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = color;
      ctx.globalAlpha = .86;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(slotX, plateY, plateW * .92, plateH * .92, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.restore();
      const artId = iconMap[kind] || kind;
      // 倒數資訊是辨識用縮圖，固定顯示靜態完整圖；只有素材尚未載入
      // 時才退回動畫幀，避免縮小動畫在黑底上產生閃現/幽靈感。
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      const previewDrawn = drawComic(artId, slotX, y + 196, isBoss ? 86 : 72, {anchor:'feet', alpha:1}) ||
        drawAnimated(artId, slotX, y + 196, isBoss ? 86 : 72, {
          anchor: 'feet', action: 'idle', phase: animClock * .72 + slotX * .01, alpha:1
        });
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
      if (!previewDrawn) {
        // Asset loading race fallback: keep the lineup colourful and readable;
        // never reintroduce the old black procedural silhouettes in the timer.
        ctx.save();
        ctx.translate(slotX, y + 196);
        ctx.fillStyle = isBoss ? red : color;
        ctx.strokeStyle = ink;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, -26, isBoss ? 19 : 15, isBoss ? 30 : 24, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = paper;
        ctx.fillRect(-7, -31, 4, 4);
        ctx.fillRect(3, -31, 4, 4);
        ctx.restore();
      }
      ctx.textAlign = 'center';
      ctx.fillStyle = color;
      ctx.font = '900 12px "Avenir Next Condensed", "PingFang TC", Arial, sans-serif';
      ctx.fillText('x' + counts[kind], slotX, y + 205);
      slotX += slotWidth;
    }

    if (nextWave % 10 === 0) {
      ctx.fillStyle = red;
      ctx.fillRect(infoX, y + height - 9, infoWidth, 3);
      ctx.textAlign = 'right';
      ctx.font = '900 10px "Avenir Next Condensed", "PingFang TC", Arial, sans-serif';
      ctx.fillText('BOSS INCOMING', x + width - 16, y + 25);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  function drawReclaimCelebration() {
    if (!reclaimBackdrop.complete || !reclaimBackdrop.naturalWidth) return;

    const elapsed = MILESTONE_T - milestone.t;
    const ease = (value) => 1 - Math.pow(1 - Math.min(1, Math.max(0, value)), 3);
    const alpha = Math.min(ease(elapsed / .45), ease(milestone.t / .55));
    const maxWidth = Math.min(W - 28, 860);
    let panelWidth = maxWidth;
    let panelHeight = panelWidth * 878 / 1536;
    if (panelHeight > H - 26) {
      panelHeight = H - 26;
      panelWidth = panelHeight * 1536 / 878;
    }
    const panelX = (W - panelWidth) / 2;
    const panelY = (H - panelHeight) / 2;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alpha * .68;
    ctx.fillStyle = '#030509';
    ctx.fillRect(0, 0, W, H);

    ctx.globalAlpha = alpha;
    drawCover(reclaimBackdrop, panelX, panelY, panelWidth, panelHeight);

    const topShade = ctx.createLinearGradient(0, panelY, 0, panelY + panelHeight * .33);
    topShade.addColorStop(0, 'rgba(4,6,9,.82)');
    topShade.addColorStop(1, 'rgba(4,6,9,0)');
    ctx.fillStyle = topShade;
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight * .36);

    const bottomShade = ctx.createLinearGradient(0, panelY + panelHeight * .64, 0, panelY + panelHeight);
    bottomShade.addColorStop(0, 'rgba(4,6,9,0)');
    bottomShade.addColorStop(1, 'rgba(4,6,9,.84)');
    ctx.fillStyle = bottomShade;
    ctx.fillRect(panelX, panelY + panelHeight * .61, panelWidth, panelHeight * .39);

    ctx.strokeStyle = gold;
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX + 3, panelY + 3, panelWidth - 6, panelHeight - 6);
    ctx.fillStyle = red;
    ctx.fillRect(panelX, panelY, panelWidth * .27, 4);
    ctx.fillStyle = gold;
    ctx.fillRect(panelX + panelWidth * .27, panelY, panelWidth * .73, 4);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'bevel';
    ctx.font = '900 ' + Math.round(panelHeight * .09) + 'px "DFPLongMen-Bold", "PingFang TC", sans-serif';
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#08090d';
    ctx.strokeText('HAPPY ENDING', W / 2, panelY + panelHeight * .11);
    ctx.fillStyle = '#ffe7a2';
    ctx.fillText('HAPPY ENDING', W / 2, panelY + panelHeight * .11);

    ctx.font = '800 ' + Math.max(11, Math.round(panelHeight * .034)) + 'px "Avenir Next Condensed", "PingFang TC", sans-serif';
    ctx.lineWidth = 4;
    ctx.strokeText('全員團聚 · 說再見前的最後合影', W / 2, panelY + panelHeight * .18);
    ctx.fillStyle = paper;
    ctx.fillText('全員團聚 · 說再見前的最後合影', W / 2, panelY + panelHeight * .18);

    ctx.textAlign = 'right';
    ctx.font = '800 ' + Math.max(10, Math.round(panelHeight * .026)) + 'px "Avenir Next Condensed", "PingFang TC", sans-serif';
    ctx.fillStyle = gold;
    ctx.fillText('THE END · 拍打仔', panelX + panelWidth - 18, panelY + panelHeight - 16);
    ctx.restore();
  }

  const originalDrawV2 = draw;
  draw = function() {
    const showPreview = scene === 'play' && state && state.running &&
      state.wave > 0 && state.spawnLeft === 0 && zombies.length === 0 && state.betweenWaves > 0;
    const countdown = showPreview ? state.betweenWaves : 0;
    if (showPreview) state.betweenWaves = 0;
    try {
      originalDrawV2();
    } finally {
      if (showPreview) state.betweenWaves = countdown;
    }
    if (showPreview) drawTacticalPreview(countdown);
    if (typeof milestone !== 'undefined' && milestone) drawReclaimCelebration();
  };

  drawTitle = function() {
    ctx.save();
    if (titleBackdrop.complete && titleBackdrop.naturalWidth) {
      drawCover(titleBackdrop, 0, 0, W, H);
    } else {
      ctx.fillStyle = ink;
      ctx.fillRect(0, 0, W, H);
    }
    // 新主視覺已經預留標題負空間；只加可讀性遮罩，不再用厚重色塊蓋掉場景。
    ctx.fillStyle = 'rgba(5,6,9,.16)';
    ctx.fillRect(0, 0, W, H);
    const upperShade = ctx.createLinearGradient(0, 0, 0, 205);
    upperShade.addColorStop(0, 'rgba(5,6,9,.68)');
    upperShade.addColorStop(.62, 'rgba(5,6,9,.22)');
    upperShade.addColorStop(1, 'rgba(5,6,9,0)');
    ctx.fillStyle = upperShade;
    ctx.fillRect(0, 0, W, 205);

    polygon([[0, 0], [W * .3, 0], [W * .19, H], [0, H]], 'rgba(112,16,25,.31)');
    polygon([[W * .78, 0], [W, 0], [W, H], [W * .89, H]], 'rgba(5,6,9,.38)');
    halftone(0, 0, W * .24, H, paper, .09, 8);
    halftone(W * .81, 0, W * .19, H, gold, .07, 9);

    ctx.globalAlpha = .35;
    ctx.strokeStyle = gold;
    ctx.lineWidth = 2;
    for (let i = -2; i < 7; i++) {
      const sx = ((i * 170 + animClock * 26) % (W + 220)) - 110;
      ctx.beginPath();
      ctx.moveTo(sx, H);
      ctx.lineTo(sx + 150, 0);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = ink;
    ctx.fillRect(0, 0, W, 34);
    ctx.fillRect(0, H - 31, W, 31);
    ctx.fillStyle = red;
    ctx.fillRect(0, 34, W, 4);
    ctx.fillRect(0, H - 35, W, 4);
    ctx.fillStyle = gold;
    ctx.fillRect(0, 38, W * .32, 2);
    ctx.fillRect(W * .68, H - 37, W * .32, 2);

    ctx.textAlign = 'left';
    ctx.font = '800 11px "Avenir Next Condensed", "PingFang TC", Arial, sans-serif';
    ctx.fillStyle = steel;
    ctx.fillText('拍打仔 / COCCO&Co / BLACKBOOK 001', 18, 22);
    ctx.textAlign = 'right';
    ctx.fillStyle = gold;
    ctx.fillText('HIP-HOP REDEMPTION TD', W - 18, 22);

    titleType('拍打仔', W / 2, 105, 88);
    ctx.textAlign = 'center';
    ctx.font = '900 22px "Avenir Next Condensed", "PingFang TC", Arial, sans-serif';
    ctx.lineWidth = 7;
    ctx.strokeStyle = ink;
    ctx.strokeText('HIP HOP REDEMPTION : LAST CYPHER', W / 2, 151);
    ctx.fillStyle = paper;
    ctx.fillText('HIP HOP REDEMPTION : LAST CYPHER', W / 2, 151);
    ctx.fillStyle = red;
    ctx.fillRect(W / 2 - 126, 163, 252, 4);
    ctx.fillStyle = gold;
    ctx.fillRect(W / 2 - 52, 169, 104, 2);

    const cast = [
      // 首頁卡司也使用同一套三頭身母尺，差異只留給服裝與招牌道具。
      { hero: 'didi', x: W / 2 - 246, y: 412, h: 176, name: 'DIDI', color: gold, phase: .05 },
      { hero: 'dj', x: W / 2 - 82, y: 412, h: 176, name: 'DJ MR.SKIN', color: red, phase: 1.55 },
      { hero: 'savagem', x: W / 2 + 82, y: 412, h: 176, name: 'SAVAGE.M', color: '#e65f58', phase: 3.1 },
      { hero: 'frankie', x: W / 2 + 246, y: 412, h: 176, name: 'FRANKIE ALPHA', color: '#a679d8', phase: 4.65 }
    ];
    for (const member of cast) {
      const beam = ctx.createLinearGradient(member.x, 175, member.x, member.y);
      beam.addColorStop(0, 'rgba(7,8,11,0)');
      beam.addColorStop(.55, 'rgba(7,8,11,.08)');
      beam.addColorStop(1, member.color + '26');
      polygon([
        [member.x - 18, 178], [member.x + 18, 178],
        [member.x + 70, member.y + 4], [member.x - 70, member.y + 4]
      ], beam);
      ctx.save();
      ctx.globalAlpha = .76;
      ctx.fillStyle = 'rgba(0,0,0,.76)';
      ctx.beginPath();
      ctx.ellipse(member.x + 5, member.y + 2, member.h * .3, member.h * .046, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = .24;
      ctx.fillStyle = member.color;
      ctx.beginPath();
      ctx.ellipse(member.x, member.y, member.h * .25, member.h * .035, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.shadowColor = member.color;
      ctx.shadowBlur = 16;
      crewPose(member.hero, member.x, member.y, member.h, member.phase);
      ctx.restore();
      crewName(member.name, member.x, 428, member.color);
    }

    const pulse = .62 + Math.sin(animClock * 4) * .18;
    polygon([
      [W / 2 - 190, 448], [W / 2 + 176, 448], [W / 2 + 190, 462],
      [W / 2 + 190, 486], [W / 2 - 176, 486], [W / 2 - 190, 472]
    ], 'rgba(7,8,11,.93)', red, 2);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = paper;
    ctx.textAlign = 'center';
    ctx.font = '900 19px "Avenir Next Condensed", "PingFang TC", Arial, sans-serif';
    ctx.fillText('TAP TO DROP THE NEEDLE', W / 2, 469);
    ctx.globalAlpha = 1;
    ctx.font = '700 11px "Avenir Next Condensed", "PingFang TC", Arial, sans-serif';
    ctx.fillStyle = gold;
    ctx.fillText('HIGH SCORE  ' + String(highScore).padStart(8, '0'), W / 2, 495);

    ctx.textAlign = 'left';
    ctx.fillStyle = steel;
    ctx.fillText('BLACKBOOK / CREW / DISTRICT FILES', 18, H - 12);
    ctx.textAlign = 'right';
    ctx.fillStyle = red;
    ctx.fillText('SAVE THE CULTURE', W - 18, H - 12);
    ctx.restore();
  };
})();
