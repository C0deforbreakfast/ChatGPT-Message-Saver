// content-script.js

// Small helper so code also works in Chrome if you ever port it.
const ext = typeof browser !== 'undefined' ? browser : chrome;

(function () {
  // --- Styles for the save button and highlight ---
  function injectStyles() {
    if (document.getElementById('gpt-saver-style')) return;

    const style = document.createElement('style');
    style.id = 'gpt-saver-style';
    style.textContent = `
      .gpt-saver-btn {
        position: absolute;
        top: 6px;
        left: 100%;
        transform: translateX(8px);
        font-size: 12px;
        cursor: pointer;
        opacity: 0.6;
        border: none;
        background: transparent;
        padding: 0;
        z-index: 2;
      }
      .gpt-saver-btn:hover {
        opacity: 1;
      }
      .gpt-saver-highlight {
        outline: 2px solid orange;
        outline-offset: 3px;
        border-radius: 6px;
      }
    `;
    document.head.appendChild(style);
  }

  // Try to find all user messages on the page.
  function getUserMessages() {
    // This selector matches current ChatGPT DOM (messages with user role).
    const nodes = document.querySelectorAll('[data-message-author-role="user"]');
    return Array.from(nodes);
  }

  // Attach buttons to any user messages that don't have one yet.
  function attachButtons() {
    injectStyles();
    const messages = getUserMessages();

    messages.forEach((msgEl, index) => {
      if (msgEl.dataset.gptSaverAttached === '1') return;

      // Ensure positioning context
      if (!getComputedStyle(msgEl).position || getComputedStyle(msgEl).position === 'static') {
        msgEl.style.position = 'relative';
      }

      const btn = document.createElement('button');
      btn.className = 'gpt-saver-btn';
      btn.textContent = '💾';
      btn.title = 'Save this message';

      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        saveMessageBookmark(msgEl, index).catch(console.error);
      });

      msgEl.dataset.gptSaverAttached = '1';
      msgEl.appendChild(btn);
    });
  }

  // Extract a snippet from the message text
  function getTextSnippet(el) {
    const text = el.innerText || el.textContent || '';
    const cleaned = text.trim().replace(/\s+/g, ' ');
    return cleaned.length > 120 ? cleaned.slice(0, 117) + '...' : cleaned;
  }

  function generateId() {
    return 'bm-' + Date.now().toString(36) + '-' +
      Math.random().toString(36).slice(2, 8);
  }

  async function saveMessageBookmark(messageEl, index) {
    const snippet = getTextSnippet(messageEl);
    const conversationUrl = window.location.origin + window.location.pathname;

    const bookmark = {
      id: generateId(),
      conversationUrl,
      index,
      textSnippet: snippet,
      createdAt: Date.now()
    };

    const res = await ext.storage.local.get('bookmarks');
    const bookmarks = res.bookmarks || [];
    bookmarks.push(bookmark);
    await ext.storage.local.set({ bookmarks });

    // Small visual feedback
    messageEl.classList.add('gpt-saver-highlight');
    setTimeout(() => messageEl.classList.remove('gpt-saver-highlight'), 1500);
  }

  // Deep-link handler: if URL hash has "#gpt-saver=<id>", scroll to that message
  async function handleDeepLink() {
    const hash = window.location.hash || '';
    const match = hash.match(/^#gpt-saver=([^&]+)/);
    if (!match) return;

    const targetId = decodeURIComponent(match[1]);

    // Wait a bit for ChatGPT to fully render the chat
    await new Promise((res) => setTimeout(res, 2000));

    const res = await ext.storage.local.get('bookmarks');
    const bookmarks = res.bookmarks || [];
    const bm = bookmarks.find((b) => b.id === targetId);
    if (!bm) return;

    const msgEl = findMessageElement(bm);
    if (msgEl) {
      highlightAndScroll(msgEl);
    }
  }

  // Try to find the message by snippet first; fall back to index.
  function findMessageElement(bookmark) {
    const messages = getUserMessages();

    // try by snippet
    let candidate = messages.find((el) => {
      const snippet = getTextSnippet(el);
      return snippet === bookmark.textSnippet ||
             snippet.startsWith(bookmark.textSnippet.slice(0, 20));
    });

    if (!candidate && typeof bookmark.index === 'number' && messages[bookmark.index]) {
      candidate = messages[bookmark.index];
    }

    return candidate || null;
  }

  function highlightAndScroll(el) {
    el.classList.add('gpt-saver-highlight');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => el.classList.remove('gpt-saver-highlight'), 4000);
  }

  async function waitForMessages(maxTries = 8, delayMs = 400) {
    for (let i = 0; i < maxTries; i++) {
      if (getUserMessages().length > 0) return true;
      await new Promise((r) => setTimeout(r, delayMs));
    }
    return getUserMessages().length > 0;
  }

  async function jumpToBookmarkId(targetId) {
    await waitForMessages();
    const res = await ext.storage.local.get('bookmarks');
    const bookmarks = res.bookmarks || [];
    const bm = bookmarks.find((b) => b.id === targetId);
    if (!bm) return false;
    const msgEl = findMessageElement(bm);
    if (msgEl) {
      highlightAndScroll(msgEl);
      return true;
    }
    return false;
  }

  // Observe DOM changes so we catch messages that load later
  function startObserver() {
    const observer = new MutationObserver(() => {
      attachButtons();
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true
    });
  }

  // Init
  function init() {
    attachButtons();
    startObserver();
    handleDeepLink().catch(console.error);
  }

  // Listen for popup requests to jump without navigation
  try {
    ext.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg && msg.type === 'gpt-saver-jump' && msg.id) {
        jumpToBookmarkId(msg.id).then((ok) => sendResponse({ ok })).catch(() => sendResponse({ ok: false }));
        return true; // async response
      }
      return false;
    });
  } catch (err) {
    // no-op
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
