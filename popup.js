// popup.js

const ext = typeof browser !== 'undefined' ? browser : chrome;

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function buildUrl(bm) {
  const baseUrl = bm.conversationUrl.split('#')[0];
  return `${baseUrl}#gpt-saver=${encodeURIComponent(bm.id)}`;
}

function baseOf(urlStr) {
  try {
    const u = new URL(urlStr);
    return u.origin + u.pathname;
  } catch {
    return (urlStr || '').split('#')[0].split('?')[0];
  }
}

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    // fall through to fallback
  }
  // Fallback
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'absolute';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(ta);
  return ok;
}

let toastTimer;
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1400);
}

// Theme handling
async function applyStoredTheme() {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const res = await ext.storage.local.get('popupTheme');
  const theme = res.popupTheme || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
}

async function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  await ext.storage.local.set({ popupTheme: next });
}

async function loadBookmarks() {
  const listEl = document.getElementById('bookmarks');
  listEl.textContent = 'Loading…';

  const res = await ext.storage.local.get('bookmarks');
  let bookmarks = res.bookmarks || [];

  // Newest first
  bookmarks = bookmarks.sort((a, b) => b.createdAt - a.createdAt);

  listEl.textContent = '';

  if (bookmarks.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No saved messages yet.';
    listEl.appendChild(li);
    return;
  }

  for (const bm of bookmarks) {
    const li = document.createElement('li');
    const item = document.createElement('div');
    item.className = 'bookmark-item';

    const row = document.createElement('div');
    row.className = 'bookmark-row';
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');
    row.title = 'Click to copy link';

    const snippetDiv = document.createElement('div');
    snippetDiv.className = 'snippet';
    snippetDiv.innerHTML = escapeHtml(bm.textSnippet);

    const dateDiv = document.createElement('div');
    dateDiv.className = 'meta';
    dateDiv.textContent = new Date(bm.createdAt).toLocaleString();

    const actions = document.createElement('div');
    actions.className = 'actions';

    const openBtn = document.createElement('button');
    openBtn.className = 'icon-btn open';
    openBtn.textContent = '↗';
    openBtn.title = 'Open conversation';
    openBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openBookmark(bm).catch(console.error);
    });

    const copyBtn = document.createElement('button');
    copyBtn.className = 'icon-btn copy';
    copyBtn.textContent = '⧉';
    copyBtn.title = 'Copy link';
    copyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const url = buildUrl(bm);
      const ok = await copyToClipboard(url);
      showToast(ok ? 'Link copied' : 'Copy failed');
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'icon-btn delete';
    deleteBtn.textContent = '✕';
    deleteBtn.title = 'Delete bookmark';
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const confirmDelete = confirm('Delete this bookmark?');
      if (!confirmDelete) return;
      await deleteBookmark(bm.id);
    });

  actions.appendChild(copyBtn);
  actions.appendChild(openBtn);
  actions.appendChild(deleteBtn);

    row.appendChild(snippetDiv);
    row.appendChild(dateDiv);

    // Row click copies URL
    row.addEventListener('click', async () => {
      const url = buildUrl(bm);
      const ok = await copyToClipboard(url);
      showToast(ok ? 'Link copied' : 'Copy failed');
    });
    row.addEventListener('keydown', async (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        const url = buildUrl(bm);
        const ok = await copyToClipboard(url);
        showToast(ok ? 'Link copied' : 'Copy failed');
      }
    });

    item.appendChild(row);
    item.appendChild(actions);
    li.appendChild(item);
    listEl.appendChild(li);
  }
}

async function openBookmark(bm) {
  const url = buildUrl(bm);
  try {
    // Try to reuse current active ChatGPT tab
    const tabs = await ext.tabs.query({ active: true, currentWindow: true });
    const active = tabs && tabs[0];
    const chatDomainRegex = /https?:\/\/(chat\.openai|chatgpt)\.com\//;
    if (active && active.url && chatDomainRegex.test(active.url)) {
      // If it's the same conversation, request in-page jump instead of navigation
      const isSameConversation = baseOf(active.url) === baseOf(bm.conversationUrl);
      if (isSameConversation) {
        try {
          const res = await ext.tabs.sendMessage(active.id, { type: 'gpt-saver-jump', id: bm.id });
          if (res && res.ok) {
            // focus the tab and exit
            await ext.tabs.update(active.id, { active: true });
            return;
          }
        } catch (_) {
          // fall through to navigation
        }
      }
      await ext.tabs.update(active.id, { url });
      return;
    }

    // Otherwise look for any existing ChatGPT tab in window
    const allTabs = await ext.tabs.query({ currentWindow: true });
    const existingChat = allTabs.find(t => t.url && chatDomainRegex.test(t.url));
    if (existingChat) {
      await ext.tabs.update(existingChat.id, { url });
      await ext.tabs.update(existingChat.id, { active: true });
      return;
    }

    // Fallback: create a new tab
    await ext.tabs.create({ url });
  } catch (e) {
    console.error('openBookmark failed, creating new tab as fallback', e);
    await ext.tabs.create({ url });
  }
}

async function deleteBookmark(id) {
  const res = await ext.storage.local.get('bookmarks');
  const bookmarks = (res.bookmarks || []).filter(b => b.id !== id);
  await ext.storage.local.set({ bookmarks });
  showToast('Deleted');
  // Re-render list
  await loadBookmarks();
}

applyStoredTheme().catch(console.error);
loadBookmarks().catch(console.error);

document.getElementById('themeToggle')?.addEventListener('click', () => {
  toggleTheme().catch(console.error);
});
