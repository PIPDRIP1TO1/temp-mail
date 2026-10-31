const API = 'https://zoromail.com/api/v1';
const ACTIVE_KEY = 'temp-mail-active-v2';
const SAVED_KEY = 'temp-mail-saved-v2';
const $ = (id) => document.getElementById(id);
let current = null;
let messages = [];
let selectedId = null;
let busy = false;
let toastTimer;

function readJson(storage, key, fallback) { try { return JSON.parse(storage.getItem(key)) || fallback; } catch { return fallback; } }
function saveActive() { if (current) sessionStorage.setItem(ACTIVE_KEY, JSON.stringify(current)); }
function savedBoxes() { return readJson(localStorage, SAVED_KEY, []); }
function setSaved(boxes) { localStorage.setItem(SAVED_KEY, JSON.stringify(boxes)); }
function icon(name) { return `<svg aria-hidden="true"><use href="#i-${name}"></use></svg>`; }
function toast(message) { const el = $('toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2800); }
function error(message) { $('error-text').textContent = message; $('error-box').hidden = false; }
function clearError() { $('error-box').hidden = true; }
function setBusy(value) { busy = value; $('new-btn').disabled = value; $('refresh-btn').disabled = value || !current; $('copy-btn').disabled = value || !current; $('save-btn').disabled = value || !current; }
function renderAddress() { $('address').textContent = current?.address || 'Creating your inbox…'; $('status-line').textContent = current ? 'Inbox refreshes automatically every 20 seconds' : 'Connecting to the mail service…'; setBusy(busy); }
async function api(path, options = {}) {
  const headers = { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(path.startsWith('/messages') && current?.token ? { Authorization: `Bearer ${current.token}` } : {}) };
  let response;
  try { response = await fetch(API + path, { ...options, headers: { ...headers, ...options.headers } }); }
  catch { throw new Error('Could not connect to ZoroMail. Check your connection and try again.'); }
  if (!response.ok) {
    let detail = ''; try { const body = await response.json(); detail = body.error || body.detail || body.message || ''; } catch {}
    throw new Error(response.status === 429 ? 'Mail service is busy. Please try again shortly.' : detail || `Mail service returned ${response.status}.`);
  }
  return response.status === 204 ? null : response.json();
}
function randomString(length) { const bytes = crypto.getRandomValues(new Uint8Array(length)); const abc = 'abcdefghijklmnopqrstuvwxyz0123456789'; return Array.from(bytes, b => abc[b % abc.length]).join(''); }
async function newMailbox() {
  if (busy) return;
  setBusy(true); clearError(); $('status-line').textContent = 'Creating your inbox…';
  try {
    const domains = await api('/domains');
    const domain = (Array.isArray(domains) ? domains : []).find(d => d.isActive !== false)?.domain;
    if (!domain) throw new Error('No public mail domain is available right now.');
    let box;
    for (let i = 0; i < 3; i++) {
      const address = `${randomString(12)}@${domain}`;
      const password = randomString(32);
      try { await api('/accounts', { method: 'POST', body: JSON.stringify({ address, password }) }); box = { address, password }; break; }
      catch (e) { if (i === 2) throw e; }
    }
    const token = await api('/token', { method: 'POST', body: JSON.stringify(box) });
    current = { ...box, token: token.token, id: token.id };
    saveActive(); messages = []; selectedId = null; renderMessages(); renderDetail(); clearError(); toast('New inbox ready');
    await refreshInbox(true);
  } catch (e) { error(e.message); $('status-line').textContent = current ? 'Inbox refresh paused' : 'Could not create an inbox'; }
  finally { setBusy(false); renderAddress(); }
}
async function refreshInbox(silent = false) {
  if (!current) return;
  try {
    const data = await api('/messages');
    const next = data.messages || [];
    const previousIds = new Set(messages.map(m => m.id));
    messages = next; renderMessages(); clearError();
    if (!silent && next.some(m => !previousIds.has(m.id))) toast('New message received');
  } catch (e) { if (!silent) error(e.message); }
}
function renderMessages() {
  $('message-count').textContent = `${messages.length} ${messages.length === 1 ? 'message' : 'messages'}`;
  const list = $('message-list'); list.replaceChildren();
  if (!messages.length) { list.innerHTML = `<div class="empty-list"><div class="empty-icon">${icon('inbox')}</div><strong>No messages yet</strong><span>Waiting for incoming mail...</span></div>`; return; }
  for (const m of messages) {
    const item = document.createElement('button'); item.type = 'button'; item.className = `message-item${m.id === selectedId ? ' active' : ''}${m.seen ? '' : ' unread'}`;
    const top = document.createElement('div'); top.className = 'message-top';
    const from = document.createElement('strong'); from.textContent = m.from?.name || m.from?.address || 'Unknown sender';
    const received = m.receivedAt || m.createdAt;
    const time = document.createElement('time'); time.dateTime = received || ''; time.textContent = received ? new Date(received).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
    top.append(from, time);
    const subject = document.createElement('div'); subject.className = 'message-subject'; subject.textContent = m.subject || '(No subject)';
    const intro = document.createElement('div'); intro.className = 'message-intro'; intro.textContent = m.intro || '';
    item.append(top, subject, intro); item.addEventListener('click', () => openMessage(m.id)); list.append(item);
  }
}
function renderDetail(message) {
  const panel = $('message-detail'); panel.replaceChildren();
  if (!message) { panel.innerHTML = `<div class="empty-detail">${icon('mail')}<span>Select a message to read</span></div>`; return; }
  const wrap = document.createElement('article'); wrap.className = 'detail-content';
  const title = document.createElement('h2'); title.textContent = message.subject || '(No subject)';
  const meta = document.createElement('div'); meta.className = 'detail-meta';
  const from = document.createElement('div'); const fromLabel = document.createElement('strong'); fromLabel.textContent = 'From: '; from.append(fromLabel, document.createTextNode(`${message.from?.name ? `${message.from.name} ` : ''}<${message.from?.address || 'unknown'}>`));
  const date = document.createElement('div'); const dateLabel = document.createElement('strong'); dateLabel.textContent = 'Date: '; date.append(dateLabel, document.createTextNode(message.receivedAt || message.createdAt ? new Date(message.receivedAt || message.createdAt).toLocaleString() : 'Unknown'));
  meta.append(from, date);
  const body = document.createElement('div'); body.className = 'detail-body'; body.textContent = message.text || (Array.isArray(message.html) && message.html.length ? 'This message contains HTML only. Plain text is unavailable.' : 'This message has no text.');
  wrap.append(title, meta, body);
  if (message.attachments?.length) { const attachments = document.createElement('div'); attachments.className = 'attachment'; attachments.textContent = `Attachments: ${message.attachments.map(a => a.filename).join(', ')}`; wrap.append(attachments); }
  panel.append(wrap);
}
async function openMessage(id) {
  selectedId = id; renderMessages(); $('message-detail').innerHTML = '<div class="empty-detail">Loading message…</div>';
  try { const message = await api(`/messages/${encodeURIComponent(id)}`); if (selectedId === id) renderDetail(message); }
  catch (e) { error(e.message); renderDetail(); }
}
function saveMailbox() {
  if (!current) return;
  const boxes = savedBoxes(); if (!boxes.some(b => b.address === current.address)) { boxes.unshift(current); setSaved(boxes); toast('Mailbox saved on this device'); }
  else toast('Mailbox already saved');
  renderSaved(); $('saved-dialog').showModal();
}
function renderSaved() {
  const list = $('saved-list'); list.replaceChildren();
  const boxes = savedBoxes();
  if (!boxes.length) { list.innerHTML = '<div class="saved-empty">No saved mailboxes yet.</div>'; return; }
  for (const box of boxes) {
    const row = document.createElement('button'); row.type = 'button'; row.className = 'saved-row'; row.textContent = box.address;
    const small = document.createElement('small'); small.textContent = box.address === current?.address ? 'Current inbox' : 'Click to open inbox'; row.append(small);
    row.addEventListener('click', async () => { current = box; saveActive(); messages = []; selectedId = null; renderAddress(); renderMessages(); renderDetail(); $('saved-dialog').close(); await refreshInbox(); });
    list.append(row);
  }
}
$('copy-btn').addEventListener('click', async () => { if (!current) return; try { await navigator.clipboard.writeText(current.address); toast('Address copied'); } catch { error('Could not copy automatically. Select the address and copy it manually.'); } });
$('refresh-btn').addEventListener('click', () => refreshInbox());
$('new-btn').addEventListener('click', newMailbox);
$('save-btn').addEventListener('click', saveMailbox);
$('close-dialog').addEventListener('click', () => $('saved-dialog').close());
$('retry-btn').addEventListener('click', () => current ? refreshInbox() : newMailbox());
current = readJson(sessionStorage, ACTIVE_KEY, null);
if (current?.address && current?.token) { renderAddress(); refreshInbox(); }
else { current = null; newMailbox(); }
setInterval(() => { if (current && !document.hidden) refreshInbox(true); }, 20000);
