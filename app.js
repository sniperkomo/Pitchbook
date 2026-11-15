(() => {
  const STORAGE_KEY = 'pitchbook.lesson-scheduler.v1';
  const PLANS = { 4: 200, 8: 400 };
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  let state = loadState();
  let page = 'dashboard';
  let selectedDate = dayKey(new Date());
  let athleteSearch = '';
  let showArchived = false;
  let toastTimer;

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (parsed && Array.isArray(parsed.athletes) && Array.isArray(parsed.lessons) && Array.isArray(parsed.packages)) return parsed;
    } catch (error) { console.warn('Could not read saved Pitchbook data.', error); }
    return { athletes: [], lessons: [], packages: [] };
  }
  function mergeRecords(shared, local) {
    const merge = (sharedRows, localRows) => {
      const rows = new Map(sharedRows.map(item => [item.id, item]));
      localRows.forEach(item => rows.set(item.id, item));
      return [...rows.values()];
    };
    return {
      athletes: merge(shared.athletes, local.athletes),
      lessons: merge(shared.lessons, local.lessons),
      packages: merge(shared.packages, local.packages)
    };
  }
  async function loadPublicRecords() {
    try {
      const response = await fetch(new URL('public-records.json', document.baseURI), { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const shared = await response.json();
      if (![shared.athletes, shared.lessons, shared.packages].every(Array.isArray)) throw new Error('Invalid shared records');
      state = mergeRecords(shared, state);
      persist();
      render();
    } catch (error) {
      console.info('Shared Pitchbook records are unavailable in this browser.', error);
    }
  }
  function persist(message) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (message) toast(message);
      return true;
    } catch (error) {
      toast('Browser storage is full. Export a backup and remove older data.');
      return false;
    }
  }
  function id() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
  function esc(value = '') { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
  function localDateTime(date) {
    const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return d.toISOString().slice(0, 16);
  }
  function dayKey(value) {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function dateFromKey(key) { return new Date(`${key}T12:00:00`); }
  function addDays(key, count) { const date = dateFromKey(key); date.setDate(date.getDate() + count); return dayKey(date); }
  function weekStart(key) { const d = dateFromKey(key); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return dayKey(d); }
  function fmtDate(value, options = { month: 'short', day: 'numeric' }) { const d = new Date(value); return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat(undefined, options).format(d); }
  function fmtLongDate(value) { return fmtDate(value, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }); }
  function fmtTime(value) { const d = new Date(value); return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(d); }
  function fmtMoney(value) { return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value) || 0); }
  function initials(name = '') { return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || 'A'; }
  function athlete(idValue) { return state.athletes.find(item => item.id === idValue); }
  function lesson(idValue) { return state.lessons.find(item => item.id === idValue); }
  function pack(idValue) { return state.packages.find(item => item.id === idValue); }
  function lessonsFor(athleteId) { return state.lessons.filter(item => item.athleteId === athleteId); }
  function packagesFor(athleteId) { return state.packages.filter(item => item.athleteId === athleteId); }
  function usedCredits(packageId) { return state.lessons.filter(item => item.packageId === packageId && item.status === 'completed').length; }
  function remainingCredits(packageItem) { return Math.max(0, packageItem.lessonCount - usedCredits(packageItem.id)); }
  function pendingPackageTotal() { return state.packages.filter(item => !item.paid).reduce((sum, item) => sum + Number(item.price), 0); }
  function pendingSingleLessons() { return state.lessons.filter(item => item.billing === 'single' && !item.paid && item.status !== 'cancelled'); }
  function outstandingTotal() { return pendingPackageTotal() + pendingSingleLessons().length * 60; }
  function allUpcoming() { const now = Date.now(); return state.lessons.filter(item => item.status === 'scheduled' && new Date(item.start).getTime() >= now).sort((a,b) => new Date(a.start) - new Date(b.start)); }
  function futureFor(athleteId) { return allUpcoming().filter(item => item.athleteId === athleteId); }
  function toast(message) {
    const node = $('#toast'); if (!node) return;
    node.textContent = message; node.classList.add('show'); clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove('show'), 2600);
  }
  function setHeader() {
    const titles = { dashboard: ['YOUR TRAINING DESK', 'Overview'], schedule: ['PLAN THE WORK', 'Schedule'], athletes: ['YOUR ROSTER', 'Athletes'], payments: ['KEEP IT SIMPLE', 'Payments'], detail: ['ATHLETE PROFILE', 'Athlete profile'], portal: ['ATHLETE VIEW', 'Athlete portal'] };
    const [eyebrow, title] = titles[page] || titles.dashboard;
    $('#page-eyebrow').textContent = eyebrow;
    $('#page-title').textContent = title;
    const actions = $('#top-actions');
    if (page === 'portal') actions.innerHTML = '<button class="btn btn-outline" data-action="leave-portal">← Back to coach view</button>';
    else if (page === 'detail') actions.innerHTML = '<button class="btn btn-outline" data-action="open-lesson" data-athlete="' + esc(window.activeAthleteId || '') + '">＋ Schedule lesson</button>';
    else actions.innerHTML = '<button class="btn btn-outline" data-action="open-athlete">＋ Add athlete</button><button class="btn btn-primary" data-action="open-lesson">＋ Schedule lesson</button>';
    $('#athlete-count').textContent = state.athletes.filter(item => !item.archived).length;
    $$('.nav-item[data-page]').forEach(button => button.classList.toggle('active', button.dataset.page === page || (page === 'detail' && button.dataset.page === 'athletes')));
  }
  function render() {
    setHeader();
    const content = $('#page-content');
    if (page === 'dashboard') content.innerHTML = renderDashboard();
    else if (page === 'schedule') content.innerHTML = renderSchedule();
    else if (page === 'athletes') content.innerHTML = renderAthletes();
    else if (page === 'payments') content.innerHTML = renderPayments();
    else if (page === 'detail') content.innerHTML = renderAthleteDetail(window.activeAthleteId);
    else if (page === 'portal') content.innerHTML = renderPortal(window.activeAthleteId);
  }
  function statCard(label, value, foot, icon, tone = '') {
    return `<div class="metric-card"><div class="metric-top">${esc(label)}<span class="metric-icon ${tone}">${icon}</span></div><div class="metric-value">${esc(value)}</div><div class="metric-foot">${esc(foot)}</div></div>`;
  }
  function emptyState(icon, title, text, button = '') { return `<div class="empty-state"><div class="empty-icon">${icon}</div><strong>${esc(title)}</strong><p>${esc(text)}</p>${button}</div>`; }
  function lessonBlock(item, showDay = false) {
    const person = athlete(item.athleteId);
    const billing = item.billing === 'package' ? `Package · ${pack(item.packageId)?.lessonCount || ''} lessons` : 'Single lesson · $60';
    const status = item.status === 'completed' ? '<span class="pill completed">Completed</span>' : item.status === 'cancelled' ? '<span class="pill cancelled">Cancelled</span>' : '<span class="pill scheduled">Scheduled</span>';
    return `<div class="lesson-row"><div class="lesson-time"><strong>${fmtTime(item.start)}</strong>${showDay ? `<span>${fmtDate(item.start)}</span>` : ''}</div><span class="lesson-marker ${item.billing === 'single' ? 'orange' : ''}"></span><div class="lesson-info"><strong>${esc(person?.name || 'Archived athlete')}</strong><small>${billing} · 30 min</small></div>${status}</div>`;
  }
  function renderDashboard() {
    const today = dayKey(new Date());
    const start = new Date(`${today}T00:00:00`).getTime(), end = start + 7 * 86400000;
    const todayLessons = state.lessons.filter(item => dayKey(item.start) === today && item.status === 'scheduled').sort((a,b) => new Date(a.start) - new Date(b.start));
    const weekLessons = state.lessons.filter(item => item.status === 'scheduled' && new Date(item.start).getTime() >= start && new Date(item.start).getTime() < end).length;
    const notes = state.lessons.filter(item => item.status === 'completed' && item.notes?.trim()).sort((a,b) => new Date(b.start) - new Date(a.start)).slice(0, 3);
    const activePackages = state.packages.filter(item => remainingCredits(item) > 0).sort((a,b) => new Date(b.purchasedAt) - new Date(a.purchasedAt)).slice(0, 5);
    const soon = allUpcoming().slice(0, 5);
    const greetDate = fmtDate(new Date(), { weekday: 'long', month: 'long', day: 'numeric' });
    return `<section class="welcome-banner"><div class="welcome-copy"><p class="welcome-kicker">${esc(greetDate.toUpperCase())}</p><h2>Build good habits, one pitch at a time.</h2><p>Your coaching week, athlete progress, and lesson notes in one place.</p></div><button class="btn" data-action="open-lesson">＋ Schedule a lesson</button></section>
      <section class="metric-grid">${statCard('Lessons today', todayLessons.length, todayLessons.length ? 'Your next sessions are below' : 'A clear day to plan ahead', '▦')}${statCard('This week', weekLessons, 'Scheduled sessions in the next 7 days', '◷', 'orange')}${statCard('Outstanding', fmtMoney(outstandingTotal()), `${pendingSingleLessons().length + state.packages.filter(item => !item.paid).length} unpaid item${pendingSingleLessons().length + state.packages.filter(item => !item.paid).length === 1 ? '' : 's'}`, '$', 'red')}${statCard('Active athletes', state.athletes.filter(item => !item.archived).length, `${state.packages.filter(item => remainingCredits(item) > 0).length} package${state.packages.filter(item => remainingCredits(item) > 0).length === 1 ? '' : 's'} with credits left`, '♧', 'green')}</section>
      <div class="content-grid"><div class="stack"><section class="panel"><div class="panel-head"><div><h2>Coming up</h2><p>Your next scheduled lessons</p></div><button class="text-link" data-action="navigate" data-page="schedule">View schedule →</button></div><div class="panel-body">${soon.length ? soon.map((item, index) => lessonBlock(item, true)).join('') : emptyState('▦', 'Nothing on the calendar yet', 'Add your first lesson and your upcoming schedule will show here.', '<button class="btn btn-primary btn-small" data-action="open-lesson">＋ Schedule a lesson</button>')}</div></section>
      <section class="panel"><div class="panel-head"><div><h2>Recent lesson notes</h2><p>Notes from completed sessions</p></div><button class="text-link" data-action="navigate" data-page="athletes">View athletes →</button></div><div class="panel-body">${notes.length ? notes.map(item => `<div class="note-row"><div class="note-row-head"><strong>${esc(athlete(item.athleteId)?.name || 'Archived athlete')}</strong><small>${esc(fmtDate(item.start, { month: 'short', day: 'numeric', year: 'numeric' }))}</small></div><p>${esc(item.notes)}</p></div>`).join('') : emptyState('✎', 'Your coaching notes will live here', 'Complete a lesson and add a few notes to start an athlete progress history.')}</div></section></div>
      <div class="stack"><section class="panel"><div class="panel-head"><div><h2>Package balances</h2><p>Lessons remaining across your roster</p></div></div><div class="panel-body">${activePackages.length ? activePackages.map(item => `<div class="package-line"><div class="package-avatar">${item.lessonCount}</div><div class="package-meta"><strong>${esc(athlete(item.athleteId)?.name || 'Archived athlete')}</strong><small>${item.lessonCount}-lesson package · ${item.paid ? 'Paid' : 'Payment due'}</small></div><span class="credit-pill">${remainingCredits(item)} left</span></div>`).join('') : emptyState('↗', 'No active packages', 'When an athlete buys a lesson package, their remaining credits show here.', '<button class="text-link" data-action="navigate" data-page="athletes">Open roster →</button>')}</div></section>
      <section class="panel"><div class="panel-head"><div><h2>Quick roster</h2><p>Athletes you coach</p></div><button class="text-link" data-action="navigate" data-page="athletes">All athletes →</button></div><div class="panel-body">${state.athletes.filter(item => !item.archived).length ? `<div class="avatar-stack">${state.athletes.filter(item => !item.archived).slice(0, 8).map(item => `<button class="mini-avatar" title="${esc(item.name)}" data-action="view-athlete" data-id="${esc(item.id)}">${esc(initials(item.name))}</button>`).join('')}</div><p class="metric-foot" style="margin:10px 0 0">${state.athletes.filter(item => !item.archived).length} athlete${state.athletes.filter(item => !item.archived).length === 1 ? '' : 's'} in your active roster</p>` : emptyState('♧', 'Start your roster', 'Create an athlete profile to keep lessons and progress together.', '<button class="btn btn-primary btn-small" data-action="open-athlete">＋ Add athlete</button>')}</div></section></div></div>`;
  }
  function renderSchedule() {
    const start = weekStart(selectedDate);
    const startDate = dateFromKey(start), endDate = dateFromKey(addDays(start, 6));
    const weekText = `${fmtDate(startDate, { month: 'short', day: 'numeric' })} – ${fmtDate(endDate, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    const dates = Array.from({ length: 7 }, (_, index) => addDays(start, index));
    const items = state.lessons.filter(item => dayKey(item.start) === selectedDate).sort((a,b) => new Date(a.start) - new Date(b.start));
    const countOnDay = key => state.lessons.filter(item => dayKey(item.start) === key && item.status !== 'cancelled').length;
    return `<div class="schedule-toolbar"><div class="week-label">${esc(weekText)}</div><div class="week-controls"><button class="btn-icon" aria-label="Previous week" data-action="week-prev">‹</button><button class="btn btn-outline btn-small" data-action="week-today">Today</button><button class="btn-icon" aria-label="Next week" data-action="week-next">›</button></div></div><div class="day-strip">${dates.map(key => { const d = dateFromKey(key), today = key === dayKey(new Date()); return `<button class="day-card ${key === selectedDate ? 'selected' : ''}" data-action="select-day" data-date="${key}"><span class="day-name">${today ? 'Today' : new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(d)}</span><span class="day-number">${d.getDate()}</span>${countOnDay(key) ? '<i class="day-dot"></i>' : ''}</button>`; }).join('')}</div>
      <section class="panel agenda-panel"><div class="panel-head"><div><h2>${esc(fmtLongDate(dateFromKey(selectedDate)))}</h2><p>${items.length} lesson${items.length === 1 ? '' : 's'} on this day</p></div><button class="btn btn-primary btn-small" data-action="open-lesson" data-date="${selectedDate}">＋ Add lesson</button></div>${items.length ? items.map(item => agendaItem(item)).join('') : emptyState('▦', 'No lessons this day', 'Choose another day or schedule a new 30-minute lesson.', '<button class="btn btn-primary btn-small" data-action="open-lesson" data-date="' + selectedDate + '">＋ Schedule lesson</button>')}</section>`;
  }
  function agendaItem(item) {
    const person = athlete(item.athleteId);
    const payLabel = item.billing === 'package' ? (pack(item.packageId)?.paid ? 'Package paid' : 'Package unpaid') : (item.paid ? 'Paid' : 'Unpaid · $60');
    return `<div class="agenda-item"><div class="agenda-clock"><strong>${fmtTime(item.start)}</strong><small>30 minutes</small></div><span class="agenda-bar ${item.billing === 'single' ? 'orange' : ''}"></span><div class="agenda-details"><strong>${esc(person?.name || 'Archived athlete')}</strong><p>${item.billing === 'package' ? `${pack(item.packageId)?.lessonCount || ''}-lesson package` : 'Single lesson · $60'}${item.notes ? ' · Notes added' : ''}</p>${item.status === 'completed' ? '<span class="pill completed">Completed</span>' : item.status === 'cancelled' ? '<span class="pill cancelled">Cancelled</span>' : '<span class="pill scheduled">Scheduled</span>'}</div><div class="agenda-actions">${item.status === 'scheduled' ? `<button class="btn btn-outline btn-small" data-action="complete-lesson" data-id="${esc(item.id)}">Complete</button>` : ''}<button class="btn-icon" title="Edit lesson" data-action="edit-lesson" data-id="${esc(item.id)}">⋯</button></div></div>`;
  }
  function renderAthletes() {
    const records = state.athletes.filter(item => Boolean(item.archived) === showArchived).filter(item => item.name.toLowerCase().includes(athleteSearch.toLowerCase())).sort((a,b) => a.name.localeCompare(b.name));
    const label = showArchived ? 'Archived athletes' : 'Your athletes';
    return `<div class="section-heading"><div><h2>${label}</h2><p>${records.length} athlete${records.length === 1 ? '' : 's'} · Profiles keep lessons, package balances, and notes together.</p></div><button class="btn btn-outline btn-small" data-action="toggle-archived">${showArchived ? 'View active roster' : 'View archived'}</button></div><div class="list-toolbar"><div class="search-box"><input id="athlete-search" type="search" placeholder="Search athletes" value="${esc(athleteSearch)}" /></div><button class="btn btn-primary btn-small" data-action="open-athlete">＋ Add athlete</button></div>${records.length ? `<div class="athlete-grid">${records.map(item => athleteCard(item)).join('')}</div>` : emptyState('♧', showArchived ? 'No archived athletes' : (state.athletes.length ? 'No athletes match that search' : 'Create your first athlete profile'), showArchived ? 'Athletes you archive will stay here with their history.' : 'Add an athlete to start scheduling lessons and tracking their progress.', showArchived || athleteSearch ? '' : '<button class="btn btn-primary btn-small" data-action="open-athlete">＋ Add athlete</button>')}`;
  }
  function athleteCard(item) {
    const history = lessonsFor(item.id);
    const next = futureFor(item.id)[0];
    const balance = packagesFor(item.id).reduce((sum, current) => sum + remainingCredits(current), 0);
    const completed = history.filter(row => row.status === 'completed').length;
    return `<article class="athlete-card" data-action="view-athlete" data-id="${esc(item.id)}"><div class="athlete-card-head"><div class="athlete-avatar">${esc(initials(item.name))}</div><div><h3>${esc(item.name)}</h3><div class="athlete-sub">${item.age ? `Age ${esc(item.age)}` : 'Athlete'}${item.throwHand ? ` · ${esc(item.throwHand)} hand` : ''}</div></div><button class="card-arrow" aria-label="Open ${esc(item.name)}">›</button></div><div class="athlete-stats"><div class="athlete-stat"><span>Lessons completed</span><strong>${completed}</strong></div><div class="athlete-stat"><span>Package credits left</span><strong>${balance}</strong></div></div><div class="athlete-card-foot"><small>${next ? `Next · ${fmtDate(next.start)} at ${fmtTime(next.start)}` : 'No upcoming lesson'}</small>${item.archived ? '<span class="archived-label">Archived</span>' : ''}</div></article>`;
  }
  function renderAthleteDetail(athleteId) {
    const person = athlete(athleteId);
    if (!person) return emptyState('♧', 'Athlete not found', 'This profile may have been removed.', '<button class="btn btn-outline btn-small" data-action="navigate" data-page="athletes">← Back to roster</button>');
    const packages = packagesFor(person.id).sort((a,b) => new Date(b.purchasedAt) - new Date(a.purchasedAt));
    const history = lessonsFor(person.id).sort((a,b) => new Date(b.start) - new Date(a.start));
    const upcoming = futureFor(person.id)[0];
    return `<button class="detail-back" data-action="navigate" data-page="athletes">← Back to athletes</button><section class="detail-header"><div class="athlete-avatar">${esc(initials(person.name))}</div><div><h2>${esc(person.name)} ${person.archived ? '<span class="archived-label">Archived</span>' : ''}</h2><p>${person.age ? `Age ${esc(person.age)}` : 'Athlete profile'}${person.throwHand ? ` · Throws ${esc(person.throwHand)}` : ''}${upcoming ? ` · Next lesson ${fmtDate(upcoming.start)} at ${fmtTime(upcoming.start)}` : ''}</p></div><div class="detail-actions"><button class="btn btn-outline" data-action="portal" data-id="${esc(person.id)}">View portal</button><button class="btn btn-outline" data-action="edit-athlete" data-id="${esc(person.id)}">Edit profile</button></div></section>
      <div class="detail-grid"><div class="stack"><section class="panel"><div class="panel-head"><div><h2>Lesson history</h2><p>Notes from completed sessions appear in the athlete portal</p></div><button class="btn btn-primary btn-small" data-action="open-lesson" data-athlete="${esc(person.id)}">＋ Schedule lesson</button></div><div class="panel-body">${history.length ? history.map(item => historyItem(item)).join('') : emptyState('▦', 'No lessons yet', 'Schedule the first session to begin this athlete’s history.')}</div></section><section class="panel"><div class="panel-head"><div><h2>Athlete details</h2><p>Profile information for your coaching reference</p></div></div><div class="panel-body"><div class="detail-info"><div><span>Age / grade</span><strong>${esc(person.age || 'Not added')}</strong></div><div><span>Throwing hand</span><strong>${esc(person.throwHand || 'Not added')}</strong></div><div><span>Parent / guardian email</span><strong>${esc(person.email || 'Not added')}</strong></div><div><span>Parent / guardian phone</span><strong>${esc(person.phone || 'Not added')}</strong></div><div style="grid-column:1/-1"><span>Goals / focus</span><strong>${esc(person.goals || 'Not added')}</strong></div></div></div></section></div>
      <div class="stack"><section class="panel"><div class="panel-head"><div><h2>Lesson packages</h2><p>Track purchased credits and payment</p></div><button class="btn btn-outline btn-small" data-action="open-package" data-athlete="${esc(person.id)}">＋ Add</button></div><div class="panel-body">${packages.length ? packages.map(item => packageCard(item)).join('') : emptyState('↗', 'No packages added', 'Add a 4-lesson or 8-lesson package to track credits.')}</div></section>${person.goals ? `<section class="panel"><div class="panel-head"><div><h2>Coaching focus</h2><p>From the athlete profile</p></div></div><div class="panel-body"><p style="font-size:11px;line-height:1.65;color:#687780;margin:0">${esc(person.goals)}</p></div></section>` : ''}<section class="panel"><div class="panel-head"><div><h2>Profile actions</h2><p>Keep your active roster tidy</p></div></div><div class="panel-body"><button class="btn btn-outline btn-small" data-action="${person.archived ? 'unarchive-athlete' : 'archive-athlete'}" data-id="${esc(person.id)}">${person.archived ? 'Restore athlete' : 'Archive athlete'}</button></div></section></div></div>`;
  }
  function packageCard(item) {
    const used = usedCredits(item.id), remaining = remainingCredits(item), percent = Math.min(100, Math.round(used / item.lessonCount * 100));
    return `<div class="package-card"><div class="package-card-top"><div><h3>${item.lessonCount}-lesson package · ${fmtMoney(item.price)}</h3><p>Purchased ${fmtDate(item.purchasedAt, { month: 'short', day: 'numeric', year: 'numeric' })}</p></div><span class="pill ${item.paid ? 'paid' : 'unpaid'}">${item.paid ? 'Paid' : 'Payment due'}</span></div><div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div><div class="progress-meta"><span>${used} completed</span><strong>${remaining} remaining</strong></div>${!item.paid ? `<button class="text-link" data-action="pay-package" data-id="${esc(item.id)}">Mark package paid →</button>` : ''}</div>`;
  }
  function historyItem(item) {
    const label = item.status === 'completed' ? 'Completed' : item.status === 'cancelled' ? 'Cancelled' : 'Scheduled';
    const payment = item.billing === 'package' ? `Package · ${pack(item.packageId)?.lessonCount || ''} lessons` : `Single · ${item.paid ? 'paid' : 'unpaid'}`;
    return `<div class="history-item"><div class="history-date">${fmtDate(item.start, { month: 'short', day: 'numeric', year: 'numeric' })}<br>${fmtTime(item.start)}</div><div class="history-content"><strong>Pitching lesson · ${label}</strong><p>${item.notes ? esc(item.notes) : '<span style="color:#abb4b9">No notes added</span>'}</p></div><span class="pill ${item.status === 'completed' ? 'completed' : item.status === 'cancelled' ? 'cancelled' : 'scheduled'}">${esc(payment)}</span></div>`;
  }
  function renderPayments() {
    const unpaidPackages = state.packages.filter(item => !item.paid).sort((a,b) => new Date(b.purchasedAt) - new Date(a.purchasedAt));
    const unpaidLessons = pendingSingleLessons().sort((a,b) => new Date(a.start) - new Date(b.start));
    const paidPackages = state.packages.filter(item => item.paid).sort((a,b) => new Date(b.purchasedAt) - new Date(a.purchasedAt)).slice(0, 5);
    const paidLessons = state.lessons.filter(item => item.billing === 'single' && item.paid).sort((a,b) => new Date(b.start) - new Date(a.start)).slice(0, 5);
    return `<section class="payment-summary">${statCard('Outstanding total', fmtMoney(outstandingTotal()), 'Unpaid packages and single lessons', '$', 'red')}${statCard('Unpaid items', unpaidPackages.length + unpaidLessons.length, 'Across your athlete roster', '◷', 'orange')}${statCard('Package credits active', state.packages.reduce((sum,item) => sum + remainingCredits(item),0), 'Lessons remaining in packages', '↗', 'green')}</section>
      <div class="stack"><section class="panel payment-section"><div class="panel-head"><div><h2>Needs payment</h2><p>Single lessons and packages still marked unpaid</p></div></div>${unpaidPackages.length + unpaidLessons.length ? [...unpaidPackages.map(item => ({ kind: 'package', data: item })), ...unpaidLessons.map(item => ({ kind: 'lesson', data: item }))].sort((a,b) => new Date(a.kind === 'package' ? a.data.purchasedAt : a.data.start) - new Date(b.kind === 'package' ? b.data.purchasedAt : b.data.start)).map(paymentRow).join('') : emptyState('✓', 'All caught up', 'When a lesson or package is unpaid, it will appear here.')}</section>
      <section class="panel"><div class="panel-head"><div><h2>Recently paid</h2><p>Latest payments recorded in Pitchbook</p></div></div>${paidPackages.length + paidLessons.length ? [...paidPackages.map(item => ({ kind: 'package', data: item })), ...paidLessons.map(item => ({ kind: 'lesson', data: item }))].sort((a,b) => new Date(b.kind === 'package' ? b.data.purchasedAt : b.data.start) - new Date(a.kind === 'package' ? a.data.purchasedAt : a.data.start)).slice(0, 6).map(item => paymentRow(item, true)).join('') : emptyState('＄', 'No payments recorded yet', 'Payments you mark paid will appear here.')}</section></div>`;
  }
  function paymentRow(entry, paid = false) {
    const item = entry.data, person = athlete(item.athleteId), isPackage = entry.kind === 'package';
    const date = isPackage ? item.purchasedAt : item.start;
    const detail = isPackage ? `${item.lessonCount}-lesson package` : `Single lesson${item.status === 'scheduled' ? ' · scheduled' : ''}`;
    const amount = isPackage ? item.price : 60;
    const action = paid ? '<span class="pill paid">Paid</span>' : `<button class="btn btn-outline btn-small" data-action="${isPackage ? 'pay-package' : 'pay-lesson'}" data-id="${esc(item.id)}">Mark paid</button>`;
    return `<div class="payment-row"><div class="payment-person"><div class="mini-avatar">${esc(initials(person?.name || 'A'))}</div><div><strong>${esc(person?.name || 'Archived athlete')}</strong><small>${detail}</small></div></div><div class="payment-amount">${fmtMoney(amount)}</div><div class="payment-date">${fmtDate(date, { month: 'short', day: 'numeric' })}</div>${action}</div>`;
  }
  function renderPortal(athleteId) {
    const person = athlete(athleteId);
    if (!person) return emptyState('♧', 'Portal not found', 'This athlete profile may have been removed.', '<button class="btn btn-outline btn-small" data-action="leave-portal">← Back to coach view</button>');
    const notes = lessonsFor(person.id).filter(item => item.status === 'completed' && item.notes?.trim()).sort((a,b) => new Date(b.start) - new Date(a.start));
    const upcoming = futureFor(person.id)[0];
    return `<div class="portal-shell"><div class="notice"><span>ⓘ</span><div><strong>Portal preview</strong> — This view uses lesson data saved in this browser. A remotely accessible athlete portal needs hosted storage and secure sign-in.</div></div><section class="portal-banner"><div class="athlete-avatar">${esc(initials(person.name))}</div><div><h2>${esc(person.name)}’s lesson portal</h2><p>Pitching lesson notes and progress</p></div><span class="portal-tag">ATHLETE VIEW</span></section>${upcoming ? `<section class="portal-next"><span>◷</span><strong>Next lesson</strong><span>${fmtDate(upcoming.start, { weekday: 'short', month: 'short', day: 'numeric' })} · ${fmtTime(upcoming.start)}</span></section>` : ''}<div class="section-heading"><div><h2>Lesson notes</h2><p>Completed lessons and coaching takeaways</p></div></div>${notes.length ? notes.map(item => `<article class="portal-note"><div class="note-row-head"><h3>Pitching lesson</h3><time>${fmtDate(item.start, { month: 'long', day: 'numeric', year: 'numeric' })}</time></div><p>${esc(item.notes)}</p></article>`).join('') : emptyState('✎', 'No lesson notes yet', 'After a lesson is completed and notes are added, they will show here.') }<div class="portal-footer">Your progress, one session at a time.</div></div>`;
  }
  function openModal(title, subtitle, body) {
    $('#modal-root').innerHTML = `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head"><div><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div><button class="modal-close" aria-label="Close" data-action="close-modal">×</button></div>${body}</section></div>`;
    const first = $('input:not([type=hidden]),select,textarea', $('#modal-root')); if (first) setTimeout(() => first.focus(), 0);
  }
  function closeModal() { $('#modal-root').innerHTML = ''; }
  function openAthleteModal(existing = null) {
    const person = existing ? athlete(existing) : null;
    openModal(person ? 'Edit athlete profile' : 'Add an athlete', person ? 'Update athlete details for your coaching roster.' : 'Create a home for lesson history, packages, and notes.', `<form class="modal-form" data-form="athlete"><input type="hidden" name="id" value="${esc(person?.id || '')}"><div class="form-grid"><div class="field full"><label for="athlete-name">Athlete name *</label><input id="athlete-name" name="name" required maxlength="80" value="${esc(person?.name || '')}" placeholder="First and last name"></div><div class="field"><label for="athlete-age">Age / grade</label><input id="athlete-age" name="age" maxlength="30" value="${esc(person?.age || '')}" placeholder="e.g. 14 or 9th grade"></div><div class="field"><label for="athlete-hand">Throwing hand</label><select id="athlete-hand" name="throwHand"><option value="">Choose</option><option ${person?.throwHand === 'Right' ? 'selected' : ''}>Right</option><option ${person?.throwHand === 'Left' ? 'selected' : ''}>Left</option><option ${person?.throwHand === 'Switch' ? 'selected' : ''}>Switch</option></select></div><div class="field"><label for="athlete-email">Parent / guardian email</label><input id="athlete-email" name="email" type="email" maxlength="120" value="${esc(person?.email || '')}" placeholder="Optional"></div><div class="field"><label for="athlete-phone">Parent / guardian phone</label><input id="athlete-phone" name="phone" type="tel" maxlength="30" value="${esc(person?.phone || '')}" placeholder="Optional"></div><div class="field full"><label for="athlete-goals">Goals / focus</label><textarea id="athlete-goals" name="goals" maxlength="800" placeholder="What are you working on together?">${esc(person?.goals || '')}</textarea></div></div><div class="modal-actions"><button type="button" class="btn btn-outline" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">${person ? 'Save profile' : 'Create athlete'}</button></div></form>`);
  }
  function defaultLessonTime(dateKeyValue) {
    const now = new Date();
    if (dateKeyValue && dateKeyValue !== dayKey(now)) { const d = dateFromKey(dateKeyValue); d.setHours(16, 0, 0, 0); return localDateTime(d); }
    const d = new Date(); d.setSeconds(0, 0);
    if (d.getMinutes() < 30) d.setMinutes(30); else { d.setHours(d.getHours() + 1); d.setMinutes(0); }
    return localDateTime(d);
  }
  function openLessonModal(existing = null, presetAthlete = '', presetDate = '') {
    const item = existing ? lesson(existing) : null;
    const athleteId = item?.athleteId || presetAthlete || (page === 'detail' ? window.activeAthleteId : '');
    const eligible = (athleteId ? packagesFor(athleteId) : state.packages).filter(row => remainingCredits(row) > 0 || row.id === item?.packageId);
    const dateValue = item ? localDateTime(new Date(item.start)) : defaultLessonTime(presetDate || (page === 'schedule' ? selectedDate : ''));
    const options = state.athletes.filter(row => !row.archived).sort((a,b) => a.name.localeCompare(b.name)).map(row => `<option value="${esc(row.id)}" ${row.id === athleteId ? 'selected' : ''}>${esc(row.name)}</option>`).join('');
    const packageOptions = eligible.map(row => `<option value="${esc(row.id)}" ${row.id === item?.packageId ? 'selected' : ''}>${esc(athlete(row.athleteId)?.name || 'Athlete')} · ${row.lessonCount}-lesson (${remainingCredits(row)} left)</option>`).join('');
    const bill = item?.billing || (eligible.some(row => row.athleteId === athleteId) ? 'package' : 'single');
    openModal(item ? 'Edit lesson' : 'Schedule a lesson', 'Every pitching lesson is 30 minutes.', `<form class="modal-form" data-form="lesson"><input type="hidden" name="id" value="${esc(item?.id || '')}"><div class="form-grid"><div class="field full"><label for="lesson-athlete">Athlete *</label><select id="lesson-athlete" name="athleteId" required><option value="">Choose an athlete</option>${options}</select>${!state.athletes.filter(row => !row.archived).length ? '<div class="field-hint">Create an athlete profile first.</div>' : ''}</div><div class="field"><label for="lesson-start">Date and start time *</label><input id="lesson-start" name="start" type="datetime-local" required value="${esc(dateValue)}"></div><div class="field"><label>Lesson length</label><div class="fixed-duration">30 minutes</div></div><div class="field"><label for="lesson-billing">Payment type</label><select id="lesson-billing" name="billing"><option value="single" ${bill === 'single' ? 'selected' : ''}>Single lesson · $60</option><option value="package" ${bill === 'package' ? 'selected' : ''} ${eligible.length ? '' : 'disabled'}>Use a lesson package</option></select></div><div class="field package-select-field" style="${bill === 'package' ? '' : 'display:none'}"><label for="lesson-package">Package *</label><select id="lesson-package" name="packageId">${packageOptions || '<option value="">No packages with credits</option>'}</select></div><div class="field full"><label for="lesson-notes">Lesson notes</label><textarea id="lesson-notes" name="notes" maxlength="2500" placeholder="Add notes from this session. They’ll appear in the athlete portal when you mark the lesson completed.">${esc(item?.notes || '')}</textarea><div class="field-hint">Notes are shown in the athlete portal after the lesson is completed.</div></div>${item ? `<div class="field"><label for="lesson-status">Status</label><select id="lesson-status" name="status"><option value="scheduled" ${item.status === 'scheduled' ? 'selected' : ''}>Scheduled</option><option value="completed" ${item.status === 'completed' ? 'selected' : ''}>Completed</option><option value="cancelled" ${item.status === 'cancelled' ? 'selected' : ''}>Cancelled</option></select></div>${item.billing === 'single' ? `<div class="field"><label for="lesson-paid">Payment</label><select id="lesson-paid" name="paid"><option value="false" ${item.paid ? '' : 'selected'}>Unpaid</option><option value="true" ${item.paid ? 'selected' : ''}>Paid</option></select></div>` : ''}` : ''}</div><div class="modal-actions">${item ? `<button type="button" class="btn btn-quiet" data-action="delete-lesson" data-id="${esc(item.id)}">Delete lesson</button>` : ''}<span style="flex:1"></span><button type="button" class="btn btn-outline" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">${item ? 'Save lesson' : 'Schedule lesson'}</button></div></form>`);
    const athleteSelect = $('#lesson-athlete', $('#modal-root'));
    athleteSelect?.addEventListener('change', () => refreshPackageOptions());
    $('#lesson-billing', $('#modal-root'))?.addEventListener('change', event => { $('.package-select-field', $('#modal-root')).style.display = event.target.value === 'package' ? '' : 'none'; });
  }
  function refreshPackageOptions() {
    const athleteId = $('#lesson-athlete', $('#modal-root')).value;
    const eligible = packagesFor(athleteId).filter(row => remainingCredits(row) > 0);
    const select = $('#lesson-package', $('#modal-root'));
    select.innerHTML = eligible.length ? eligible.map(row => `<option value="${esc(row.id)}">${row.lessonCount}-lesson · ${remainingCredits(row)} left${row.paid ? '' : ' · unpaid'}</option>`).join('') : '<option value="">No packages with credits</option>';
    const packageType = $('#lesson-billing option[value="package"]', $('#modal-root'));
    packageType.disabled = eligible.length === 0;
    if (!eligible.length && $('#lesson-billing', $('#modal-root')).value === 'package') $('#lesson-billing', $('#modal-root')).value = 'single';
    $('.package-select-field', $('#modal-root')).style.display = $('#lesson-billing', $('#modal-root')).value === 'package' ? '' : 'none';
  }
  function openPackageModal(athleteId) {
    const person = athlete(athleteId);
    if (!person) { toast('Choose an athlete first.'); return; }
    openModal('Add a lesson package', `Record a package purchase for ${person.name}.`, `<form class="modal-form" data-form="package"><input type="hidden" name="athleteId" value="${esc(person.id)}"><div class="form-grid"><div class="field full"><label for="package-plan">Package</label><select id="package-plan" name="lessonCount"><option value="8">8 lessons · $400</option><option value="4">4 lessons · $200</option></select></div><div class="field full"><label for="package-date">Purchase date</label><input id="package-date" type="date" name="purchasedAt" value="${dayKey(new Date())}" required></div><div class="field full"><label for="package-paid">Payment status</label><select id="package-paid" name="paid"><option value="true">Paid</option><option value="false">Unpaid</option></select></div></div><div class="modal-actions"><button type="button" class="btn btn-outline" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">Add package</button></div></form>`);
  }
  function overlapExists(start, ignoreId = '') {
    const startMs = new Date(start).getTime();
    return state.lessons.some(item => item.id !== ignoreId && item.status !== 'cancelled' && Math.abs(new Date(item.start).getTime() - startMs) < 30 * 60 * 1000);
  }
  function saveAthlete(form) {
    const data = new FormData(form), existing = data.get('id');
    const name = String(data.get('name') || '').trim();
    if (!name) { toast('Add the athlete’s name.'); return; }
    const values = { name, age: String(data.get('age') || '').trim(), throwHand: String(data.get('throwHand') || ''), email: String(data.get('email') || '').trim(), phone: String(data.get('phone') || '').trim(), goals: String(data.get('goals') || '').trim() };
    if (existing) Object.assign(athlete(existing), values);
    else state.athletes.push({ id: id(), ...values, archived: false, createdAt: new Date().toISOString() });
    closeModal(); persist(existing ? 'Athlete profile saved.' : 'Athlete added.'); render();
  }
  function saveLesson(form) {
    const data = new FormData(form), existingId = String(data.get('id') || ''), start = new Date(String(data.get('start') || ''));
    const athleteId = String(data.get('athleteId') || ''), person = athlete(athleteId);
    const old = existingId ? lesson(existingId) : null;
    if (!person || Number.isNaN(start.getTime())) { toast('Choose an athlete and lesson time.'); return; }
    if (overlapExists(start.toISOString(), existingId)) { toast('You already have a lesson scheduled within that 30-minute slot.'); return; }
    const billing = String(data.get('billing') || 'single');
    const packageId = billing === 'package' ? String(data.get('packageId') || '') : '';
    if (billing === 'package') {
      const packageItem = pack(packageId);
      const keepingAssignedPackage = old && old.packageId === packageId && (old.status === 'completed' || data.get('status') !== 'completed');
      if (!packageItem || packageItem.athleteId !== athleteId || (remainingCredits(packageItem) < 1 && !keepingAssignedPackage)) { toast('Choose a package with a lesson credit remaining.'); return; }
    }
    const values = { athleteId, start: start.toISOString(), duration: 30, billing, packageId, notes: String(data.get('notes') || '').trim() };
    if (existingId) {
      const status = String(data.get('status') || 'scheduled');
      if (status === 'completed' && billing === 'package' && packageId === old.packageId && old.status !== 'completed' && remainingCredits(pack(packageId)) < 1) { toast('This package has no credits left. Add a package or choose single lesson.'); return; }
      if (status === 'completed' && billing === 'package' && packageId !== old.packageId && remainingCredits(pack(packageId)) < 1) { toast('This package has no credits left.'); return; }
      const resolvedStatus = status === 'scheduled' && start.getTime() < Date.now() ? 'completed' : status;
      Object.assign(old, values, { status: resolvedStatus, paid: billing === 'single' ? data.get('paid') === 'true' : false });
    } else {
      const status = start.getTime() < Date.now() ? 'completed' : 'scheduled';
      state.lessons.push({ id: id(), ...values, status, paid: false, createdAt: new Date().toISOString() });
    }
    closeModal(); persist(existingId ? 'Lesson updated.' : 'Lesson scheduled.'); render();
  }
  function savePackage(form) {
    const data = new FormData(form), lessonCount = Number(data.get('lessonCount'));
    if (!athlete(String(data.get('athleteId'))) || !PLANS[lessonCount]) { toast('Choose a valid package.'); return; }
    const purchasedAt = new Date(`${data.get('purchasedAt')}T12:00:00`).toISOString();
    state.packages.push({ id: id(), athleteId: String(data.get('athleteId')), lessonCount, price: PLANS[lessonCount], paid: data.get('paid') === 'true', purchasedAt, createdAt: new Date().toISOString() });
    closeModal(); persist('Package added and credits are ready to track.'); render();
  }
  function completeLesson(idValue) {
    const item = lesson(idValue); if (!item) return;
    if (item.billing === 'package' && remainingCredits(pack(item.packageId)) < 1) { toast('No credits remain in this package. Edit the lesson or add another package.'); return; }
    item.status = 'completed'; persist('Lesson completed. Notes now appear in the athlete portal.'); render();
  }
  function markPackagePaid(idValue) { const item = pack(idValue); if (!item) return; item.paid = true; persist('Package marked paid.'); render(); }
  function markLessonPaid(idValue) { const item = lesson(idValue); if (!item) return; item.paid = true; persist('Lesson marked paid.'); render(); }
  function exportBackup() {
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), ...state }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = `pitchbook-backup-${dayKey(new Date())}.json`; link.click(); URL.revokeObjectURL(url); toast('Backup downloaded.');
  }
  function importBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        const imported = { athletes: data.athletes, lessons: data.lessons, packages: data.packages };
        if (!Array.isArray(imported.athletes) || !Array.isArray(imported.lessons) || !Array.isArray(imported.packages)) throw new Error('Invalid file');
        if (!confirm('Import this backup and replace the data saved in this browser? Download a current backup first if you need it.')) return;
        state = imported; persist(); page = 'dashboard'; render(); toast('Backup imported.');
      } catch (error) { toast('That file is not a valid Pitchbook backup.'); }
    };
    reader.readAsText(file);
  }

  document.addEventListener('click', event => {
    const target = event.target.closest('[data-action]'); if (!target) return;
    const action = target.dataset.action;
    if (action === 'backdrop-close') { if (event.target === target) closeModal(); return; }
    if (action === 'navigate') { page = target.dataset.page; window.activeAthleteId = ''; render(); }
    else if (action === 'open-athlete') openAthleteModal();
    else if (action === 'edit-athlete') openAthleteModal(target.dataset.id);
    else if (action === 'open-lesson') openLessonModal(null, target.dataset.athlete || '', target.dataset.date || '');
    else if (action === 'edit-lesson') openLessonModal(target.dataset.id);
    else if (action === 'open-package') openPackageModal(target.dataset.athlete);
    else if (action === 'view-athlete') { window.activeAthleteId = target.dataset.id; page = 'detail'; render(); }
    else if (action === 'portal') { window.activeAthleteId = target.dataset.id; page = 'portal'; render(); }
    else if (action === 'leave-portal') { page = window.activeAthleteId ? 'detail' : 'dashboard'; render(); }
    else if (action === 'close-modal') closeModal();
    else if (action === 'week-prev') { selectedDate = addDays(selectedDate, -7); render(); }
    else if (action === 'week-next') { selectedDate = addDays(selectedDate, 7); render(); }
    else if (action === 'week-today') { selectedDate = dayKey(new Date()); render(); }
    else if (action === 'select-day') { selectedDate = target.dataset.date; render(); }
    else if (action === 'complete-lesson') completeLesson(target.dataset.id);
    else if (action === 'pay-package') markPackagePaid(target.dataset.id);
    else if (action === 'pay-lesson') markLessonPaid(target.dataset.id);
    else if (action === 'archive-athlete' || action === 'unarchive-athlete') { const person = athlete(target.dataset.id); if (person) { person.archived = action === 'archive-athlete'; persist(person.archived ? 'Athlete archived. Their history is preserved.' : 'Athlete restored to your active roster.'); render(); } }
    else if (action === 'toggle-archived') { showArchived = !showArchived; athleteSearch = ''; render(); }
    else if (action === 'delete-lesson') { const item = lesson(target.dataset.id); if (item && confirm('Delete this lesson and its notes?')) { state.lessons = state.lessons.filter(row => row.id !== item.id); closeModal(); persist('Lesson deleted.'); render(); } }
    else if (action === 'export') exportBackup();
    else if (action === 'import') $('#import-file').click();
  });
  document.addEventListener('submit', event => {
    const form = event.target.closest('form[data-form]'); if (!form) return;
    event.preventDefault();
    if (form.dataset.form === 'athlete') saveAthlete(form);
    else if (form.dataset.form === 'lesson') saveLesson(form);
    else if (form.dataset.form === 'package') savePackage(form);
  });
  document.addEventListener('input', event => {
    if (event.target.id === 'athlete-search') { athleteSearch = event.target.value; const pos = event.target.selectionStart; const content = $('#page-content'); content.innerHTML = renderAthletes(); const input = $('#athlete-search'); input.focus(); input.setSelectionRange(pos, pos); }
  });
  $('#import-file').addEventListener('change', event => { importBackup(event.target.files?.[0]); event.target.value = ''; });
  render();
  loadPublicRecords();
})();
