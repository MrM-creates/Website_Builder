import { useState, useEffect, useRef } from 'react';
import './index.css';

/* ==========================================================================
   FLATSITE – Configuration Constants
   ========================================================================== */

const THEMES = {
  minimalist: {
    name: 'Minimalist',
    description: 'Clean, luftig und reduziert',
    font: '"Inter", sans-serif',
    previewClass: 'preview-minimalist',
    themeClass: 'theme-minimalist',
  },
  brachial: {
    name: 'Brachial',
    description: 'Laut, mutig und kontrastreich',
    font: '"Inter", sans-serif',
    previewClass: 'preview-brachial',
    themeClass: 'theme-brachial',
  },
  modern: {
    name: 'Modern',
    description: 'Gradient, weich und zeitgemäss',
    font: '"Inter", sans-serif',
    previewClass: 'preview-modern',
    themeClass: 'theme-modern',
  },
  classic: {
    name: 'Classic',
    description: 'Elegant, zeitlos und seriös',
    font: '"Playfair Display", serif',
    previewClass: 'preview-classic',
    themeClass: 'theme-classic',
  },
};

// Per-Theme Farbschemas (3 Varianten pro Design)
const THEME_COLORS = {
  minimalist: [
    { name: 'Monochrom', bg: '#fafafa', text: '#222', accent: '#000000' },
    { name: 'Cool Gray', bg: '#f0f4f8', text: '#334155', accent: '#4facfe' },
    { name: 'Warm Sand', bg: '#fdf8f0', text: '#3d3027', accent: '#c49a6c' },
  ],
  brachial: [
    { name: 'Schwarz/Weiss', bg: '#000000', text: '#ffffff', accent: '#ffffff' },
    { name: 'Feuerrot', bg: '#0a0000', text: '#ffffff', accent: '#ff2d2d' },
    { name: 'Neon Grün', bg: '#050505', text: '#ffffff', accent: '#39ff14' },
  ],
  modern: [
    { name: 'Ocean Blue', bg: '#fdfbfb', text: '#333', accent: '#4facfe' },
    { name: 'Sunset', bg: '#fff5f5', text: '#333', accent: '#ff6b6b' },
    { name: 'Aurora', bg: '#f0fdf4', text: '#1a3a2a', accent: '#22c55e' },
  ],
  classic: [
    { name: 'Elfenbein', bg: '#fdfbf7', text: '#2b2b2b', accent: '#8b7355' },
    { name: 'Bordeaux', bg: '#faf5f5', text: '#2b1515', accent: '#8b1a1a' },
    { name: 'Navy Gold', bg: '#f5f5fa', text: '#1a1a3a', accent: '#b8860b' },
  ],
};

// Helper to get the current color
const getColor = (design, colorIndex) => THEME_COLORS[design]?.[colorIndex] || THEME_COLORS.minimalist[0];
const normalizeWebsiteUrlInput = (value = '') => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const parsed = new URL(withProtocol);
    return parsed.toString().replace(/\/+$/g, '');
  } catch {
    return raw;
  }
};

const normalizeTargetPathInput = (value = '/') => {
  let targetPath = String(value ?? '').trim();
  if (!targetPath || targetPath === '.') return '/';

  targetPath = targetPath.replace(/\\/g, '/').replace(/\/+/g, '/');
  if (!targetPath.startsWith('/')) {
    targetPath = `/${targetPath}`;
  }

  if (targetPath.length > 1) {
    targetPath = targetPath.replace(/\/+$/g, '');
  }

  return targetPath || '/';
};

const ensureTrailingSlashForDirectory = (url = '') => {
  try {
    const parsed = new URL(url);
    if (parsed.pathname && parsed.pathname !== '/' && !parsed.pathname.endsWith('/')) {
      parsed.pathname = `${parsed.pathname}/`;
    }
    return parsed.toString();
  } catch {
    return url;
  }
};

const DEFAULT_PAGES = [
  { id: 'home', title: 'Startseite', required: true, selected: true },
  { id: 'portfolio', title: 'Portfolio', required: false, selected: true },
  { id: 'about', title: 'Über mich', required: false, selected: true },
  { id: 'contact', title: 'Kontakt', required: false, selected: true },
];

const TEST_HOSTING_DEFAULTS = {
  ftpServer: 'sl91.web.hostpoint.ch',
  ftpUser: 'testuser@egakinup.myhostpoint.ch',
  ftpPassword: '',
  ftpPort: '21',
  websiteUrl: 'https://swiss-ai-community.ch',
  targetPath: '/flatsite-test',
};

/* ==========================================================================
   FLATSITE – Mini Website Preview Component
   ========================================================================== */

