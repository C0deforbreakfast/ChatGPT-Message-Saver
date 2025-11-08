ChatGPT Message Saver
======================

> Original core idea inspired by **Arian Jahed** – https://github.com/C0deforbreakfast

Save, organize, and jump back to specific user prompts in ChatGPT conversations. Adds a small save icon next to each of your messages; the popup shows a professional list with copy / open / delete actions, deep-link highlighting, and theme toggle.

Available in firefox addons: https://addons.mozilla.org/en-US/firefox/addon/chatgpt-message-saver/

## Features

Current implemented capabilities:

- Save any user message (💾 button injected beside each prompt)
- Popup UI: dark/light themes, copy link, open in same tab or reuse existing tab, delete bookmarks
- In-page jump/highlight when opening a bookmark from the same conversation (no reload)
- Persistent theme selection (stored locally)
- Snippet trimming and timestamp display

## How It Works

1. The content script scans ChatGPT (`chat.openai.com` / `chatgpt.com`) user messages and injects a save button.
2. Clicking the button stores a bookmark (id, conversation URL, index, snippet, createdAt) in `storage.local`.
3. The popup lists bookmarks (newest first). Clicking:
	 - Row / Copy (⧉): Copies a deep-link URL (`#gpt-saver=<id>`)
	 - Open (↗): Navigates existing ChatGPT tab or jumps in-page if already on that conversation
	 - Delete (✕): Removes the bookmark
4. Deep-link handling and in-page message jumping rely on the content script matching snippets / stored index.

## Installation (Developer Mode)

Chrome / Chromium:
1. Clone or download this repository.
2. Visit `chrome://extensions`.
3. Enable Developer Mode (top-right toggle).
4. Click “Load unpacked” and select the project folder.
5. Open ChatGPT and start saving messages.

Firefox:
1. Open `about:debugging#/runtime/this-firefox`.
2. Click “Load Temporary Add-on”.
3. Select `manifest.json` from the folder.

## Permissions Explanation

`storage` – Persist bookmarks.
`tabs` – Reuse existing ChatGPT tab, update URL, send in-page jump message.
Host permissions (`*://chat.openai.com/*`, `*://chatgpt.com/*`) – Inject content script only where needed.

## Data Stored

All bookmark data lives in `browser.storage.local` / `chrome.storage.local` under the key `bookmarks`. No remote sync yet.

Bookmark object shape:
```
{
	id: string,
	conversationUrl: string,       // Base URL of the conversation
	index: number,                 // Message position at capture time
	textSnippet: string,           // Trimmed snippet (<= 120 chars)
	createdAt: number              // Epoch ms
}
```

## Development Notes

- Manifest Version: currently MV2 for simplicity; Chrome MV3 migration is recommended soon (service worker instead of background page if one is added later).
- Popup uses simple vanilla JS; no build tooling required.
- Cross-browser API shim: `const ext = typeof browser !== 'undefined' ? browser : chrome`.

## Roadmap / TODOs

Nearest planned improvements (from user requests):

- Grouping: Allow folders / tags / conversation grouping to organize bookmarks
- Coloring: Color-code bookmarks by tag or manual label (e.g., priority / topic)
- Chrome (Enhancements): MV3 migration + optional sync storage + options page for preferences
- Search / filter bar in popup
- Bulk operations (multi-select delete / export)
- Export / import (JSON file)
- Sort modes (Oldest, A–Z by snippet, Conversation order)
- “Pin” feature (keep certain bookmarks at top)
- Undo for delete (toast with 5s undo action)
- Optional automatic tag suggestion based on snippet keywords
- Sync storage toggle (use `chrome.storage.sync` / `browser.storage.sync` when available)
- Keyboard shortcuts: quick save (e.g., Alt+S) and open popup (extension commands)
- Logo

## Contributing

1. Open an issue describing improvement / bug.
2. Submit PR with focused changes (avoid unrelated formatting).
3. Keep styles consistent; prefer CSS variables.

## MV3 Migration Checklist (Future)

- Update `manifest_version` to 3
- Replace deprecated permissions or patterns
- Ensure no background page usage (currently none)
- Verify `tabs` permission behavior
- Re-test content script injection timing (consider `document_idle` vs `document_end`)

## Known Limitations

- Snippet matching may fail if ChatGPT drastically changes DOM or content transforms (fallback: index search)
- Bookmark index can drift if messages are deleted or system messages appear mid-thread
- No sync across devices yet (local only)

## License

MIT License

Copyright (c) 2025 ChatGPT Message Saver Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Disclaimer

Unofficial tool. Not affiliated with OpenAI. Use at your own risk. DOM selectors may require updates if ChatGPT changes layout.

