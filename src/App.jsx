import { useState, useEffect, useRef } from 'react';
import './index.css';

/* ==========================================================================
   FLATSITE – Configuration Constants
   ========================================================================== */

const DESIGN_STYLES = {
  brachial: {
    name: 'Brachial',
    description: 'Laut, kontrastreich, industriell',
    previewClass: 'preview-brachial',
    themeClass: 'theme-brachial',
  },
  minimalist: {
    name: 'Minimalist',
    description: 'Ruhig, elegant, inhaltsfokussiert',
    previewClass: 'preview-minimalist',
    themeClass: 'theme-minimalist',
  },
  modern: {
    name: 'Modern',
    description: 'Clean, tech-affin, vertrauenswürdig',
    previewClass: 'preview-modern',
    themeClass: 'theme-modern',
  },
  classic: {
    name: 'Classic',
    description: 'Zeitlos, wertig, erzählend',
    previewClass: 'preview-classic',
    themeClass: 'theme-classic',
  },
};

// 4x4 curated vibe matrix (fixed font/color bundles)
const DESIGN_VIBES = {
  brachial: [
    { id: 'B-01', label: 'Lass es knallen?', headingFont: '"Inter Tight", sans-serif', bodyFont: '"Inter", sans-serif', bg: '#1A1A1A', text: '#FFFFFF', accent: '#EEFF00' },
    { id: 'B-02', label: 'Etwas technischer?', headingFont: '"Inter Tight", sans-serif', bodyFont: '"Inter", sans-serif', bg: '#0D0D0D', text: '#FFFFFF', accent: '#00FFFF' },
    { id: 'B-03', label: 'Radikal reduziert?', headingFont: '"Inter Tight", sans-serif', bodyFont: '"Inter", sans-serif', bg: '#000000', text: '#FFFFFF', accent: '#FFFFFF' },
    { id: 'B-04', label: 'Mehr Gefahr?', headingFont: '"Inter Tight", sans-serif', bodyFont: '"Inter", sans-serif', bg: '#1A1A1A', text: '#FFFFFF', accent: '#FF4500' },
  ],
  minimalist: [
    { id: 'M-01', label: 'Schön entspannt?', headingFont: '"Playfair Display", serif', bodyFont: '"Source Sans 3", sans-serif', bg: '#F9F9F7', text: '#2C2C2C', accent: '#8A9A8A' },
    { id: 'M-02', label: 'Ein Hauch von Luxus?', headingFont: '"Playfair Display", serif', bodyFont: '"Source Sans 3", sans-serif', bg: '#001F3F', text: '#FFFFFF', accent: '#D4AF37' },
    { id: 'M-03', label: 'Galerie-Feeling?', headingFont: '"Playfair Display", serif', bodyFont: '"Source Sans 3", sans-serif', bg: '#FFFFFF', text: '#000000', accent: '#E0E0E0' },
    { id: 'M-04', label: 'Warm & Erdig?', headingFont: '"Playfair Display", serif', bodyFont: '"Source Sans 3", sans-serif', bg: '#F2E8DF', text: '#3D2B1F', accent: '#BDB76B' },
  ],
  modern: [
    { id: 'D-01', label: 'Schön professionell?', headingFont: '"Plus Jakarta Sans", sans-serif', bodyFont: '"Roboto", sans-serif', bg: '#FFFFFF', text: '#001F3F', accent: '#007AFF' },
    { id: 'D-02', label: 'Eher Dark Mode?', headingFont: '"Plus Jakarta Sans", sans-serif', bodyFont: '"Roboto", sans-serif', bg: '#121212', text: '#F0F0F0', accent: '#BB86FC' },
    { id: 'D-03', label: 'Mut zur Farbe?', headingFont: '"Plus Jakarta Sans", sans-serif', bodyFont: '"Roboto", sans-serif', bg: '#FFFFFF', text: '#2D3436', accent: '#6C5CE7' },
    { id: 'D-04', label: 'Radikal aufgeräumt?', headingFont: '"Plus Jakarta Sans", sans-serif', bodyFont: '"Roboto", sans-serif', bg: '#F5F5F7', text: '#1D1D1F', accent: '#8E8E93' },
  ],
  classic: [
    { id: 'C-01', label: 'Wie ein Magazin?', headingFont: '"Libre Baskerville", serif', bodyFont: '"Lora", serif', bg: '#F2E8DF', text: '#3D2B1F', accent: '#BF4F26' },
    { id: 'C-02', label: 'Ein Hauch Geschichte?', headingFont: '"Libre Baskerville", serif', bodyFont: '"Lora", serif', bg: '#F0F4F0', text: '#1B3022', accent: '#2D5A27' },
    { id: 'C-03', label: 'Sehr seriös?', headingFont: '"Libre Baskerville", serif', bodyFont: '"Lora", serif', bg: '#FFFFFF', text: '#002366', accent: '#C5B358' },
    { id: 'C-04', label: 'Vintage-Charme?', headingFont: '"Libre Baskerville", serif', bodyFont: '"Lora", serif', bg: '#FAF3E0', text: '#5D4037', accent: '#8D6E63' },
  ],
};

const getVibesForStyle = (styleKey) => DESIGN_VIBES[styleKey] || [];
const getDefaultVibeForStyle = (styleKey) => getVibesForStyle(styleKey)[0] || null;
const getSelectedVibe = (styleKey, vibeId) =>
  getVibesForStyle(styleKey).find((v) => v.id === vibeId) || getDefaultVibeForStyle(styleKey);
const getVibeByLegacyIndex = (styleKey, legacyIndex = 0) =>
  getVibesForStyle(styleKey)[Number(legacyIndex) || 0] || getDefaultVibeForStyle(styleKey);
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

const withDefaultIfBlank = (value, fallback = '') => {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : String(fallback ?? '');
};

const normalizeFtpUserFromState = (state = {}) => {
  const fallback = TEST_HOSTING_DEFAULTS.ftpUser;
  const value = withDefaultIfBlank(state?.ftpUser, fallback);
  const provider = String(state?.hostingProvider || '').trim().toLowerCase();

  // Guard against legacy cross-field corruption in Hostpoint projects
  if (provider === 'hostpoint' && !String(value).includes('@')) {
    return fallback;
  }

  return value;
};

const DEFAULT_PAGES = [
  { id: 'portfolio', title: 'Portfolio', selected: true },
  { id: 'about', title: 'Über mich', selected: true },
  { id: 'contact', title: 'Kontakt', selected: true },
];

const TEST_HOSTING_DEFAULTS = {
  hostingProvider: 'other',
  connectionType: 'ftpes',
  ftpServer: '',
  ftpUser: '',
  ftpPassword: '',
  ftpPort: '21',
  websiteUrl: '',
  targetPath: '/',
};

const PROVIDER_GUIDES = [
  { id: 'hostpoint', name: 'Hostpoint', short: 'HP', url: 'https://support.hostpoint.ch/de/produkte/webhosting/erste-schritte/wie-erstelle-ich-einen-ftp-account' },
  { id: 'infomaniak', name: 'Infomaniak', short: 'IN', url: 'https://www.infomaniak.com/de/support/faq/1982/ftp-ssh-konten-verwalten' },
  { id: 'cyon', name: 'Cyon', short: 'CY', url: 'https://www.cyon.ch/support/a/ftp-konto-erstellen' },
  { id: 'metanet', name: 'Metanet', short: 'ME', url: 'https://support.metanet.ch/45' },
  { id: 'hoststar', name: 'Hoststar', short: 'HS', url: 'https://www.hoststar.ch/de/support/my-panel/hosting/ftp-verwaltung' },
];

const CONNECTION_TYPES = {
  ftpes: { label: 'FTP/FTPES', defaultPort: '21' },
  sftp: { label: 'SFTP (SSH)', defaultPort: '22' },
};

const HOSTING_PROVIDER_PRESETS = {
  hostpoint: { id: 'hostpoint', label: 'Hostpoint', connectionType: 'ftpes', port: '21', server: 'sl91.web.hostpoint.ch', targetPath: '/' },
  infomaniak: { id: 'infomaniak', label: 'Infomaniak', connectionType: 'ftpes', port: '21', server: 'ftp.infomaniak.com', targetPath: '/' },
  cyon: { id: 'cyon', label: 'Cyon', connectionType: 'sftp', port: '22', server: 'ssh.cyon.ch', targetPath: '/' },
  metanet: { id: 'metanet', label: 'Metanet', connectionType: 'ftpes', port: '21', server: 'ftp.metanet.ch', targetPath: '/' },
  hoststar: { id: 'hoststar', label: 'Hoststar', connectionType: 'ftpes', port: '21', server: 'ftp.hoststar.ch', targetPath: '/' },
  other: { id: 'other', label: 'Anderer Anbieter', connectionType: 'ftpes', port: '21', server: '', targetPath: '/' },
};

const inferConnectionTypeFromPort = (portValue = '') => {
  const normalized = String(portValue ?? '').trim();
  return normalized === '22' ? 'sftp' : 'ftpes';
};

const mapDeployErrorToUserMessage = (raw = '') => {
  const message = String(raw || '').trim();
  const lower = message.toLowerCase();

  if (!message) return 'Upload fehlgeschlagen. Bitte Daten prüfen und erneut versuchen.';
  if (lower.includes('fehlende ftp credentials')) return 'Benutzername oder Passwort fehlt. Bitte die Hosting-Daten prüfen.';
  if (lower.includes('530') || lower.includes('authentication failed') || lower.includes('login incorrect')) {
    return 'Login fehlgeschlagen. Benutzername oder Passwort sind nicht korrekt.';
  }
  if (lower.includes('getaddrinfo') || lower.includes('enotfound') || lower.includes('eai_again')) {
    return 'Server-Adresse wurde nicht gefunden. Bitte die Server-Adresse prüfen.';
  }
  if (lower.includes('econnrefused') || lower.includes('connection refused')) {
    return 'Verbindung abgelehnt. Bitte Server-Adresse, Port und Verbindungsart prüfen.';
  }
  if (lower.includes('timed out') || lower.includes('etimedout') || lower.includes('timeout')) {
    return 'Verbindung hat zu lange gedauert. Bitte Internetverbindung oder Server prüfen.';
  }
  if (lower.includes('tls') || lower.includes('ssl') || lower.includes('handshake') || lower.includes('eproto')) {
    return 'TLS/SSL-Fehler. Bitte Port und Verbindungsart (FTP/FTPES oder SFTP) prüfen.';
  }
  if (lower.includes('deployment laeuft bereits') || lower.includes('deployment läuft bereits')) {
    return 'Es läuft bereits eine Veröffentlichung. Bitte kurz warten und dann erneut versuchen.';
  }
  if (lower.includes('startdatei') || lower.includes('index.html oder index.php')) {
    return 'Upload abgeschlossen, aber keine Startseite im Speicherort gefunden. Bitte Speicherort und Domain-Zuordnung prüfen.';
  }
  if (lower.includes('553') || lower.includes('550') || lower.includes('no such file') || lower.includes('not found')) {
    return 'Speicherort nicht gefunden oder nicht erreichbar. Bitte den Speicherort prüfen.';
  }

  return `Upload fehlgeschlagen: ${message}`;
};

/* ==========================================================================
   FLATSITE – Mini Website Preview Component
   ========================================================================== */

function MiniSitePreview({ styleKey, vibe }) {
  const style = DESIGN_STYLES[styleKey];
  const color = vibe || getDefaultVibeForStyle(styleKey);
  const isDark = color?.bg?.toLowerCase() < '#888';
  const navBorder = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)';
  const heroImgBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  return (
    <div className={`mini-site-preview ${style?.previewClass || ''}`} style={{
      borderRadius: '8px', overflow: 'hidden', aspectRatio: '16/10',
      border: '1px solid var(--border-color)',
      background: color?.bg || '#fff',
      color: color?.text || '#111',
      fontFamily: color?.bodyFont || '"Inter", sans-serif',
      transition: 'background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease'
    }}>
      {/* Mini Nav */}
      <div className="ms-nav" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 12px', fontSize: '7px', borderBottom: `1px solid ${navBorder}`
      }}>
        <div className="ms-logo" style={{ fontWeight: 'bold', fontSize: '8px', color: color?.text || '#111', fontFamily: color?.headingFont }}>
          Logo
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ width: '20px', height: '3px', background: color?.text || '#111', opacity: 0.4, borderRadius: '2px' }}></div>
          <div style={{ width: '20px', height: '3px', background: color?.text || '#111', opacity: 0.4, borderRadius: '2px' }}></div>
          <div style={{ width: '20px', height: '3px', background: color?.text || '#111', opacity: 0.4, borderRadius: '2px' }}></div>
        </div>
      </div>
      {/* Mini Hero Section */}
      <div className="ms-hero" style={{ display: 'flex', gap: '8px', padding: '10px 12px', flex: 1 }}>
        <div className="ms-hero-text" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
          <div className="ms-title" style={{ width: '70%', height: '10px', background: color?.text || '#111', opacity: 0.8, borderRadius: '2px' }}></div>
          <div className="ms-subtitle" style={{ width: '50%', height: '5px', background: color?.text || '#111', opacity: 0.3, borderRadius: '2px' }}></div>
        </div>
        <div className="ms-hero-img" style={{ flex: 1, background: heroImgBg, borderRadius: '4px' }}></div>
      </div>
      {/* Color accent bar */}
      <div style={{ height: '4px', background: color?.accent || '#000', marginTop: 'auto' }}></div>
    </div>
  );
}

