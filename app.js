(() => {
  'use strict';
  const grid = document.querySelector('#grid');
  const work = document.querySelector('#work');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const portfolio = {};
  const imagePath = number => `assets/work/${number}.png`;
  const delay = () => 3000;
  const states = [];

  function designSlide(slot) {
    const [name, file, x, y, w, h, iw, ih, ix, iy] = slot;
    const slide = document.createElement('div');
    slide.className = `slide design-card composition-${name}`;
    const crop = document.createElement('div');
    crop.className = 'design-crop';
    crop.style.cssText = `left:${x}%;top:${y}%;width:${w}%;height:${h}%`;
    const image = document.createElement('img');
    image.src = `assets/design/${file}`;
    image.alt = '';
    image.style.cssText = `width:${iw}%;height:${ih}%;left:${ix}%;top:${iy}%`;
    crop.append(image); slide.append(crop);
    if (name === 'pink') {
      const vector = document.createElement('img');
      vector.src = 'assets/design/cf9aa.svg'; vector.alt = '';
      vector.className = 'pink-vector'; slide.append(vector);
    }
    return slide;
  }

  portfolio.projects = window.SITE_CONTENT.projects.map(project => ({...project, alt:project.title, images:project.thumbnails.slice(1), first:project.thumbnails[0]}));
  grid.replaceChildren();

  function imageSlide(project, number, lazy = false) {
    const slide = document.createElement('div');
    slide.className = 'slide';
    const image = document.createElement('img');
    image.className = 'gallery-image';
    image.alt = project.alt;
    image.decoding = 'async';
    image.loading = lazy ? 'lazy' : 'eager';
    image.src = typeof number === 'number' ? imagePath(number) : number.src;
    image.style.objectFit = number.fit || 'cover';
    slide.append(image);
    return slide;
  }

  function thumbnailSlide(project, item, lazy = false) {
    return item?.type === 'design' ? designSlide(item.slot) : imageSlide(project, item || {src:'assets/work/1.png'}, lazy);
  }

  portfolio.projects.forEach((project, index) => {
    let card = grid.children[index];
    if (!card) {
      card = document.createElement('figure');
      card.className = 'work-card';
      card.setAttribute('aria-label', project.alt);
      const slide = thumbnailSlide(project, project.first, true);
      slide.classList.add('is-visible');
      card.append(slide);
      grid.append(card);
    }
    const composite = card.firstElementChild.cloneNode(true);
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-controls', 'project-panel');
    card.setAttribute('aria-expanded', 'false');
    card.addEventListener('click', () => openProject(index));
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openProject(index); }
    });
    states.push({ card, project, composite, index: composite ? -1 : 0, timer: null, active: false, generation: 0, cleanup: null });
  });

  function schedule(state) {
    clearTimeout(state.timer);
    if (state.active && state.project.images.length && !document.hidden && !reducedMotion.matches) {
      state.timer = setTimeout(() => advance(state), delay());
    }
  }

  async function advance(state) {
    if (!state.active || document.hidden || reducedMotion.matches) return;
    const generation = ++state.generation;
    const nextIndex = (state.index + 1) % state.project.images.length;
    // The four Figma compositions are the first slide of their respective cards.
    const returnToComposite = state.composite && state.index === state.project.images.length - 1;
    const next = returnToComposite ? state.composite.cloneNode(true) : thumbnailSlide(state.project, state.project.images[nextIndex]);
    next.classList.remove('is-visible');
    const loading = [...next.querySelectorAll('img')].map(img => img.decode());
    try { await Promise.all(loading); } catch { schedule(state); return; }
    if (generation !== state.generation || !state.active || document.hidden || reducedMotion.matches) return;
    // Finish a pending transition before adding another slide after tab visibility changes.
    state.cleanup?.();
    const previous = state.card.firstElementChild;
    state.card.append(next);
    next.getBoundingClientRect();
    next.classList.add('is-visible');
    state.index = returnToComposite ? -1 : nextIndex;
    let cleanupTimer;
    state.cleanup = () => {
      clearTimeout(cleanupTimer);
      previous?.remove();
      state.cleanup = null;
    };
    cleanupTimer = setTimeout(state.cleanup, 700);
    schedule(state);
  }

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const state = states.find(item => item.card === entry.target);
      state.active = entry.isIntersecting;
      if (!state.active) { clearTimeout(state.timer); state.generation++; }
      else schedule(state);
    }
  }, { rootMargin: '0px', threshold: 0 });
  states.forEach(state => observer.observe(state.card));
  document.addEventListener('visibilitychange', () => states.forEach(state => {
    state.generation++;
    schedule(state);
  }));
  reducedMotion.addEventListener('change', () => states.forEach(schedule));

  const panel = document.querySelector('#project-panel');
  const content = document.querySelector('#project-content');
  const closeButton = panel.querySelector('.panel-close');
  let trigger = null;
  let closeTimer;
  let galleryScroll = 0;
  const tileObserver = new ResizeObserver(entries => {
    entries.forEach(entry => entry.target.style.setProperty('--tile-scale', entry.contentRect.width / 461));
  });
  states.forEach(state => tileObserver.observe(state.card));
  function openProject(index) {
    clearTimeout(closeTimer);
    trigger?.setAttribute('aria-expanded', 'false');
    trigger = states[index].card;
    trigger.setAttribute('aria-expanded', 'true');
    // Keep thumbnail timers running while the project panel is open.
    states.forEach(state => state.cleanup?.());
    const project = portfolio.projects[index];
    content.replaceChildren();
    project.blocks.forEach(block => {
      if (block.type === 'text') {
        const box = document.createElement('div'); box.className = 'detail-caption detail-text';
        const text = document.createElement(window.ContentTools.safeLink(block.url) ? 'a' : 'p');
        text.textContent = block.text; if (text.tagName === 'A') text.href = window.ContentTools.safeLink(block.url);
        box.style.fontSize = `${Math.min(72, Math.max(10, Number(block.size) || 18))}px`;
        box.style.textAlign = ['left','center','right'].includes(block.align) ? block.align : 'left';
        box.append(text); content.append(box);
      } else if (block.type === 'design') {
        const hero = document.createElement('div'); hero.className = `detail-hero composition-${block.slot[0]}`;
        const slide = designSlide(block.slot); slide.classList.add('is-visible'); hero.append(slide); content.append(hero);
      } else {
        const image = document.createElement('img'); image.src = block.src; image.alt = block.alt || project.alt;
        image.className = 'detail-image'; image.loading = 'lazy'; image.style.objectFit = block.fit || 'contain'; content.append(image);
      }
    });
    panel.hidden = false; panel.scrollTop = 0;
    panel.getBoundingClientRect();
    const alreadyOpen = document.body.classList.contains('detail-open');
    if (!alreadyOpen) galleryScroll = scrollY;
    const relativeScroll = Math.max(0, scrollY - workTop() + 87);
    document.body.classList.add('detail-open');
    if (!alreadyOpen) scrollTo(0, relativeScroll);
    closeButton.focus({preventScroll:true});
  }
  function closeProject() {
    document.body.classList.remove('detail-open');
    scrollTo(0, galleryScroll);
    trigger?.setAttribute('aria-expanded', 'false');
    trigger?.focus({preventScroll:true});
    closeTimer = setTimeout(() => { panel.hidden = true; }, reducedMotion.matches ? 0 : 500);
    states.forEach(schedule);
  }
  closeButton.addEventListener('click', closeProject);
  addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) closeProject(); });
  document.querySelector('a[href="#work"]').addEventListener('click', () => { if (!panel.hidden) closeProject(); });

  // Only the introduction snaps. Inside the gallery, scrolling stays native.
  let animation = null;
  let settlingUntil = 0;
  const workTop = () => work.getBoundingClientRect().top + scrollY;

  function scrollToSection(target) {
    if (animation !== null) cancelAnimationFrame(animation);
    const start = scrollY;
    const started = performance.now();
    const end = Math.max(0, Math.min(target, document.documentElement.scrollHeight - innerHeight));
    if (reducedMotion.matches) {
      animation = null;
      scrollTo(0, end);
      return;
    }
    const duration = 900;
    function frame(now) {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      scrollTo(0, start + (end - start) * eased);
      if (progress < 1) animation = requestAnimationFrame(frame);
      else { animation = null; settlingUntil = performance.now() + 200; }
    }
    animation = requestAnimationFrame(frame);
  }

  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', event => {
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      event.preventDefault();
      scrollToSection(target.getBoundingClientRect().top + scrollY);
    });
  });

  function inIntroduction() { return scrollY < workTop() - 4; }
  addEventListener('wheel', event => {
    if (event.target.closest('.project-panel') || document.body.classList.contains('detail-open') || event.ctrlKey || event.metaKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    if (animation !== null || performance.now() < settlingUntil) { event.preventDefault(); return; }
    if (event.deltaY > 2 && inIntroduction()) {
      event.preventDefault();
      scrollToSection(workTop());
    }
  }, { passive: false });

  let touchY = null;
  addEventListener('touchstart', event => { touchY = event.touches.length === 1 ? event.touches[0].clientY : null; }, { passive: true });
  addEventListener('touchmove', event => {
    if (event.target.closest('.project-panel') || document.body.classList.contains('detail-open')) return;
    if (event.touches.length !== 1 || touchY === null) return;
    if (animation !== null) { event.preventDefault(); return; }
    if (touchY - event.touches[0].clientY > 24 && inIntroduction()) {
      event.preventDefault();
      touchY = null;
      scrollToSection(workTop());
    }
  }, { passive: false });

  addEventListener('keydown', event => {
    if (event.key === 'Escape' && animation !== null) {
      cancelAnimationFrame(animation); animation = null; return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.target.closest('a, button, input, textarea, select, [contenteditable]')) return;
    if (['ArrowDown', 'PageDown', ' '].includes(event.key) && inIntroduction()) {
      event.preventDefault();
      if (animation === null) scrollToSection(workTop());
    }
  });
})();
