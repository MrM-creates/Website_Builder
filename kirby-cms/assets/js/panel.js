(function () {
  const ROOT_ATTR = 'data-flider-seo-assist';
  let lastPath = '';

  const css = `
    [${ROOT_ATTR}] { margin-top: 0.55rem; border-top: 1px solid rgba(0,0,0,0.08); padding-top: 0.55rem; }
    [${ROOT_ATTR}] .flider-seo-row { display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap; }
    [${ROOT_ATTR}] .flider-seo-btn {
      border: 1px solid rgba(44, 95, 207, 0.35);
      background: rgba(44, 95, 207, 0.08);
      color: #2349a6;
      border-radius: 0.45rem;
      padding: 0.38rem 0.62rem;
      font-size: 0.74rem;
      font-weight: 600;
      cursor: pointer;
    }
    [${ROOT_ATTR}] .flider-seo-btn:disabled { opacity: 0.65; cursor: not-allowed; }
    [${ROOT_ATTR}] .flider-seo-status { font-size: 0.73rem; line-height: 1.35; color: #5f646f; }
    [${ROOT_ATTR}] .flider-seo-status[data-kind="error"] { color: #b73c3c; }
    [${ROOT_ATTR}] .flider-seo-status[data-kind="ok"] { color: #2a7a45; }
    .flider-seo-confirm-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      padding: 1rem;
    }
    .flider-seo-confirm-box {
      width: min(520px, 100%);
      border-radius: 0.75rem;
      background: #fff;
      box-shadow: 0 20px 45px rgba(0, 0, 0, 0.26);
      padding: 1rem 1rem 0.9rem;
      color: #1f2330;
    }
    .flider-seo-confirm-text { font-size: 0.9rem; line-height: 1.45; margin: 0 0 0.95rem; }
    .flider-seo-confirm-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
    .flider-seo-confirm-btn {
      border-radius: 999px;
      border: 1px solid #cfd4dc;
      background: #f3f5f8;
      color: #28303d;
      padding: 0.45rem 0.9rem;
      font-size: 0.82rem;
      cursor: pointer;
      min-width: 96px;
    }
    .flider-seo-confirm-btn--ok {
      border-color: #2b66d2;
      background: #2b66d2;
      color: #fff;
    }
  `;

  const ensureStyle = () => {
    if (document.getElementById('flider-seo-assist-style')) return;
    const style = document.createElement('style');
    style.id = 'flider-seo-assist-style';
    style.textContent = css;
    document.head.appendChild(style);
  };

  const decode = (value) => {
    try {
      return decodeURIComponent(String(value || ''));
    } catch {
      return String(value || '');
    }
  };

  const getCurrentPageId = () => {
    const match = String(window.location.pathname || '').match(/^\/panel\/pages\/([^/]+)/);
    if (!match || !match[1]) return '';
    return decode(match[1]).trim();
  };

  const findSeoTextarea = () => {
    const candidates = [
      'textarea[name="seodesc"]',
      '[data-name="seodesc"] textarea',
      '.k-field-name-seodesc textarea'
    ];

    for (const selector of candidates) {
      const node = document.querySelector(selector);
      if (node) return node;
    }
    return null;
  };

  const dispatchInputChange = (textarea) => {
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const showConfirmDialog = (message) =>
    new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'flider-seo-confirm-overlay';

      const box = document.createElement('div');
      box.className = 'flider-seo-confirm-box';

      const text = document.createElement('p');
      text.className = 'flider-seo-confirm-text';
      text.textContent = String(message || '');

      const actions = document.createElement('div');
      actions.className = 'flider-seo-confirm-actions';

      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'flider-seo-confirm-btn';
      cancel.textContent = 'Abbrechen';

      const ok = document.createElement('button');
      ok.type = 'button';
      ok.className = 'flider-seo-confirm-btn flider-seo-confirm-btn--ok';
      ok.textContent = 'Ersetzen';

      const close = (result) => {
        overlay.remove();
        resolve(Boolean(result));
      };

      cancel.addEventListener('click', () => close(false));
      ok.addEventListener('click', () => close(true));
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) close(false);
      });

      actions.appendChild(cancel);
      actions.appendChild(ok);
      box.appendChild(text);
      box.appendChild(actions);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
    });

  const ensureSeoAssist = () => {
    const path = String(window.location.pathname || '');
    if (!path.includes('/panel/pages/')) return;

    const textarea = findSeoTextarea();
    if (!textarea) return;

    const field = textarea.closest('.k-field') || textarea.parentElement;
    if (!field) return;
    if (field.querySelector(`[${ROOT_ATTR}]`)) return;

    const container = document.createElement('div');
    container.setAttribute(ROOT_ATTR, '1');

    const row = document.createElement('div');
    row.className = 'flider-seo-row';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'flider-seo-btn';
    button.textContent = 'Vorschlag generieren';

    const status = document.createElement('div');
    status.className = 'flider-seo-status';
    status.textContent = 'Erstellt einen Vorschlag aus dem Seiteninhalt.';

    const setStatus = (text, kind) => {
      status.textContent = text;
      status.setAttribute('data-kind', kind || '');
    };

    button.addEventListener('click', async () => {
      const pageId = getCurrentPageId();
      if (!pageId) {
        setStatus('Seite konnte nicht erkannt werden. Bitte Seite neu laden.', 'error');
        return;
      }

      button.disabled = true;
      setStatus('Vorschlag wird erstellt ...', '');

      try {
        const res = await fetch('/flider/seo/suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ pageId })
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data || data.success !== true || !String(data.suggestion || '').trim()) {
          setStatus(
            String(data && data.error ? data.error : 'Vorschlag konnte nicht erstellt werden.'),
            'error'
          );
          return;
        }

        const suggestion = String(data.suggestion || '').trim();
        const existingValue = String(textarea.value || '').trim();
        if (existingValue) {
          const confirmed = await showConfirmDialog(
            'Im Feld ist bereits ein Text. Soll dieser durch den neuen Vorschlag ersetzt werden?'
          );
          if (!confirmed) {
            setStatus('Bestehender Text wurde nicht ersetzt.', '');
            return;
          }
        }

        textarea.value = suggestion;
        dispatchInputChange(textarea);
        setStatus('Vorschlag eingefuegt. Jetzt Seite speichern.', 'ok');
      } catch {
        setStatus('Vorschlag konnte nicht erstellt werden. Bitte erneut versuchen.', 'error');
      } finally {
        button.disabled = false;
      }
    });

    row.appendChild(button);
    container.appendChild(row);
    container.appendChild(status);
    field.appendChild(container);
  };

  ensureStyle();
  ensureSeoAssist();

  setInterval(() => {
    const path = String(window.location.pathname || '');
    if (path !== lastPath) {
      lastPath = path;
    }
    ensureSeoAssist();
  }, 500);
})();