/* ==========================================================================
   FLATSITE – Live Preview Component (Full-size)
   ========================================================================== */

function LivePreview({ styleKey, vibe, projectName }) {
  const style = DESIGN_STYLES[styleKey];
  const color = vibe || getDefaultVibeForStyle(styleKey);
  const isDark = color?.bg?.toLowerCase() < '#888';
  const subtleText = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
  const cardBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const heroBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const navBorder = isDark ? `2px solid ${color?.accent || '#fff'}` : `1px solid rgba(0,0,0,0.08)`;
  return (
    <div className={`live-preview-container ${style?.themeClass || ''}`} style={{
      borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)',
      minHeight: '300px',
      background: color?.bg || '#fff',
      color: color?.text || '#111',
      fontFamily: color?.bodyFont || '"Inter", sans-serif',
      transition: 'background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease'
    }}>
      {/* Navigation */}
      <div className="lp-nav" style={{ borderBottom: navBorder }}>
        <div className="lp-logo" style={{ color: color?.accent || '#000', fontFamily: color?.headingFont }}>{projectName || 'Mein Portfolio'}</div>
        <div className="lp-links">
          <span className="lp-link" style={{ color: color?.text || '#111', fontFamily: color?.bodyFont }}>Portfolio</span>
          <span className="lp-link" style={{ color: color?.text || '#111', fontFamily: color?.bodyFont }}>Über mich</span>
          <span className="lp-link" style={{ color: color?.text || '#111', fontFamily: color?.bodyFont }}>Kontakt</span>
        </div>
      </div>
      {/* Hero */}
      <div className="lp-main">
        <div className="lp-hero">
          <div className="lp-hero-content">
            <h1 className="lp-h1" style={{ color: color?.text || '#111', fontFamily: color?.headingFont }}>Willkommen</h1>
            <p className="lp-p" style={{ color: subtleText, fontFamily: color?.bodyFont }}>Entdecke meine Arbeiten und lass dich inspirieren.</p>
            <button className="lp-btn" style={{
              borderColor: color?.accent || '#000', color: isDark ? (color?.bg || '#111') : '#fff',
              background: color?.accent || '#000',
              transition: 'all 0.3s ease',
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

function HelpBadgeIcon({ label = 'Hilfe' }) {
  return (
    <span
      aria-hidden="true"
      title={label}
      style={{
        display: 'inline-flex',
        width: '18px',
        height: '18px',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        border: '1px solid rgba(79,172,254,0.45)',
        background: 'rgba(79,172,254,0.14)',
        color: '#7dc6ff',
        fontSize: '0.72rem',
        fontWeight: 700,
        lineHeight: 1,
        flexShrink: 0
      }}
    >
      ?
    </span>
  );
}

/* ==========================================================================
   FLATSITE – Main Application
   ========================================================================== */

function App() {
  const BACKEND_URL = 'http://127.0.0.1:3001';
  const BRAND_NAME = 'Flider.';
  const APP_VERSION = 'v1.0.0-rc2';
  const BRAND_WORDMARK_DARK = '/brand/flider_wordmark_dark.svg?v=3';
  const SITE_LOGO_MAX_MB = 5;
  const SITE_LOGO_ALLOWED_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml',
  ]);

  /* ---- State ---- */
  const [step, setStep] = useState('welcome');
  const [projectName, setProjectName] = useState('');
  const [siteLogoUrl, setSiteLogoUrl] = useState('');
  const [isUploadingSiteLogo, setIsUploadingSiteLogo] = useState(false);
  const [siteLogoError, setSiteLogoError] = useState('');

  // Pages
  const [pages, setPages] = useState(DEFAULT_PAGES.map(p => ({ ...p })));
  const [newPageName, setNewPageName] = useState('');
  const [editingPageId, setEditingPageId] = useState(null);
  const [editingPageTitle, setEditingPageTitle] = useState('');
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Design
  const [selectedDesign, setSelectedDesign] = useState('minimalist');
  const [selectedVibeId, setSelectedVibeId] = useState(getDefaultVibeForStyle('minimalist')?.id || 'M-01');

  // Hosting
  const [hostingProvider, setHostingProvider] = useState(TEST_HOSTING_DEFAULTS.hostingProvider);
  const [connectionType, setConnectionType] = useState(TEST_HOSTING_DEFAULTS.connectionType);
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
  const [showFooterPanelInEditor, setShowFooterPanelInEditor] = useState(true);
  const [currentProjectId, setCurrentProjectId] = useState('');
  const [currentProjectPath, setCurrentProjectPath] = useState('');
  const [projects, setProjects] = useState([]);
  const [showProjectList, setShowProjectList] = useState(false);
  const [showProviderGuide, setShowProviderGuide] = useState(false);
  const [showHostingWhy, setShowHostingWhy] = useState(false);
  const [showEditorActionsMenu, setShowEditorActionsMenu] = useState(false);
  const [defaultProjectsRoot, setDefaultProjectsRoot] = useState('');
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isOpeningProject, setIsOpeningProject] = useState(false);
  const [projectError, setProjectError] = useState('');
  const [safeMode, setSafeMode] = useState(false);
  const [backendFailureCount, setBackendFailureCount] = useState(0);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [isRestartingServices, setIsRestartingServices] = useState(false);
  const [isReportingIssue, setIsReportingIssue] = useState(false);
  const [issueReportFeedback, setIssueReportFeedback] = useState('');
  const [diagnostics, setDiagnostics] = useState(null);

  // Refs
  const editInputRef = useRef(null);
  const panelFrameRef = useRef(null);
  const lastOnboardingSyncSignatureRef = useRef('');
  const isApplyingProjectStateRef = useRef(false);
  const lastPersistedContentSignatureRef = useRef('');
  const isResettingProjectRef = useRef(false);
  const saveQueueRef = useRef(Promise.resolve());
  const startupPreflightDoneRef = useRef(false);

  const collectProjectState = () => ({
    projectName: projectName.trim(),
    siteLogoUrl,
    selectedDesign,
    selectedVibeId,
    hostingProvider,
    connectionType,
    ftpServer,
    ftpUser,
    ftpPassword,
    ftpPort,
    websiteUrl,
    targetPath,
    footerLine1,
    footerLine2,
    footerLine3,
    setupDone,
    isLive,
    lastPublishedViewUrl,
    lastPublishedSignature,
  });

  const isPanelSiteOverviewPath = (pathname = '') => {
    const normalized = String(pathname || '').replace(/\/+$/g, '');
    return normalized === '/panel/site';
  };

  const refreshEditorFooterVisibility = () => {
    try {
      const pathname = panelFrameRef.current?.contentWindow?.location?.pathname || '';
      const shouldShow = isPanelSiteOverviewPath(pathname);
      setShowFooterPanelInEditor((prev) => (prev === shouldShow ? prev : shouldShow));
    } catch {
      // Ignore iframe access edge cases and keep previous visibility state.
    }
  };

  const applyProjectState = (state = {}) => {
    isApplyingProjectStateRef.current = true;

    setProjectName(String(state.projectName || ''));
    setSiteLogoUrl(String(state.siteLogoUrl || ''));
    setSiteLogoError('');
    const resolvedDesign = String(state.selectedDesign || 'minimalist');
    const fallbackVibe = getVibeByLegacyIndex(resolvedDesign, state.selectedColor);
    const resolvedVibeId = String(state.selectedVibeId || fallbackVibe?.id || getDefaultVibeForStyle(resolvedDesign)?.id || '');
    setSelectedDesign(resolvedDesign);
    setSelectedVibeId(resolvedVibeId);
    const resolvedPort = String(state.ftpPort ?? TEST_HOSTING_DEFAULTS.ftpPort);
    const resolvedConnectionType = String(state.connectionType || inferConnectionTypeFromPort(resolvedPort));
    setHostingProvider(String(state.hostingProvider || TEST_HOSTING_DEFAULTS.hostingProvider));
    setConnectionType(resolvedConnectionType);
    setFtpServer(String(state.ftpServer ?? TEST_HOSTING_DEFAULTS.ftpServer));
    setFtpUser(normalizeFtpUserFromState(state));
    setFtpPassword(String(state.ftpPassword ?? TEST_HOSTING_DEFAULTS.ftpPassword));
    setFtpPort(resolvedPort);
    setWebsiteUrl(withDefaultIfBlank(state.websiteUrl, TEST_HOSTING_DEFAULTS.websiteUrl));
    setTargetPath(String(state.targetPath ?? TEST_HOSTING_DEFAULTS.targetPath));
    setFooterLine1(String(state.footerLine1 ?? ''));
    setFooterLine2(String(state.footerLine2 ?? ''));
    setFooterLine3(String(state.footerLine3 ?? ''));
    setSetupDone(Boolean(state.setupDone));
    setIsLive(Boolean(state.isLive));
    setLastPublishedViewUrl(String(state.lastPublishedViewUrl || ''));
    setLastPublishedSignature(state.lastPublishedSignature ?? null);
    setExportResult('');
    setShowExportModal(false);
    setKirbyReady(false);
    setPanelSrc('/panel/site');
    setShowFooterPanelInEditor(true);
    lastOnboardingSyncSignatureRef.current = '';

    setTimeout(() => {
      isApplyingProjectStateRef.current = false;
    }, 0);
  };

  const getHostingPreset = (providerId = '') =>
    HOSTING_PROVIDER_PRESETS[String(providerId || '').trim()] || HOSTING_PROVIDER_PRESETS.other;

  const applyHostingPreset = (providerId, { overwriteServer = true } = {}) => {
    const preset = getHostingPreset(providerId);
    setHostingProvider(preset.id);
    setConnectionType(preset.connectionType);
    setFtpPort(String(preset.port || CONNECTION_TYPES[preset.connectionType]?.defaultPort || '21'));
    if (overwriteServer) {
      setFtpServer(String(preset.server || ''));
    }
    setTargetPath((prev) => {
      const current = String(prev || '').trim();
      return current ? current : String(preset.targetPath || '/');
    });
  };

  const handleHostingProviderChange = (providerId) => {
    applyHostingPreset(providerId, { overwriteServer: true });
  };

  const handleConnectionTypeChange = (nextType) => {
    const normalized = String(nextType || '').trim();
    if (!CONNECTION_TYPES[normalized]) return;
    setConnectionType(normalized);
    setFtpPort(CONNECTION_TYPES[normalized].defaultPort);
  };

  const handleFtpPortChange = (value) => {
    const nextPort = String(value || '').replace(/[^\d]/g, '');
    setFtpPort(nextPort);
    if (nextPort === '22') {
      setConnectionType('sftp');
    } else if (nextPort === '21') {
      setConnectionType('ftpes');
    }
  };

  const pickFolder = async (promptText, initialPath = '') => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/system/pick-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          initialPath: String(initialPath || '').trim() || undefined,
        }),
      });
      const raw = await res.text();
      let data = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }

      if (!res.ok) {
        const fallbackError = 'Ordnerdialog konnte nicht geöffnet werden. Bitte prüfe, ob der Backend-Server läuft.';
        setProjectError(data?.error || fallbackError);
        return '';
      }

      if (!data?.success) {
        setProjectError(data?.error || 'Ordnerdialog antwortet ungültig. Bitte Backend neu starten.');
        return '';
      }
      if (data.canceled) return '';
      return String(data.path || '');
    } catch {
      setProjectError('Backend nicht erreichbar. Bitte App-Server neu starten und erneut versuchen.');
      return '';
    }
  };

  const fetchProjectPreferences = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/projects/preferences`);
      const data = await res.json();
      if (!res.ok || !data?.success) return;
      setDefaultProjectsRoot(String(data?.preferences?.defaultProjectsRoot || ''));
    } catch {
      // ignore - preferences are optional
    }
  };

  const saveDefaultProjectsRoot = async (pathValue = '') => {
    const value = String(pathValue || '').trim();
    try {
      const res = await fetch(`${BACKEND_URL}/api/projects/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultProjectsRoot: value }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setProjectError(data?.error || 'Standard-Projektordner konnte nicht gespeichert werden');
        return '';
      }
      const nextRoot = String(data?.preferences?.defaultProjectsRoot || '');
      setDefaultProjectsRoot(nextRoot);
      return nextRoot;
    } catch {
      setProjectError('Standard-Projektordner konnte nicht gespeichert werden');
      return '';
    }
  };

  const ensureDefaultProjectsRoot = async () => {
    const existing = String(defaultProjectsRoot || '').trim();
    if (existing) return existing;

    const chosen = await pickFolder('Wähle deinen Standard-Projektordner');
    if (!chosen) return '';

    const saved = await saveDefaultProjectsRoot(chosen);
    return saved || chosen;
  };

  const requestAllocatedProjectPath = async (rootPath) => {
    const root = String(rootPath || '').trim();
    if (!root) return '';

    try {
      const res = await fetch(`${BACKEND_URL}/api/projects/allocate-path`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootPath: root }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setProjectError(data?.error || 'Neuer Projektordner konnte nicht erzeugt werden');
        return '';
      }
      return String(data.projectPath || '');
    } catch {
      setProjectError('Neuer Projektordner konnte nicht erzeugt werden');
      return '';
    }
  };

  const refreshProjects = async () => {
    try {
      setIsLoadingProjects(true);
      const res = await fetch(`${BACKEND_URL}/api/projects/list`);
      const data = await res.json();
      if (!data?.success) return;

      const listed = Array.isArray(data.projects) ? data.projects : [];
      setProjects(listed);
    } catch {
      // ignore: project list is optional UI state
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const fetchPagesFromKirbyContent = async ({ applyState = true } = {}) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/content-pages`);
      const data = await res.json();
      if (!res.ok || !data?.success || !Array.isArray(data?.pages)) {
        return [];
      }

      const normalized = data.pages
        .map((page) => ({
          id: String(page?.id || '').trim(),
          title: String(page?.title || '').trim(),
          selected: page?.selected !== false,
        }))
        .filter((page) => page.id && page.title);

      if (applyState && normalized.length) {
        setPages(normalized);
      }
      return normalized;
    } catch {
      return [];
    }
  };

  const syncPagesToKirby = async (pagesInput = pages) => {
    const payloadPages = (Array.isArray(pagesInput) ? pagesInput : [])
      .filter((p) => p?.selected !== false)
      .map((p) => ({
        slug: String(p?.id || '').trim(),
        title: String(p?.title || '').trim(),
      }))
      .filter((p) => p.slug && p.title);

    await fetch(`${BACKEND_URL}/api/sync-pages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pages: payloadPages }),
    });
  };

  const runProjectSave = async (projectIdOverride = '', projectPathOverride = '', stateOverride = null) => {
    const projectId = projectIdOverride || currentProjectId;
    const projectPath = String(projectPathOverride || currentProjectPath || '').trim();
    if (!projectId || !projectPath) return;

    const res = await fetch(`${BACKEND_URL}/api/projects/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: projectId || undefined,
        projectPath: projectPath || undefined,
        state: stateOverride && typeof stateOverride === 'object' ? stateOverride : collectProjectState(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success || !data?.project?.id) {
      throw new Error(data?.error || 'Projekt konnte nicht gespeichert werden');
    }
    setCurrentProjectId(String(data.project.id));
    setCurrentProjectPath(String(data.project.path || projectPath));
  };

  const saveCurrentProject = (projectIdOverride = '', projectPathOverride = '', stateOverride = null) => {
    const queued = saveQueueRef.current
      .catch(() => {})
      .then(() => runProjectSave(projectIdOverride, projectPathOverride, stateOverride));

    saveQueueRef.current = queued.catch(() => {});
    return queued;
  };

  const openExistingProject = async ({ projectId = '', projectPath = '' } = {}) => {
    if ((!projectId && !projectPath) || isOpeningProject) return;
    setProjectError('');
    setIsOpeningProject(true);

    try {
      // Only autosave if the user is actually editing an opened project.
      // On welcome/startup, a stale project reference must never trigger a save.
      if (currentProjectId && currentProjectPath && step === 'editor') {
        try {
          await fetch(`${BACKEND_URL}/api/update-site-meta`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: projectName,
              siteLogoUrl,
              footerLine1,
              footerLine2,
              footerLine3,
            }),
          });
        } catch {
          // best effort only before snapshot save
        }
        try {
          await saveCurrentProject();
        } catch (err) {
          console.warn('Autosave vor Projektwechsel fehlgeschlagen:', err?.message || err);
        }
      }

      const res = await fetch(`${BACKEND_URL}/api/projects/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, projectPath }),
      });
      const data = await res.json();
      if (!data?.success) {
        setProjectError(data?.error || 'Projekt konnte nicht geöffnet werden');
        return;
      }

      setCurrentProjectId(data.project.id);
      setCurrentProjectPath(String(data.project.path || ''));
      const loadedState = { ...(data.project.state || {}) };
      try {
        const metaRes = await fetch(`${BACKEND_URL}/api/site-meta`);
        const metaData = await metaRes.json().catch(() => ({}));
        if (metaRes.ok && metaData?.success) {
          const siteMeta = metaData?.siteMeta || {};
          const hasStateField = (fieldName) =>
            Object.prototype.hasOwnProperty.call(loadedState, fieldName);
          const mergePreferState = (fieldName, stateValue, metaValue) => {
            // Important: explicit empty strings from saved project state must win.
            if (hasStateField(fieldName)) {
              return String(stateValue ?? '');
            }
            return String(metaValue ?? '');
          };

          loadedState.siteLogoUrl = mergePreferState('siteLogoUrl', loadedState.siteLogoUrl, siteMeta.logo);
          loadedState.footerLine1 = mergePreferState('footerLine1', loadedState.footerLine1, siteMeta.footerLine1);
          loadedState.footerLine2 = mergePreferState('footerLine2', loadedState.footerLine2, siteMeta.footerLine2);
          loadedState.footerLine3 = mergePreferState('footerLine3', loadedState.footerLine3, siteMeta.footerLine3);
          loadedState.projectName = mergePreferState('projectName', loadedState.projectName, siteMeta.title);
        }
      } catch {
        // ignore site meta fallback errors
      }
      let contentPages = await fetchPagesFromKirbyContent({ applyState: false });
      const hasSavedPages = Array.isArray(loadedState.pages) && loadedState.pages.length > 0;

      if (!contentPages.length && hasSavedPages) {
        await syncPagesToKirby(loadedState.pages);
        contentPages = await fetchPagesFromKirbyContent({ applyState: false });
      }

      const canonicalPages = contentPages.length
        ? contentPages
        : DEFAULT_PAGES.map((p) => ({ ...p }));

      if ((contentPages.length || hasSavedPages) && !loadedState.setupDone) {
        loadedState.setupDone = true;
      }
      if (!String(loadedState.projectName || '').trim() && String(data.project?.name || '').trim()) {
        loadedState.projectName = String(data.project.name);
      }
      applyProjectState(loadedState);
      setPages(canonicalPages);
      setShowProjectList(false);
      setStep('editor');
      await refreshProjects();
      await fetchProjectSignature();
    } catch {
      setProjectError('Projekt konnte nicht geöffnet werden');
    } finally {
      setIsOpeningProject(false);
    }
  };

  const formatProjectDate = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('de-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatProjectPath = (value = '') => {
    const raw = String(value || '').trim();
    if (!raw) return '';

    const normalized = raw.replace(/^\/Users\/[^/]+/, '~');
    if (normalized.length <= 64) return normalized;
    return `${normalized.slice(0, 30)}...${normalized.slice(-30)}`;
  };

  const fetchJsonWithTimeout = async (url, options = {}, timeoutMs = 2500) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      return { response, data };
    } finally {
      clearTimeout(timer);
    }
  };

  const probeUrlReachable = async (url, timeoutMs = 1600) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      await fetch(url, { mode: 'no-cors', cache: 'no-store', signal: controller.signal });
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  };

  const runSystemDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    try {
      try {
        const { data } = await fetchJsonWithTimeout(`${BACKEND_URL}/api/system/health`, {}, 3000);
        if (data?.health) {
          setDiagnostics({
            source: 'backend',
            health: data.health,
            recoverySteps: Array.isArray(data?.recoverySteps) ? data.recoverySteps : [],
          });
          setSafeMode(!(data?.success === true));
          if (data?.success === true) {
            setBackendFailureCount(0);
          }
          return;
        }
      } catch {
        // fallback below
      }

      const [backendUp, frontendUp, kirbyUp] = await Promise.all([
        probeUrlReachable('http://127.0.0.1:3001/api/project-signature'),
        probeUrlReachable('http://127.0.0.1:5173/'),
        probeUrlReachable('http://127.0.0.1:8000/'),
      ]);

      setDiagnostics({
        source: 'browser-fallback',
        health: {
          backend: { service: 'backend', up: backendUp, status: backendUp ? 200 : 0, error: backendUp ? null : 'unreachable' },
          frontend: { service: 'frontend', up: frontendUp, status: frontendUp ? 200 : 0, error: frontendUp ? null : 'unreachable' },
          kirby: { service: 'kirby', up: kirbyUp, status: kirbyUp ? 302 : 0, error: kirbyUp ? null : 'unreachable' },
        },
        recoverySteps: [
          'npm run dev:bg:ensure',
          'npm run dev:bg:status',
          'npm run dev:bg:logs',
        ],
      });
      setSafeMode(!(backendUp && frontendUp && kirbyUp));
      if (backendUp) setBackendFailureCount(0);
    } finally {
      setIsRunningDiagnostics(false);
    }
  };

  const restartSystemServices = async () => {
    if (isRestartingServices) return;
    setIsRestartingServices(true);

    try {
      let restartAccepted = false;
      try {
        const response = await fetch(`${BACKEND_URL}/api/system/restart`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'safe-mode-restart' }),
        });
        restartAccepted = response.ok;
      } catch {
        restartAccepted = false;
      }

      if (!restartAccepted && window?.fliderDesktop?.restartServices) {
        try {
          const ipcResult = await window.fliderDesktop.restartServices();
          restartAccepted = Boolean(ipcResult?.success);
        } catch {
          restartAccepted = false;
        }
      }

      if (!restartAccepted) {
        setIssueReportFeedback('Neustart konnte nicht gestartet werden. Bitte App kurz neu oeffnen.');
        return;
      }

      // Wait briefly for restart process to kick in.
      await new Promise((resolve) => setTimeout(resolve, 1800));

      // Poll health after restart. Exit early once all services are up.
      for (let attempt = 0; attempt < 10; attempt += 1) {
        await runSystemDiagnostics();

        let allUp = false;
        try {
          const { data } = await fetchJsonWithTimeout(`${BACKEND_URL}/api/system/health`, {}, 2000);
          allUp = Boolean(
            data?.success === true &&
            data?.health?.backend?.up &&
            data?.health?.frontend?.up &&
            data?.health?.kirby?.up
          );
        } catch {
          allUp = false;
        }

        if (allUp) {
          setSafeMode(false);
          setBackendFailureCount(0);
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    } finally {
      setIsRestartingServices(false);
    }
  };

  const reportSystemIssue = async () => {
    if (isReportingIssue) return;
    setIsReportingIssue(true);
    setIssueReportFeedback('');

    try {
      let latestDiagnostics = diagnostics;
      try {
        const { data } = await fetchJsonWithTimeout(`${BACKEND_URL}/api/system/preflight`, {}, 3500);
        if (data) {
          latestDiagnostics = {
            source: 'manual-report',
            health: data?.health || diagnostics?.health || null,
            preflight: data?.preflight || diagnostics?.preflight || null,
            issues: Array.isArray(data?.issues) ? data.issues : (Array.isArray(diagnostics?.issues) ? diagnostics.issues : []),
            recoverySteps: Array.isArray(data?.recoverySteps)
              ? data.recoverySteps
              : (Array.isArray(diagnostics?.recoverySteps) ? diagnostics.recoverySteps : []),
          };
          setDiagnostics(latestDiagnostics);
        }
      } catch {
        // keep existing diagnostics
      }

      const issues = Array.isArray(latestDiagnostics?.issues) ? latestDiagnostics.issues : [];
      const primaryIssue = issues[0] || {};

      const payload = {
        app: {
          name: BRAND_NAME,
          version: String(import.meta.env?.VITE_APP_VERSION || import.meta.env?.MODE || 'dev'),
          channel: String(import.meta.env?.MODE || 'dev'),
        },
        environment: {
          os: navigator?.userAgent || 'unknown',
          arch: navigator?.platform || 'unknown',
          runtime: 'desktop',
          locale: navigator?.language || null,
          timezone: Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone || null,
        },
        project: {
          id: currentProjectId || 'unknown',
          name: projectName || null,
          path: currentProjectPath || '',
          signature: projectSignature || null,
          lastSavedAt: new Date().toISOString(),
        },
        incident: {
          errorCode: String(primaryIssue?.code || (safeMode ? 'SRV_UNHEALTHY' : 'CFG_INVALID')),
          severity: String(primaryIssue?.severity || (safeMode ? 'P1' : 'P2')),
          message: String(primaryIssue?.message || 'Problem in Safe Mode gemeldet'),
          reproSteps: [
            'Safe Mode sichtbar',
            'Problem melden geklickt',
          ],
        },
        diagnostics: {
          health: latestDiagnostics?.health || null,
          recoverySteps: Array.isArray(latestDiagnostics?.recoverySteps) ? latestDiagnostics.recoverySteps : [],
          actionsTried: [],
        },
      };

      let data = null;
      let reportSaved = false;
      try {
        const response = await fetch(`${BACKEND_URL}/api/system/report-issue`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const responseData = await response.json().catch(() => ({}));
        if (response.ok && responseData?.success) {
          data = responseData;
          reportSaved = true;
        }
      } catch {
        reportSaved = false;
      }

      if (!reportSaved && window?.fliderDesktop?.saveIssueReport) {
        try {
          const ipcData = await window.fliderDesktop.saveIssueReport(payload);
          if (ipcData?.success) {
            data = ipcData;
            reportSaved = true;
          } else {
            data = ipcData;
          }
        } catch {
          reportSaved = false;
        }
      }

      if (!reportSaved || !data?.success) {
        setIssueReportFeedback((data && data.error) || 'Problembericht konnte nicht erstellt werden.');
        return;
      }

      const summary = String(data?.summary || '').trim();
      if (summary && navigator?.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(summary);
        } catch {
          // clipboard optional
        }
      }

      setIssueReportFeedback(
        `Problembericht gespeichert: ${String(data?.reportPath || '').trim() || data?.reportId || ''}`
      );
    } catch {
      setIssueReportFeedback('Problembericht konnte nicht erstellt werden.');
    } finally {
      setIsReportingIssue(false);
    }
  };

  const runStartupPreflight = async () => {
    if (startupPreflightDoneRef.current) return;
    startupPreflightDoneRef.current = true;

    try {
      const { response, data } = await fetchJsonWithTimeout(`${BACKEND_URL}/api/system/preflight`, {}, 3500);
      if (!response?.ok || !data) return;

      const issues = Array.isArray(data?.issues) ? data.issues : [];
      const preflightDiagnostics = {
        source: 'startup-preflight',
        health: data?.health || null,
        preflight: data?.preflight || null,
        issues,
        recoverySteps: Array.isArray(data?.recoverySteps) ? data.recoverySteps : [],
      };

      if (data?.success === true) {
        setBackendFailureCount(0);
        if (issues.length > 0) {
          setDiagnostics(preflightDiagnostics);
        }
        return;
      }

      setDiagnostics(preflightDiagnostics);
      setSafeMode(true);
    } catch {
      // fallback monitoring remains active
    }
  };

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
      setPanelSrc(`/panel/site?ts=${Date.now()}`);
      setShowFooterPanelInEditor(true);
    }
  }, [step]);

  useEffect(() => {
    if (step !== 'editor' && showEditorActionsMenu) {
      setShowEditorActionsMenu(false);
    }
  }, [step, showEditorActionsMenu]);

  useEffect(() => {
    if (step !== 'pages') return;
    fetchPagesFromKirbyContent({ applyState: true }).catch(() => {});
  }, [step]);

  useEffect(() => {
    if (step !== 'pages' || isApplyingProjectStateRef.current || isResettingProjectRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      syncPagesToKirby(pages)
        .then(async () => {
          if (currentProjectId || currentProjectPath) {
            await saveCurrentProject();
          }
        })
        .catch((err) => {
          console.warn('Seiten-Sync fehlgeschlagen:', err?.message || err);
        });
    }, 350);

    return () => clearTimeout(timer);
  }, [step, pages, currentProjectId, currentProjectPath]);

  useEffect(() => {
    fetchProjectSignature();
    refreshProjects();
    fetchProjectPreferences();
    runStartupPreflight().catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;

    const probeBackend = async () => {
      try {
        await fetchJsonWithTimeout(`${BACKEND_URL}/api/project-signature`, {}, 1800);
        if (cancelled) return;
        setBackendFailureCount(0);
        setDiagnostics(null);
        setSafeMode(false);
      } catch {
        if (cancelled) return;
        setBackendFailureCount((prev) => {
          const next = prev + 1;
          if (next >= 3) {
            setSafeMode(true);
          }
          return next;
        });
      }
    };

    probeBackend();
    const intervalId = setInterval(probeBackend, 4000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!safeMode || isRunningDiagnostics) return;
    if (diagnostics?.health) return;
    runSystemDiagnostics().catch(() => {});
  }, [safeMode]);

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

  useEffect(() => {
    if (step !== 'editor') return;

    refreshEditorFooterVisibility();
    const intervalId = setInterval(refreshEditorFooterVisibility, 600);

    return () => clearInterval(intervalId);
  }, [step, panelSrc, kirbyReady]);

  useEffect(() => {
    if (!currentProjectId || step !== 'editor' || isApplyingProjectStateRef.current || isResettingProjectRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      saveCurrentProject().catch(() => {});
    }, 700);

    return () => clearTimeout(timer);
  }, [
    currentProjectId,
    step,
    projectName,
    siteLogoUrl,
    pages,
    selectedDesign,
    selectedVibeId,
    hostingProvider,
    connectionType,
    ftpServer,
    ftpUser,
    ftpPassword,
    ftpPort,
    websiteUrl,
    targetPath,
    footerLine1,
    footerLine2,
    footerLine3,
    setupDone,
    isLive,
    lastPublishedViewUrl,
    lastPublishedSignature
  ]);

  useEffect(() => {
    if (step !== 'editor' || isApplyingProjectStateRef.current || isResettingProjectRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      fetch(`${BACKEND_URL}/api/update-site-meta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: projectName,
          siteLogoUrl,
          footerLine1,
          footerLine2,
          footerLine3,
        }),
      }).catch(() => {});
    }, 350);

    return () => clearTimeout(timer);
  }, [step, projectName, siteLogoUrl, footerLine1, footerLine2, footerLine3]);

  useEffect(() => {
    if (!currentProjectId || step !== 'editor' || !projectSignature || isResettingProjectRef.current) return;
    if (lastPersistedContentSignatureRef.current === projectSignature) return;

    const timer = setTimeout(() => {
      saveCurrentProject()
        .then(() => {
          lastPersistedContentSignatureRef.current = projectSignature;
        })
        .catch(() => {});
    }, 500);

    return () => clearTimeout(timer);
  }, [currentProjectId, step, projectSignature]);

  useEffect(() => {
    lastPersistedContentSignatureRef.current = '';
  }, [currentProjectId]);

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

    if (!loggedIn) {
      await delay(800);
      await tryAutoLogin();
    }

    // Delay to let cookie propagate
    await delay(500);
    setKirbyReady(true);
  };

  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'));
      reader.readAsDataURL(file);
    });

  const handleSiteLogoUpload = async (event) => {
    const file = event?.target?.files?.[0];
    if (!file) return;
    event.target.value = '';
    setSiteLogoError('');

    const maxBytes = SITE_LOGO_MAX_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      setSiteLogoError(`Logo ist zu gross (max. ${SITE_LOGO_MAX_MB} MB).`);
      return;
    }

    const normalizedType = String(file.type || '').toLowerCase();
    if (!SITE_LOGO_ALLOWED_TYPES.has(normalizedType)) {
      setSiteLogoError('Bitte ein Logo als PNG, JPG, WEBP oder SVG hochladen.');
      return;
    }

    setIsUploadingSiteLogo(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await fetch(`${BACKEND_URL}/api/upload-site-logo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          dataUrl
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success || !String(data?.logoPath || '').trim()) {
        setSiteLogoError(data?.error || 'Logo konnte nicht gespeichert werden.');
        return;
      }

      const uploadedLogoPath = String(data.logoPath).trim();
      setSiteLogoUrl(uploadedLogoPath);
      await fetch(`${BACKEND_URL}/api/update-site-meta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: projectName,
          siteLogoUrl: uploadedLogoPath,
          footerLine1,
          footerLine2,
          footerLine3
        }),
      });
    } catch {
      setSiteLogoError('Logo konnte nicht gespeichert werden.');
    } finally {
      setIsUploadingSiteLogo(false);
    }
  };

  const removeSiteLogo = async () => {
    setSiteLogoError('');
    setSiteLogoUrl('');
    try {
      await fetch(`${BACKEND_URL}/api/update-site-meta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: projectName,
          siteLogoUrl: '',
          footerLine1,
          footerLine2,
          footerLine3
        }),
      });
    } catch {
      // ignore: will be synced on next regular save/sync
    }
  };

  const performStartNewProject = async (projectPath) => {
    isResettingProjectRef.current = true;

    // Only snapshot-save if the current project is actively open in editor.
    if (currentProjectId && currentProjectPath && step === 'editor') {
      try {
        await saveCurrentProject();
      } catch {
        // ignore autosave errors when starting a new project
      }
    }

    setProjectError('');
    setShowProjectList(false);
    setCurrentProjectId('');
    setCurrentProjectPath('');
    setProjectName('');
    setSiteLogoUrl('');
    setSiteLogoError('');
    setPages(DEFAULT_PAGES.map((p) => ({ ...p })));
    setNewPageName('');
    setEditingPageId(null);
    setEditingPageTitle('');
    setDragIndex(null);
    setDragOverIndex(null);
    setSelectedDesign('minimalist');
    setSelectedVibeId(getDefaultVibeForStyle('minimalist')?.id || 'M-01');
    setHostingProvider(TEST_HOSTING_DEFAULTS.hostingProvider);
    setConnectionType(TEST_HOSTING_DEFAULTS.connectionType);
    setFooterLine1('');
    setFooterLine2('');
    setFooterLine3('');
    setSetupDone(false);
    setKirbyReady(false);
    setIsLive(false);
    setLastPublishedViewUrl('');
    setProjectSignature('');
    setLastPublishedSignature(null);
    setExportResult('');
    setShowExportModal(false);
    setPanelSrc('/panel/site');
    lastOnboardingSyncSignatureRef.current = '';

    try {
      await fetch(`${BACKEND_URL}/api/update-site-meta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Meine Website',
          siteLogoUrl: '',
          footerLine1: '',
          footerLine2: '',
          footerLine3: '',
        }),
      });

      await fetch(`${BACKEND_URL}/api/reset-pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pages: DEFAULT_PAGES
            .filter((p) => p.selected)
            .map((p) => ({ slug: p.id, title: p.title })),
        }),
      });

      const defaultDesignKey = 'minimalist';
      const defaultVibe = getDefaultVibeForStyle(defaultDesignKey);
      await fetch(`${BACKEND_URL}/api/update-theme`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          design: defaultDesignKey,
          vibeId: defaultVibe?.id,
          fontHeading: defaultVibe?.headingFont,
          fontBody: defaultVibe?.bodyFont,
          colorPrimary: defaultVibe?.accent,
          colorBg: defaultVibe?.bg,
          colorText: defaultVibe?.text,
        }),
      });

      const createRes = await fetch(`${BACKEND_URL}/api/projects/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectPath,
          state: {
            projectName: '',
            siteLogoUrl: '',
            selectedDesign: 'minimalist',
            selectedVibeId: getDefaultVibeForStyle('minimalist')?.id || 'M-01',
            hostingProvider: TEST_HOSTING_DEFAULTS.hostingProvider,
            connectionType: TEST_HOSTING_DEFAULTS.connectionType,
            ftpServer: TEST_HOSTING_DEFAULTS.ftpServer,
            ftpUser: TEST_HOSTING_DEFAULTS.ftpUser,
            ftpPassword: TEST_HOSTING_DEFAULTS.ftpPassword,
            ftpPort: TEST_HOSTING_DEFAULTS.ftpPort,
            websiteUrl: TEST_HOSTING_DEFAULTS.websiteUrl,
            targetPath: TEST_HOSTING_DEFAULTS.targetPath,
            footerLine1: '',
            footerLine2: '',
            footerLine3: '',
            setupDone: false,
            isLive: false,
            lastPublishedViewUrl: '',
            lastPublishedSignature: null,
          },
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok || !createData?.success || !createData?.project?.id) {
        setProjectError(createData?.error || 'Projekt konnte im gewählten Ordner nicht gespeichert werden.');
        return;
      }

      setCurrentProjectId(createData.project.id);
      setCurrentProjectPath(String(createData.project.path || ''));
      await refreshProjects();
      setStep('config');
    } catch (err) {
      console.error('Neues-Projekt-Reset fehlgeschlagen:', err);
      setProjectError('Projekt konnte im gewählten Ordner nicht gespeichert werden.');
    } finally {
      isResettingProjectRef.current = false;
    }
  };

  const startNewProject = async () => {
    setProjectError('');
    const baseRoot = await ensureDefaultProjectsRoot();
    if (!baseRoot) return;

    const chosenPath = await requestAllocatedProjectPath(baseRoot);
    if (!chosenPath) return;

    await performStartNewProject(chosenPath);
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

  const localPreviewUrl = 'http://127.0.0.1:8000/';
  const selectedHostingPreset = getHostingPreset(hostingProvider);
  const serverPlaceholder = selectedHostingPreset.server
    ? `z.B. ${selectedHostingPreset.server}`
    : 'z.B. ftp.dein-anbieter.ch';
  const websiteViewUrl = String(lastPublishedViewUrl || '').trim() || (isLive ? buildWebsiteViewUrl(websiteUrl, targetPath) : '');
  const canOpenWebsite = isLive && Boolean(websiteViewUrl);

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
      siteLogoUrl: String(siteLogoUrl || '').trim(),
      pages: pages.map((p) => ({ id: p.id, title: p.title, selected: p.selected })),
      design: { selectedDesign, selectedVibeId },
      contentSignature: signatureValue || '',
      footer: {
        footerLine1: footerLine1.trim(),
        footerLine2: footerLine2.trim(),
        footerLine3: footerLine3.trim(),
      },
      hosting: {
        hostingProvider,
        connectionType,
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
    exportResult.toLowerCase().includes('fehler') ||
    exportResult.toLowerCase().includes('fehlgeschlagen') ||
    exportResult.toLowerCase().includes('hoppla');
  const buildOnboardingSyncSignature = () =>
    JSON.stringify({
      projectName: projectName.trim(),
      siteLogoUrl: String(siteLogoUrl || '').trim(),
      pages: pages.map((p) => ({ id: p.id, title: p.title, selected: p.selected })),
      design: { selectedDesign, selectedVibeId },
      footer: {
        footerLine1: footerLine1.trim(),
        footerLine2: footerLine2.trim(),
        footerLine3: footerLine3.trim(),
      },
    });

  const syncProjectStateToKirby = async ({ includeAccount = false, syncPages = true } = {}) => {
    if (includeAccount) {
      await fetch(`${BACKEND_URL}/api/ensure-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    }

    await fetch(`${BACKEND_URL}/api/update-site-meta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: projectName,
        siteLogoUrl,
        footerLine1,
        footerLine2,
        footerLine3,
      }),
    });

    if (syncPages) {
      await syncPagesToKirby(pages);
    }

    const vibe = getSelectedVibe(selectedDesign, selectedVibeId);
    await fetch(`${BACKEND_URL}/api/update-theme`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        design: selectedDesign,
        vibeId: vibe?.id,
        fontHeading: vibe?.headingFont,
        fontBody: vibe?.bodyFont,
        colorPrimary: vibe?.accent,
        colorBg: vibe?.bg,
        colorText: vibe?.text,
      }),
    });
  };

  const handleOpenLocalPreview = () => {
    const initialUrl = `${localPreviewUrl}?preview=${Date.now()}`;
    const previewTab = window.open('about:blank', '_blank');
    if (!previewTab) {
      // Popup blocked: fallback open without tab handle.
      window.open(initialUrl, '_blank');
      return;
    }

    const navigatePreview = (url) => {
      try {
        previewTab.location.replace(url);
      } catch {
        window.open(url, '_blank');
      }
    };

    // Navigate immediately to avoid staying on about:blank.
    navigatePreview(initialUrl);

    (async () => {
      try {
        await fetchPagesFromKirbyContent({ applyState: true });
        await syncProjectStateToKirby({ syncPages: false });
        const refreshedUrl = `${localPreviewUrl}?preview=${Date.now()}`;
        if (!previewTab.closed) {
          navigatePreview(refreshedUrl);
        }
      } catch (err) {
        console.warn('Lokale Vorschau: Sync fehlgeschlagen:', err);
      }
    })();
  };

  const goToEditorWithSync = async () => {
    const currentSyncSignature = buildOnboardingSyncSignature();
    if (currentSyncSignature === lastOnboardingSyncSignatureRef.current) {
      setStep('editor');
      return;
    }

    setIsSettingUp(true);
    try {
      await syncProjectStateToKirby({ syncPages: step === 'pages' });
      lastOnboardingSyncSignatureRef.current = currentSyncSignature;
      await saveCurrentProject();
    } catch (err) {
      console.error('Sync vor Editor fehlgeschlagen:', err);
    } finally {
      setIsSettingUp(false);
    }
    setStep('editor');
  };

  /* ---- Hosting Setup (invisible Kirby account) ---- */
  const handleHostingComplete = async () => {
    setIsSettingUp(true);
    try {
      await syncProjectStateToKirby({ includeAccount: true, syncPages: !setupDone });
      lastOnboardingSyncSignatureRef.current = buildOnboardingSyncSignature();
      await saveCurrentProject();
    } catch (err) {
      console.error('Setup error:', err);
    }
    setIsSettingUp(false);
    setSetupDone(true);
    setKirbyReady(false);
    setStep('editor');
  };

  /* ---- Export / Publish ---- */
  const handleExport = async () => {
    setIsExporting(true);
    setExportResult('');
    const normalizedWebsiteUrl = normalizeWebsiteUrlInput(websiteUrl);
    let effectiveSignature = projectSignature;
    if (normalizedWebsiteUrl !== websiteUrl) {
      setWebsiteUrl(normalizedWebsiteUrl);
    }
    let timeout = null;
    try {
      // Persist current UI state first so design/footer changes survive crashes or failed deploys.
      await saveCurrentProject();

      const vibe = getSelectedVibe(selectedDesign, selectedVibeId);
      await fetch(`${BACKEND_URL}/api/update-theme`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          design: selectedDesign,
          vibeId: vibe?.id,
          fontHeading: vibe?.headingFont,
          fontBody: vibe?.bodyFont,
          colorPrimary: vibe?.accent,
          colorBg: vibe?.bg,
          colorText: vibe?.text,
        }),
      });

      await fetch(`${BACKEND_URL}/api/update-site-meta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: projectName,
          siteLogoUrl,
          footerLine1,
          footerLine2,
          footerLine3,
        }),
      });

      const latestProjectSignature = await fetchProjectSignature();
      effectiveSignature = latestProjectSignature ?? projectSignature;

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
          port: parseInt(ftpPort, 10) || parseInt(CONNECTION_TYPES[connectionType]?.defaultPort || '21', 10),
          websiteUrl: normalizedWebsiteUrl,
          targetPath,
          deployMode: 'auto',
          siteTitle: projectName,
          footerLine1,
          footerLine2,
          footerLine3,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        const syncedPages = await fetchPagesFromKirbyContent({ applyState: false });
        if (syncedPages.length) {
          setPages(syncedPages);
        }
        setExportResult('Deine Website ist jetzt live!');
        setIsLive(true);
        const postDeploySignature = await fetchProjectSignature();
        const finalSignature = postDeploySignature ?? effectiveSignature;
        if (finalSignature) {
          setProjectSignature(finalSignature);
        }
        const publishedViewUrl =
          buildWebsiteViewUrlFromTrigger(data.triggerUrl) ||
          buildWebsiteViewUrl(normalizedWebsiteUrl, targetPath);
        const nextPublishedSignature = buildPublishSignature(normalizedWebsiteUrl, finalSignature);
        setLastPublishedViewUrl(publishedViewUrl);
        setLastPublishedSignature(nextPublishedSignature);
        await saveCurrentProject('', '', {
          ...collectProjectState(),
          isLive: true,
          lastPublishedViewUrl: publishedViewUrl,
          lastPublishedSignature: nextPublishedSignature,
        });
      } else {
        setIsLive(false);
        setExportResult(`Fehler: ${mapDeployErrorToUserMessage(data?.error || data?.log || '')}`);
      }
    } catch (err) {
      if (err?.name === 'AbortError') {
        setIsLive(false);
        setExportResult('Fehler: Verbindung abgebrochen (Timeout). Bitte Daten prüfen und erneut versuchen.');
      } else {
        setIsLive(false);
        setExportResult(`Fehler: ${mapDeployErrorToUserMessage(err?.message || '')}`);
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
      setPages([...pages, { id: slug || `page-${Date.now()}`, title: newPageName.trim(), selected: true }]);
      setNewPageName('');
    }
  };

  const togglePage = (id) => {
    const selectedCount = pages.filter((p) => p.selected).length;
    setPages(
      pages.map((p) => {
        if (p.id !== id) return p;
        if (p.selected && selectedCount <= 1) return p;
        return { ...p, selected: !p.selected };
      })
    );
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

  const activeVibe = getSelectedVibe(selectedDesign, selectedVibeId);
  const activeStyleVibes = getVibesForStyle(selectedDesign);

  const handleDesignStyleChange = (styleKey) => {
    const fallbackVibe = getDefaultVibeForStyle(styleKey);
    setSelectedDesign(styleKey);
    setSelectedVibeId(fallbackVibe?.id || '');
  };

  const completedSteps = {
    config: projectName.trim().length > 0,
    pages: pages.some((page) => page.selected && String(page.id || '').trim() && String(page.title || '').trim()),
    design: Boolean(DESIGN_STYLES[selectedDesign]) && Boolean(activeVibe?.id),
    account:
      ftpServer.trim().length > 0 &&
      ftpUser.trim().length > 0 &&
      String(ftpPassword || '').trim().length > 0 &&
      String(ftpPort || '').trim().length > 0,
    editor: step === 'editor' || setupDone || kirbyReady,
  };
  const projectNameInHeader = projectName.trim() || (currentProjectId ? 'Unbenanntes Projekt' : '');
  const appFooterYear = new Date().getFullYear();
  const diagnosticServices = diagnostics?.health
    ? [
      diagnostics.health.backend,
      diagnostics.health.frontend,
      diagnostics.health.kirby,
    ].filter(Boolean)
    : [];
  const diagnosticPreflightChecks = diagnostics?.preflight?.checks
    ? Object.values(diagnostics.preflight.checks).filter(Boolean)
    : [];
  const diagnosticIssues = Array.isArray(diagnostics?.issues) ? diagnostics.issues : [];
  const safeModeHeadline =
    diagnostics?.source === 'startup-preflight'
      ? 'System-Preflight fehlgeschlagen'
      : 'Server reagiert nicht stabil';
  const safeModeDescription =
    diagnosticIssues[0]?.message
      ? String(diagnosticIssues[0].message)
      : 'Backend war mehrfach nicht erreichbar. Starte die Systemdiagnose und folge den Recovery-Schritten.';

  /* ========================================================================
     RENDER
     ======================================================================== */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-color)' }}>
      {safeMode && (
        <div style={{
          position: 'fixed',
          right: '1rem',
          bottom: '1rem',
          width: 'min(520px, calc(100vw - 2rem))',
          zIndex: 1000,
          border: '1px solid rgba(255,87,87,0.45)',
          background: 'rgba(23, 8, 8, 0.96)',
          borderRadius: '12px',
          padding: '1rem 1rem 0.9rem',
          color: '#ffd6d6',
          boxShadow: '0 16px 42px rgba(0,0,0,0.55)'
        }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.4rem' }}>{safeModeHeadline}</div>
          <div style={{ color: '#ffbcbc', fontSize: '0.84rem', marginBottom: '0.75rem', lineHeight: 1.4 }}>
            {safeModeDescription}
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            <button
              type="button"
              onClick={runSystemDiagnostics}
              disabled={isRunningDiagnostics || isRestartingServices || isReportingIssue}
              style={{
                background: '#ff4d4f',
                border: 'none',
                color: 'white',
                padding: '0.46rem 0.78rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: isRunningDiagnostics || isRestartingServices || isReportingIssue ? 'not-allowed' : 'pointer',
                opacity: isRunningDiagnostics || isRestartingServices || isReportingIssue ? 0.65 : 1
              }}
            >
              {isRunningDiagnostics ? 'Diagnose läuft…' : 'Systemdiagnose starten'}
            </button>

            <button
              type="button"
              onClick={restartSystemServices}
              disabled={isRunningDiagnostics || isRestartingServices || isReportingIssue}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.25)',
                color: '#ffd6d6',
                padding: '0.46rem 0.72rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                cursor: isRunningDiagnostics || isRestartingServices || isReportingIssue ? 'not-allowed' : 'pointer',
                opacity: isRunningDiagnostics || isRestartingServices || isReportingIssue ? 0.65 : 1
              }}
            >
              {isRestartingServices ? 'Dienste werden neu gestartet…' : 'Dienste neu starten'}
            </button>

            <button
              type="button"
              onClick={reportSystemIssue}
              disabled={isRunningDiagnostics || isRestartingServices || isReportingIssue}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.25)',
                color: '#ffd6d6',
                padding: '0.46rem 0.72rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                cursor: isRunningDiagnostics || isRestartingServices || isReportingIssue ? 'not-allowed' : 'pointer',
                opacity: isRunningDiagnostics || isRestartingServices || isReportingIssue ? 0.65 : 1
              }}
            >
              {isReportingIssue ? 'Problem wird gemeldet…' : 'Problem melden'}
            </button>
          </div>

          {issueReportFeedback && (
            <div style={{ fontSize: '0.74rem', color: '#f3c7c7', lineHeight: 1.45, marginBottom: '0.65rem' }}>
              {issueReportFeedback}
            </div>
          )}

          {diagnosticServices.length > 0 && (
            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '0.7rem' }}>
              {diagnosticServices.map((service) => {
                const up = Boolean(service?.up);
                const label = String(service?.service || 'service');
                return (
                  <span
                    key={label}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontSize: '0.76rem',
                      padding: '0.26rem 0.52rem',
                      borderRadius: '999px',
                      background: up ? 'rgba(80,200,120,0.16)' : 'rgba(255,87,87,0.16)',
                      color: up ? '#9ff0bf' : '#ffb5b5',
                      border: `1px solid ${up ? 'rgba(80,200,120,0.35)' : 'rgba(255,87,87,0.35)'}`
                    }}
                  >
                    <span>{label}</span>
                    <strong>{up ? 'OK' : 'DOWN'}</strong>
                  </span>
                );
              })}
            </div>
          )}

          {diagnosticPreflightChecks.length > 0 && (
            <div style={{ marginBottom: '0.7rem' }}>
              <div style={{ fontSize: '0.74rem', color: '#f3c7c7', marginBottom: '0.34rem' }}>
                Preflight:
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {diagnosticPreflightChecks.map((check) => {
                  const ok = Boolean(check?.ok);
                  const label = String(check?.label || check?.id || 'check');
                  return (
                    <span
                      key={String(check?.id || label)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.34rem',
                        fontSize: '0.72rem',
                        padding: '0.22rem 0.46rem',
                        borderRadius: '999px',
                        background: ok ? 'rgba(80,200,120,0.16)' : 'rgba(255,167,38,0.16)',
                        color: ok ? '#9ff0bf' : '#ffd5a1',
                        border: `1px solid ${ok ? 'rgba(80,200,120,0.32)' : 'rgba(255,167,38,0.32)'}`
                      }}
                      title={String(check?.message || '')}
                    >
                      <span>{label}</span>
                      <strong>{ok ? 'OK' : 'WARN'}</strong>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {diagnosticIssues.length > 0 && (
            <div style={{ fontSize: '0.74rem', color: '#f3c7c7', lineHeight: 1.45, marginBottom: '0.65rem' }}>
              {diagnosticIssues.slice(0, 3).map((issue, index) => (
                <div key={`${issue?.code || 'issue'}-${index}`}>
                  <code>{String(issue?.code || 'ISSUE')}</code> {String(issue?.message || '')}
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize: '0.74rem', color: '#e4b3b3', lineHeight: 1.5 }}>
            Recovery:
            {diagnostics?.recoverySteps?.map((stepCmd) => (
              <div key={stepCmd}><code>{stepCmd}</code></div>
            ))}
            {!diagnostics?.recoverySteps?.length && (
              <div><code>npm run dev:bg:ensure</code></div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================
          TOP NAVIGATION BAR (visible after welcome)
          ================================================================ */}
      {step !== 'welcome' && (
        <header className="glass-panel fade-in" style={{
          padding: '1rem 2rem', display: 'flex', alignItems: 'center', gap: '1.1rem',
          borderBottom: '1px solid var(--border-color)', borderRadius: 0, position: 'sticky', top: 0, zIndex: 10
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.28rem', minWidth: 0, maxWidth: 'clamp(300px, 38vw, 580px)' }}>
            <button
              type="button"
              aria-label={`${BRAND_NAME} Startseite`}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
              onClick={async () => {
                setShowProjectList(false);
                setProjectError('');
                if (currentProjectId && !isResettingProjectRef.current) {
                  try {
                    await fetch(`${BACKEND_URL}/api/update-site-meta`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        title: projectName,
                        siteLogoUrl,
                        footerLine1,
                        footerLine2,
                        footerLine3,
                      }),
                    });
                  } catch {
                    // ignore best-effort flush
                  }
                  try {
                    await saveCurrentProject();
                  } catch {
                    // ignore save errors on welcome-navigation
                  }
                }
                setStep('welcome');
              }}
            >
              <img src={BRAND_WORDMARK_DARK} alt={BRAND_NAME} style={{ height: '42px', width: 'auto', display: 'block' }} />
            </button>
            {projectNameInHeader && (
              <div
                title={projectNameInHeader}
                style={{
                  display: 'inline-flex',
                  alignItems: 'baseline',
                  justifyContent: 'flex-start',
                  gap: '0.35rem',
                  maxWidth: '100%',
                  overflow: 'hidden',
                  fontSize: '0.74rem',
                  lineHeight: 1.2
                }}
              >
                <span style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
                  Projekt:
                </span>
                <span style={{
                  color: 'var(--text-primary)',
                  fontWeight: 700,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {projectNameInHeader}
                </span>
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '2rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            {navItems.map((nav) => {
              const isActive = step === nav.state || (nav.label === 'Übersicht' && step === 'provider');
              return (
                <span key={nav.label} onClick={() => {
                  if (nav.state === 'pages') {
                    fetchPagesFromKirbyContent({ applyState: true }).catch(() => {});
                  }
                  if (nav.state === 'editor') {
                    goToEditorWithSync();
                    return;
                  }
                  setStep(nav.state);
                }} style={{
                  color: isActive ? 'var(--text-primary)' : 'inherit',
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer', opacity: isActive ? 1 : 0.6, transition: 'opacity 0.2s',
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem'
                }}
                  onMouseOver={(e) => !isActive && (e.currentTarget.style.opacity = '1')}
                  onMouseOut={(e) => !isActive && (e.currentTarget.style.opacity = '0.6')}
                >
                  <span>{nav.label}</span>
                  {completedSteps[nav.state] && (
                    <span
                      aria-label={`${nav.label} erledigt`}
                      title={`${nav.label} erledigt`}
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(140,198,63,0.18)',
                        color: '#8cc63f',
                        border: '1px solid rgba(140,198,63,0.4)',
                        fontSize: '11px',
                        lineHeight: 1,
                        fontWeight: 700
                      }}
                    >
                      ✓
                    </span>
                  )}
                </span>
              );
            })}
          </div>

          {/* Status */}
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
            <img
              src={BRAND_WORDMARK_DARK}
              alt={BRAND_NAME}
              style={{ width: 'min(560px, 92vw)', height: 'auto', display: 'block', margin: '0 auto 0.45rem', transform: 'translateX(0.45rem)' }}
            />
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', marginBottom: '3rem', lineHeight: '1.6', marginTop: 0 }}>
              Your Content. Your Computer. Your Web.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button className="btn-primary fade-in" style={{ padding: '1rem 2rem', fontSize: '1.1rem', minWidth: '220px', boxShadow: '0 8px 20px rgba(79, 172, 254, 0.3)' }}
                onClick={startNewProject}>
                Projekt starten
              </button>
              <button className="btn-outline fade-in" style={{ padding: '1rem 2rem', fontSize: '1.1rem', minWidth: '220px', background: 'rgba(255,255,255,0.05)' }}
                onClick={async () => {
                  setProjectError('');
                  setShowProjectList(true);
                  await refreshProjects();
                }}>
                Projekt fortsetzen
              </button>
            </div>
            {projectError && !showProjectList && (
              <div style={{ color: '#ff8080', fontSize: '0.9rem', marginTop: '0.9rem' }}>{projectError}</div>
            )}
            {showProjectList && (
              <div
                className="fade-in"
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0, 0, 0, 0.55)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1200,
                  padding: '1rem'
                }}
                onClick={() => {
                  setShowProjectList(false);
                  setProjectError('');
                }}
              >
                <div
                  className="glass-panel"
                  style={{
                    width: '100%',
                    maxWidth: '760px',
                    borderRadius: '12px',
                    padding: '1rem',
                    textAlign: 'left',
                    maxHeight: '84vh',
                    overflow: 'auto'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.7rem' }}>
                    <strong style={{ fontSize: '1rem' }}>Bestehende Projekte</strong>
                    <button
                      className="btn-outline"
                      style={{ padding: '0.35rem 0.7rem', fontSize: '0.75rem' }}
                      onClick={() => {
                        setShowProjectList(false);
                        setProjectError('');
                      }}
                      disabled={isOpeningProject}
                    >
                      Schliessen
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                      className="btn-outline"
                      style={{ padding: '0.45rem 0.8rem', fontSize: '0.78rem' }}
                      onClick={refreshProjects}
                      disabled={isLoadingProjects || isOpeningProject}
                    >
                      Aktualisieren
                    </button>
                    <button
                      className="btn-primary"
                      style={{ padding: '0.45rem 0.8rem', fontSize: '0.78rem' }}
                      onClick={async () => {
                        setProjectError('');
                        const chosenProjectFolder = await pickFolder('Wähle deinen Projektordner', defaultProjectsRoot);
                        if (chosenProjectFolder) {
                          await openExistingProject({ projectPath: chosenProjectFolder });
                        }
                      }}
                      disabled={isOpeningProject}
                    >
                      Einen anderen Ordner wählen
                    </button>
                  </div>
                  {projectError && (
                    <div style={{ color: '#ff8080', fontSize: '0.85rem', marginBottom: '0.6rem' }}>{projectError}</div>
                  )}
                  {isLoadingProjects ? (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Lade Projekte...</div>
                  ) : projects.length === 0 ? (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Noch kein gespeichertes Projekt gefunden.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                      {projects.map((project) => (
                        <button
                          key={project.id}
                          className="btn-outline"
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0.6rem 0.8rem',
                            fontSize: '0.85rem',
                            textAlign: 'left'
                          }}
                          onClick={() => openExistingProject({ projectId: project.id })}
                          disabled={isOpeningProject}
                        >
                          <span style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{project.name || 'Unbenanntes Projekt'}</span>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>{formatProjectPath(project.path)}</span>
                          </span>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                            {formatProjectDate(project.updatedAt || project.createdAt)}
                            {project.id === currentProjectId ? ' · aktiv' : ''}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '0.8rem',
              marginTop: '2rem',
              textAlign: 'left'
            }}>
              {[
                { title: 'Kein Klick-Chaos', text: 'Konzentrier dich auf deine Inhalte statt auf komplizierte Menüs.' },
                { title: 'Arbeiten in Echtzeit', text: 'Änderungen siehst du direkt auf deinem Rechner.' },
                { title: 'Echte Freiheit', text: 'Deine Website gehört dir und bleibt unabhängig vom Anbieter.' },
                { title: 'Design mit Haltung', text: 'Wähle aus vier starken Looks und wirke sofort professionell.' },
              ].map((item) => (
                <div key={item.title} style={{
                  border: '1px solid var(--border-color)',
                  background: 'var(--surface-color)',
                  borderRadius: '8px',
                  padding: '0.75rem 0.9rem'
                }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.25rem' }}>{item.title}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>{item.text}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ====== STEP: PROJECT NAME ====== */}
        {step === 'config' && (
          <div className="glass-panel fade-in" style={{ maxWidth: '600px', width: '100%', padding: '3rem', borderRadius: '12px' }}>
            <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Wie soll deine Website heissen?</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Dieser Name erscheint auch oben als dein Logo auf der Website.</p>
            <div className="input-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Website-Name</label>
              <input type="text" placeholder="z.B. Sarahs Fotografie" value={projectName}
                onChange={e => setProjectName(e.target.value)} autoFocus />
            </div>
            <div className="input-group" style={{ marginTop: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Eigenes Logo (optional)
              </label>
              {siteLogoUrl && (
                <div style={{ marginBottom: '0.65rem', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--surface-color)' }}>
                  <img
                    src={siteLogoUrl}
                    alt="Eigenes Website-Logo"
                    style={{ display: 'block', maxHeight: '72px', width: 'auto', maxWidth: '100%', margin: '0.6rem auto', objectFit: 'contain' }}
                  />
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                <label className="btn-outline" style={{ padding: '0.62rem 1rem', cursor: isUploadingSiteLogo ? 'not-allowed' : 'pointer', opacity: isUploadingSiteLogo ? 0.65 : 1 }}>
                  {isUploadingSiteLogo ? 'Logo wird hochgeladen…' : 'Logo auswählen'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleSiteLogoUpload}
                    disabled={isUploadingSiteLogo}
                    style={{ display: 'none' }}
                  />
                </label>
                {siteLogoUrl && (
                  <button
                    type="button"
                    className="btn-outline"
                    style={{ padding: '0.62rem 1rem' }}
                    onClick={removeSiteLogo}
                    disabled={isUploadingSiteLogo}
                  >
                    Logo entfernen
                  </button>
                )}
              </div>
              <p style={{ marginTop: '0.45rem', marginBottom: 0, color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                Empfohlen: PNG/SVG mit transparentem Hintergrund, max. {SITE_LOGO_MAX_MB} MB.
                Wenn gesetzt, wird das Bild statt des Text-Logos auf der Website angezeigt.
              </p>
              {siteLogoError && (
                <p style={{ marginTop: '0.45rem', marginBottom: 0, color: '#ff8080', fontSize: '0.8rem' }}>{siteLogoError}</p>
              )}
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
            <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Welche Seiten brauchst du?</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              Du kannst Seiten per Drag-and-Drop sortieren oder per Doppelklick umbenennen.
            </p>

            {/* Page List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '2rem' }}>
              {pages.map((page, index) => (
                <div key={page.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                  onDrop={() => handleDrop(index)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.8rem 1rem',
                    background: dragOverIndex === index ? 'rgba(79,172,254,0.15)' : page.selected ? 'rgba(79, 172, 254, 0.08)' : 'var(--surface-color)',
                    border: dragOverIndex === index ? '1px dashed var(--accent-color)' : page.selected ? '1px solid rgba(79,172,254,0.3)' : '1px solid var(--border-color)',
                    borderRadius: '8px', cursor: 'grab',
                    opacity: dragIndex === index ? 0.4 : 1, transition: 'all 0.15s'
                  }}>
                  {/* Drag Handle */}
                  <span style={{ color: 'var(--text-secondary)', fontSize: '1rem', cursor: 'grab', userSelect: 'none' }}>⠿</span>
                  {/* Checkbox */}
                  <div onClick={() => togglePage(page.id)} style={{
                    width: '20px', height: '20px', borderRadius: '4px', flexShrink: 0,
                    background: page.selected ? 'var(--accent-color, #4facfe)' : 'transparent',
                    border: page.selected ? 'none' : '1px solid var(--text-secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer'
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
                    <span onDoubleClick={() => startRename(page)} style={{
                      flex: 1, color: page.selected ? 'var(--text-primary)' : 'var(--text-secondary)',
                      cursor: 'text'
                    }}>
                      {page.title}
                    </span>
                  )}
                  {/* Remove Button */}
                  <span onClick={() => removePage(page.id)} style={{
                    color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.1rem',
                    opacity: 0.5, transition: 'opacity 0.2s'
                  }} onMouseOver={e => e.target.style.opacity = 1} onMouseOut={e => e.target.style.opacity = 0.5}>
                    ✕
                  </span>
                </div>
              ))}
            </div>

            {/* Add Page */}
            <form onSubmit={handleAddPage} style={{ display: 'flex', gap: '1rem' }}>
              <input type="text" placeholder="Neue Seite hinzufügen" value={newPageName}
                onChange={e => setNewPageName(e.target.value)} style={{ flex: 1 }} />
              <button type="submit" className="btn-outline" style={{ padding: '0.8rem 1.5rem', whiteSpace: 'nowrap' }}>
                Hinzufügen
              </button>
            </form>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '1rem', textAlign: 'center' }}>
              Doppelklick auf einen Namen zum Umbenennen · Ziehen zum Sortieren
            </p>

            <button
              className="btn-primary"
              style={{ width: '100%', padding: '1rem', marginTop: '2rem' }}
              onClick={() => {
                if (setupDone) {
                  goToEditorWithSync();
                  return;
                }
                setStep('design');
              }}
              disabled={setupDone && isSettingUp}
            >
              {setupDone ? (isSettingUp ? 'Synchronisiere...' : 'Zurück zur Übersicht') : 'Weiter zum Design'}
            </button>
          </div>
        )}

        {/* ====== STEP: DESIGN ====== */}
        {step === 'design' && (
          <div className="fade-in" style={{ maxWidth: '1000px', width: '100%', padding: '2rem' }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem', textAlign: 'center' }}>Dein Stil</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '3rem', textAlign: 'center' }}>
              Wähle einen Grundstil und dann eine Vibe-Karte. Du siehst sofort ein fertiges Design.
            </p>

            {/* Theme Grid with Visual Previews */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem', marginBottom: '3rem' }}>
              {Object.entries(DESIGN_STYLES).map(([key, style]) => {
                const previewVibe = key === selectedDesign ? activeVibe : getDefaultVibeForStyle(key);
                return (
                <div key={key} onClick={() => handleDesignStyleChange(key)} className="theme-card" style={{
                  cursor: 'pointer', background: 'var(--surface-color)', padding: '1rem', borderRadius: '12px',
                  border: selectedDesign === key ? '2px solid #4facfe' : '1px solid var(--border-color)',
                  transition: 'all 0.2s', boxShadow: selectedDesign === key ? '0 0 20px rgba(79,172,254,0.15)' : 'none'
                }}>
                  {/* Visual Preview */}
                  <MiniSitePreview styleKey={key} vibe={previewVibe} />
                  {/* Theme Info */}
                  <div style={{ marginTop: '0.8rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                      {style.name}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {style.description}
                    </div>
                  </div>
                </div>
              )})}
            </div>

            {/* Vibe cards (4 per style) */}
            <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem', textAlign: 'center' }}>
              Wie soll es sich anfühlen? ({DESIGN_STYLES[selectedDesign]?.name})
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.9rem', marginBottom: '3rem' }}>
              {activeStyleVibes.map((vibe) => (
                <button
                  key={vibe.id}
                  type="button"
                  onClick={() => setSelectedVibeId(vibe.id)}
                  style={{
                    textAlign: 'left',
                    borderRadius: '10px',
                    border: selectedVibeId === vibe.id ? `2px solid ${vibe.accent}` : '1px solid var(--border-color)',
                    background: selectedVibeId === vibe.id ? 'rgba(79,172,254,0.08)' : 'var(--surface-color)',
                    padding: '0.85rem 0.9rem',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.55rem' }}>
                    <span style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>{vibe.id}</span>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: vibe.accent, display: 'inline-block' }}></span>
                  </div>
                  <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '0.55rem' }}>
                    {vibe.label}
                  </div>
                  <div style={{ display: 'flex', gap: '0.45rem' }}>
                    <span style={{ width: '16px', height: '16px', borderRadius: '4px', background: vibe.bg, border: '1px solid rgba(255,255,255,0.2)' }}></span>
                    <span style={{ width: '16px', height: '16px', borderRadius: '4px', background: vibe.text, border: '1px solid rgba(255,255,255,0.2)' }}></span>
                    <span style={{ width: '16px', height: '16px', borderRadius: '4px', background: vibe.accent, border: '1px solid rgba(255,255,255,0.2)' }}></span>
                  </div>
                </button>
              ))}
            </div>

            {/* Full-Size Live Preview */}
            <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem', textAlign: 'center' }}>Vorschau</h3>
            <LivePreview styleKey={selectedDesign} vibe={activeVibe} projectName={projectName} />

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '3rem' }}>
              <button className="btn-primary" style={{ padding: '1rem 3rem' }}
                onClick={() => {
                  if (setupDone) {
                    goToEditorWithSync();
                    return;
                  }
                  setStep('account');
                }}>
                {setupDone ? 'Zurück zur Übersicht' : 'Weiter zum Hosting'}
              </button>
            </div>
          </div>
        )}

        {/* ====== STEP: HOSTING / ACCOUNT ====== */}
        {step === 'account' && (
          <div className="glass-panel fade-in" style={{ maxWidth: '600px', width: '100%', padding: '3rem', borderRadius: '12px' }}>
            <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Wo soll dein Web wohnen?</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              Trage hier die Zugangsdaten deines Anbieters ein. {BRAND_NAME} kümmert sich um den Rest.
            </p>

            <div style={{
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              background: 'rgba(255,255,255,0.03)',
              marginBottom: '1.2rem'
            }}>
              <button
                type="button"
                onClick={() => setShowHostingWhy((prev) => !prev)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  padding: '0.75rem 0.9rem',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem' }}>
                  <HelpBadgeIcon label="Warum brauche ich Hosting?" />
                  <span>Warum brauche ich Hosting?</span>
                </span>
                <span style={{ opacity: 0.7 }}>{showHostingWhy ? '−' : '+'}</span>
              </button>
              {showHostingWhy && (
                <div style={{ padding: '0 0.9rem 0.9rem', color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: 1.55 }}>
                  Damit deine Website im Internet erreichbar ist, muss sie auf einen Webserver hochgeladen werden.
                  Dafür braucht {BRAND_NAME} einmalig die Zugangsdaten deines Anbieters.
                  <br />
                  Deine Inhalte bearbeitest du weiterhin lokal in {BRAND_NAME}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <div className="input-group" style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Provider</label>
                <select value={hostingProvider} onChange={(e) => handleHostingProviderChange(e.target.value)}>
                  {Object.values(HOSTING_PROVIDER_PRESETS).map((provider) => (
                    <option key={provider.id} value={provider.id}>{provider.label}</option>
                  ))}
                </select>
              </div>
              <div className="input-group" style={{ width: '180px' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Verbindungsart</label>
                <select value={connectionType} onChange={(e) => handleConnectionTypeChange(e.target.value)}>
                  {Object.entries(CONNECTION_TYPES).map(([key, info]) => (
                    <option key={key} value={key}>{info.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              className="btn-outline"
              style={{ marginBottom: '1rem', fontSize: '0.82rem', padding: '0.45rem 0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              onClick={() => setShowProviderGuide(true)}
            >
              <HelpBadgeIcon label="Provider-Hilfe" />
              Du weisst nicht, wo du diese Daten findest?
            </button>

            <div className="input-group" style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Server-Adresse</label>
              <input type="text" placeholder={serverPlaceholder} value={ftpServer} onChange={e => setFtpServer(e.target.value)} />
            </div>
            <div className="input-group" style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Website-Adresse</label>
              <input
                type="text"
                placeholder="z.B. swiss-ai-community.ch"
                value={websiteUrl}
                onChange={e => setWebsiteUrl(e.target.value)}
                onBlur={e => setWebsiteUrl(normalizeWebsiteUrlInput(e.target.value))}
              />
            </div>
            <div className="input-group" style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Speicherort</label>
              <input type="text" placeholder={`${selectedHostingPreset.targetPath} oder /mein-projekt`} value={targetPath} onChange={e => setTargetPath(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <div className="input-group" style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Benutzername</label>
                <input type="text" placeholder="Benutzername bei deinem Anbieter" value={ftpUser} onChange={e => setFtpUser(e.target.value)} />
              </div>
              <div className="input-group" style={{ width: '100px' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Port</label>
                <input type="text" placeholder={CONNECTION_TYPES[connectionType]?.defaultPort || '21'} value={ftpPort} onChange={e => handleFtpPortChange(e.target.value)} />
              </div>
            </div>
            <div className="input-group" style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Passwort</label>
                <input type="text" placeholder="Passwort bei deinem Anbieter" value={ftpPassword}
                  onChange={e => setFtpPassword(e.target.value)}
                  style={{ WebkitTextSecurity: 'disc' }} />
            </div>

            <button className="btn-primary" style={{ width: '100%', padding: '1rem', marginTop: '0.5rem' }}
              onClick={handleHostingComplete} disabled={isSettingUp}>
              {isSettingUp ? `${BRAND_NAME} richtet alles ein...` : 'Fertig einrichten & zur Übersicht'}
            </button>
          </div>
        )}

        {/* ====== STEP: EDITOR / DASHBOARD ====== */}
        {step === 'editor' && (
          <div className="fade-in" style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
            {/* Dashboard Toolbar */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '1rem 2rem', background: 'var(--surface-color)',
              borderBottom: '1px solid var(--border-color)'
            }}>
              {/* Left: compact design info */}
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Design: {DESIGN_STYLES[selectedDesign]?.name} · {activeVibe?.id} · {activeVibe?.label}
              </div>

              {/* Right: Actions */}
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', position: 'relative' }}>
                <button
                  className="btn-outline"
                  style={{ padding: '0.55rem 1.05rem', fontSize: '0.86rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                  onClick={handleOpenLocalPreview}
                  title="Öffnet deine lokale Vorschau ohne Upload"
                >
                  <span style={{ display: 'inline-flex', width: '16px', height: '16px', alignItems: 'center', justifyContent: 'center' }} aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  </span>
                  Vorschau
                </button>
                <button className="btn-primary" style={{
                  padding: '0.55rem 1.3rem',
                  fontSize: '0.86rem',
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #d73737, #b71f1f)',
                  borderColor: '#a01c1c',
                  boxShadow: publishButtonDisabled ? 'none' : '0 6px 14px rgba(183,31,31,0.35)',
                  opacity: publishButtonDisabled ? 0.45 : 1,
                  cursor: publishButtonDisabled ? 'not-allowed' : 'pointer',
                  filter: publishButtonDisabled ? 'grayscale(0.25)' : 'none'
                }}
                  onClick={() => setShowExportModal(true)}
                  disabled={publishButtonDisabled}>
                  {hasPendingPublishChanges ? 'Live schalten' : 'Live'}
                </button>

                <div style={{ position: 'relative' }}>
                  <button
                    className="btn-outline"
                    style={{ padding: '0.5rem 0.95rem', fontSize: '0.82rem' }}
                    onClick={() => setShowEditorActionsMenu((prev) => !prev)}
                  >
                    Mehr
                  </button>
                  {showEditorActionsMenu && (
                    <div style={{
                      position: 'absolute',
                      right: 0,
                      top: 'calc(100% + 0.45rem)',
                      minWidth: '210px',
                      background: 'rgba(20,20,20,0.95)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '10px',
                      boxShadow: '0 10px 24px rgba(0,0,0,0.32)',
                      padding: '0.45rem',
                      zIndex: 50,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem'
                    }}>
                      <button
                        className="btn-outline"
                        style={{ width: '100%', textAlign: 'left', fontSize: '0.8rem', padding: '0.5rem 0.65rem' }}
                        onClick={() => {
                          setShowEditorActionsMenu(false);
                          setStep('provider');
                        }}
                      >
                        Provider wechseln
                      </button>
                      <button
                        className="btn-outline"
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          fontSize: '0.8rem',
                          padding: '0.5rem 0.65rem',
                          opacity: canOpenWebsite ? 1 : 0.45,
                          cursor: canOpenWebsite ? 'pointer' : 'not-allowed'
                        }}
                        onClick={() => {
                          if (!canOpenWebsite) return;
                          setShowEditorActionsMenu(false);
                          handleOpenWebsite();
                        }}
                        disabled={!canOpenWebsite}
                        title={canOpenWebsite ? websiteViewUrl : 'Erst nach dem ersten Live-Schalten verfügbar'}
                      >
                        Website ansehen
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              flex: 1,
              minHeight: 0,
              gap: '0.9rem',
              padding: '0.9rem 2rem 1rem',
              alignItems: 'stretch'
            }}>
              {/* Kirby Editor Iframe */}
              <div style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                overflow: 'hidden',
                background: '#0f0f10',
                boxShadow: '0 8px 24px rgba(0,0,0,0.25)'
              }}>
                {kirbyReady ? (
                  <iframe
                    ref={panelFrameRef}
                    src={panelSrc}
                    style={{ width: '100%', flex: 1, border: 'none', minHeight: '600px', background: '#fff' }}
                    title="Kirby CMS Editor"
                    onLoad={refreshEditorFooterVisibility}
                  />
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#4facfe', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                    <p style={{ color: 'var(--text-secondary)' }}>Layout Editor wird gestartet...</p>
                    <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                  </div>
                )}
              </div>

              {/* Footer block in site overview context */}
              {showFooterPanelInEditor && (
                <aside style={{
                  width: '320px',
                  background: 'var(--surface-color)',
                  padding: '1rem',
                  overflowY: 'auto',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
                }}>
                  <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1rem' }}>Footer</h3>
                  <p style={{ margin: '0 0 1rem 0', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                    Diese Angaben werden auf deiner Website unten angezeigt.
                  </p>
                  <div className="input-group" style={{ marginBottom: '0.85rem' }}>
                    <label style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
                      Copyright Name (© + Jahr automatisch)
                    </label>
                    <input
                      type="text"
                      placeholder="z.B. Dein Name"
                      value={footerLine1}
                      onChange={e => setFooterLine1(e.target.value)}
                      style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem' }}
                    />
                  </div>
                  <div className="input-group" style={{ marginBottom: '0.85rem' }}>
                    <label style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
                      Instagram-Link
                    </label>
                    <input
                      type="text"
                      placeholder="z.B. instagram.com/deinprofil"
                      value={footerLine2}
                      onChange={e => setFooterLine2(e.target.value)}
                      style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem' }}
                    />
                  </div>
                  <div className="input-group">
                    <label style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
                      Kontakt E-Mail (optional)
                    </label>
                    <input
                      type="text"
                      placeholder="z.B. mail@example.com"
                      value={footerLine3}
                      onChange={e => setFooterLine3(e.target.value)}
                      style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem' }}
                    />
                  </div>
                </aside>
              )}

            </div>
          </div>
        )}

        {/* ====== STEP: PROVIDER CHANGE ====== */}
        {step === 'provider' && (
          <div className="glass-panel fade-in" style={{ maxWidth: '600px', width: '100%', padding: '3rem', borderRadius: '12px' }}>
            <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Providerwechsel</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              Du möchtest deine Website bei einem anderen Hosting-Anbieter betreiben?
              Trage einfach die neuen Zugangsdaten ein. Beim nächsten Live-Schalten wird die Seite auf dem neuen Server hochgeladen.
            </p>
            <button
              type="button"
              className="btn-outline"
              style={{ marginTop: '-1.2rem', marginBottom: '1.2rem', fontSize: '0.82rem', padding: '0.45rem 0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              onClick={() => setShowProviderGuide(true)}
            >
              <HelpBadgeIcon label="Provider-Hilfe" />
              Du weisst nicht, wo du diese Daten findest?
            </button>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <div className="input-group" style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Provider</label>
                <select value={hostingProvider} onChange={(e) => handleHostingProviderChange(e.target.value)}>
                  {Object.values(HOSTING_PROVIDER_PRESETS).map((provider) => (
                    <option key={provider.id} value={provider.id}>{provider.label}</option>
                  ))}
                </select>
              </div>
              <div className="input-group" style={{ width: '180px' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Verbindungsart</label>
                <select value={connectionType} onChange={(e) => handleConnectionTypeChange(e.target.value)}>
                  {Object.entries(CONNECTION_TYPES).map(([key, info]) => (
                    <option key={key} value={key}>{info.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="input-group" style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Server-Adresse</label>
              <input type="text" placeholder={serverPlaceholder} value={ftpServer} onChange={e => setFtpServer(e.target.value)} />
            </div>
            <div className="input-group" style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Website-Adresse</label>
              <input
                type="text"
                placeholder="z.B. swiss-ai-community.ch"
                value={websiteUrl}
                onChange={e => setWebsiteUrl(e.target.value)}
                onBlur={e => setWebsiteUrl(normalizeWebsiteUrlInput(e.target.value))}
              />
            </div>
            <div className="input-group" style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Speicherort</label>
              <input type="text" placeholder={`${selectedHostingPreset.targetPath} oder /mein-projekt`} value={targetPath} onChange={e => setTargetPath(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <div className="input-group" style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Benutzername</label>
                <input type="text" placeholder="Benutzername bei deinem Anbieter" value={ftpUser} onChange={e => setFtpUser(e.target.value)} />
              </div>
              <div className="input-group" style={{ width: '100px' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Port</label>
                <input type="text" placeholder={CONNECTION_TYPES[connectionType]?.defaultPort || '21'} value={ftpPort} onChange={e => handleFtpPortChange(e.target.value)} />
              </div>
            </div>
            <div className="input-group" style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Passwort</label>
              <input type="text" placeholder="Passwort bei deinem Anbieter" value={ftpPassword}
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

      <footer style={{
        borderTop: '1px solid var(--border-color)',
        padding: '0.7rem 1.2rem',
        textAlign: 'center',
        fontSize: '0.76rem',
        color: 'var(--text-secondary)',
        background: 'rgba(8,8,10,0.72)',
        letterSpacing: '0.02em'
      }}>
        Designed with the power of AI · © {appFooterYear} MrM · {APP_VERSION}
      </footer>

      {/* ================================================================
          MODAL: EXPORT / PUBLISH
          ================================================================ */}
      {showExportModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.3s ease' }}>
          <div className="glass-panel fade-in" style={{ padding: '3rem', borderRadius: '12px', maxWidth: '600px', width: '90%', textAlign: 'center', position: 'relative' }}>
            <button onClick={() => { setShowExportModal(false); setExportResult(''); }} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.5rem', fontSize: '1.2rem' }}>✖</button>
            <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Website live schalten</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              {BRAND_NAME} macht alles bereit und bringt deine Seite ins Netz.
              <br />
              Speicherort: <strong>{targetPath || '/'}</strong>{websiteUrl ? <> · Website-Adresse: <strong>{websiteUrl}</strong></> : null}
            </p>

            {isExporting ? (
              <div style={{ padding: '2rem' }}>
                <div style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#4facfe', borderRadius: '50%', margin: '0 auto', animation: 'spin 1s linear infinite' }}></div>
                <p style={{ marginTop: '1.5rem', fontSize: '1.1rem' }}>{BRAND_NAME} macht alles bereit und bringt deine Seite ins Netz...</p>
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                  <button
                    className="btn-outline"
                    style={{ padding: '0.7rem 1.2rem', fontSize: '0.85rem' }}
                    onClick={() => {
                      setShowExportModal(false);
                      setIsExporting(false);
                    }}
                  >
                    Abbrechen
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
                    <>
                      <button
                        className="btn-outline"
                        style={{ padding: '0.7rem 1.2rem', fontSize: '0.85rem' }}
                        onClick={handleOpenWebsite}
                        disabled={!canOpenWebsite}
                      >
                        Website ansehen
                      </button>
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
                    </>
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
                Live schalten
              </button>
            )}
          </div>
        </div>
      )}

      {showProviderGuide && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.72)',
            backdropFilter: 'blur(4px)',
            zIndex: 1300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
          onClick={() => setShowProviderGuide(false)}
        >
          <div
            className="glass-panel fade-in"
            style={{ maxWidth: '700px', width: '100%', padding: '1.4rem', borderRadius: '12px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'inline-flex', alignItems: 'center', gap: '0.55rem' }}>
                <HelpBadgeIcon label="Provider-Anleitungen" />
                <span>Provider-Anleitungen</span>
              </h3>
              <button
                className="btn-outline"
                style={{ padding: '0.35rem 0.7rem', fontSize: '0.75rem' }}
                onClick={() => setShowProviderGuide(false)}
              >
                Schliessen
              </button>
            </div>
            <p style={{ margin: '0 0 0.85rem 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Wähle deinen Provider für eine Schritt-für-Schritt-Anleitung. Die Seite öffnet in einem neuen Tab.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.6rem' }}>
              {PROVIDER_GUIDES.map((provider) => (
                <a
                  key={provider.id}
                  href={provider.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-outline"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.6rem 0.75rem',
                    textDecoration: 'none',
                    fontSize: '0.82rem'
                  }}
                >
                  <span style={{
                    display: 'inline-flex',
                    width: '24px',
                    height: '24px',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'rgba(255,255,255,0.06)',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: 'var(--text-secondary)',
                    flexShrink: 0
                  }}>
                    {provider.short}
                  </span>
                  <span style={{ color: 'var(--text-primary)' }}>{provider.name}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