function MiniSitePreview({ themeKey, colorIndex }) {
  const theme = THEMES[themeKey];
  const color = getColor(themeKey, colorIndex);
  const isDark = color.bg.toLowerCase() < '#888';
  const navBorder = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)';
  const heroImgBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  return (
    <div className={`mini-site-preview ${theme.previewClass}`} style={{
      borderRadius: '8px', overflow: 'hidden', aspectRatio: '16/10',
      border: '1px solid var(--border-color)',
      background: color.bg, color: color.text
    }}>
      {/* Mini Nav */}
      <div className="ms-nav" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 12px', fontSize: '7px', borderBottom: `1px solid ${navBorder}`
      }}>
        <div className="ms-logo" style={{ fontWeight: 'bold', fontSize: '8px', color: color.text }}>Logo</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ width: '20px', height: '3px', background: color.text, opacity: 0.4, borderRadius: '2px' }}></div>
          <div style={{ width: '20px', height: '3px', background: color.text, opacity: 0.4, borderRadius: '2px' }}></div>
          <div style={{ width: '20px', height: '3px', background: color.text, opacity: 0.4, borderRadius: '2px' }}></div>
        </div>
      </div>
      {/* Mini Hero Section */}
      <div className="ms-hero" style={{ display: 'flex', gap: '8px', padding: '10px 12px', flex: 1 }}>
        <div className="ms-hero-text" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
          <div className="ms-title" style={{ width: '70%', height: '10px', background: color.text, opacity: 0.8, borderRadius: '2px' }}></div>
          <div className="ms-subtitle" style={{ width: '50%', height: '5px', background: color.text, opacity: 0.3, borderRadius: '2px' }}></div>
        </div>
        <div className="ms-hero-img" style={{ flex: 1, background: heroImgBg, borderRadius: '4px' }}></div>
      </div>
      {/* Color accent bar */}
      <div style={{ height: '4px', background: color.accent, marginTop: 'auto' }}></div>
    </div>
  );
}

/* ==========================================================================
   FLATSITE – Live Preview Component (Full-size)
   ========================================================================== */

