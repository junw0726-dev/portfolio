(() => {
  const safeLink = value => {
    const url = String(value || '').trim();
    return /^(https?:\/\/|mailto:|tel:)/i.test(url) ? url : '';
  };
  window.ContentTools = {safeLink};
  const data = window.SITE_CONTENT;
  const intro = document.querySelector('.intro-copy');
  if (intro) intro.textContent = data.intro;
  const copyright = document.querySelector('.copyright');
  if (copyright) copyright.textContent = data.copyright;
  const biography = document.querySelector('.biography');
  if (biography) biography.textContent = data.biography;
  const contact = document.querySelector('#contact-popover');
  contact.replaceChildren(...data.contacts.map(item => {
    const url = safeLink(item.url);
    const el = document.createElement(url ? 'a' : 'span');
    el.textContent = item.text; el.className = 'contact-line';
    if (url) el.href = url;
    return el;
  }));
  const resume = document.querySelector('.resume-scroll');
  if (resume) resume.replaceChildren(...data.sections.map(group => {
    const section = document.createElement('section'); section.className = 'resume-section';
    const title = document.createElement('h2'); title.textContent = group.title;
    const list = document.createElement('div');
    group.items.forEach(item => {
      const p = document.createElement('p');
      const url = safeLink(item.url);
      const text = document.createElement(url ? 'a' : 'span'); text.textContent = item.text;
      if (url) text.href = url;
      p.append(text); list.append(p);
    });
    section.append(title, list); return section;
  }));
})();
