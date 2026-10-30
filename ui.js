(() => {
  const loader = document.querySelector('#page-loader');
  if (loader) {
    const finishLoading = () => {
      loader.remove();
      document.body.classList.remove('is-loading');
      window.dispatchEvent(new Event('portfolio:ready'));
    };
    loader.addEventListener('animationend', event => {
      if (event.target === loader) finishLoading();
    });
    if (document.documentElement.classList.contains('is-internal-navigation')) finishLoading();
    else setTimeout(finishLoading, 1600);
  }
  const toggle = document.querySelector('.contact-toggle');
  const popover = document.querySelector('#contact-popover');
  const setContact = open => {
    popover.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.addEventListener('click', () => setContact(popover.hidden));
  document.addEventListener('click', event => {
    if (!event.target.closest('.contact-toggle, .contact-popover')) setContact(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !popover.hidden) { setContact(false); toggle.focus(); }
  });

  const cursor = document.querySelector('#cursor');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  let x = 0, y = 0, frame = null;
  const clickable = 'a, button, [role="button"], input[type="submit"], summary';
  function render() {
    cursor.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    const target = document.elementFromPoint(x, y);
    document.body.classList.toggle('star-cursor', Boolean(target?.closest(clickable)) && !target?.closest('.work-card'));
    frame = null;
  }
  document.addEventListener('pointermove', event => {
    if (!finePointer.matches || event.pointerType === 'touch') return;
    x = event.clientX; y = event.clientY;
    document.body.classList.add('cursor-on');
    if (frame === null) frame = requestAnimationFrame(render);
  }, {passive: true});
  document.addEventListener('scroll', () => {
    if (finePointer.matches && frame === null) frame = requestAnimationFrame(render);
  }, {passive: true, capture: true});
  const hide = () => document.body.classList.remove('cursor-on', 'star-cursor');
  document.documentElement.addEventListener('pointerleave', hide);
  window.addEventListener('blur', hide);
  finePointer.addEventListener('change', hide);
})();

(() => {
  const asElement = target => target instanceof Element ? target : target?.parentElement;
  document.addEventListener('contextmenu', event => {
    const target = asElement(event.target);
    const allowed = document.body.classList.contains('about-page') && target?.closest('.biography, .resume-scroll') && !target.closest('.site-header');
    if (!allowed) event.preventDefault();
  });
  document.addEventListener('selectstart', event => {
    if (asElement(event.target)?.closest('.site-header')) event.preventDefault();
  });
  document.addEventListener('dragstart', event => {
    if (asElement(event.target)?.closest('.site-header')) event.preventDefault();
  });
})();

(() => {
  const scroller = document.querySelector('.about-page .resume-scroll');
  const layout = document.querySelector('.about-page .about-layout');
  const header = document.querySelector('.site-header');
  if (!scroller || !layout || !header) return;
  const marker = document.createElement('div');
  marker.className = 'about-scroll-indicator';
  marker.setAttribute('aria-hidden', 'true');
  marker.hidden = true;
  document.body.append(marker);
  const mobile = matchMedia('(max-width:700px)');
  const touch = matchMedia('(hover:none), (pointer:coarse)');
  let frame = null;
  function update() {
    frame = null;
    // Halve the actual gap below the navigation, rather than halving all top padding.
    layout.style.setProperty('--about-header-bottom', `${header.getBoundingClientRect().bottom}px`);
    const rect = scroller.getBoundingClientRect();
    const range = scroller.scrollHeight - scroller.clientHeight;
    const bottom = Math.min(rect.bottom, innerHeight - 40);
    const travel = Math.max(0, bottom - rect.top - 50);
    marker.hidden = mobile.matches || touch.matches || range <= 1 || bottom - rect.top < 50;
    if (!marker.hidden) {
      const progress = Math.max(0, Math.min(1, scroller.scrollTop / range));
      marker.style.transform = `translateY(${rect.top + progress * travel}px)`;
    }
  }
  function schedule() {
    if (frame === null) frame = requestAnimationFrame(update);
  }
  scroller.addEventListener('scroll', schedule, {passive:true});
  addEventListener('resize', schedule, {passive:true});
  addEventListener('pageshow', schedule);
  mobile.addEventListener('change', schedule);
  touch.addEventListener('change', schedule);
  layout.addEventListener('transitionend', schedule);
  const observer = new ResizeObserver(schedule);
  [header, scroller, ...scroller.children].forEach(element => observer.observe(element));
  document.fonts?.ready.then(schedule);
  schedule();
})();

// Refresh other open preview tabs after a successful online publication.
try { const publishChannel = new BroadcastChannel('portfolio-published'); publishChannel.onmessage = event => {if(event.data==='published')location.reload();}; } catch {}