function LivePreview({ themeKey, colorIndex, projectName }) {
  const theme = THEMES[themeKey];
  const color = getColor(themeKey, colorIndex);
  const isDark = color.bg.toLowerCase() < '#888';
  const subtleText = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
  const cardBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const heroBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const navBorder = isDark ? `2px solid ${color.accent}` : `1px solid rgba(0,0,0,0.08)`;
  return (
    <div className={`live-preview-container ${theme.themeClass}`} style={{
      borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)',
      minHeight: '300px', background: color.bg, color: color.text
    }}>
      {/* Navigation */}
      <div className="lp-nav" style={{ borderBottom: navBorder }}>
        <div className="lp-logo" style={{ color: color.accent }}>{projectName || 'Mein Portfolio'}</div>
        <div className="lp-links">
          <span className="lp-link" style={{ color: color.text }}>Portfolio</span>
          <span className="lp-link" style={{ color: color.text }}>Über mich</span>
          <span className="lp-link" style={{ color: color.text }}>Kontakt</span>
        </div>
      </div>
      {/* Hero */}
      <div className="lp-main">
        <div className="lp-hero">
          <div className="lp-hero-content">
            <h1 className="lp-h1" style={{ color: color.text }}>Willkommen</h1>
            <p className="lp-p" style={{ color: subtleText }}>Entdecke meine Arbeiten und lass dich inspirieren.</p>
            <button className="lp-btn" style={{
              borderColor: color.accent, color: isDark ? color.bg : '#fff',
              background: color.accent,
            }}>Mehr erfahren</button>
          </div>
          <div className="lp-hero-image" style={{ minHeight: '200px', background: heroBg, color: subtleText }}>
            Bild
          </div>
        </div>
        {/* Grid */}
        <div className="lp-feature-grid">
          <div className="lp-card" style={{ background: cardBg }}></div>
          <div className="lp-card" style={{ background: cardBg }}></div>
          <div className="lp-card" style={{ background: cardBg }}></div>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   FLATSITE – Main Application
   ========================================================================== */

function App() {
  const BACKEND_URL = 'http://127.0.0.1:3001';

  /* ---- State ---- */
  const [step, setStep] = useState('welcome');
  const [projectName, setProjectName] = useState('');

  // Pages
  const [pages, setPages] = useState(DEFAULT_PAGES.map(p => ({ ...p })));
  const [newPageName, setNewPageName] = useState('');
  const [editingPageId, setEditingPageId] = useState(null);
  const [editingPageTitle, setEditingPageTitle] = useState('');
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Design
  const [selectedDesign, setSelectedDesign] = useState('minimalist');
  const [selectedColor, setSelectedColor] = useState(0);

  // Hosting
  const [ftpServer, setFtpServer] = useState(TEST_HOSTING_DEFAULTS.ftpServer);
  const [ftpUser, setFtpUser] = useState(TEST_HOSTING_DEFAULTS.ftpUser);
  const [ftpPassword, setFtpPassword] = useState(TEST_HOSTING_DEFAULTS.ftpPassword);
  const [ftpPort, setFtpPort] = useState(TEST_HOSTING_DEFAULTS.ftpPort);
  const [websiteUrl, setWebsiteUrl] = useState(TEST_HOSTING_DEFAULTS.websiteUrl);
  const [targetPath, setTargetPath] = useState(TEST_HOSTING_DEFAULTS.targetPath);

  // Footer
  const [footerLine1, setFooterLine1] = useState('');
  const [footerLine2, setFooterLine2] = useState('');
  const [footerLine3, setFooterLine3] = useState('');

  // UI state
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [lastPublishedViewUrl, setLastPublishedViewUrl] = useState('');
  const [projectSignature, setProjectSignature] = useState('');
  const [lastPublishedSignature, setLastPublishedSignature] = useState(null);
  const [kirbyReady, setKirbyReady] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupDone, setSetupDone] = useState(false);
  const [panelSrc, setPanelSrc] = useState('/panel/site');

  // Refs
  const editInputRef = useRef(null);

  /* ---- Effects ---- */
  useEffect(() => {
    if (editingPageId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingPageId]);

  // Start Kirby server when entering editor
  useEffect(() => {
    if (step === 'editor' && !kirbyReady) {
      startKirbyAndLogin();
    }
  }, [step]);

  useEffect(() => {
    if (step === 'editor') {
      setPanelSrc('/panel/site');
    }
  }, [step]);

  useEffect(() => {
    fetchProjectSignature();
  }, []);

  useEffect(() => {
    if (step !== 'editor') return;

    let stopped = false;
    const run = async () => {
      if (stopped) return;
      await fetchProjectSignature();
    };

    run();
    const intervalId = setInterval(run, 4000);

    return () => {
      stopped = true;
      clearInterval(intervalId);
    };
  }, [step]);

  /* ---- Kirby Server & Auto-Login ---- */
  const startKirbyAndLogin = async () => {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const tryAutoLogin = async () => {
      try {
        const res = await fetch('/api/auto-login', {
          method: 'POST',
          credentials: 'same-origin'
        });
        const data = await res.json();
        if (data.success) {
          console.log('Kirby Auto-Login erfolgreich');
          return true;
        }
        console.log('Kirby Auto-Login fehlgeschlagen:', data.message);
        return false;
      } catch (e) {
        console.log('Kirby Auto-Login Fehler:', e.message);
        return false;
      }
    };

    let loggedIn = await tryAutoLogin();

    // Recovery path: if Kirby is down, ask backend to (re)start PHP and retry
    if (!loggedIn) {
      try {
        await fetch(`${BACKEND_URL}/api/start-kirby`, { method: 'POST' });
      } catch (e) {
        console.log('Kirby Start-Request Fehler:', e.message);
      }

      await delay(1200);
      loggedIn = await tryAutoLogin();
    }

    if (!loggedIn) {
      await delay(800);
      await tryAutoLogin();
    }

    // Delay to let cookie propagate
    await delay(500);
    setKirbyReady(true);
  };

  const openPanelOverview = () => {
    setPanelSrc(`/panel/site?from=flatsite&ts=${Date.now()}`);
  };

  const buildWebsiteViewUrl = (urlInput = websiteUrl, targetPathInput = targetPath) => {
    const base = normalizeWebsiteUrlInput(urlInput);
    if (!base) return '';

    try {
      const parsed = new URL(base);
      const normalizedTargetPath = normalizeTargetPathInput(targetPathInput);
      const currentPath = parsed.pathname.replace(/\/+$/g, '');

      if (normalizedTargetPath && normalizedTargetPath !== '/') {
        if (!currentPath || currentPath === '/') {
          parsed.pathname = normalizedTargetPath;
        } else if (currentPath !== normalizedTargetPath) {
          parsed.pathname = `${currentPath}${normalizedTargetPath}`.replace(/\/+/g, '/');
        } else {
          parsed.pathname = currentPath;
        }
      } else {
        parsed.pathname = currentPath || '/';
      }

      parsed.search = '';
      parsed.hash = '';
      return ensureTrailingSlashForDirectory(parsed.toString());
    } catch {
      return '';
    }
  };

  const buildWebsiteViewUrlFromTrigger = (triggerUrl = '') => {
    if (!triggerUrl) return '';
    try {
      const parsed = new URL(triggerUrl);
      parsed.search = '';
      parsed.hash = '';
      parsed.pathname = parsed.pathname.replace(/\/flatsite-unzip\.php$/i, '/');
      return ensureTrailingSlashForDirectory(parsed.toString());
    } catch {
      return '';
    }
  };

  const computedWebsiteViewUrl = buildWebsiteViewUrl();
  const websiteViewUrl =
    isLive && lastPublishedViewUrl
      ? lastPublishedViewUrl
      : computedWebsiteViewUrl;
  const canOpenWebsite = Boolean(websiteViewUrl);

  const handleOpenWebsite = () => {
    if (!canOpenWebsite) return;
    window.open(websiteViewUrl, '_blank', 'noopener,noreferrer');
  };

  const fetchProjectSignature = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/project-signature`);
      if (!res.ok) return null;
      const data = await res.json();
      if (!data?.success || !data?.signature) return null;

      setProjectSignature((prev) => (prev === data.signature ? prev : data.signature));
      return data.signature;
    } catch {
      return null;
    }
  };

  const buildPublishSignature = (urlValue = websiteUrl, signatureValue = projectSignature) =>
    JSON.stringify({
      projectName: projectName.trim(),
      pages: pages.map((p) => ({ id: p.id, title: p.title, required: p.required, selected: p.selected })),
      design: { selectedDesign, selectedColor },
      contentSignature: signatureValue || '',
      footer: {
        footerLine1: footerLine1.trim(),
        footerLine2: footerLine2.trim(),
        footerLine3: footerLine3.trim(),
      },
      hosting: {
        ftpServer: ftpServer.trim(),
        ftpUser: ftpUser.trim(),
        ftpPassword,
        ftpPort: String(ftpPort || '').trim(),
        websiteUrl: normalizeWebsiteUrlInput(urlValue),
        targetPath: String(targetPath || '').trim(),
      },
    });

  const currentPublishSignature = buildPublishSignature(websiteUrl);
  const hasPendingPublishChanges =
    lastPublishedSignature === null || currentPublishSignature !== lastPublishedSignature;
  const publishButtonDisabled = isExporting || !hasPendingPublishChanges;
  const isExportError =
    exportResult.startsWith('Fehler') || exportResult.startsWith('Verbindung');

  /* ---- Hosting Setup (invisible Kirby account) ---- */
  const handleHostingComplete = async () => {
    setIsSettingUp(true);
    try {
      // Create Kirby account in the background
      await fetch(`${BACKEND_URL}/api/ensure-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@flatsite.app', password: 'flatsite2026' }),
      });
      // Sync project name to Kirby site title for Panel overview/header
      await fetch(`${BACKEND_URL}/api/update-site-title`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: projectName }),
      });
      // Sync pages in Kirby filesystem so panel overview matches onboarding exactly
      await fetch(`${BACKEND_URL}/api/sync-pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pages: pages
            .filter((p) => p.selected && p.id !== 'home')
            .map((p) => ({ slug: p.id, title: p.title }))
        }),
      });
      // Apply theme
      const color = getColor(selectedDesign, selectedColor);
      await fetch(`${BACKEND_URL}/api/update-theme`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          design: selectedDesign,
          font: THEMES[selectedDesign].font,
          colorPrimary: color.accent,
          colorBg: color.bg,
          colorText: color.text,
        }),
      });
    } catch (err) {
      console.error('Setup error:', err);
    }
    setIsSettingUp(false);
    setSetupDone(true);
    setStep('editor');
  };

  /* ---- Export / Publish ---- */
  const handleExport = async () => {
    setIsExporting(true);
    setExportResult('');
    const normalizedWebsiteUrl = normalizeWebsiteUrlInput(websiteUrl);
    const latestProjectSignature = await fetchProjectSignature();
    const effectiveSignature = latestProjectSignature ?? projectSignature;
    const signatureAtDeploy = buildPublishSignature(normalizedWebsiteUrl, effectiveSignature);
    if (normalizedWebsiteUrl !== websiteUrl) {
      setWebsiteUrl(normalizedWebsiteUrl);
    }
    let timeout = null;
    try {
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), 120000);
      const res = await fetch(`${BACKEND_URL}/api/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          host: ftpServer,
          user: ftpUser,
          password: ftpPassword,
          port: parseInt(ftpPort, 10) || 21,
          websiteUrl: normalizedWebsiteUrl,
          targetPath,
          deployMode: 'auto',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setExportResult('Upload erfolgreich.');
        setIsLive(true);
        if (latestProjectSignature) {
          setProjectSignature(latestProjectSignature);
        }
        const publishedViewUrl =
          buildWebsiteViewUrlFromTrigger(data.triggerUrl) ||
          buildWebsiteViewUrl(normalizedWebsiteUrl, targetPath);
        setLastPublishedViewUrl(publishedViewUrl);
        setLastPublishedSignature(signatureAtDeploy);
      } else {
        setExportResult('Fehler: Upload fehlgeschlagen.');
      }
    } catch (err) {
      if (err?.name === 'AbortError') {
        setExportResult('Fehler: Upload dauert zu lange (Timeout).');
      } else {
        setExportResult('Verbindungsfehler: Upload fehlgeschlagen.');
      }
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
    setIsExporting(false);
  };

  /* ---- Page Handlers ---- */
  const handleAddPage = (e) => {
    e.preventDefault();
    if (newPageName.trim()) {
      const slug = newPageName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      setPages([...pages, { id: slug || `page-${Date.now()}`, title: newPageName.trim(), required: false, selected: true }]);
      setNewPageName('');
    }
  };

  const togglePage = (id) => {
    setPages(pages.map(p => p.id === id && !p.required ? { ...p, selected: !p.selected } : p));
  };

  const removePage = (id) => {
    setPages(pages.filter(p => p.id !== id));
  };

  const startRename = (page) => {
    setEditingPageId(page.id);
    setEditingPageTitle(page.title);
  };

  const commitRename = () => {
    if (editingPageTitle.trim()) {
      setPages(pages.map(p => p.id === editingPageId ? { ...p, title: editingPageTitle.trim() } : p));
    }
    setEditingPageId(null);
  };

  // Drag and Drop
  const handleDragStart = (index) => {
    setDragIndex(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (index) => {
    if (dragIndex === null || dragIndex === index) { setDragIndex(null); setDragOverIndex(null); return; }
    const reordered = [...pages];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(index, 0, moved);
    setPages(reordered);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  /* ---- Navigation ---- */
  const navItems = [
    { label: 'Start', state: 'config' },
    { label: 'Seiten', state: 'pages' },
    { label: 'Design', state: 'design' },
    { label: 'Hosting', state: 'account' },
    { label: 'Übersicht', state: 'editor' },
  ];

  /* ========================================================================
     RENDER
     ======================================================================== */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-color)' }}>

      {/* ================================================================
          TOP NAVIGATION BAR (visible after welcome)
          ================================================================ */}
      {step !== 'welcome' && (
        <header className="glass-panel fade-in" style={{
          padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: '1px solid var(--border-color)', borderRadius: 0, position: 'sticky', top: 0, zIndex: 10
        }}>
          {/* Logo & Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{
              fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.5px', cursor: 'pointer',
              background: 'linear-gradient(135deg, var(--text-primary) 0%, rgba(255,255,255,0.5) 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
            }} onClick={() => setStep('welcome')}>
              Flatsite
            </div>
            <span style={{
              background: isLive ? 'rgba(140,198,63,0.15)' : 'rgba(255,152,0,0.1)',
              color: isLive ? '#8cc63f' : '#ff9800',
              padding: '0.2rem 0.6rem',
              borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '1px',
              border: isLive ? '1px solid rgba(140,198,63,0.35)' : '1px solid rgba(255,152,0,0.3)'
            }}>
              {isLive ? 'Live' : 'Lokal (Entwurf)'}
            </span>
          </div>

          {/* Navigation Links */}
          <div style={{ display: 'flex', gap: '2rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            {navItems.map((nav) => {
              const isActive = step === nav.state || (nav.label === 'Übersicht' && step === 'provider');
              return (
                <span key={nav.label} onClick={() => setStep(nav.state)} style={{
                  color: isActive ? 'var(--text-primary)' : 'inherit',
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer', opacity: isActive ? 1 : 0.6, transition: 'opacity 0.2s'
                }}
                  onMouseOver={(e) => !isActive && (e.target.style.opacity = '1')}
                  onMouseOut={(e) => !isActive && (e.target.style.opacity = '0.6')}
                >
                  {nav.label}
                </span>
              );
            })}
          </div>

        </header>
      )}

      {/* ================================================================
          MAIN CONTENT AREA
          ================================================================ */}
      <main style={{
        flex: 1, display: 'flex',
        flexDirection: step === 'editor' ? 'column' : 'row',
        alignItems: step === 'editor' ? 'stretch' : 'center',
        justifyContent: step === 'editor' ? 'stretch' : 'center',
        padding: step === 'editor' ? '0' : '4rem 5%'
      }}>

        {/* ====== STEP: WELCOME ====== */}
        {step === 'welcome' && (
          <div className="fade-in" style={{ textAlign: 'center', maxWidth: '600px', width: '100%', margin: '0 auto' }}>
            <div style={{
              fontWeight: 800, fontSize: '3rem', letterSpacing: '-1px', marginBottom: '1rem',
              background: 'linear-gradient(135deg, #fff 0%, #aaa 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
            }}>
              Flatsite
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', marginBottom: '3rem', lineHeight: '1.6' }}>
              Dein Content. Dein Computer. Dein Web.<br />
              Erstelle deine Website lokal und publiziere sie als superschnelles HTML.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button className="btn-primary fade-in" style={{ padding: '1rem 2rem', fontSize: '1.1rem', minWidth: '220px', boxShadow: '0 8px 20px rgba(79, 172, 254, 0.3)' }}
                onClick={() => setStep('config')}>
                Neues Projekt
              </button>
              <button className="btn-outline fade-in" style={{ padding: '1rem 2rem', fontSize: '1.1rem', minWidth: '220px', background: 'rgba(255,255,255,0.05)' }}
                onClick={() => setStep('editor')}>
                Bisheriges Projekt öffnen
              </button>
            </div>
          </div>
        )}

        {/* ====== STEP: PROJECT NAME ====== */}
        {step === 'config' && (
          <div className="glass-panel fade-in" style={{ maxWidth: '600px', width: '100%', padding: '3rem', borderRadius: '12px' }}>
            <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Projektname</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Gib deinem Projekt einen Namen – dieser wird als Logo auf deiner Website angezeigt.</p>
            <div className="input-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Projekt Name</label>
              <input type="text" placeholder="z.B. Sarahs Fotografie" value={projectName}
                onChange={e => setProjectName(e.target.value)} autoFocus />
            </div>
            <button className="btn-primary" style={{ width: '100%', padding: '1rem', marginTop: '1.5rem' }}
              onClick={() => setStep('pages')}>
              Weiter zu den Seiten
            </button>
          </div>
        )}

        {/* ====== STEP: PAGES ====== */}
        {step === 'pages' && (
          <div className="glass-panel fade-in" style={{ maxWidth: '600px', width: '100%', padding: '3rem', borderRadius: '12px' }}>
            <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Seitenstruktur</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              Wähle, benenne und ordne die Seiten deiner Website. Ziehe eine Seite, um die Reihenfolge zu ändern.
            </p>

            {/* Page List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '2rem' }}>
              {pages.map((page, index) => (
                <div key={page.id}
                  draggable={!page.required}
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                  onDrop={() => handleDrop(index)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.8rem 1rem',
                    background: dragOverIndex === index ? 'rgba(79,172,254,0.15)' : page.selected ? 'rgba(79, 172, 254, 0.08)' : 'var(--surface-color)',
                    border: dragOverIndex === index ? '1px dashed var(--accent-color)' : page.selected ? '1px solid rgba(79,172,254,0.3)' : '1px solid var(--border-color)',
                    borderRadius: '8px', cursor: page.required ? 'default' : 'grab',
                    opacity: dragIndex === index ? 0.4 : 1, transition: 'all 0.15s'
                  }}>
                  {/* Drag Handle */}
                  {!page.required && (
                    <span style={{ color: 'var(--text-secondary)', fontSize: '1rem', cursor: 'grab', userSelect: 'none' }}>⠿</span>
                  )}
                  {/* Checkbox */}
                  <div onClick={() => togglePage(page.id)} style={{
                    width: '20px', height: '20px', borderRadius: '4px', flexShrink: 0,
                    background: page.selected ? 'var(--accent-color, #4facfe)' : 'transparent',
                    border: page.selected ? 'none' : '1px solid var(--text-secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: page.required ? 'default' : 'pointer'
                  }}>
                    {page.selected && <span style={{ color: '#000', fontSize: '12px', fontWeight: 'bold' }}>✓</span>}
                  </div>
                  {/* Title (editable on double-click) */}
                  {editingPageId === page.id ? (
                    <input ref={editInputRef} type="text" value={editingPageTitle}
                      onChange={e => setEditingPageTitle(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingPageId(null); }}
                      style={{ flex: 1, background: 'var(--surface-color-light)', border: '1px solid var(--border-hover)', color: 'var(--text-primary)', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.95rem' }}
                    />
                  ) : (
                    <span onDoubleClick={() => !page.required && startRename(page)} style={{
                      flex: 1, color: page.selected ? 'var(--text-primary)' : 'var(--text-secondary)',
                      cursor: page.required ? 'default' : 'text'
                    }}>
                      {page.title}
                      {page.required && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>(Pflicht)</span>}
                    </span>
                  )}
                  {/* Remove Button */}
                  {!page.required && (
                    <span onClick={() => removePage(page.id)} style={{
                      color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.1rem',
                      opacity: 0.5, transition: 'opacity 0.2s'
                    }} onMouseOver={e => e.target.style.opacity = 1} onMouseOut={e => e.target.style.opacity = 0.5}>
                      ✕
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Add Page */}
            <form onSubmit={handleAddPage} style={{ display: 'flex', gap: '1rem' }}>
              <input type="text" placeholder="Neue Seite hinzufügen (z.B. Blog)" value={newPageName}
                onChange={e => setNewPageName(e.target.value)} style={{ flex: 1 }} />
              <button type="submit" className="btn-outline" style={{ padding: '0.8rem 1.5rem', whiteSpace: 'nowrap' }}>
                + Hinzufügen
              </button>
            </form>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '1rem', textAlign: 'center' }}>
              Doppelklick auf einen Namen zum Umbenennen · Ziehen zum Sortieren
            </p>

            <button className="btn-primary" style={{ width: '100%', padding: '1rem', marginTop: '2rem' }}
              onClick={() => setStep('design')}>
              Weiter zum Design
            </button>
          </div>
        )}

        {/* ====== STEP: DESIGN ====== */}
        {step === 'design' && (
          <div className="fade-in" style={{ maxWidth: '1000px', width: '100%', padding: '2rem' }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem', textAlign: 'center' }}>Wähle ein Design</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '3rem', textAlign: 'center' }}>
              Das Design bestimmt Typografie, Layout und Farbschema deiner Website.
            </p>

            {/* Theme Grid with Visual Previews */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem', marginBottom: '3rem' }}>
              {Object.entries(THEMES).map(([key, theme]) => (
                <div key={key} onClick={() => setSelectedDesign(key)} className="theme-card" style={{
                  cursor: 'pointer', background: 'var(--surface-color)', padding: '1rem', borderRadius: '12px',
                  border: selectedDesign === key ? '2px solid #4facfe' : '1px solid var(--border-color)',
                  transition: 'all 0.2s', boxShadow: selectedDesign === key ? '0 0 20px rgba(79,172,254,0.15)' : 'none'
                }}>
                  {/* Visual Preview */}
                  <MiniSitePreview themeKey={key} colorIndex={key === selectedDesign ? selectedColor : 0} />
                  {/* Theme Info */}
                  <div style={{ marginTop: '0.8rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                      {theme.name}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {theme.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Color Variants (per theme) */}
            <h3 style={{ fontSize: '1.3rem', marginBottom: '1.5rem', textAlign: 'center' }}>Farbvariante für {THEMES[selectedDesign].name}</h3>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '3rem' }}>
              {THEME_COLORS[selectedDesign].map((color, idx) => (
                <div key={idx} onClick={() => setSelectedColor(idx)} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.8rem', cursor: 'pointer'
                }}>
                  <div style={{
                    width: '60px', height: '60px', borderRadius: '50%', background: color.bg,
                    border: selectedColor === idx ? `3px solid ${color.accent}` : '2px solid var(--border-color)',
                    boxShadow: selectedColor === idx ? `0 0 15px ${color.accent}40` : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
                  }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: color.accent }}></div>
                  </div>
                  <span style={{ fontSize: '0.85rem', color: selectedColor === idx ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    {color.name}
                  </span>
                </div>
              ))}
            </div>

            {/* Full-Size Live Preview */}
            <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem', textAlign: 'center' }}>Vorschau</h3>
            <LivePreview themeKey={selectedDesign} colorIndex={selectedColor} projectName={projectName} />

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '3rem' }}>
              <button className="btn-primary" style={{ padding: '1rem 3rem' }}
                onClick={() => setStep(setupDone ? 'editor' : 'account')}>
                {setupDone ? 'Zurück zur Übersicht' : 'Weiter zum Hosting'}
              </button>
            </div>
          </div>
        )}

        {/* ====== STEP: HOSTING / ACCOUNT ====== */}
        {step === 'account' && (
          <div className="glass-panel fade-in" style={{ maxWidth: '600px', width: '100%', padding: '3rem', borderRadius: '12px' }}>
            <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Hosting & Provider</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              Trage deine FTP/SSH-Zugangsdaten ein. Flatsite erledigt das gesamte Setup im Hintergrund für dich.
            </p>

            <div className="input-group" style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Server Host / IP</label>
              <input type="text" placeholder="z.B. ftp.hostpoint.ch" value={ftpServer} onChange={e => setFtpServer(e.target.value)} />
            </div>
            <div className="input-group" style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Website URL (optional für schnelles ZIP-Deploy)</label>
              <input
                type="text"
                placeholder="z.B. swiss-ai-community.ch"
                value={websiteUrl}
                onChange={e => setWebsiteUrl(e.target.value)}
                onBlur={e => setWebsiteUrl(normalizeWebsiteUrlInput(e.target.value))}
              />
            </div>
            <div className="input-group" style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Zielpfad auf Server</label>
              <input type="text" placeholder="/ oder /flatsite-test" value={targetPath} onChange={e => setTargetPath(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <div className="input-group" style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Benutzername</label>
                <input type="text" placeholder="Dein FTP Benutzer" value={ftpUser} onChange={e => setFtpUser(e.target.value)} />
              </div>
              <div className="input-group" style={{ width: '100px' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Port</label>
                <input type="text" placeholder="21" value={ftpPort} onChange={e => setFtpPort(e.target.value)} />
              </div>
            </div>
            <div className="input-group" style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Passwort</label>
              <input type="text" placeholder="Dein FTP Passwort" value={ftpPassword}
                onChange={e => setFtpPassword(e.target.value)}
                style={{ WebkitTextSecurity: 'disc' }} />
            </div>

            <button className="btn-primary" style={{ width: '100%', padding: '1rem', marginTop: '0.5rem' }}
              onClick={handleHostingComplete} disabled={isSettingUp}>
              {isSettingUp ? 'Setup läuft...' : 'Setup abschliessen & zum Editor'}
            </button>
          </div>
        )}

        {/* ====== STEP: EDITOR / DASHBOARD ====== */}
        {step === 'editor' && (
          <div className="fade-in" style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{
              padding: '1rem 2rem',
              background: 'var(--surface-color)',
              borderBottom: '1px solid var(--border-color)'
            }}>
              <h2 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--text-primary)' }}>Seiten anpassen</h2>
            </div>
            {/* Dashboard Toolbar */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '1rem 2rem', background: 'var(--surface-color)',
              borderBottom: '1px solid var(--border-color)'
            }}>
              {/* Left: Design Info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                  <div style={{ width: '120px', height: '70px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 }}>
                    <MiniSitePreview themeKey={selectedDesign} colorIndex={selectedColor} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {THEMES[selectedDesign]?.name} · {getColor(selectedDesign, selectedColor)?.name}
                    </div>
                    <span onClick={() => setStep('design')} style={{
                      fontSize: '0.8rem', color: '#4facfe', cursor: 'pointer', textDecoration: 'underline'
                    }}>
                      Design ändern
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Actions */}
              <div style={{ display: 'flex', gap: '0.8rem' }}>
                <button className="btn-outline" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
                  onClick={openPanelOverview}>
                  Seitenübersicht
                </button>
                <button className="btn-outline" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
                  onClick={() => setStep('provider')}>
                  Providerwechsel
                </button>
                <button
                  className="btn-outline"
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.8rem',
                    opacity: canOpenWebsite ? 1 : 0.5,
                    cursor: canOpenWebsite ? 'pointer' : 'not-allowed'
                  }}
                  onClick={handleOpenWebsite}
                  disabled={!canOpenWebsite}
                  title={canOpenWebsite ? websiteViewUrl : 'Bitte zuerst Website URL erfassen'}
                >
                  Website ansehen
                </button>
                <button className="btn-primary" style={{
                  padding: '0.5rem 1.5rem',
                  fontSize: '0.8rem',
                  opacity: publishButtonDisabled ? 0.45 : 1,
                  cursor: publishButtonDisabled ? 'not-allowed' : 'pointer',
                  filter: publishButtonDisabled ? 'grayscale(0.25)' : 'none'
                }}
                  onClick={() => setShowExportModal(true)}
                  disabled={publishButtonDisabled}>
                  {hasPendingPublishChanges ? 'Publizieren' : 'Publiziert'}
                </button>
              </div>
            </div>

            {/* Footer Fields */}
            <div style={{
              display: 'flex', gap: '1rem', padding: '0.8rem 2rem',
              background: 'var(--surface-color)', borderBottom: '1px solid var(--border-color)'
            }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>Footer Zeile 1</label>
                <input type="text" placeholder="z.B. © 2026 Dein Name" value={footerLine1}
                  onChange={e => setFooterLine1(e.target.value)}
                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>Footer Zeile 2</label>
                <input type="text" placeholder="z.B. @instagram_handle" value={footerLine2}
                  onChange={e => setFooterLine2(e.target.value)}
                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>Footer Zeile 3</label>
                <input type="text" placeholder="z.B. mail@example.com" value={footerLine3}
                  onChange={e => setFooterLine3(e.target.value)}
                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }} />
              </div>
            </div>

            {/* Kirby Editor Iframe */}
            {kirbyReady ? (
              <iframe
                src={panelSrc}
                style={{ width: '100%', flex: 1, border: 'none', minHeight: '600px' }}
                title="Kirby CMS Editor"
              />
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#4facfe', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                <p style={{ color: 'var(--text-secondary)' }}>Layout Editor wird gestartet...</p>
                <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
              </div>
            )}
          </div>
        )}

        {/* ====== STEP: PROVIDER CHANGE ====== */}
        {step === 'provider' && (
          <div className="glass-panel fade-in" style={{ maxWidth: '600px', width: '100%', padding: '3rem', borderRadius: '12px' }}>
            <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Providerwechsel</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              Du möchtest deine Website bei einem anderen Hosting-Anbieter betreiben?
              Trage einfach die neuen FTP-Zugangsdaten ein. Beim nächsten Publizieren wird die Seite auf dem neuen Server hochgeladen.
            </p>

            <div className="input-group" style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Neuer Server Host / IP</label>
              <input type="text" placeholder="z.B. ftp.neuer-provider.ch" value={ftpServer} onChange={e => setFtpServer(e.target.value)} />
            </div>
            <div className="input-group" style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Website URL</label>
              <input
                type="text"
                placeholder="z.B. swiss-ai-community.ch"
                value={websiteUrl}
                onChange={e => setWebsiteUrl(e.target.value)}
                onBlur={e => setWebsiteUrl(normalizeWebsiteUrlInput(e.target.value))}
              />
            </div>
            <div className="input-group" style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Zielpfad</label>
              <input type="text" placeholder="/ oder /flatsite-test" value={targetPath} onChange={e => setTargetPath(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <div className="input-group" style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Benutzername</label>
                <input type="text" placeholder="Neuer FTP Benutzer" value={ftpUser} onChange={e => setFtpUser(e.target.value)} />
              </div>
              <div className="input-group" style={{ width: '100px' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Port</label>
                <input type="text" placeholder="21" value={ftpPort} onChange={e => setFtpPort(e.target.value)} />
              </div>
            </div>
            <div className="input-group" style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Passwort</label>
              <input type="text" placeholder="Neues FTP Passwort" value={ftpPassword}
                onChange={e => setFtpPassword(e.target.value)}
                style={{ WebkitTextSecurity: 'disc' }} />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn-outline" style={{ flex: 1, padding: '1rem' }}
                onClick={() => setStep('editor')}>
                Abbrechen
              </button>
              <button className="btn-primary" style={{ flex: 1, padding: '1rem' }}
                onClick={() => { setStep('editor'); }}>
                Daten speichern
              </button>
            </div>
          </div>
        )}

      </main>

      {/* ================================================================
          MODAL: EXPORT / PUBLISH
          ================================================================ */}
      {showExportModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.3s ease' }}>
          <div className="glass-panel fade-in" style={{ padding: '3rem', borderRadius: '12px', maxWidth: '600px', width: '90%', textAlign: 'center', position: 'relative' }}>
            <button onClick={() => { setShowExportModal(false); setExportResult(''); }} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.5rem', fontSize: '1.2rem' }}>✖</button>
            <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Website Publizieren</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              Flatsite verpackt deinen Content und lädt ihn via FTP auf {ftpServer || 'den Server'} hoch.
              <br />
              Zielpfad: <strong>{targetPath || '/'}</strong>{websiteUrl ? <> · Website URL: <strong>{websiteUrl}</strong></> : null}
            </p>

            {isExporting ? (
              <div style={{ padding: '2rem' }}>
                <div style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#4facfe', borderRadius: '50%', margin: '0 auto', animation: 'spin 1s linear infinite' }}></div>
                <p style={{ marginTop: '1.5rem', fontSize: '1.1rem' }}>Generiere & Deploye...</p>
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                  <button
                    className="btn-outline"
                    style={{ padding: '0.7rem 1.2rem', fontSize: '0.85rem' }}
                    onClick={() => {
                      setShowExportModal(false);
                      setIsExporting(false);
                    }}
                  >
                    Abbrechen & Zur Übersicht
                  </button>
                </div>
                <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
              </div>
            ) : exportResult ? (
              <div className="fade-in">
                <div style={{
                  padding: '2rem',
                  background: isExportError ? 'rgba(255,68,68,0.1)' : 'rgba(140, 198, 63, 0.1)',
                  borderRadius: '8px',
                  border: `1px solid ${isExportError ? 'rgba(255,68,68,0.3)' : 'rgba(140,198,63,0.3)'}`,
                  color: isExportError ? '#ff4444' : '#8cc63f'
                }}>
                  <h3 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    {isExportError ? '✗' : '✓'} {exportResult}
                  </h3>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: '1rem' }}>
                  {!isExportError && (
                    <button
                      className="btn-primary"
                      style={{ padding: '0.7rem 1.2rem', fontSize: '0.85rem' }}
                      onClick={() => {
                        setShowExportModal(false);
                        setExportResult('');
                        setStep('editor');
                      }}
                    >
                      Zur Übersicht
                    </button>
                  )}
                  <button
                    className="btn-outline"
                    style={{ padding: '0.7rem 1.2rem', fontSize: '0.85rem' }}
                    onClick={() => {
                      setShowExportModal(false);
                      setExportResult('');
                    }}
                  >
                    Schliessen
                  </button>
                </div>
              </div>
            ) : (
              <button className="btn-primary" style={{ padding: '1rem 3rem', fontSize: '1.1rem' }} onClick={handleExport}>
                Deployment Starten
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
