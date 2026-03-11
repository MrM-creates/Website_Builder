import express from 'express';
import cors from 'cors';
import { Client } from 'basic-ftp';
import SftpClient from 'ssh2-sftp-client';
import { exec, execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = __dirname;
const FLIDER_RUNTIME_ROOT = String(process.env.FLIDER_RUNTIME_ROOT || '').trim()
    ? path.resolve(String(process.env.FLIDER_RUNTIME_ROOT || '').trim())
    : APP_ROOT;
const KIRBY_ROOT = String(process.env.FLIDER_KIRBY_ROOT || '').trim()
    ? path.resolve(String(process.env.FLIDER_KIRBY_ROOT || '').trim())
    : path.join(APP_ROOT, 'kirby-cms');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '25mb' }));

const DEFAULT_ADMIN_EMAIL = 'admin@flider.local';
const DEFAULT_ADMIN_NAME = 'Flatsite Admin';
const DEFAULT_ADMIN_LANGUAGE = 'de';
const DEFAULT_ADMIN_ROLE = 'admin';
const FLATSITE_DIR = String(process.env.FLIDER_STATE_DIR || '').trim()
    ? path.resolve(String(process.env.FLIDER_STATE_DIR || '').trim())
    : path.join(FLIDER_RUNTIME_ROOT, '.flatsite');
const STORAGE_CONFIG_FILE = path.join(FLATSITE_DIR, 'config.json');
const ACTIVE_PROJECT_FILE = path.join(FLATSITE_DIR, 'active-project.json');
const REPAIR_LOG_FILE = path.join(FLATSITE_DIR, 'repair-events.log');
const ADMIN_CREDENTIALS_FILE = path.join(FLATSITE_DIR, 'admin-credentials.json');
const PROJECT_RECOVERY_DIR_NAME = '_recovery';
const LIVE_CONTENT_DIR = path.join(KIRBY_ROOT, 'content');
const LIVE_CUSTOM_CSS_PATH = path.join(KIRBY_ROOT, 'assets', 'css', 'custom.css');
const LIVE_UPLOADS_DIR = path.join(KIRBY_ROOT, 'assets', 'uploads');

const parseField = (content, key) => {
    const match = content.match(new RegExp(`^${key}:\\s*(.+)$`, 'mi'));
    return match?.[1]?.trim() || null;
};

const normalizeEmail = (value = '') => String(value || '').trim().toLowerCase();

const isLikelyEmail = (value = '') =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));

const generateAdminPassword = () => {
    if (typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID().replace(/-/g, '');
    }
    return crypto.randomBytes(16).toString('hex');
};

const generateBcryptHashWithPhp = (password = '') => {
    const safe = String(password || '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'");
    const phpScript = `echo password_hash('${safe}', PASSWORD_BCRYPT), PHP_EOL;`;
    const output = execFileSync('php', ['-r', phpScript], { encoding: 'utf-8' }).trim();
    if (!/^\$2[abyx]\$/i.test(output)) {
        throw new Error('PHP hat keinen gueltigen bcrypt-Hash erzeugt');
    }
    return output;
};

const readPersistedAdminCredentials = () => {
    if (!fs.existsSync(ADMIN_CREDENTIALS_FILE)) return null;
    try {
        const parsed = JSON.parse(fs.readFileSync(ADMIN_CREDENTIALS_FILE, 'utf-8'));
        const email = normalizeEmail(parsed?.email);
        const password = String(parsed?.password || '').trim();
        const passwordHash = String(parsed?.passwordHash || '').trim();

        if (!isLikelyEmail(email) || !password || !/^\$2[abyx]\$/i.test(passwordHash)) {
            return null;
        }

        return { email, password, passwordHash };
    } catch {
        return null;
    }
};

const persistAdminCredentials = ({ email, password, passwordHash }) => {
    fs.mkdirSync(FLATSITE_DIR, { recursive: true });
    fs.writeFileSync(
        ADMIN_CREDENTIALS_FILE,
        JSON.stringify(
            {
                email: normalizeEmail(email) || DEFAULT_ADMIN_EMAIL,
                password: String(password || ''),
                passwordHash: String(passwordHash || ''),
                updatedAt: new Date().toISOString()
            },
            null,
            2
        ),
        'utf-8'
    );
};

const getOrCreateAdminCredentials = ({ preferredEmail = '' } = {}) => {
    const existing = readPersistedAdminCredentials();
    if (existing) return existing;

    const email = isLikelyEmail(preferredEmail) ? normalizeEmail(preferredEmail) : DEFAULT_ADMIN_EMAIL;
    const password = generateAdminPassword();
    const passwordHash = generateBcryptHashWithPhp(password);
    const credentials = { email, password, passwordHash };
    persistAdminCredentials(credentials);
    return credentials;
};

const parseUserTxt = (content) => ({
    email: parseField(content, 'Email'),
    name: parseField(content, 'Name'),
    language: parseField(content, 'Language'),
    role: parseField(content, 'Role')
});

const parseIndexPhp = (content) => {
    const read = (key) => {
        const match = content.match(new RegExp(`['"]${key}['"]\\s*=>\\s*['"]([^'"]*)['"]`, 'i'));
        return match?.[1]?.trim() || null;
    };

    return {
        email: read('email'),
        name: read('name'),
        language: read('language'),
        role: read('role')
    };
};

const phpEscape = (value = '') =>
    String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const buildAccountIndexPhp = ({ email, name, language, role }) => `<?php

return [
    'email' => '${phpEscape(email)}',
    'language' => '${phpEscape(language)}',
    'name' => '${phpEscape(name)}',
    'role' => '${phpEscape(role)}'
];
`;

const buildUserTxt = ({ email, name, language, role, passwordHash }) => `Email: ${email}

----

Name: ${name}

----

Language: ${language}

----

Role: ${role}

----

Password: ${passwordHash}
`;

const ensureAdminAccountFiles = (accountDir, { email, name, language, role, passwordHash }) => {
    fs.mkdirSync(accountDir, { recursive: true });

    fs.writeFileSync(
        path.join(accountDir, 'index.php'),
        buildAccountIndexPhp({ email, name, language, role }),
        'utf-8'
    );

    fs.writeFileSync(path.join(accountDir, '.htpasswd'), `${passwordHash}\n`, 'utf-8');
    fs.writeFileSync(
        path.join(accountDir, 'user.txt'),
        buildUserTxt({ email, name, language, role, passwordHash }),
        'utf-8'
    );
};

const findAdminAccount = (accountsDir) => {
    if (!fs.existsSync(accountsDir)) {
        return null;
    }

    for (const entry of fs.readdirSync(accountsDir)) {
        if (entry.startsWith('.')) continue;

        const accountDir = path.join(accountsDir, entry);
        if (!fs.statSync(accountDir).isDirectory()) continue;

        const indexPath = path.join(accountDir, 'index.php');
        const userPath = path.join(accountDir, 'user.txt');

        let indexData = {};
        let userData = {};

        if (fs.existsSync(indexPath)) {
            indexData = parseIndexPhp(fs.readFileSync(indexPath, 'utf-8'));
        }

        if (fs.existsSync(userPath)) {
            userData = parseUserTxt(fs.readFileSync(userPath, 'utf-8'));
        }

        const role = (indexData.role || userData.role || '').toLowerCase();
        if (role !== 'admin') continue;

        return {
            id: entry,
            email: indexData.email || userData.email || DEFAULT_ADMIN_EMAIL,
            name: indexData.name || userData.name || DEFAULT_ADMIN_NAME,
            language: indexData.language || userData.language || DEFAULT_ADMIN_LANGUAGE,
            role: DEFAULT_ADMIN_ROLE
        };
    }

    return null;
};

const ensureAdminAccount = (accountsDir, { email = '' } = {}) => {
    fs.mkdirSync(accountsDir, { recursive: true });
    const credentials = getOrCreateAdminCredentials({ preferredEmail: email });

    const admin = findAdminAccount(accountsDir);
    const accountId = admin?.id || crypto.randomBytes(4).toString('hex');
    const accountDir = path.join(accountsDir, accountId);

    const accountData = {
        email: admin?.email || credentials.email,
        name: admin?.name || DEFAULT_ADMIN_NAME,
        language: admin?.language || DEFAULT_ADMIN_LANGUAGE,
        role: DEFAULT_ADMIN_ROLE,
        passwordHash: credentials.passwordHash
    };

    ensureAdminAccountFiles(accountDir, accountData);
    if (accountData.email !== credentials.email) {
        persistAdminCredentials({
            email: accountData.email,
            password: credentials.password,
            passwordHash: credentials.passwordHash
        });
    }

    return {
        id: accountId,
        email: accountData.email,
        password: credentials.password
    };
};

const updateSiteTitleInContent = (contentDir, title) => {
    const siteFile = path.join(contentDir, 'site.txt');
    const safeTitle = (title || '').trim() || 'Meine Website';

    if (!fs.existsSync(contentDir)) {
        fs.mkdirSync(contentDir, { recursive: true });
    }

    if (!fs.existsSync(siteFile)) {
        fs.writeFileSync(siteFile, `Title: ${safeTitle}\n`, 'utf-8');
        return;
    }

    const current = fs.readFileSync(siteFile, 'utf-8');

    if (/^Title:/m.test(current)) {
        const updated = current.replace(/^Title:.*$/m, `Title: ${safeTitle}`);
        fs.writeFileSync(siteFile, updated, 'utf-8');
    } else {
        const updated = `Title: ${safeTitle}\n\n----\n\n${current}`;
        fs.writeFileSync(siteFile, updated, 'utf-8');
    }
};

const normalizeSingleLineFieldValue = (value = '') =>
    String(value ?? '')
        .replace(/\r?\n+/g, ' ')
        .trim();

const parseSingleLineKirbyFields = (content = '') => {
    const fields = {};
    const lines = String(content ?? '').split(/\r?\n/);

    for (const line of lines) {
        const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
        if (!match) continue;
        const key = match[1];
        const value = normalizeSingleLineFieldValue(match[2] ?? '');
        fields[key] = value;
    }

    return fields;
};

const stringifyKirbyFields = (orderedEntries = []) => {
    const normalizedEntries = orderedEntries
        .filter(([key]) => Boolean(String(key || '').trim()))
        .map(([key, value]) => [String(key).trim(), normalizeSingleLineFieldValue(value)]);

    if (!normalizedEntries.length) return '';

    return `${normalizedEntries.map(([key, value]) => `${key}: ${value}`).join('\n\n----\n\n')}\n`;
};

const updateSiteMetaInContent = (
    contentDir,
    { title = '', siteLogoUrl = null, footerLine1 = '', footerLine2 = '', footerLine3 = '' } = {}
) => {
    const siteFile = path.join(contentDir, 'site.txt');
    const safeTitle = (title || '').trim() || 'Meine Website';

    if (!fs.existsSync(contentDir)) {
        fs.mkdirSync(contentDir, { recursive: true });
    }

    let current = '';
    if (fs.existsSync(siteFile)) {
        current = fs.readFileSync(siteFile, 'utf-8');
    }

    const existingFields = parseSingleLineKirbyFields(current);
    const currentTitle = normalizeSingleLineFieldValue(existingFields.Title || '');
    const resolvedTitle = (title || '').trim() || currentTitle || safeTitle;

    const merged = {
        ...existingFields,
        Title: resolvedTitle,
        Logo:
            siteLogoUrl === null || siteLogoUrl === undefined
                ? normalizeSingleLineFieldValue(existingFields.Logo || '')
                : normalizeSingleLineFieldValue(siteLogoUrl),
        Footerline1: normalizeSingleLineFieldValue(footerLine1),
        Footerline2: normalizeSingleLineFieldValue(footerLine2),
        Footerline3: normalizeSingleLineFieldValue(footerLine3)
    };

    const orderedKeys = ['Title', 'Logo', 'Footerline1', 'Footerline2', 'Footerline3'];
    const restKeys = Object.keys(merged).filter((key) => !orderedKeys.includes(key)).sort();
    const allKeys = [...orderedKeys, ...restKeys];

    const updated = stringifyKirbyFields(allKeys.map((key) => [key, merged[key]]));
    fs.writeFileSync(siteFile, updated, 'utf-8');
};

const readSiteMetaFromContent = (contentDir) => {
    const siteFile = path.join(contentDir, 'site.txt');
    let content = '';
    if (fs.existsSync(siteFile)) {
        content = fs.readFileSync(siteFile, 'utf-8');
    }

    const fields = parseSingleLineKirbyFields(content);
    return {
        title: normalizeSingleLineFieldValue(fields.Title || ''),
        logo: normalizeSingleLineFieldValue(fields.Logo || ''),
        footerLine1: normalizeSingleLineFieldValue(fields.Footerline1 || ''),
        footerLine2: normalizeSingleLineFieldValue(fields.Footerline2 || ''),
        footerLine3: normalizeSingleLineFieldValue(fields.Footerline3 || '')
    };
};

const decodeHtmlEntitiesForText = (value = '') =>
    String(value ?? '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&#x2f;|&#47;/gi, '/');

const sanitizeTextSnippet = (value = '') =>
    decodeHtmlEntitiesForText(String(value ?? ''))
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const trimSeoDescription = (value = '', maxChars = 160) => {
    const normalized = sanitizeTextSnippet(value);
    if (!normalized) return '';
    if (normalized.length <= maxChars) return normalized;

    const hardCut = normalized.slice(0, maxChars);
    const breakPoint = hardCut.lastIndexOf(' ');
    const trimmed = breakPoint > 70 ? hardCut.slice(0, breakPoint) : hardCut;
    return trimmed.trim();
};

const resolvePageDefaultFileBySlug = (contentRoot, slugInput = '') => {
    const slug = sanitizeSlug(slugInput);
    if (!slug) return '';

    const dirName = findExistingPageDirName(contentRoot, slug);
    if (!dirName) return '';

    const filePath = path.join(contentRoot, dirName, 'default.txt');
    if (!fs.existsSync(filePath)) return '';

    return filePath;
};

const extractSeoRelevantSnippetsFromLayout = (layoutRaw = '') => {
    const raw = String(layoutRaw ?? '').trim();
    if (!raw) return [];

    let parsed = [];
    try {
        parsed = JSON.parse(raw);
    } catch {
        return [];
    }

    const snippets = [];
    const allowedKeys = new Set([
        'text',
        'title',
        'caption',
        'description',
        'headline',
        'subheadline',
        'alt',
        'label',
        'name'
    ]);

    const pushSnippet = (value) => {
        const cleaned = sanitizeTextSnippet(value);
        if (!cleaned) return;
        if (cleaned.length < 3) return;
        if (/^[0-9a-f-]{8,}$/i.test(cleaned)) return;
        snippets.push(cleaned);
    };

    const walkValue = (value, keyHint = '') => {
        if (value === null || value === undefined) return;

        if (typeof value === 'string') {
            if (!keyHint || allowedKeys.has(String(keyHint).toLowerCase())) {
                pushSnippet(value);
            }
            return;
        }

        if (Array.isArray(value)) {
            value.forEach((item) => walkValue(item, keyHint));
            return;
        }

        if (typeof value === 'object') {
            Object.entries(value).forEach(([key, nested]) => {
                walkValue(nested, key);
            });
        }
    };

    walkValue(parsed, '');

    // Keep deterministic order and avoid noisy duplicates.
    const unique = [];
    const seen = new Set();
    for (const snippet of snippets) {
        const normalized = snippet.toLowerCase();
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        unique.push(snippet);
        if (unique.length >= 8) break;
    }

    return unique;
};

const buildSeoDescriptionSuggestion = ({ pageTitle = '', layoutRaw = '', projectName = '' } = {}) => {
    const title = normalizeSingleLineFieldValue(pageTitle || '') || 'Diese Seite';
    const snippets = extractSeoRelevantSnippetsFromLayout(layoutRaw);

    let draft = '';
    if (snippets.length > 0) {
        draft = `${title}: ${snippets.join(' ')}`;
    } else {
        const safeProject = normalizeSingleLineFieldValue(projectName || '');
        draft = safeProject
            ? `${title} auf ${safeProject} entdecken.`
            : `${title} entdecken.`;
    }

    const trimmed = trimSeoDescription(draft, 160);
    if (!trimmed) {
        return trimSeoDescription(`${title} entdecken.`, 160);
    }

    return trimmed;
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findExistingPageDirName = (contentRoot, slug) => {
    if (!fs.existsSync(contentRoot)) return null;

    const slugPattern = new RegExp(`^(?:\\d+_)?${escapeRegex(slug)}$`);

    for (const entry of fs.readdirSync(contentRoot)) {
        const fullPath = path.join(contentRoot, entry);
        if (!fs.statSync(fullPath).isDirectory()) continue;
        if (entry === 'error') continue;
        if (slugPattern.test(entry)) return entry;
    }

    return null;
};

const nextListedDirName = (contentRoot, slug) => {
    let maxNum = 0;

    if (fs.existsSync(contentRoot)) {
        for (const entry of fs.readdirSync(contentRoot)) {
            const match = entry.match(/^(\d+)_/);
            if (!match) continue;
            const num = parseInt(match[1], 10);
            if (Number.isFinite(num) && num > maxNum) {
                maxNum = num;
            }
        }
    }

    const nextNum = String(maxNum + 1).padStart(2, '0');
    return `${nextNum}_${slug}`;
};

const sanitizeSlug = (value = '') =>
    String(value)
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

const normalizeOnboardingPages = (rawPages = []) => {
    const normalizedPages = [];
    const seen = new Set();

    for (const raw of rawPages) {
        const slug = sanitizeSlug(raw?.slug);
        const title = String(raw?.title || '').trim();
        if (!slug || slug === 'home') continue;
        if (!title) continue;
        if (seen.has(slug)) continue;
        seen.add(slug);
        normalizedPages.push({ slug, title });
    }

    return normalizedPages;
};

const listContentDirectories = (contentRoot) => {
    if (!fs.existsSync(contentRoot)) return [];
    return fs.readdirSync(contentRoot).filter((entry) => {
        if (entry.startsWith('.')) return false;
        const fullPath = path.join(contentRoot, entry);
        return fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
    });
};

const readPageTitleFromDirectory = (contentRoot, dirName, fallbackTitle = '') => {
    const txtPath = path.join(contentRoot, dirName, 'default.txt');
    if (!fs.existsSync(txtPath)) return fallbackTitle;

    try {
        const raw = fs.readFileSync(txtPath, 'utf-8');
        const match = raw.match(/^Title:\s*(.+)$/m);
        const title = String(match?.[1] || '').trim();
        return title || fallbackTitle;
    } catch {
        return fallbackTitle;
    }
};

const humanizeSlug = (slug = '') =>
    String(slug || '')
        .replace(/[-_]+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());

const MANAGED_LISTED_DIR_PATTERN = /^\d+_[a-z0-9-]+$/;

const isManagedListedDirName = (value = '') =>
    MANAGED_LISTED_DIR_PATTERN.test(String(value || '').trim());

const listPagesForFlatsiteUi = (contentRoot) => {
    if (!fs.existsSync(contentRoot)) return [];

    const items = fs
        .readdirSync(contentRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && isManagedListedDirName(entry.name))
        .map((entry, index) => {
            const rawName = String(entry.name || '').trim();
            if (!rawName || rawName.startsWith('.')) return null;
            if (rawName === 'error') return null;

            const listedMatch = rawName.match(/^(\d+)_([\s\S]+)$/);
            const slugSource = listedMatch?.[2] || rawName;
            const slug = sanitizeSlug(slugSource);
            if (!slug) return null;

            const order = listedMatch ? parseInt(listedMatch[1], 10) || 999999 : 1000000 + index;
            const fallbackTitle = humanizeSlug(slugSource);
            const title = readPageTitleFromDirectory(contentRoot, rawName, fallbackTitle) || fallbackTitle;

            return {
                id: slug,
                title,
                selected: true,
                _order: order,
                _name: rawName
            };
        })
        .filter(Boolean)
        .sort((a, b) => {
            if (a._order !== b._order) return a._order - b._order;
            return String(a._name).localeCompare(String(b._name), 'de', { sensitivity: 'base' });
        });

    const unique = [];
    const seen = new Set();
    for (const item of items) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        unique.push({ id: item.id, title: item.title, selected: true });
    }

    return unique;
};

const upsertPageContentFile = (contentDir, title) => {
    const txtFilePath = path.join(contentDir, 'default.txt');

    if (!fs.existsSync(contentDir)) {
        fs.mkdirSync(contentDir, { recursive: true });
    }

    if (fs.existsSync(txtFilePath)) {
        const current = fs.readFileSync(txtFilePath, 'utf-8');
        let updated = current;
        if (/^Title:/m.test(updated)) {
            updated = updated.replace(/^Title:.*$/m, `Title: ${title}`);
        } else {
            updated = `Title: ${title}\n\n----\n\n${updated}`;
        }
        fs.writeFileSync(txtFilePath, updated, 'utf-8');
        return;
    }

    const fileContent = `Title: ${title}\n\n----\n\nLayout: []\n`;
    fs.writeFileSync(txtFilePath, fileContent, 'utf-8');
};

const removeDefaultTemplateArtifacts = (
    contentDir,
    {
        contentRoot = '',
        recoveryRoot = '',
        projectPath = '',
        projectId = ''
    } = {}
) => {
    if (!fs.existsSync(contentDir)) return;
    for (const entry of fs.readdirSync(contentDir)) {
        if (!/^default\s+.+\.txt$/i.test(entry)) continue;
        const absolute = path.join(contentDir, entry);
        try {
            if (fs.statSync(absolute).isFile()) {
                if (recoveryRoot && contentRoot) {
                    movePathToRecovery({
                        absolutePath: absolute,
                        contentRoot,
                        projectPath,
                        projectId,
                        recoveryRoot,
                        reason: 'default-template-artifact-moved'
                    });
                } else {
                    fs.rmSync(absolute, { force: true });
                }
            }
        } catch {
            // ignore individual artifact cleanup failures
        }
    }
};

const findMatchingDirForSlug = (dirs, slug, used = new Set()) => {
    const slugPattern = new RegExp(`^(?:\\d+_)?${escapeRegex(slug)}$`);
    return dirs.find((entry) => used.has(entry) === false && slugPattern.test(entry)) || null;
};

const syncPagesInContent = (
    contentRoot,
    rawPages = [],
    { projectPath = '', projectId = '' } = {}
) => {
    if (!fs.existsSync(contentRoot)) {
        fs.mkdirSync(contentRoot, { recursive: true });
    }

    let recoveryRoot = '';
    const getRecoveryRoot = () => {
        if (!projectPath) return '';
        if (!recoveryRoot) {
            recoveryRoot = ensureProjectRecoveryDir(projectPath);
        }
        return recoveryRoot;
    };

    const normalizedPages = normalizeOnboardingPages(rawPages);

    const dirs = listContentDirectories(contentRoot);
    const usedDirs = new Set();
    const selected = normalizedPages.map((page, index) => {
        const sourceDir = findMatchingDirForSlug(dirs, page.slug, usedDirs);
        if (sourceDir) usedDirs.add(sourceDir);
        return {
            ...page,
            sourceDir,
            desiredDir: `${index + 1}_${page.slug}`
        };
    });

    const renameOps = [];

    for (const page of selected) {
        if (page.sourceDir && page.sourceDir !== page.desiredDir) {
            renameOps.push({ from: page.sourceDir, to: page.desiredDir });
        }
    }

    const renameFromSet = new Set(renameOps.map((op) => op.from));
    // Remove or recover orphan content dirs so Kirby doesn't show duplicate draft pages.
    // Old behavior renamed them to "*-legacy" inside content/, which still appears in Panel.
    const orphanDirs = dirs.filter((entry) => {
        if (!entry || entry.startsWith('.')) return false;
        if (entry === 'error' || entry === PROJECT_RECOVERY_DIR_NAME) return false;
        if (usedDirs.has(entry)) return false;
        if (renameFromSet.has(entry)) return false;
        return true;
    });

    for (const orphan of orphanDirs) {
        const orphanPath = path.join(contentRoot, orphan);
        if (!fs.existsSync(orphanPath)) continue;

        const recoveryRoot = getRecoveryRoot();
        if (recoveryRoot) {
            movePathToRecovery({
                absolutePath: orphanPath,
                contentRoot,
                projectPath,
                projectId,
                recoveryRoot,
                reason: 'orphan-content-dir-moved'
            });
        } else {
            fs.rmSync(orphanPath, { recursive: true, force: true });
        }
    }

    const stagedRenames = [];
    renameOps.forEach((op, index) => {
        const fromPath = path.join(contentRoot, op.from);
        if (!fs.existsSync(fromPath)) return;
        const tempName = `__sync_tmp_${Date.now()}_${index}`;
        const tempPath = path.join(contentRoot, tempName);
        fs.renameSync(fromPath, tempPath);
        stagedRenames.push({ tempName, to: op.to });
    });

    for (const op of stagedRenames) {
        const fromPath = path.join(contentRoot, op.tempName);
        const toPath = path.join(contentRoot, op.to);
        if (fs.existsSync(toPath)) {
            const fallbackRecoveryRoot = getRecoveryRoot();
            if (fallbackRecoveryRoot) {
                movePathToRecovery({
                    absolutePath: toPath,
                    contentRoot,
                    projectPath,
                    projectId,
                    recoveryRoot: fallbackRecoveryRoot,
                    reason: 'rename-conflict-target-moved'
                });
            } else {
                fs.rmSync(toPath, { recursive: true, force: true });
            }
        }
        fs.renameSync(fromPath, toPath);
    }

    for (const page of selected) {
        const finalDir = path.join(contentRoot, page.desiredDir);
        if (!fs.existsSync(finalDir)) {
            fs.mkdirSync(finalDir, { recursive: true });
        }
        upsertPageContentFile(finalDir, page.title);
        removeDefaultTemplateArtifacts(finalDir, {
            contentRoot,
            recoveryRoot: getRecoveryRoot(),
            projectPath,
            projectId
        });
    }

    return {
        synced: selected.map((p) => ({ slug: p.slug, title: p.title, dir: p.desiredDir })),
        total: selected.length
    };
};

const hardResetPagesInContent = (contentRoot, rawPages = []) => {
    if (!fs.existsSync(contentRoot)) {
        fs.mkdirSync(contentRoot, { recursive: true });
    }

    let normalizedPages = normalizeOnboardingPages(rawPages);
    if (normalizedPages.length === 0) {
        normalizedPages = [{ slug: 'portfolio', title: 'Portfolio' }];
    }

    const entries = fs.readdirSync(contentRoot, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const absolute = path.join(contentRoot, entry.name);

        if (entry.isDirectory()) {
            if (entry.name === 'error') continue;
            fs.rmSync(absolute, { recursive: true, force: true });
            continue;
        }

        if (entry.isFile()) {
            if (entry.name === 'site.txt') continue;
            fs.rmSync(absolute, { force: true });
        }
    }

    const synced = [];
    normalizedPages.forEach((page, index) => {
        const dirName = `${index + 1}_${page.slug}`;
        const contentDir = path.join(contentRoot, dirName);
        upsertPageContentFile(contentDir, page.title);
        synced.push({ slug: page.slug, title: page.title, dir: dirName });
    });

    return {
        synced,
        total: synced.length
    };
};

const normalizeTargetPath = (value = '/') => {
    let targetPath = String(value ?? '').trim();

    if (!targetPath || targetPath === '.') {
        return '/';
    }

    targetPath = targetPath.replace(/\\/g, '/');

    if (!targetPath.startsWith('/')) {
        targetPath = `/${targetPath}`;
    }

    targetPath = targetPath.replace(/\/+/g, '/');

    if (targetPath.length > 1) {
        targetPath = targetPath.replace(/\/+$/g, '');
    }

    if (targetPath.split('/').includes('..')) {
        throw new Error('Ungueltiger Zielpfad');
    }

    return targetPath || '/';
};

const normalizeWebsiteUrl = (value = '') => {
    let websiteUrl = String(value ?? '').trim();
    if (!websiteUrl) return '';

    if (!/^https?:\/\//i.test(websiteUrl)) {
        websiteUrl = `https://${websiteUrl}`;
    }

    try {
        const parsed = new URL(websiteUrl);
        return parsed.toString().replace(/\/+$/g, '');
    } catch {
        return '';
    }
};

const shQuote = (value = '') => `'${String(value).replace(/'/g, `'\\''`)}'`;

const execPromise = (cmd, options = {}) =>
    new Promise((resolve, reject) => {
        exec(cmd, options, (err, stdout, stderr) => {
            if (err) {
                const message = (stderr || err.message || '').trim() || 'Kommando fehlgeschlagen';
                reject(new Error(message));
                return;
            }
            resolve({ stdout, stderr });
        });
    });

const createDeployZip = async (sourceFolder, zipPath) => {
    const source = shQuote(sourceFolder);
    const zip = shQuote(zipPath);
    await execPromise(`cd ${source} && zip -qr ${zip} . -x "site/sessions/*"`);
};

const DEPLOY_START_FILE_CANDIDATES = ['index.html', 'index.php'];
let deployInProgress = false;

const ensureLocalExportHasStartFile = (sourceFolder = '') => {
    for (const fileName of DEPLOY_START_FILE_CANDIDATES) {
        if (fs.existsSync(path.join(sourceFolder, fileName))) {
            return fileName;
        }
    }
    throw new Error('Export enthaelt keine Startdatei (index.html oder index.php)');
};

const isFtpDirectoryEntry = (entry) => {
    if (!entry) return false;
    if (typeof entry.isDirectory === 'function') return entry.isDirectory();
    return Number(entry.type) === 2;
};

const isFtpFileEntry = (entry) => {
    if (!entry) return false;
    if (typeof entry.isFile === 'function') return entry.isFile();
    return Number(entry.type) === 1;
};

const getFtpEntry = async (client, remotePath = '/') => {
    const normalized = normalizeTargetPath(remotePath);
    if (normalized === '/') {
        return { exists: true, isDir: true, isFile: false, name: '/' };
    }

    const parent = path.posix.dirname(normalized) || '/';
    const base = path.posix.basename(normalized);

    try {
        const entries = await client.list(parent);
        const entry = entries.find((item) => String(item?.name || '') === base);
        if (!entry) {
            return { exists: false, isDir: false, isFile: false, name: base };
        }
        return {
            exists: true,
            isDir: isFtpDirectoryEntry(entry),
            isFile: isFtpFileEntry(entry),
            name: base
        };
    } catch {
        return { exists: false, isDir: false, isFile: false, name: base };
    }
};

const removeFtpPathIfExists = async (client, remotePath = '/') => {
    const normalized = normalizeTargetPath(remotePath);
    if (normalized === '/') return;

    const entry = await getFtpEntry(client, normalized);
    if (!entry.exists) return;

    if (entry.isDir) {
        await client.removeDir(normalized);
        return;
    }

    await client.remove(normalized);
};

const MANAGED_MEDIA_SUBPATHS = ['media/pages'];
const DEPLOY_MANIFEST_FILENAME = '.flider-deploy-manifest.json';

const buildRemoteChildPath = (remoteRoot = '/', childPath = '') => {
    const normalizedRoot = normalizeTargetPath(remoteRoot);
    const normalizedChild = String(childPath || '')
        .replace(/^\/+/, '')
        .replace(/\\/g, '/')
        .replace(/\/+/g, '/');

    if (!normalizedChild) {
        return normalizedRoot;
    }

    if (normalizedRoot === '/') {
        return normalizeTargetPath(`/${normalizedChild}`);
    }

    return normalizeTargetPath(`${normalizedRoot}/${normalizedChild}`);
};

const cleanupManagedMediaFtp = async (client, remoteRoot = '/') => {
    for (const subPath of MANAGED_MEDIA_SUBPATHS) {
        const target = buildRemoteChildPath(remoteRoot, subPath);
        await removeFtpPathIfExists(client, target);
    }
};

const removeSftpPathIfExists = async (sftp, remotePath = '/') => {
    const normalized = normalizeTargetPath(remotePath);
    if (normalized === '/') return;

    let entryType = false;
    try {
        entryType = await sftp.exists(normalized);
    } catch {
        return;
    }

    if (!entryType) return;

    if (entryType === 'd') {
        await sftp.rmdir(normalized, true);
        return;
    }

    try {
        await sftp.delete(normalized);
    } catch {
        await sftp.rmdir(normalized, true);
    }
};

const cleanupManagedMediaSftp = async (sftp, remoteRoot = '/') => {
    for (const subPath of MANAGED_MEDIA_SUBPATHS) {
        const target = buildRemoteChildPath(remoteRoot, subPath);
        await removeSftpPathIfExists(sftp, target);
    }
};

const listFilesRecursive = (rootDir, currentDir = rootDir, files = []) => {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
        const absolute = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
            listFilesRecursive(rootDir, absolute, files);
            continue;
        }
        if (!entry.isFile()) continue;
        const relative = path.relative(rootDir, absolute).replace(/\\/g, '/');
        files.push(relative);
    }
    return files;
};

const buildDeployManifestPayload = ({
    projectId = '',
    projectPath = '',
    targetPath = '/',
    websiteUrl = '',
    filePaths = []
} = {}) => ({
    version: 1,
    generatedAt: new Date().toISOString(),
    projectId: normalizeProjectId(projectId),
    projectPath: String(projectPath || '').trim() || null,
    targetPath: normalizeTargetPath(targetPath),
    websiteUrl: normalizeWebsiteUrl(websiteUrl),
    files: [...new Set((Array.isArray(filePaths) ? filePaths : []).map((item) => String(item || '').replace(/\\/g, '/').replace(/^\/+/, '')))]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, 'en'))
});

const writeDeployManifestToSource = ({ sourceFolder, payload }) => {
    const manifestPath = path.join(sourceFolder, DEPLOY_MANIFEST_FILENAME);
    fs.writeFileSync(manifestPath, JSON.stringify(payload, null, 2), 'utf-8');
    return manifestPath;
};

const parseDeployManifestPayload = (raw = '') => {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed?.files)) return null;
        return {
            ...parsed,
            files: [...new Set(parsed.files.map((item) => String(item || '').replace(/\\/g, '/').replace(/^\/+/, '')).filter(Boolean))]
        };
    } catch {
        return null;
    }
};

const readRemoteDeployManifestFtp = async (client, remoteRoot = '/') => {
    const remotePath = buildRemoteChildPath(remoteRoot, DEPLOY_MANIFEST_FILENAME);
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flider-remote-manifest-'));
    const localFile = path.join(tempDir, DEPLOY_MANIFEST_FILENAME);
    try {
        await client.downloadTo(localFile, remotePath);
        const raw = fs.readFileSync(localFile, 'utf-8');
        return parseDeployManifestPayload(raw);
    } catch {
        return null;
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
};

const readRemoteDeployManifestSftp = async (sftp, remoteRoot = '/') => {
    const remotePath = buildRemoteChildPath(remoteRoot, DEPLOY_MANIFEST_FILENAME);
    try {
        const buffer = await sftp.get(remotePath);
        if (!buffer) return null;
        const raw = Buffer.isBuffer(buffer) ? buffer.toString('utf-8') : String(buffer);
        return parseDeployManifestPayload(raw);
    } catch {
        return null;
    }
};

const computeStaleManifestEntries = (previousManifest, nextManifest) => {
    const prevFiles = new Set(Array.isArray(previousManifest?.files) ? previousManifest.files : []);
    const nextFiles = new Set(Array.isArray(nextManifest?.files) ? nextManifest.files : []);

    const staleFiles = [...prevFiles]
        .filter((filePath) => !nextFiles.has(filePath))
        .sort((a, b) => b.length - a.length);

    const dirs = new Set();
    for (const filePath of staleFiles) {
        const normalized = String(filePath || '').replace(/\\/g, '/');
        if (!normalized) continue;
        let current = path.posix.dirname(normalized);
        while (current && current !== '.' && current !== '/') {
            dirs.add(current);
            current = path.posix.dirname(current);
        }
    }

    const staleDirs = [...dirs].sort((a, b) => b.length - a.length);
    return { staleFiles, staleDirs };
};

const removeRemoteStaleFromManifestFtp = async (client, remoteRoot, previousManifest, nextManifest) => {
    const { staleFiles, staleDirs } = computeStaleManifestEntries(previousManifest, nextManifest);

    for (const relativeFile of staleFiles) {
        const remotePath = buildRemoteChildPath(remoteRoot, relativeFile);
        await removeFtpPathIfExists(client, remotePath);
    }

    for (const relativeDir of staleDirs) {
        const remoteDir = buildRemoteChildPath(remoteRoot, relativeDir);
        try {
            const entries = await client.list(remoteDir);
            if (entries.length === 0) {
                await client.removeDir(remoteDir);
            }
        } catch {
            // ignore non-empty/missing dirs
        }
    }

    return { staleFiles: staleFiles.length, staleDirs: staleDirs.length };
};

const removeRemoteStaleFromManifestSftp = async (sftp, remoteRoot, previousManifest, nextManifest) => {
    const { staleFiles, staleDirs } = computeStaleManifestEntries(previousManifest, nextManifest);

    for (const relativeFile of staleFiles) {
        const remotePath = buildRemoteChildPath(remoteRoot, relativeFile);
        await removeSftpPathIfExists(sftp, remotePath);
    }

    for (const relativeDir of staleDirs) {
        const remoteDir = buildRemoteChildPath(remoteRoot, relativeDir);
        try {
            const entries = await sftp.list(remoteDir);
            if (entries.length === 0) {
                await sftp.rmdir(remoteDir, false);
            }
        } catch {
            // ignore non-empty/missing dirs
        }
    }

    return { staleFiles: staleFiles.length, staleDirs: staleDirs.length };
};

const promoteFtpStagingDirectory = async (
    client,
    { targetPath = '/', stagingPath = '/', deployId = '' } = {}
) => {
    const normalizedTarget = normalizeTargetPath(targetPath);
    const normalizedStaging = normalizeTargetPath(stagingPath);

    if (normalizedTarget === '/' || normalizedTarget === normalizedStaging) {
        return { swapped: false, targetPath: normalizedTarget };
    }

    const backupPath = `${normalizedTarget}.backup-${deployId || Date.now()}`;
    const targetEntry = await getFtpEntry(client, normalizedTarget);

    try {
        await removeFtpPathIfExists(client, backupPath);

        if (targetEntry.exists) {
            await client.rename(normalizedTarget, backupPath);
        }

        await client.rename(normalizedStaging, normalizedTarget);

        await removeFtpPathIfExists(client, backupPath);
        return { swapped: true, targetPath: normalizedTarget };
    } catch (error) {
        try {
            const backupEntry = await getFtpEntry(client, backupPath);
            const targetNow = await getFtpEntry(client, normalizedTarget);
            if (backupEntry.exists && !targetNow.exists) {
                await client.rename(backupPath, normalizedTarget);
            }
        } catch {
            // ignore rollback errors
        }
        throw new Error(`Staging-Swap fehlgeschlagen (${error?.message || 'unbekannt'})`);
    }
};

const waitForRemoteStartFileFtp = async (
    client,
    { remotePath = '/', attempts = 3, delayMs = 600 } = {}
) => {
    const normalizedRemotePath = normalizeTargetPath(remotePath);
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        const entries = await client.list(normalizedRemotePath);
        const names = new Set(entries.map((entry) => String(entry?.name || '').toLowerCase()));
        for (const candidate of DEPLOY_START_FILE_CANDIDATES) {
            if (names.has(candidate.toLowerCase())) {
                return candidate;
            }
        }

        if (attempt < attempts - 1) {
            await delay(delayMs);
        }
    }

    throw new Error(
        'Upload abgeschlossen, aber im Speicherort fehlt eine Startdatei (index.html oder index.php). Bitte Speicherort/Domain-Zuordnung pruefen.'
    );
};

const waitForRemoteStartFileSftp = async (
    sftp,
    remoteRoot = '/',
    { attempts = 3, delayMs = 600 } = {}
) => {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        for (const candidate of DEPLOY_START_FILE_CANDIDATES) {
            const remotePath = path.posix.join(remoteRoot, candidate);
            const exists = await sftp.exists(remotePath);
            if (exists) {
                return candidate;
            }
        }

        if (attempt < attempts - 1) {
            await delay(delayMs);
        }
    }

    throw new Error(
        'Upload abgeschlossen, aber im Speicherort fehlt eine Startdatei (index.html oder index.php). Bitte Speicherort/Domain-Zuordnung pruefen.'
    );
};

const buildUnzipScript = (token) => `<?php
declare(strict_types=1);

$expectedToken = '${token}';
$token = $_GET['token'] ?? '';

if (!hash_equals($expectedToken, (string)$token)) {
    http_response_code(403);
    echo 'forbidden';
    exit;
}

$archive = basename((string)($_GET['archive'] ?? 'flatsite-deploy.zip'));
$zipPath = __DIR__ . DIRECTORY_SEPARATOR . $archive;

if (!is_file($zipPath)) {
    http_response_code(404);
    echo 'archive_not_found';
    exit;
}

if (!class_exists('ZipArchive')) {
    http_response_code(500);
    echo 'zip_extension_missing';
    exit;
}

$zip = new ZipArchive();
$opened = $zip->open($zipPath);

if ($opened !== true) {
    http_response_code(500);
    echo 'zip_open_failed:' . $opened;
    exit;
}

$ok = $zip->extractTo(__DIR__);
$zip->close();

if ($ok !== true) {
    http_response_code(500);
    echo 'zip_extract_failed';
    exit;
}

$cleanup = (string)($_GET['cleanup'] ?? '1');
if ($cleanup !== '0') {
    @unlink($zipPath);
    @unlink(__FILE__);
}

echo 'ok';
`;

const normalizePublicPath = (value = '') => {
    let current = String(value ?? '').trim();
    if (!current || current === '/' || current === '.') return '';

    current = current.replace(/\\/g, '/').replace(/\/+/g, '/');
    if (!current.startsWith('/')) {
        current = `/${current}`;
    }

    current = current.replace(/\/+$/g, '');
    return current === '/' ? '' : current;
};

const collectPublicPathCandidates = (baseUrl, targetPath) => {
    const candidates = [];

    try {
        const parsed = new URL(baseUrl);
        const pathFromWebsiteUrl = normalizePublicPath(parsed.pathname);
        if (pathFromWebsiteUrl) {
            candidates.push(pathFromWebsiteUrl);
        }
    } catch {
        // ignore
    }

    const normalizedTargetPath = normalizePublicPath(targetPath);
    if (normalizedTargetPath) {
        candidates.push(normalizedTargetPath);

        // Common FTP roots on shared hosting: try the public variant without webroot folder
        const withoutWebroot = normalizedTargetPath.replace(/^\/(?:httpdocs|htdocs|public_html)(?=\/|$)/i, '');
        const publicVariant = normalizePublicPath(withoutWebroot);
        if (publicVariant) {
            candidates.push(publicVariant);
        }
    }

    // Some providers map the domain directly to the FTP target root
    candidates.push('');

    return [...new Set(candidates)];
};

const buildUnzipTriggerUrls = ({ websiteUrl, host, targetPath, token, archive }) => {
    const bases = [];
    const normalizedWebsiteUrl = normalizeWebsiteUrl(websiteUrl);

    if (normalizedWebsiteUrl) {
        bases.push(normalizedWebsiteUrl);
    }

    const normalizedHost = String(host ?? '').trim();
    if (normalizedHost) {
        bases.push(`https://${normalizedHost}`);
        bases.push(`http://${normalizedHost}`);
    }

    const uniqueBases = [...new Set(bases)];

    const urls = [];

    for (const base of uniqueBases) {
        const pathCandidates = collectPublicPathCandidates(base, targetPath);

        for (const candidate of pathCandidates) {
            const scriptPath = candidate
                ? `${candidate}/flatsite-unzip.php`
                : '/flatsite-unzip.php';

            const parsed = new URL(base);
            parsed.pathname = scriptPath;
            parsed.searchParams.set('token', token);
            parsed.searchParams.set('archive', archive);
            parsed.searchParams.set('cleanup', '1');
            urls.push(parsed.toString());
        }
    }

    return [...new Set(urls)];
};

const fetchWithTimeout = async (url, timeoutMs = 12000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            redirect: 'follow'
        });
    } finally {
        clearTimeout(timer);
    }
};

const triggerRemoteUnzip = async (urls = []) => {
    const attempts = [];

    for (const url of urls) {
        try {
            const response = await fetchWithTimeout(url, 12000);
            const text = await response.text();
            const preview = String(text || '').slice(0, 200);

            attempts.push({
                url,
                status: response.status,
                preview
            });

            if (response.ok) {
                return {
                    ok: true,
                    url,
                    status: response.status,
                    preview,
                    attempts
                };
            }
        } catch (error) {
            attempts.push({
                url,
                status: 0,
                preview: error.message
            });
        }
    }

    return {
        ok: false,
        attempts
    };
};

const BACKEND_LOCAL_ORIGIN = 'http://127.0.0.1:3001';
const FRONTEND_LOCAL_ORIGIN = 'http://127.0.0.1:5173';
const KIRBY_LOCAL_ORIGIN = 'http://127.0.0.1:8000';
const LOCAL_ORIGIN_CANDIDATES = [
    'http://127.0.0.1:5173',
    'http://localhost:5173',
    'http://127.0.0.1:8000',
    'http://localhost:8000'
];

const delay = (ms = 0) =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });

const listPublicPagePaths = (contentRoot) => {
    const listedPages = listPagesForFlatsiteUi(contentRoot)
        .map((page) => sanitizeSlug(page?.id))
        .filter(Boolean)
        .map((slug) => `/${slug}`);

    return ['/', ...new Set(listedPages)];
};

const normalizePathForFileOutput = (pathname = '/') => {
    const raw = String(pathname || '/').split('?')[0].split('#')[0];
    const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`;
    return withLeadingSlash.replace(/\/+/g, '/');
};

const writeStaticPage = (exportRoot, pathname, html) => {
    const normalizedPath = normalizePathForFileOutput(pathname);
    const isRoot = normalizedPath === '/';
    const outputPath = isRoot
        ? path.join(exportRoot, 'index.html')
        : path.join(exportRoot, normalizedPath.replace(/^\/|\/$/g, ''), 'index.html');

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, html, 'utf-8');
};

const buildPublishBaseUrl = (websiteUrl, targetPath) => {
    const normalizedWebsiteUrl = normalizeWebsiteUrl(websiteUrl);
    if (!normalizedWebsiteUrl) return '';

    try {
        const parsed = new URL(normalizedWebsiteUrl);
        const basePath = normalizePublicPath(parsed.pathname);
        const publishPath = normalizePublicPath(targetPath);

        if (publishPath) {
            if (!basePath) {
                parsed.pathname = publishPath;
            } else if (basePath !== publishPath) {
                parsed.pathname = `${basePath}/${publishPath}`.replace(/\/+/g, '/');
            } else {
                parsed.pathname = basePath;
            }
        } else {
            parsed.pathname = basePath || '/';
        }

        parsed.search = '';
        parsed.hash = '';
        return parsed.toString().replace(/\/+$/g, '');
    } catch {
        return '';
    }
};

const buildPublishPathPrefix = (websiteUrl, targetPath) => {
    const publishBaseUrl = buildPublishBaseUrl(websiteUrl, targetPath);
    if (publishBaseUrl) {
        try {
            const parsed = new URL(publishBaseUrl);
            return normalizePublicPath(parsed.pathname);
        } catch {
            // ignore
        }
    }

    return normalizePublicPath(targetPath);
};

const rewriteHtmlForStaticDeploy = (html, { websiteUrl, targetPath }) => {
    let output = String(html ?? '');
    const publishBaseUrl = buildPublishBaseUrl(websiteUrl, targetPath);
    const pathPrefix = buildPublishPathPrefix(websiteUrl, targetPath);

    if (publishBaseUrl) {
        for (const origin of LOCAL_ORIGIN_CANDIDATES) {
            output = output.split(origin).join(publishBaseUrl);
        }
    }

    if (pathPrefix) {
        output = output.replace(/(href|src|content)=("|')\/(?!\/)/gi, `$1=$2${pathPrefix}/`);
        output = output.replace(/url\((["']?)\/(?!\/)/gi, `url($1${pathPrefix}/`);
    }

    return output;
};

const trimWrappedQuotes = (value = '') => {
    const raw = String(value ?? '').trim();
    return raw.replace(/^['"]+|['"]+$/g, '').trim();
};

const decodeCommonHtmlEntities = (value = '') =>
    String(value ?? '')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#x27;|&#39;/gi, "'")
        .replace(/&#x2f;|&#47;/gi, '/')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>');

const isSkippableAssetReference = (value = '') => {
    const raw = String(value ?? '').trim().toLowerCase();
    return (
        !raw ||
        raw.startsWith('#') ||
        raw.startsWith('//') ||
        raw.startsWith('data:') ||
        raw.startsWith('blob:') ||
        raw.startsWith('javascript:') ||
        raw.startsWith('mailto:') ||
        raw.startsWith('tel:')
    );
};

const normalizeLocalAssetPath = (reference = '') => {
    let current = trimWrappedQuotes(reference);
    current = decodeCommonHtmlEntities(current).trim();
    try {
        current = decodeURIComponent(current);
    } catch {
        // keep original if malformed percent-encoding
    }
    if (!current || isSkippableAssetReference(current)) return '';

    if (/^[a-z][a-z0-9+.-]*:/i.test(current)) {
        try {
            const parsed = new URL(current);
            const origin = parsed.origin.toLowerCase();
            const isLocalOrigin = LOCAL_ORIGIN_CANDIDATES.some((candidate) => candidate.toLowerCase() === origin);
            if (!isLocalOrigin) return '';
            current = parsed.pathname || '';
        } catch {
            return '';
        }
    }

    current = current.split('?')[0].split('#')[0];
    if (!current) return '';

    if (!current.startsWith('/')) {
        current = `/${current}`;
    }

    try {
        current = decodeURIComponent(current);
    } catch {
        // keep raw encoded path
    }

    current = current.replace(/\\/g, '/').replace(/\/+/g, '/');

    if (!/^\/(?:media|assets)\//i.test(current)) return '';
    return current;
};

const addAssetReference = (assetMap, assetPath, pagePath) => {
    if (!assetPath) return;
    const key = assetPath;
    if (!assetMap.has(key)) {
        assetMap.set(key, new Set());
    }
    if (pagePath) {
        assetMap.get(key).add(pagePath);
    }
};

const extractAssetPathsFromHtml = (html = '', pagePath = '/') => {
    const result = new Map();
    const rawHtml = String(html ?? '');

    const directAttrPattern = /\b(?:src|href|content|poster|data-src)\s*=\s*["']([^"']+)["']/gi;
    let attrMatch;
    while ((attrMatch = directAttrPattern.exec(rawHtml)) !== null) {
        const assetPath = normalizeLocalAssetPath(attrMatch[1]);
        addAssetReference(result, assetPath, pagePath);
    }

    const srcsetPattern = /\bsrcset\s*=\s*["']([^"']+)["']/gi;
    let srcsetMatch;
    while ((srcsetMatch = srcsetPattern.exec(rawHtml)) !== null) {
        const entries = String(srcsetMatch[1] || '')
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean);

        for (const entry of entries) {
            const [candidate] = entry.split(/\s+/);
            const assetPath = normalizeLocalAssetPath(candidate);
            addAssetReference(result, assetPath, pagePath);
        }
    }

    const cssUrlPattern = /url\(([^)]+)\)/gi;
    let cssUrlMatch;
    while ((cssUrlMatch = cssUrlPattern.exec(rawHtml)) !== null) {
        const assetPath = normalizeLocalAssetPath(cssUrlMatch[1]);
        addAssetReference(result, assetPath, pagePath);
    }

    return result;
};

const mergeAssetMaps = (targetMap, sourceMap) => {
    for (const [assetPath, pages] of sourceMap.entries()) {
        if (!targetMap.has(assetPath)) {
            targetMap.set(assetPath, new Set());
        }
        const setRef = targetMap.get(assetPath);
        for (const pagePath of pages) {
            setRef.add(pagePath);
        }
    }
};

const resolveCssUrlAssetPath = (cssAssetPath, cssReference) => {
    const raw = trimWrappedQuotes(cssReference);
    if (!raw || isSkippableAssetReference(raw)) return '';

    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
        return normalizeLocalAssetPath(raw);
    }

    const normalizedCssPath = String(cssAssetPath || '').replace(/\\/g, '/');
    const cssDir = path.posix.dirname(normalizedCssPath);
    const combined = raw.startsWith('/')
        ? raw
        : path.posix.join(cssDir, raw);

    return normalizeLocalAssetPath(combined);
};

const expandCssAssetDependencies = (assetMap, kirbyRoot) => {
    const queue = [...assetMap.keys()].filter((assetPath) => /\.css$/i.test(assetPath));
    const visited = new Set();

    while (queue.length > 0) {
        const cssAssetPath = queue.shift();
        if (!cssAssetPath || visited.has(cssAssetPath)) continue;
        visited.add(cssAssetPath);

        const cssFilePath = path.join(kirbyRoot, cssAssetPath.replace(/^\/+/, ''));
        if (!fs.existsSync(cssFilePath)) continue;

        let cssContent = '';
        try {
            cssContent = fs.readFileSync(cssFilePath, 'utf-8');
        } catch {
            continue;
        }

        const cssUrlPattern = /url\(([^)]+)\)/gi;
        let cssUrlMatch;
        while ((cssUrlMatch = cssUrlPattern.exec(cssContent)) !== null) {
            const dependencyPath = resolveCssUrlAssetPath(cssAssetPath, cssUrlMatch[1]);
            if (!dependencyPath) continue;

            addAssetReference(assetMap, dependencyPath, null);
            if (/\.css$/i.test(dependencyPath) && !visited.has(dependencyPath)) {
                queue.push(dependencyPath);
            }
        }
    }
};

const warmReferencedAssets = async (assetPaths = []) => {
    const warmed = [];
    const failed = [];

    for (const assetPath of assetPaths) {
        const url = `${KIRBY_LOCAL_ORIGIN}${assetPath}`;
        try {
            const response = await fetchWithTimeout(url, 25000);
            if (response.ok) {
                warmed.push(assetPath);
            } else {
                failed.push({
                    assetPath,
                    status: response.status,
                    error: `HTTP ${response.status}`
                });
            }
        } catch (error) {
            failed.push({
                assetPath,
                status: 0,
                error: error?.message || 'request failed'
            });
        }
    }

    return { warmed, failed };
};

const findMissingAssetFiles = (assetPaths, kirbyRoot) => {
    const missing = [];
    for (const assetPath of assetPaths) {
        const sourcePath = path.join(kirbyRoot, assetPath.replace(/^\/+/, ''));
        if (!fs.existsSync(sourcePath)) {
            missing.push(assetPath);
        }
    }
    return missing;
};

const copyReferencedAssetsToExport = ({ assetPaths, kirbyRoot, exportRoot }) => {
    let copied = 0;
    const missing = [];

    for (const assetPath of assetPaths) {
        const sourcePath = path.join(kirbyRoot, assetPath.replace(/^\/+/, ''));
        const targetPath = path.join(exportRoot, assetPath.replace(/^\/+/, ''));

        if (!fs.existsSync(sourcePath)) {
            missing.push(assetPath);
            continue;
        }

        const stats = fs.statSync(sourcePath);
        if (!stats.isFile()) {
            continue;
        }

        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.copyFileSync(sourcePath, targetPath);
        copied += 1;
    }

    return { copied, missing };
};

const copyDirectoryIfExists = (sourceDir, targetDir) => {
    if (!fs.existsSync(sourceDir)) return;
    fs.mkdirSync(path.dirname(targetDir), { recursive: true });
    fs.cpSync(sourceDir, targetDir, { recursive: true });
};

const writeUtf8Htaccess = (exportRoot) => {
    const content = `AddDefaultCharset UTF-8
<IfModule mod_mime.c>
  AddCharset UTF-8 .html .css .js .json .xml .txt
</IfModule>
`;
    fs.writeFileSync(path.join(exportRoot, '.htaccess'), content, 'utf-8');
};

const removePathIfExists = (targetPath) => {
    if (!targetPath) return;
    if (fs.existsSync(targetPath)) {
        fs.rmSync(targetPath, { recursive: true, force: true });
    }
};

const fetchKirbyPageHtml = async (pathname = '/') => {
    const normalizedPath = normalizePathForFileOutput(pathname);
    const response = await fetchWithTimeout(`${KIRBY_LOCAL_ORIGIN}${normalizedPath}`, 15000);

    if (!response.ok) {
        throw new Error(`Seite ${normalizedPath} konnte nicht gerendert werden (HTTP ${response.status})`);
    }

    return response.text();
};

const isKirbyReachable = async () => {
    try {
        const response = await fetchWithTimeout(`${KIRBY_LOCAL_ORIGIN}/`, 2500);
        return response.ok || response.status === 302;
    } catch {
        return false;
    }
};

const probeHttpService = async (
    service,
    url,
    { acceptedStatus = [200], timeoutMs = 2500 } = {}
) => {
    const startedAt = Date.now();
    try {
        const response = await fetchWithTimeout(url, timeoutMs);
        const status = Number(response.status || 0);
        const up = acceptedStatus.includes(status);
        return {
            service,
            url,
            up,
            status,
            latencyMs: Date.now() - startedAt,
            error: up ? null : `unexpected status ${status}`
        };
    } catch (error) {
        return {
            service,
            url,
            up: false,
            status: 0,
            latencyMs: Date.now() - startedAt,
            error: String(error?.name === 'AbortError' ? 'timeout' : error?.message || 'unreachable')
        };
    }
};

const ensureKirbyReachable = async () => {
    if (await isKirbyReachable()) {
        return;
    }

    throw new Error('Kirby Server ist nicht erreichbar. Bitte den Dev-Stack mit "npm run dev" starten und erneut versuchen.');
};

const buildStaticDeploySource = async ({ kirbyRoot, websiteUrl, targetPath }) => {
    await ensureKirbyReachable();

    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'flatsite-static-'));
    const exportRoot = path.join(tempRoot, 'site-export');
    fs.mkdirSync(exportRoot, { recursive: true });

    // Reset Kirby media cache for deploy to avoid carrying stale hash folders
    // between publishes. Content files remain untouched.
    removePathIfExists(path.join(kirbyRoot, 'media', 'pages'));

    const contentRoot = path.join(kirbyRoot, 'content');
    const pagePaths = listPublicPagePaths(contentRoot);

    const referencedAssets = new Map();

    for (const pagePath of pagePaths) {
        const rawHtml = await fetchKirbyPageHtml(pagePath);
        mergeAssetMaps(referencedAssets, extractAssetPathsFromHtml(rawHtml, pagePath));
        const rewrittenHtml = rewriteHtmlForStaticDeploy(rawHtml, { websiteUrl, targetPath });
        writeStaticPage(exportRoot, pagePath, rewrittenHtml);
    }

    expandCssAssetDependencies(referencedAssets, kirbyRoot);

    const requiredAssetPaths = [...referencedAssets.keys()].sort();
    const warmResult = await warmReferencedAssets(requiredAssetPaths);
    const missingLocalAssets = findMissingAssetFiles(requiredAssetPaths, kirbyRoot);

    if (missingLocalAssets.length > 0) {
        const preview = missingLocalAssets.slice(0, 6).map((assetPath) => {
            const pages = [...(referencedAssets.get(assetPath) || [])].slice(0, 3).join(', ') || '?';
            return `${assetPath} (referenziert in: ${pages})`;
        });
        throw new Error(
            `Deploy abgebrochen: ${missingLocalAssets.length} referenzierte Assets fehlen lokal. ` +
            `Beispiele: ${preview.join(' | ')}`
        );
    }

    const copiedAssets = copyReferencedAssetsToExport({
        assetPaths: requiredAssetPaths,
        kirbyRoot,
        exportRoot
    });

    if (copiedAssets.missing.length > 0) {
        const preview = copiedAssets.missing.slice(0, 6).join(' | ');
        throw new Error(
            `Deploy abgebrochen: ${copiedAssets.missing.length} Assets konnten nicht exportiert werden. Beispiele: ${preview}`
        );
    }

    writeUtf8Htaccess(exportRoot);

    return {
        sourceFolder: exportRoot,
        pageCount: pagePaths.length,
        assetReport: {
            referenced: requiredAssetPaths.length,
            warmed: warmResult.warmed.length,
            warmFailed: warmResult.failed.length,
            copied: copiedAssets.copied
        },
        cleanup: () => {
            fs.rmSync(tempRoot, { recursive: true, force: true });
        }
    };
};

const hashPathTree = (rootDir, currentDir, hash) => {
    const entries = fs
        .readdirSync(currentDir, { withFileTypes: true })
        .filter((entry) => !entry.name.startsWith('.'))
        .sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
        const absolute = path.join(currentDir, entry.name);
        const relative = path.relative(rootDir, absolute).replace(/\\/g, '/');

        if (entry.isDirectory()) {
            hashPathTree(rootDir, absolute, hash);
        } else if (entry.isFile()) {
            // Hash file contents to avoid false positives from directory mtime churn
            const fileBuffer = fs.readFileSync(absolute);
            hash.update(`F:${relative}:`);
            hash.update(fileBuffer);
            hash.update(';');
        }
    }
};

const computeProjectSignature = () => {
    const hash = crypto.createHash('sha256');
    const contentRoot = LIVE_CONTENT_DIR;
    const customCssPath = LIVE_CUSTOM_CSS_PATH;

    if (fs.existsSync(contentRoot)) {
        hashPathTree(contentRoot, contentRoot, hash);
    } else {
        hash.update('missing:content;');
    }

    if (fs.existsSync(customCssPath)) {
        hash.update('F:assets/css/custom.css:');
        hash.update(fs.readFileSync(customCssPath));
        hash.update(';');
    } else {
        hash.update('missing:assets/css/custom.css;');
    }

    return hash.digest('hex');
};

const jsonTempFilePath = (filePath) => `${filePath}.tmp`;

const fsyncPath = (targetPath) => {
    let fd;
    try {
        fd = fs.openSync(targetPath, 'r');
        fs.fsyncSync(fd);
    } catch {
        // Best effort only (platform/filesystem dependent)
    } finally {
        if (fd !== undefined) {
            try {
                fs.closeSync(fd);
            } catch {
                // noop
            }
        }
    }
};

const parseJsonRaw = (raw = '') => {
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
};

const recoverAtomicJsonFile = (filePath) => {
    const targetPath = path.resolve(filePath);
    const tmpPath = jsonTempFilePath(targetPath);

    if (!fs.existsSync(tmpPath)) return;

    let tmpRaw = '';
    try {
        tmpRaw = fs.readFileSync(tmpPath, 'utf-8');
    } catch {
        fs.rmSync(tmpPath, { force: true });
        return;
    }

    const tmpParsed = parseJsonRaw(tmpRaw);
    if (tmpParsed === null) {
        fs.rmSync(tmpPath, { force: true });
        return;
    }

    const targetExists = fs.existsSync(targetPath);
    if (!targetExists) {
        fs.renameSync(tmpPath, targetPath);
        fsyncPath(path.dirname(targetPath));
        return;
    }

    let targetRaw = '';
    try {
        targetRaw = fs.readFileSync(targetPath, 'utf-8');
    } catch {
        targetRaw = '';
    }
    const targetParsed = parseJsonRaw(targetRaw);

    const tmpMtime = fs.statSync(tmpPath).mtimeMs || 0;
    const targetMtime = fs.statSync(targetPath).mtimeMs || 0;
    const shouldPromoteTmp = targetParsed === null || tmpMtime >= targetMtime;

    if (shouldPromoteTmp) {
        try {
            fs.renameSync(tmpPath, targetPath);
        } catch {
            fs.rmSync(targetPath, { force: true });
            fs.renameSync(tmpPath, targetPath);
        }
        fsyncPath(path.dirname(targetPath));
        return;
    }

    fs.rmSync(tmpPath, { force: true });
};

const writeJsonFile = (filePath, payload) => {
    const targetPath = path.resolve(filePath);
    const targetDir = path.dirname(targetPath);
    const tmpPath = jsonTempFilePath(targetPath);

    fs.mkdirSync(targetDir, { recursive: true });
    recoverAtomicJsonFile(targetPath);

    const serialized = JSON.stringify(payload, null, 2);
    fs.writeFileSync(tmpPath, serialized, 'utf-8');
    fsyncPath(tmpPath);
    fs.renameSync(tmpPath, targetPath);
    fsyncPath(targetDir);
};

const readJsonFileOrNull = (filePath) => {
    const targetPath = path.resolve(filePath);
    recoverAtomicJsonFile(targetPath);

    if (!fs.existsSync(targetPath)) return null;
    try {
        return JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
    } catch {
        return null;
    }
};

const ensureFlatsiteDir = () => {
    fs.mkdirSync(FLATSITE_DIR, { recursive: true });
};

const normalizeProjectPath = (value = '') => {
    const raw = String(value ?? '').trim();
    if (!raw) {
        throw new Error('Projektpfad fehlt');
    }
    return path.resolve(raw);
};

const AUTO_PROJECT_DIR_PATTERN = /^projekt-\d{8}-\d{6}(?:-\d+)?$/i;

const normalizeProjectDirName = (value = '') => {
    const transliterated = String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/ä/g, 'ae')
        .replace(/ö/g, 'oe')
        .replace(/ü/g, 'ue')
        .replace(/ß/g, 'ss')
        .replace(/à|á|â|ã|å|ā/g, 'a')
        .replace(/è|é|ê|ë|ē/g, 'e')
        .replace(/ì|í|î|ï|ī/g, 'i')
        .replace(/ò|ó|ô|õ|ø|ō/g, 'o')
        .replace(/ù|ú|û|ū/g, 'u')
        .replace(/ñ/g, 'n')
        .replace(/ç/g, 'c');

    return transliterated
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 64);
};

const uniqueSiblingPath = (parentDir, baseDirName) => {
    let candidateName = baseDirName || 'projekt';
    let counter = 2;
    let candidatePath = path.join(parentDir, candidateName);

    while (fs.existsSync(candidatePath)) {
        candidateName = `${baseDirName}-${counter}`;
        candidatePath = path.join(parentDir, candidateName);
        counter += 1;
    }

    return candidatePath;
};

const PROJECT_META_DIR_NAME = 'flatsite-project';
const LEGACY_PROJECT_META_DIR_NAME = '.flatsite-project';

const projectMetaDirVisible = (projectPath) => path.join(projectPath, PROJECT_META_DIR_NAME);
const projectMetaDirLegacy = (projectPath) => path.join(projectPath, LEGACY_PROJECT_META_DIR_NAME);

const resolveProjectMetaDir = (projectPath, { forWrite = false } = {}) => {
    const visibleDir = projectMetaDirVisible(projectPath);
    const legacyDir = projectMetaDirLegacy(projectPath);

    if (forWrite) return visibleDir;
    if (fs.existsSync(visibleDir)) return visibleDir;
    if (fs.existsSync(legacyDir)) return legacyDir;
    return visibleDir;
};

const appendProjectRepairLog = ({ projectId = '', projectPath = '', action = '', details = {} } = {}) => {
    const entry = {
        timestamp: new Date().toISOString(),
        projectId: String(projectId || '').trim() || null,
        projectPath: String(projectPath || '').trim() || null,
        action: String(action || '').trim() || 'unknown',
        details: details && typeof details === 'object' ? details : {}
    };

    try {
        fs.mkdirSync(FLATSITE_DIR, { recursive: true });
        fs.appendFileSync(REPAIR_LOG_FILE, `${JSON.stringify(entry)}\n`, 'utf-8');
    } catch {
        // best effort log sink
    }

    const projectLabel = entry.projectId || path.basename(entry.projectPath || '') || 'unknown';
    console.log(`[repair][${projectLabel}] ${entry.action}`, entry.details);
};

const ensureProjectRecoveryDir = (projectPath) => {
    const metaDir = resolveProjectMetaDir(projectPath, { forWrite: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const recoveryDir = path.join(metaDir, PROJECT_RECOVERY_DIR_NAME, stamp);
    fs.mkdirSync(recoveryDir, { recursive: true });
    return recoveryDir;
};

const safeRelativePath = (baseRoot, targetPath) => {
    const relative = path.relative(baseRoot, targetPath).replace(/\\/g, '/');
    if (!relative || relative.startsWith('..')) {
        return path.basename(targetPath);
    }
    return relative;
};

const uniqueTargetPath = (targetPath) => {
    if (!fs.existsSync(targetPath)) return targetPath;
    const ext = path.extname(targetPath);
    const base = targetPath.slice(0, ext ? -ext.length : undefined);
    let index = 1;
    let candidate = `${base}-${index}${ext}`;
    while (fs.existsSync(candidate)) {
        index += 1;
        candidate = `${base}-${index}${ext}`;
    }
    return candidate;
};

const movePathToRecovery = ({
    absolutePath,
    contentRoot,
    projectPath = '',
    projectId = '',
    recoveryRoot = '',
    reason = 'moved-to-recovery'
} = {}) => {
    if (!absolutePath || !fs.existsSync(absolutePath) || !recoveryRoot) return null;

    const rel = safeRelativePath(contentRoot, absolutePath);
    const targetRaw = path.join(recoveryRoot, rel);
    const target = uniqueTargetPath(targetRaw);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.renameSync(absolutePath, target);

    appendProjectRepairLog({
        projectId,
        projectPath,
        action: reason,
        details: { from: absolutePath, to: target }
    });

    return target;
};

const projectManifestPath = (projectPath, options = {}) =>
    path.join(resolveProjectMetaDir(projectPath, options), 'manifest.json');
const projectStatePath = (projectPath, options = {}) =>
    path.join(resolveProjectMetaDir(projectPath, options), 'state.json');
const projectSnapshotContentPath = (projectPath, options = {}) =>
    path.join(resolveProjectMetaDir(projectPath, options), 'snapshot', 'content');
const projectSnapshotCssPath = (projectPath, options = {}) =>
    path.join(resolveProjectMetaDir(projectPath, options), 'snapshot', 'custom.css');
const projectSnapshotUploadsPath = (projectPath, options = {}) =>
    path.join(resolveProjectMetaDir(projectPath, options), 'snapshot', 'uploads');
const HISTORY_FILE = path.join(FLATSITE_DIR, 'projects-history.json');

const recoverAtomicJsonStateOnStartup = () => {
    ensureFlatsiteDir();

    recoverAtomicJsonFile(STORAGE_CONFIG_FILE);
    recoverAtomicJsonFile(ACTIVE_PROJECT_FILE);
    recoverAtomicJsonFile(HISTORY_FILE);

    const candidateProjectPaths = new Set();
    const history = readJsonFileOrNull(HISTORY_FILE);
    if (Array.isArray(history?.projects)) {
        for (const entry of history.projects) {
            const rawPath = String(entry?.path || '').trim();
            if (!rawPath) continue;
            try {
                candidateProjectPaths.add(normalizeProjectPath(rawPath));
            } catch {
                // ignore broken entries
            }
        }
    }

    const activeData = readJsonFileOrNull(ACTIVE_PROJECT_FILE);
    const activePath = String(activeData?.projectPath || '').trim();
    if (activePath) {
        try {
            candidateProjectPaths.add(normalizeProjectPath(activePath));
        } catch {
            // ignore broken active pointer
        }
    }

    for (const projectPath of candidateProjectPaths) {
        recoverAtomicJsonFile(projectManifestPath(projectPath));
        recoverAtomicJsonFile(projectStatePath(projectPath));
        recoverAtomicJsonFile(path.join(projectMetaDirLegacy(projectPath), 'manifest.json'));
        recoverAtomicJsonFile(path.join(projectMetaDirLegacy(projectPath), 'state.json'));
    }
};

recoverAtomicJsonStateOnStartup();

const LEGACY_PROJECT_ID_PATTERN = /^[a-f0-9]{12}$/i;

const createProjectId = () => {
    if (typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    const hex = crypto.randomBytes(16).toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};

const normalizeProjectId = (value = '') => String(value || '').trim();

const ensureStableProjectId = (value = '') => {
    const normalized = normalizeProjectId(value);
    if (!normalized) return createProjectId();
    if (LEGACY_PROJECT_ID_PATTERN.test(normalized)) return createProjectId();
    return normalized;
};

const readProjectManifest = (projectPathInput, { migrate = false } = {}) => {
    const projectPath = normalizeProjectPath(projectPathInput);
    const manifestPath = projectManifestPath(projectPath);
    const raw = readJsonFileOrNull(manifestPath);
    if (!raw || typeof raw !== 'object') return null;

    const normalizedPath = normalizeProjectPath(projectPath);
    const normalizedId = ensureStableProjectId(raw.id);
    const normalized = {
        ...raw,
        id: normalizedId,
        path: normalizedPath
    };

    const changed = normalizedId !== normalizeProjectId(raw.id) || normalizedPath !== String(raw.path || '').trim();
    if (migrate && changed) {
        writeJsonFile(projectManifestPath(projectPath, { forWrite: true }), normalized);
    }

    return normalized;
};

const readUiConfig = () => {
    ensureFlatsiteDir();
    return readJsonFileOrNull(STORAGE_CONFIG_FILE) || {};
};

const writeUiConfig = (config = {}) => {
    ensureFlatsiteDir();
    writeJsonFile(STORAGE_CONFIG_FILE, config);
};

const getProjectPreferences = () => {
    const uiConfig = readUiConfig();
    const defaultRootRaw = String(uiConfig.defaultProjectsRoot || '').trim();
    let defaultProjectsRoot = '';

    if (defaultRootRaw) {
        try {
            defaultProjectsRoot = normalizeProjectPath(defaultRootRaw);
        } catch {
            defaultProjectsRoot = '';
        }
    }

    return { defaultProjectsRoot };
};

const setActiveProjectRef = ({ projectPath = '', projectId = '' } = {}) => {
    ensureFlatsiteDir();
    const payload = {};
    if (projectPath) {
        payload.projectPath = normalizeProjectPath(projectPath);
    }
    const normalizedId = normalizeProjectId(projectId);
    if (normalizedId) {
        payload.projectId = normalizedId;
    }
    writeJsonFile(ACTIVE_PROJECT_FILE, payload);
};

const getActiveProjectRef = () => {
    const data = readJsonFileOrNull(ACTIVE_PROJECT_FILE);
    let projectPath = '';
    let projectId = '';

    if (data?.projectPath) {
        try {
            projectPath = normalizeProjectPath(data.projectPath);
        } catch {
            projectPath = '';
        }
    }

    projectId = normalizeProjectId(data?.projectId);

    return { projectPath, projectId };
};

const getActiveProjectPath = () => {
    return getActiveProjectRef().projectPath;
};

const readProjectHistory = () => {
    const data = readJsonFileOrNull(HISTORY_FILE);
    if (!Array.isArray(data?.projects)) {
        return { projects: [] };
    }

    const seenIds = new Set();
    const seenPaths = new Set();
    const normalizedProjects = [];

    for (const rawEntry of data.projects) {
        const rawPath = String(rawEntry?.path || '').trim();
        if (!rawPath) continue;

        let normalizedPath = '';
        try {
            normalizedPath = normalizeProjectPath(rawPath);
        } catch {
            continue;
        }

        const normalizedId = normalizeProjectId(rawEntry?.id);
        if (normalizedId && seenIds.has(normalizedId)) continue;
        if (seenPaths.has(normalizedPath)) continue;

        if (normalizedId) seenIds.add(normalizedId);
        seenPaths.add(normalizedPath);

        normalizedProjects.push({
            id: normalizedId,
            name: String(rawEntry?.name || '').trim(),
            path: normalizedPath,
            updatedAt: rawEntry?.updatedAt || null,
            createdAt: rawEntry?.createdAt || null
        });
    }

    return {
        projects: normalizedProjects
    };
};

const writeProjectHistory = (history) => {
    writeJsonFile(HISTORY_FILE, {
        projects: Array.isArray(history?.projects) ? history.projects : []
    });
};

const touchProjectInHistory = (manifest) => {
    const history = readProjectHistory();
    const normalizedPath = normalizeProjectPath(manifest.path);
    const now = new Date().toISOString();
    const manifestId = ensureStableProjectId(manifest?.id);

    const filtered = history.projects.filter((entry) => {
        if (manifestId && String(entry?.id || '').trim() === manifestId) return false;
        try {
            return normalizeProjectPath(entry.path) !== normalizedPath;
        } catch {
            return false;
        }
    });
    filtered.unshift({
        id: manifestId,
        name: manifest.name,
        path: normalizedPath,
        updatedAt: now
    });

    writeProjectHistory({ projects: filtered.slice(0, 50) });
};

const projectLocks = new Map();
let liveContentLockTail = Promise.resolve();

const withLiveContentLock = (task) => {
    const previous = liveContentLockTail;

    let releaseCurrent;
    const currentGate = new Promise((resolve) => {
        releaseCurrent = resolve;
    });

    liveContentLockTail = previous.catch(() => {}).then(() => currentGate);

    return previous
        .catch(() => {})
        .then(() => task())
        .finally(() => {
            releaseCurrent();
        });
};

const withProjectLock = (projectPath, task) => {
    const key = normalizeProjectPath(projectPath);
    const previous = projectLocks.get(key) || Promise.resolve();

    let releaseCurrent;
    const currentGate = new Promise((resolve) => {
        releaseCurrent = resolve;
    });
    const queueTail = previous.catch(() => {}).then(() => currentGate);
    projectLocks.set(key, queueTail);

    return previous
        .catch(() => {})
        .then(() => task())
        .finally(() => {
            releaseCurrent();
            if (projectLocks.get(key) === queueTail) {
                projectLocks.delete(key);
            }
        });
};

const snapshotLiveProjectToStore = (projectPath) => {
    const snapshotContentDir = projectSnapshotContentPath(projectPath, { forWrite: true });
    const snapshotCss = projectSnapshotCssPath(projectPath, { forWrite: true });
    const snapshotUploadsDir = projectSnapshotUploadsPath(projectPath, { forWrite: true });

    fs.rmSync(snapshotContentDir, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(snapshotContentDir), { recursive: true });
    if (fs.existsSync(LIVE_CONTENT_DIR)) {
        fs.cpSync(LIVE_CONTENT_DIR, snapshotContentDir, { recursive: true });
    } else {
        fs.mkdirSync(snapshotContentDir, { recursive: true });
    }

    fs.mkdirSync(path.dirname(snapshotCss), { recursive: true });
    if (fs.existsSync(LIVE_CUSTOM_CSS_PATH)) {
        fs.copyFileSync(LIVE_CUSTOM_CSS_PATH, snapshotCss);
    } else {
        fs.writeFileSync(snapshotCss, '', 'utf-8');
    }

    fs.rmSync(snapshotUploadsDir, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(snapshotUploadsDir), { recursive: true });
    if (fs.existsSync(LIVE_UPLOADS_DIR)) {
        fs.cpSync(LIVE_UPLOADS_DIR, snapshotUploadsDir, { recursive: true });
    } else {
        fs.mkdirSync(snapshotUploadsDir, { recursive: true });
    }
};

const restoreStoredProjectToLive = (projectPath) => {
    const snapshotContentDir = projectSnapshotContentPath(projectPath);
    const snapshotCss = projectSnapshotCssPath(projectPath);
    const snapshotUploadsDir = projectSnapshotUploadsPath(projectPath);

    fs.rmSync(LIVE_CONTENT_DIR, { recursive: true, force: true });
    if (fs.existsSync(snapshotContentDir)) {
        fs.cpSync(snapshotContentDir, LIVE_CONTENT_DIR, { recursive: true });
    } else {
        fs.mkdirSync(LIVE_CONTENT_DIR, { recursive: true });
    }

    fs.mkdirSync(path.dirname(LIVE_CUSTOM_CSS_PATH), { recursive: true });
    if (fs.existsSync(snapshotCss)) {
        fs.copyFileSync(snapshotCss, LIVE_CUSTOM_CSS_PATH);
    }

    fs.rmSync(LIVE_UPLOADS_DIR, { recursive: true, force: true });
    if (fs.existsSync(snapshotUploadsDir)) {
        fs.cpSync(snapshotUploadsDir, LIVE_UPLOADS_DIR, { recursive: true });
    } else {
        fs.mkdirSync(LIVE_UPLOADS_DIR, { recursive: true });
    }
};

const saveProjectAtPath = (projectPathInput, statePayload = {}) => {
    const initialProjectPath = normalizeProjectPath(projectPathInput);
    let projectPath = initialProjectPath;
    const previousManifest = readProjectManifest(initialProjectPath, { migrate: true });
    const now = new Date().toISOString();

    fs.mkdirSync(projectPath, { recursive: true });

    const fallbackName = path.basename(projectPath) || 'Unbenanntes Projekt';
    const name = String(statePayload?.projectName || previousManifest?.name || fallbackName).trim() || fallbackName;

    const currentDirName = path.basename(projectPath);
    const previousNameNormalized = normalizeProjectDirName(previousManifest?.name || '');
    const nextNameNormalized = normalizeProjectDirName(name);
    const shouldRenameAutoDir =
        AUTO_PROJECT_DIR_PATTERN.test(currentDirName) &&
        String(name || '').trim().length > 0;
    const shouldRenameNameDir =
        Boolean(previousNameNormalized) &&
        currentDirName === previousNameNormalized &&
        Boolean(nextNameNormalized) &&
        nextNameNormalized !== currentDirName;

    if (shouldRenameAutoDir || shouldRenameNameDir) {
        const parentDir = path.dirname(projectPath);
        const normalizedDirName = nextNameNormalized;
        if (normalizedDirName && normalizedDirName !== currentDirName) {
            const desiredPath = path.join(parentDir, normalizedDirName);
            const nextPath =
                fs.existsSync(desiredPath) && desiredPath !== projectPath
                    ? uniqueSiblingPath(parentDir, normalizedDirName)
                    : desiredPath;

            if (nextPath !== projectPath) {
                try {
                    fs.renameSync(projectPath, nextPath);
                    projectPath = nextPath;
                } catch (error) {
                    console.warn('Projektordner konnte nicht umbenannt werden:', error.message);
                }
            }
        }
    }

    const metaDir = resolveProjectMetaDir(projectPath, { forWrite: true });
    fs.mkdirSync(metaDir, { recursive: true });

    const manifest = {
        id: ensureStableProjectId(previousManifest?.id),
        name,
        path: projectPath,
        createdAt: previousManifest?.createdAt || now,
        updatedAt: now
    };

    const rawStatePayload = statePayload && typeof statePayload === 'object' ? statePayload : {};
    const { pages: _ignoredPages, ...stateWithoutPages } = rawStatePayload;

    // Keep site meta canonical in Kirby content before taking the project snapshot.
    // This closes timing gaps where footer/logo/title changed in UI but weren't yet
    // flushed to site.txt when a project switch/save is triggered.
    const hasOwn = (key) => Object.prototype.hasOwnProperty.call(rawStatePayload, key);
    const containsMetaPayload =
        hasOwn('projectName') ||
        hasOwn('siteLogoUrl') ||
        hasOwn('footerLine1') ||
        hasOwn('footerLine2') ||
        hasOwn('footerLine3');

    if (containsMetaPayload) {
        try {
            const currentMeta = readSiteMetaFromContent(LIVE_CONTENT_DIR);
            updateSiteMetaInContent(LIVE_CONTENT_DIR, {
                title: hasOwn('projectName') ? String(rawStatePayload.projectName ?? '') : currentMeta.title,
                siteLogoUrl: hasOwn('siteLogoUrl') ? String(rawStatePayload.siteLogoUrl ?? '') : currentMeta.logo,
                footerLine1: hasOwn('footerLine1') ? String(rawStatePayload.footerLine1 ?? '') : currentMeta.footerLine1,
                footerLine2: hasOwn('footerLine2') ? String(rawStatePayload.footerLine2 ?? '') : currentMeta.footerLine2,
                footerLine3: hasOwn('footerLine3') ? String(rawStatePayload.footerLine3 ?? '') : currentMeta.footerLine3
            });
        } catch (error) {
            console.warn('Site-Meta konnte vor Snapshot nicht aktualisiert werden:', error?.message || error);
        }
    }

    writeJsonFile(projectManifestPath(projectPath, { forWrite: true }), manifest);
    writeJsonFile(projectStatePath(projectPath, { forWrite: true }), stateWithoutPages);
    snapshotLiveProjectToStore(projectPath);
    touchProjectInHistory(manifest);

    return manifest;
};

const findProjectPathById = (projectId = '') => {
    const requestedId = normalizeProjectId(projectId);
    if (!requestedId) return '';

    const history = readProjectHistory();
    const directMatch = history.projects.find((entry) => entry.id === requestedId);
    if (directMatch?.path) {
        return normalizeProjectPath(directMatch.path);
    }

    for (const entry of history.projects) {
        try {
            const candidatePath = normalizeProjectPath(entry.path);
            const manifest = readProjectManifest(candidatePath, { migrate: true });
            if (manifest?.id === requestedId) {
                return candidatePath;
            }
        } catch {
            // ignore invalid history entries
        }
    }

    return '';
};

const resolveProjectPathFromRequest = ({ projectId = '', projectPath = '' } = {}) => {
    if (projectPath) {
        return normalizeProjectPath(projectPath);
    }

    if (projectId) {
        const resolved = findProjectPathById(projectId);
        if (resolved) {
            return resolved;
        }
    }

    const activeRef = getActiveProjectRef();
    if (activeRef.projectId) {
        const resolvedActivePath = findProjectPathById(activeRef.projectId);
        if (resolvedActivePath) {
            return resolvedActivePath;
        }
    }

    if (activeRef.projectPath) return activeRef.projectPath;
    throw new Error('Projekt konnte nicht gefunden werden');
};

const collectCanonicalPagesFromContent = (
    contentRoot,
    { projectPath = '', projectId = '' } = {}
) => {
    const dirs = listContentDirectories(contentRoot).filter((name) => {
        if (!name || name.startsWith('.')) return false;
        if (name === 'error' || name === PROJECT_RECOVERY_DIR_NAME) return false;
        return true;
    });

    const candidates = [];
    dirs.forEach((dirName, index) => {
        const listedMatch = dirName.match(/^(\d+)_([\s\S]+)$/);
        const isLegacyDir = /-legacy(?:-\d+)?$/i.test(dirName);
        const hasDefaultTemplate = fs.existsSync(path.join(contentRoot, dirName, 'default.txt'));

        const isManagedListed = isManagedListedDirName(dirName);
        const looksLikeBrokenListed = /^\d+_/.test(dirName) && isManagedListed === false;

        // Ignore broken listed folder names (e.g. "1_portfolio 2"), they are canonicalized away.
        if (looksLikeBrokenListed) {
            return;
        }

        if (!listedMatch && (!hasDefaultTemplate || isLegacyDir)) {
            return;
        }

        const slugSource = listedMatch?.[2] || dirName;
        const slug = sanitizeSlug(slugSource);
        if (!slug) return;

        const order = listedMatch ? parseInt(listedMatch[1], 10) || 999999 : 1000000 + index;
        const fallbackTitle = humanizeSlug(slugSource);
        const title = readPageTitleFromDirectory(contentRoot, dirName, fallbackTitle) || fallbackTitle;

        candidates.push({ slug, title, order, dirName });
    });

    candidates.sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return String(a.dirName).localeCompare(String(b.dirName), 'de', { sensitivity: 'base' });
    });

    const slugUsage = new Map();
    const canonical = [];

    for (const candidate of candidates) {
        const currentCount = slugUsage.get(candidate.slug) || 0;
        slugUsage.set(candidate.slug, currentCount + 1);
        const canonicalSlug = currentCount === 0 ? candidate.slug : `${candidate.slug}-${currentCount + 1}`;

        if (canonicalSlug !== candidate.slug) {
            appendProjectRepairLog({
                projectId,
                projectPath,
                action: 'duplicate-slug-normalized',
                details: {
                    originalSlug: candidate.slug,
                    normalizedSlug: canonicalSlug,
                    sourceDir: candidate.dirName
                }
            });
        }

        canonical.push({ slug: canonicalSlug, title: candidate.title });
    }

    return canonical;
};

const sanitizeProjectSnapshotOnOpen = (projectPath, projectId) => {
    const snapshotContentDir = projectSnapshotContentPath(projectPath, { forWrite: true });
    fs.mkdirSync(snapshotContentDir, { recursive: true });

    const canonicalPages = collectCanonicalPagesFromContent(snapshotContentDir, {
        projectPath,
        projectId
    });

    if (canonicalPages.length > 0) {
        const result = syncPagesInContent(snapshotContentDir, canonicalPages, {
            projectPath,
            projectId
        });

        appendProjectRepairLog({
            projectId,
            projectPath,
            action: 'snapshot-canonicalized',
            details: { total: result.total }
        });
    }

    return canonicalPages;
};

const openProjectByPath = (projectPathInput) => {
    const projectPath = normalizeProjectPath(projectPathInput);
    const manifest = readProjectManifest(projectPath, { migrate: true });
    if (!manifest) throw new Error('In diesem Ordner wurde kein Flider-Projekt gefunden');

    let state = readJsonFileOrNull(projectStatePath(projectPath)) || {};
    const snapshotPages = sanitizeProjectSnapshotOnOpen(projectPath, manifest.id);
    restoreStoredProjectToLive(projectPath);

    let canonicalPages = listPagesForFlatsiteUi(LIVE_CONTENT_DIR)
        .map((page) => ({
            slug: sanitizeSlug(page?.id),
            title: String(page?.title || '').trim()
        }))
        .filter((page) => page.slug && page.title);

    // One-time compatibility migration for old projects that still persisted pages in state.json.
    if (canonicalPages.length === 0 && snapshotPages.length > 0) {
        canonicalPages = snapshotPages;
    }

    if (canonicalPages.length === 0) {
        const legacyStatePages = Array.isArray(state.pages) ? state.pages : [];
        const normalizedLegacyPages = legacyStatePages
            .filter((page) => page?.selected !== false)
            .map((page) => ({
                slug: sanitizeSlug(page?.id),
                title: String(page?.title || '').trim()
            }))
            .filter((page) => page.slug && page.title);

        if (normalizedLegacyPages.length > 0) {
            syncPagesInContent(LIVE_CONTENT_DIR, normalizedLegacyPages, {
                projectPath,
                projectId: manifest.id
            });
            canonicalPages = normalizedLegacyPages;
        }
    }

    // Keep Kirby content canonical on project open so editor and app show the same pages.
    if (canonicalPages.length > 0) {
        syncPagesInContent(LIVE_CONTENT_DIR, canonicalPages, {
            projectPath,
            projectId: manifest.id
        });
    }

    // Remove legacy duplicate page source from state.json (pages now live in Kirby content only).
    if (Array.isArray(state.pages)) {
        const { pages: _legacyPages, ...stateWithoutPages } = state;
        state = stateWithoutPages;
        writeJsonFile(projectStatePath(projectPath, { forWrite: true }), stateWithoutPages);
    }

    const now = new Date().toISOString();
    const nextManifest = { ...manifest, id: ensureStableProjectId(manifest.id), updatedAt: now, path: projectPath };
    writeJsonFile(projectManifestPath(projectPath, { forWrite: true }), nextManifest);
    touchProjectInHistory(nextManifest);
    setActiveProjectRef({ projectPath, projectId: nextManifest.id });

    return { ...nextManifest, state };
};

const listProjects = () => {
    const history = readProjectHistory();
    const activeRef = getActiveProjectRef();

    const projects = [];
    const nextHistory = [];
    let historyChanged = false;
    let activeChanged = false;
    for (const entry of history.projects) {
        try {
            const projectPath = normalizeProjectPath(entry.path);
            if (!fs.existsSync(projectManifestPath(projectPath))) continue;
            const manifest = readProjectManifest(projectPath, { migrate: true });
            if (!manifest) continue;
            const manifestId = ensureStableProjectId(manifest.id);
            const state = readJsonFileOrNull(projectStatePath(projectPath)) || {};
            const stateProjectName = String(state?.projectName || '').trim();
            const manifestName = String(manifest?.name || '').trim();
            const autoDirName = path.basename(projectPath || '');
            const isActiveCandidate = activeRef.projectId
                ? manifestId === activeRef.projectId
                : activeRef.projectPath
                    ? projectPath === activeRef.projectPath
                    : false;

            // Hide aborted placeholder projects (created by "Neues Projekt" + cancel)
            // from the recent list to prevent list growth.
            const isAbortedAutoDraft =
                AUTO_PROJECT_DIR_PATTERN.test(autoDirName) &&
                AUTO_PROJECT_DIR_PATTERN.test(manifestName) &&
                stateProjectName.length === 0 &&
                state?.setupDone !== true &&
                state?.isLive !== true;

            if (isAbortedAutoDraft && !isActiveCandidate) {
                historyChanged = true;
                continue;
            }
            if (isAbortedAutoDraft && isActiveCandidate) {
                historyChanged = true;
                activeChanged = true;
                continue;
            }

            nextHistory.push({
                id: manifestId,
                name: manifest.name || entry.name || path.basename(projectPath) || 'Unbenanntes Projekt',
                path: projectPath,
                createdAt: manifest.createdAt || entry.createdAt || null,
                updatedAt: manifest.updatedAt || entry.updatedAt || null
            });

            projects.push({
                id: manifestId,
                name: manifest.name || entry.name || path.basename(projectPath) || 'Unbenanntes Projekt',
                path: projectPath,
                createdAt: manifest.createdAt || null,
                updatedAt: manifest.updatedAt || entry.updatedAt || null,
                isActive: isActiveCandidate
            });
        } catch {
            // ignore invalid history entries
        }
    }

    projects.sort((a, b) => {
        const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
    });

    if (historyChanged) {
        writeProjectHistory({ projects: nextHistory.slice(0, 50) });
    }
    if (activeChanged) {
        setActiveProjectRef({ projectPath: '', projectId: '' });
    }

    return projects;
};

const PRECHECK_DISK_WARNING_BYTES = 500 * 1024 * 1024; // 500 MB
const PRECHECK_DISK_CRITICAL_BYTES = 100 * 1024 * 1024; // 100 MB
const RUNTIME_PIDS_DIR = path.join(APP_ROOT, '.runtime', 'pids');

const buildPreflightCheck = ({
    id,
    label,
    ok,
    severity = 'info',
    status = 'ok',
    message = '',
    details = {}
} = {}) => ({
    id: String(id || ''),
    label: String(label || ''),
    ok: Boolean(ok),
    severity: String(severity || 'info'),
    status: String(status || 'ok'),
    message: String(message || ''),
    details: details && typeof details === 'object' ? details : {}
});

const probeWritableDirectory = ({
    id,
    label,
    targetPath = '',
    required = false,
    createIfMissing = true
} = {}) => {
    const normalizedTarget = String(targetPath || '').trim();

    if (!normalizedTarget) {
        return buildPreflightCheck({
            id,
            label,
            ok: required === false,
            severity: required ? 'critical' : 'warning',
            status: 'missing',
            message: required
                ? 'Pfad fehlt und ist erforderlich'
                : 'Pfad ist nicht gesetzt',
            details: { path: '' }
        });
    }

    try {
        if (!fs.existsSync(normalizedTarget) && createIfMissing) {
            fs.mkdirSync(normalizedTarget, { recursive: true });
        }

        if (!fs.existsSync(normalizedTarget) || !fs.statSync(normalizedTarget).isDirectory()) {
            return buildPreflightCheck({
                id,
                label,
                ok: false,
                severity: required ? 'critical' : 'warning',
                status: 'invalid',
                message: 'Pfad existiert nicht als Ordner',
                details: { path: normalizedTarget }
            });
        }

        fs.accessSync(normalizedTarget, fs.constants.R_OK | fs.constants.W_OK);
        const probeFile = path.join(
            normalizedTarget,
            `.flider-preflight-${Date.now()}-${process.pid}.tmp`
        );
        fs.writeFileSync(probeFile, 'ok', 'utf-8');
        fs.rmSync(probeFile, { force: true });

        return buildPreflightCheck({
            id,
            label,
            ok: true,
            status: 'ok',
            message: 'Schreibrechte vorhanden',
            details: { path: normalizedTarget }
        });
    } catch (error) {
        return buildPreflightCheck({
            id,
            label,
            ok: false,
            severity: required ? 'critical' : 'warning',
            status: 'permission-denied',
            message: 'Ordner ist nicht beschreibbar',
            details: {
                path: normalizedTarget,
                error: String(error?.message || 'permission denied')
            }
        });
    }
};

const probeDiskFreeSpace = (targetPathInput = '') => {
    const targetPath = String(targetPathInput || '').trim() || APP_ROOT;

    if (typeof fs.statfsSync !== 'function') {
        return buildPreflightCheck({
            id: 'diskSpace',
            label: 'Freier Speicher',
            ok: true,
            severity: 'warning',
            status: 'unsupported',
            message: 'Dateisystem-Check nicht verfuegbar',
            details: { path: targetPath, freeBytes: null }
        });
    }

    try {
        const stats = fs.statfsSync(targetPath);
        const freeBytes = Number(stats.bavail || 0) * Number(stats.bsize || 0);

        if (!Number.isFinite(freeBytes) || freeBytes < 0) {
            throw new Error('ungueltiger freier Speicherwert');
        }

        if (freeBytes < PRECHECK_DISK_CRITICAL_BYTES) {
            return buildPreflightCheck({
                id: 'diskSpace',
                label: 'Freier Speicher',
                ok: false,
                severity: 'critical',
                status: 'critical-low',
                message: 'Sehr wenig freier Speicher verfuegbar',
                details: {
                    path: targetPath,
                    freeBytes,
                    warningBelow: PRECHECK_DISK_WARNING_BYTES,
                    criticalBelow: PRECHECK_DISK_CRITICAL_BYTES
                }
            });
        }

        if (freeBytes < PRECHECK_DISK_WARNING_BYTES) {
            return buildPreflightCheck({
                id: 'diskSpace',
                label: 'Freier Speicher',
                ok: false,
                severity: 'warning',
                status: 'low',
                message: 'Freier Speicher ist niedrig',
                details: {
                    path: targetPath,
                    freeBytes,
                    warningBelow: PRECHECK_DISK_WARNING_BYTES,
                    criticalBelow: PRECHECK_DISK_CRITICAL_BYTES
                }
            });
        }

        return buildPreflightCheck({
            id: 'diskSpace',
            label: 'Freier Speicher',
            ok: true,
            status: 'ok',
            message: 'Speicher ausreichend',
            details: {
                path: targetPath,
                freeBytes,
                warningBelow: PRECHECK_DISK_WARNING_BYTES,
                criticalBelow: PRECHECK_DISK_CRITICAL_BYTES
            }
        });
    } catch (error) {
        return buildPreflightCheck({
            id: 'diskSpace',
            label: 'Freier Speicher',
            ok: true,
            severity: 'warning',
            status: 'unknown',
            message: 'Freier Speicher konnte nicht ermittelt werden',
            details: {
                path: targetPath,
                error: String(error?.message || 'statfs failed')
            }
        });
    }
};

const probeRuntimePidFiles = () => {
    const staleFiles = [];

    try {
        if (!fs.existsSync(RUNTIME_PIDS_DIR)) {
            return buildPreflightCheck({
                id: 'runtimePidFiles',
                label: 'Runtime Lock/PID Dateien',
                ok: true,
                status: 'ok',
                message: 'Keine PID-Ordner gefunden',
                details: { staleFiles: [] }
            });
        }

        const entries = fs.readdirSync(RUNTIME_PIDS_DIR).filter((entry) => entry.endsWith('.pid'));
        for (const entry of entries) {
            const filePath = path.join(RUNTIME_PIDS_DIR, entry);
            const rawPid = String(fs.readFileSync(filePath, 'utf-8') || '').trim();
            const pid = Number(rawPid);

            if (!Number.isInteger(pid) || pid <= 0) {
                staleFiles.push(filePath);
                continue;
            }

            try {
                process.kill(pid, 0);
            } catch (error) {
                if (error?.code === 'ESRCH') {
                    staleFiles.push(filePath);
                }
            }
        }

        if (staleFiles.length > 0) {
            return buildPreflightCheck({
                id: 'runtimePidFiles',
                label: 'Runtime Lock/PID Dateien',
                ok: false,
                severity: 'warning',
                status: 'stale',
                message: 'Veraltete PID-Dateien erkannt',
                details: { staleFiles }
            });
        }

        return buildPreflightCheck({
            id: 'runtimePidFiles',
            label: 'Runtime Lock/PID Dateien',
            ok: true,
            status: 'ok',
            message: 'Keine veralteten PID-Dateien',
            details: { staleFiles: [] }
        });
    } catch (error) {
        return buildPreflightCheck({
            id: 'runtimePidFiles',
            label: 'Runtime Lock/PID Dateien',
            ok: true,
            severity: 'warning',
            status: 'unknown',
            message: 'PID-Status konnte nicht geprueft werden',
            details: { error: String(error?.message || 'pid check failed') }
        });
    }
};

app.get('/api/system/health', async (req, res) => {
    try {
        const [backend, frontend, kirby] = await Promise.all([
            probeHttpService('backend', `${BACKEND_LOCAL_ORIGIN}/api/project-signature`, {
                acceptedStatus: [200],
                timeoutMs: 1800
            }),
            probeHttpService('frontend', `${FRONTEND_LOCAL_ORIGIN}/`, {
                acceptedStatus: [200],
                timeoutMs: 1800
            }),
            probeHttpService('kirby', `${KIRBY_LOCAL_ORIGIN}/`, {
                acceptedStatus: [200, 302],
                timeoutMs: 2200
            })
        ]);

        const allHealthy = backend.up && frontend.up && kirby.up;
        const recoverySteps = allHealthy
            ? []
            : [
                'npm run dev:bg:ensure',
                'npm run dev:bg:status',
                'npm run dev:bg:logs'
            ];

        res.json({
            success: allHealthy,
            health: { backend, frontend, kirby },
            recoverySteps
        });
    } catch (error) {
        res.json({
            success: false,
            health: null,
            recoverySteps: [
                'npm run dev:bg:ensure',
                'npm run dev:bg:status',
                'npm run dev:bg:logs'
            ],
            error: String(error?.message || 'health-check failed')
        });
    }
});

app.get('/api/system/preflight', async (req, res) => {
    try {
        const [backend, frontend, kirby] = await Promise.all([
            probeHttpService('backend', `${BACKEND_LOCAL_ORIGIN}/api/project-signature`, {
                acceptedStatus: [200],
                timeoutMs: 1800
            }),
            probeHttpService('frontend', `${FRONTEND_LOCAL_ORIGIN}/`, {
                acceptedStatus: [200],
                timeoutMs: 1800
            }),
            probeHttpService('kirby', `${KIRBY_LOCAL_ORIGIN}/`, {
                acceptedStatus: [200, 302],
                timeoutMs: 2200
            })
        ]);

        const preferences = getProjectPreferences();
        const activeRef = getActiveProjectRef();
        const defaultProjectsRoot = String(preferences.defaultProjectsRoot || '').trim();
        const activeProjectPath = String(activeRef.projectPath || '').trim();
        const diskProbePath = activeProjectPath || defaultProjectsRoot || FLIDER_RUNTIME_ROOT || APP_ROOT;

        const checks = {
            defaultProjectsRoot: probeWritableDirectory({
                id: 'defaultProjectsRoot',
                label: 'Standard-Projektordner',
                targetPath: defaultProjectsRoot,
                required: false
            }),
            activeProjectPath: probeWritableDirectory({
                id: 'activeProjectPath',
                label: 'Aktives Projekt',
                targetPath: activeProjectPath,
                required: Boolean(activeProjectPath)
            }),
            diskSpace: probeDiskFreeSpace(diskProbePath),
            runtimePidFiles: probeRuntimePidFiles()
        };

        const healthChecks = [backend, frontend, kirby];
        const servicesHealthy = healthChecks.every((service) => service.up === true);
        const preflightChecks = Object.values(checks);

        const issues = [];
        if (!servicesHealthy) {
            issues.push({
                code: 'SRV_UNHEALTHY',
                severity: 'P1',
                message: 'Mindestens ein lokaler Dienst ist nicht erreichbar'
            });
        }

        for (const check of preflightChecks) {
            if (check.ok === true) continue;

            if (check.id === 'diskSpace' && check.status === 'critical-low') {
                issues.push({
                    code: 'FS_DISK_LOW',
                    severity: 'P1',
                    message: check.message
                });
                continue;
            }

            if (
                (check.id === 'activeProjectPath' || check.id === 'defaultProjectsRoot') &&
                check.status === 'permission-denied'
            ) {
                issues.push({
                    code: 'FS_PERMISSION_DENIED',
                    severity: check.id === 'activeProjectPath' ? 'P1' : 'P2',
                    message: check.message
                });
                continue;
            }

            if (check.id === 'runtimePidFiles') {
                issues.push({
                    code: 'SRV_UNHEALTHY',
                    severity: 'P2',
                    message: check.message
                });
            }
        }

        const hasBlockingIssue =
            servicesHealthy === false ||
            preflightChecks.some(
                (check) =>
                    check.ok === false &&
                    (check.severity === 'critical' ||
                        (check.id === 'activeProjectPath' && check.severity !== 'warning'))
            );

        const recoverySteps = hasBlockingIssue
            ? [
                'npm run dev:bg:ensure',
                'npm run dev:bg:status',
                'npm run dev:bg:logs'
            ]
            : [];

        res.json({
            success: !hasBlockingIssue,
            health: { backend, frontend, kirby },
            preflight: {
                checkedAt: new Date().toISOString(),
                checks,
                context: {
                    defaultProjectsRoot: defaultProjectsRoot || null,
                    activeProjectPath: activeProjectPath || null
                }
            },
            issues,
            recoverySteps
        });
    } catch (error) {
        res.json({
            success: false,
            health: null,
            preflight: null,
            issues: [
                {
                    code: 'SRV_UNHEALTHY',
                    severity: 'P1',
                    message: String(error?.message || 'Preflight fehlgeschlagen')
                }
            ],
            recoverySteps: [
                'npm run dev:bg:ensure',
                'npm run dev:bg:status',
                'npm run dev:bg:logs'
            ],
            error: String(error?.message || 'preflight failed')
        });
    }
});

app.post('/api/system/pick-folder', express.json(), async (req, res) => {
    const prompt = String(req.body?.prompt || 'Wähle einen Ordner');
    const requestedInitial = String(req.body?.initialPath || '').trim();
    const uiConfig = readUiConfig();
    let initialPath =
        requestedInitial ||
        String(uiConfig.defaultProjectsRoot || '').trim() ||
        String(uiConfig.lastPickerPath || '').trim() ||
        path.join(os.homedir(), 'Documents');

    try {
        initialPath = normalizeProjectPath(initialPath);
    } catch {
        initialPath = path.join(os.homedir(), 'Documents');
    }

    if (!fs.existsSync(initialPath)) {
        initialPath = path.join(os.homedir(), 'Documents');
    }

    try {
        const platform = os.platform();
        let result = '';

        if (platform === 'darwin') {
            const jxaScript = `
const app = Application.currentApplication();
app.includeStandardAdditions = true;
const prompt = ${JSON.stringify(prompt)};
const initialPath = ${JSON.stringify(initialPath)};

const isCanceled = (error) => {
  const message = String((error && error.message) || error || "");
  return message.includes("-128") || /User cancelled|User canceled|abgebrochen/i.test(message);
};

let chosen = null;
let output = "";

try {
  chosen = app.chooseFolder({
    withPrompt: prompt,
    defaultLocation: Path(initialPath)
  });
} catch (error) {
  if (isCanceled(error)) {
    output = "__CANCELED__";
  } else {
    try {
      chosen = app.chooseFolder({ withPrompt: prompt });
    } catch (fallbackError) {
      if (isCanceled(fallbackError)) {
        output = "__CANCELED__";
      } else {
        throw fallbackError;
      }
    }
  }
}

if (chosen) {
  output = chosen.toString();
}

output;
`;
            const { stdout } = await execPromise(`osascript -l JavaScript -e ${shQuote(jxaScript)}`);
            result = String(stdout || '').trim();
        } else if (platform === 'win32') {
            const psEscape = (value = '') => String(value).replace(/'/g, "''");
            const psScript = `
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = '${psEscape(prompt)}'
$dialog.ShowNewFolderButton = $true
if (Test-Path '${psEscape(initialPath)}') { $dialog.SelectedPath = '${psEscape(initialPath)}' }
$result = $dialog.ShowDialog()
if ($result -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.SelectedPath }
`;
            const { stdout } = await execPromise(`powershell -NoProfile -ExecutionPolicy Bypass -Command ${shQuote(psScript)}`);
            result = String(stdout || '').trim();
        } else {
            try {
                const zenityDir = initialPath.endsWith(path.sep) ? initialPath : `${initialPath}${path.sep}`;
                const { stdout } = await execPromise(
                    `zenity --file-selection --directory --title=${shQuote(prompt)} --filename=${shQuote(zenityDir)}`
                );
                result = String(stdout || '').trim();
            } catch (zenityErr) {
                const zenityMsg = String(zenityErr?.message || '');
                if (/command not found|not found/i.test(zenityMsg)) {
                    const { stdout } = await execPromise(
                        `kdialog --getexistingdirectory ${shQuote(initialPath)} --title ${shQuote(prompt)}`
                    );
                    result = String(stdout || '').trim();
                } else {
                    throw zenityErr;
                }
            }
        }

        if (!result || result === '__CANCELED__') {
            return res.json({ success: true, canceled: true });
        }

        const folderPath = normalizeProjectPath(result);
        writeUiConfig({ ...uiConfig, lastPickerPath: folderPath });
        res.json({ success: true, canceled: false, path: folderPath });
    } catch (err) {
        const message = String(err?.message || '');
        if (message.includes('-128') || /User canceled/i.test(message)) {
            return res.json({ success: true, canceled: true });
        }
        console.error('Fehler beim Öffnen des Ordnerdialogs:', err);
        res.status(500).json({
            success: false,
            error: `Ordner-Auswahl konnte nicht geöffnet werden (${message || 'unbekannter Fehler'})`
        });
    }
});

// ENDPOINTS: PROJECT MANAGEMENT
app.get('/api/projects/preferences', (req, res) => {
    try {
        const preferences = getProjectPreferences();
        res.json({ success: true, preferences });
    } catch (err) {
        console.error('Fehler beim Laden der Projekt-Praeferenzen:', err);
        res.status(500).json({ success: false, error: 'Projekt-Praeferenzen konnten nicht geladen werden' });
    }
});

app.post('/api/projects/preferences', express.json(), (req, res) => {
    try {
        const uiConfig = readUiConfig();
        const requested = String(req.body?.defaultProjectsRoot || '').trim();

        if (!requested) {
            writeUiConfig({
                ...uiConfig,
                defaultProjectsRoot: '',
                lastPickerPath: String(uiConfig.lastPickerPath || '').trim()
            });
            return res.json({ success: true, preferences: { defaultProjectsRoot: '' } });
        }

        const normalized = normalizeProjectPath(requested);
        fs.mkdirSync(normalized, { recursive: true });

        writeUiConfig({
            ...uiConfig,
            defaultProjectsRoot: normalized,
            lastPickerPath: normalized
        });

        res.json({ success: true, preferences: { defaultProjectsRoot: normalized } });
    } catch (err) {
        console.error('Fehler beim Speichern der Projekt-Praeferenzen:', err);
        res.status(400).json({ success: false, error: err.message || 'Projekt-Praeferenzen konnten nicht gespeichert werden' });
    }
});

app.post('/api/projects/allocate-path', express.json(), (req, res) => {
    try {
        const fallbackRoot = getProjectPreferences().defaultProjectsRoot;
        const requestedRoot = String(req.body?.rootPath || '').trim() || fallbackRoot;
        const rootPath = normalizeProjectPath(requestedRoot);
        fs.mkdirSync(rootPath, { recursive: true });

        const now = new Date();
        const yyyy = String(now.getFullYear());
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        const baseName = `projekt-${yyyy}${mm}${dd}-${hh}${min}${ss}`;

        let suffix = 0;
        let candidatePath = path.join(rootPath, baseName);
        while (fs.existsSync(candidatePath)) {
            suffix += 1;
            candidatePath = path.join(rootPath, `${baseName}-${suffix}`);
        }

        res.json({ success: true, projectPath: candidatePath });
    } catch (err) {
        console.error('Fehler beim Reservieren eines Projektordners:', err);
        res.status(400).json({ success: false, error: err.message || 'Projektordner konnte nicht vorbereitet werden' });
    }
});

app.get('/api/projects/list', (req, res) => {
    try {
        const projects = listProjects();
        const activeRef = getActiveProjectRef();
        res.json({
            success: true,
            projects,
            activeProjectPath: activeRef.projectPath || null,
            activeProjectId: activeRef.projectId || null
        });
    } catch (err) {
        console.error('Fehler beim Laden der Projekte:', err);
        res.status(500).json({ success: false, error: 'Projekte konnten nicht geladen werden' });
    }
});

app.post('/api/projects/create', express.json(), async (req, res) => {
    try {
        const projectPath = normalizeProjectPath(req.body?.projectPath || '');
        const state = req.body?.state || {};
        const project = await withProjectLock(projectPath, () =>
            withLiveContentLock(() => saveProjectAtPath(projectPath, state))
        );
        setActiveProjectRef({ projectPath: project.path, projectId: project.id });
        res.json({ success: true, project });
    } catch (err) {
        console.error('Fehler beim Erstellen des Projekts:', err);
        res.status(400).json({ success: false, error: err.message || 'Projekt konnte nicht erstellt werden' });
    }
});

app.post('/api/projects/save', express.json(), async (req, res) => {
    try {
        const requestedId = normalizeProjectId(req.body?.projectId);
        const requestedPathInput = String(req.body?.projectPath || '').trim();
        if (!requestedId || !requestedPathInput) {
            return res.status(400).json({
                success: false,
                error: 'Speichern erfordert projectId und projectPath'
            });
        }

        const projectPath = normalizeProjectPath(requestedPathInput);
        const resolvedPathById = findProjectPathById(requestedId);
        if (!resolvedPathById) {
            return res.status(404).json({
                success: false,
                error: 'Projekt-ID konnte nicht aufgeloest werden'
            });
        }
        if (resolvedPathById !== projectPath) {
            return res.status(409).json({
                success: false,
                error: 'Projektkontext-Konflikt (ID/Pfad)'
            });
        }

        const activeRef = getActiveProjectRef();
        const activeId = normalizeProjectId(activeRef.projectId);
        const activePath = activeRef.projectPath ? normalizeProjectPath(activeRef.projectPath) : '';

        if ((activeId && activeId !== requestedId) || (activePath && activePath !== projectPath)) {
            return res.status(409).json({
                success: false,
                error: 'Projektkontext hat gewechselt. Bitte Projekt neu oeffnen.'
            });
        }

        const state = req.body?.state || {};
        const project = await withProjectLock(projectPath, () =>
            withLiveContentLock(() => saveProjectAtPath(projectPath, state))
        );
        res.json({ success: true, project });
    } catch (err) {
        console.error('Fehler beim Speichern des Projekts:', err);
        res.status(400).json({ success: false, error: err.message || 'Projekt konnte nicht gespeichert werden' });
    }
});

app.post('/api/projects/open', express.json(), async (req, res) => {
    try {
        const projectPath = resolveProjectPathFromRequest({
            projectId: req.body?.projectId,
            projectPath: req.body?.projectPath
        });
        const project = await withProjectLock(projectPath, () =>
            withLiveContentLock(() => openProjectByPath(projectPath))
        );
        res.json({ success: true, project });
    } catch (err) {
        console.error('Fehler beim Oeffnen des Projekts:', err);
        res.status(404).json({ success: false, error: err.message || 'Projekt konnte nicht geoeffnet werden' });
    }
});

app.get('/api/projects/current', async (req, res) => {
    try {
        const activeRef = getActiveProjectRef();
        const activePath = resolveProjectPathFromRequest({
            projectId: activeRef.projectId,
            projectPath: activeRef.projectPath
        });
        if (!activePath) {
            return res.json({ success: true, project: null });
        }
        const project = await withProjectLock(activePath, () =>
            withLiveContentLock(() => openProjectByPath(activePath))
        );
        res.json({ success: true, project });
    } catch {
        res.json({ success: true, project: null });
    }
});

// ENDPOINT: START PHP SERVER (Kirby CMS)
app.post('/api/start-kirby', async (req, res) => {
    try {
        if (await isKirbyReachable()) {
            return res.json({ success: true, message: 'Kirby Server läuft bereits.' });
        }
        res.status(503).json({
            success: false,
            error: 'Kirby Server ist offline. Bitte den Dev-Stack mit "npm run dev" neu starten.'
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message || 'Kirby Server konnte nicht gestartet werden' });
    }
});

// ENDPOINT: PROJECT SIGNATURE (detect editor-side content changes for publish state)
app.get('/api/project-signature', (req, res) => {
    try {
        const signature = computeProjectSignature();
        res.json({ success: true, signature });
    } catch (err) {
        console.error('Fehler beim Berechnen der Projekt-Signatur:', err);
        res.status(500).json({ success: false, error: 'Projekt-Signatur konnte nicht berechnet werden' });
    }
});


// ENDPOINT: DEPLOY VIA FTP
app.post('/api/deploy', async (req, res) => {
    const {
        host,
        user,
        password,
        port = 21,
        targetPath = '/',
        websiteUrl = '',
        deployMode = 'auto',
        siteTitle = '',
        footerLine1 = '',
        footerLine2 = '',
        footerLine3 = ''
    } = req.body ?? {};
    const kirbyRoot = KIRBY_ROOT;

    if (!host || !user || !password) {
        return res.status(400).json({ error: 'Fehlende FTP Credentials' });
    }

    if (!fs.existsSync(kirbyRoot)) {
        return res.status(404).json({ error: 'Kirby Projektordner fehlt!' });
    }

    const parsedPort = parseInt(port, 10);
    let normalizedTargetPath = '/';
    let normalizedWebsiteUrl = '';
    let sourceFolder = '';
    let cleanupStaticExport = () => {};
    let activeProjectPath = '';
    let activeProjectId = '';
    let activeProjectName = '';
    let deployManifest = null;
    let assetReport = {
        referenced: 0,
        warmed: 0,
        warmFailed: 0,
        copied: 0
    };

    if (deployInProgress) {
        return res.status(409).json({
            error: 'Ein Deployment laeuft bereits. Bitte kurz warten und erneut versuchen.'
        });
    }

    deployInProgress = true;

    try {
        normalizedTargetPath = normalizeTargetPath(targetPath);
        normalizedWebsiteUrl = normalizeWebsiteUrl(websiteUrl);
    } catch (error) {
        deployInProgress = false;
        return res.status(400).json({ error: error.message || 'Ungueltige Deploy-Parameter' });
    }

    try {
        try {
            const activeRef = getActiveProjectRef();
            activeProjectPath = resolveProjectPathFromRequest({
                projectId: activeRef.projectId,
                projectPath: activeRef.projectPath
            });
            const activeProject = await withProjectLock(
                activeProjectPath,
                () => withLiveContentLock(() => openProjectByPath(activeProjectPath))
            );
            activeProjectId = normalizeProjectId(activeProject?.id);
            activeProjectName = String(activeProject?.name || '').trim();
        } catch (projectError) {
            throw new Error(
                `Kein aktives Projekt für Deploy verfügbar (${projectError?.message || 'Projekt konnte nicht geladen werden'})`
            );
        }

        const staticExport = await withLiveContentLock(async () => {
            updateSiteMetaInContent(path.join(kirbyRoot, 'content'), {
                title: siteTitle,
                footerLine1,
                footerLine2,
                footerLine3
            });
            if (activeProjectPath) {
                await withProjectLock(activeProjectPath, () => {
                    snapshotLiveProjectToStore(activeProjectPath);
                });
            }

            return buildStaticDeploySource({
                kirbyRoot,
                websiteUrl: normalizedWebsiteUrl,
                targetPath: normalizedTargetPath
            });
        });
        sourceFolder = staticExport.sourceFolder;
        assetReport = staticExport.assetReport || assetReport;
        cleanupStaticExport = staticExport.cleanup;

        // Build a deterministic deploy manifest for remote stale cleanup.
        writeDeployManifestToSource({
            sourceFolder,
            payload: buildDeployManifestPayload({
                projectId: activeProjectId,
                projectPath: activeProjectPath,
                targetPath: normalizedTargetPath,
                websiteUrl: normalizedWebsiteUrl,
                filePaths: []
            })
        });
        const exportFiles = listFilesRecursive(sourceFolder);
        deployManifest = buildDeployManifestPayload({
            projectId: activeProjectId,
            projectPath: activeProjectPath,
            targetPath: normalizedTargetPath,
            websiteUrl: normalizedWebsiteUrl,
            filePaths: exportFiles
        });
        writeDeployManifestToSource({
            sourceFolder,
            payload: deployManifest
        });

        ensureLocalExportHasStartFile(sourceFolder);

        console.log(
            `Static Export erstellt (${staticExport.pageCount} Seiten, ` +
            `${assetReport.referenced} Assets referenziert, ${assetReport.copied} kopiert, ` +
            `${assetReport.warmFailed} Warmup-Fehler): ${sourceFolder}`
        );
        console.log(`Starte Deployment zu ${host} auf Port ${parsedPort} (Zielpfad: ${normalizedTargetPath})...`);

        if (parsedPort === 22) {
            // SFTP (SSH Protocol) via ssh2-sftp-client
            const sftp = new SftpClient();
            let staleCleanup = { staleFiles: 0, staleDirs: 0 };
            try {
                await sftp.connect({
                    host: host,
                    port: 22,
                    username: user,
                    password: password,
                    readyTimeout: 10000 // 10 seconds timeout
                });
                console.log("SFTP Verbindung hergestellt! Lade Dateien hoch...");

                let previousRemoteManifest = null;
                if (normalizedTargetPath === '/') {
                    previousRemoteManifest = await readRemoteDeployManifestSftp(sftp, normalizedTargetPath);
                }
                if (normalizedTargetPath === '/') {
                    await cleanupManagedMediaSftp(sftp, normalizedTargetPath);
                    if (previousRemoteManifest && deployManifest) {
                        staleCleanup = await removeRemoteStaleFromManifestSftp(
                            sftp,
                            normalizedTargetPath,
                            previousRemoteManifest,
                            deployManifest
                        );
                    }
                }

                await sftp.mkdir(normalizedTargetPath, true);
                // Upload the entire directory
                await sftp.uploadDir(sourceFolder, normalizedTargetPath);
                const verifiedStartFile = await waitForRemoteStartFileSftp(sftp, normalizedTargetPath);
                console.log(`SFTP Upload erfolgreich (Startdatei: ${verifiedStartFile}).`);
            } finally {
                await sftp.end().catch(() => {});
            }
            res.json({
                success: true,
                mode: 'direct',
                targetPath: normalizedTargetPath,
                verifiedStartFile: true,
                assetReport,
                staleCleanup,
                project: {
                    id: activeProjectId || null,
                    name: activeProjectName || null
                },
                log: `Erfolgreich nach ${host} (via SFTP) hochgeladen. Zielpfad: ${normalizedTargetPath}`
            });

        } else {
            // Standard FTP / FTPES via basic-ftp
            // Hostpoint Erfordert oft explizites FTPES (FTP over explicit TLS) auf Port 21
            const client = new Client();
            // client.ftp.verbose = true;
            try {
                await client.access({
                    host: host,
                    user: user,
                    password: password,
                    port: parsedPort || 21,
                    secure: true,
                    secureOptions: { rejectUnauthorized: false }
                });

                const wantsZip = deployMode === 'zip' || (deployMode === 'auto' && Boolean(normalizedWebsiteUrl));
                const deployId = Date.now();
                const supportsStagingSwap = normalizedTargetPath !== '/';
                const stagingPath = supportsStagingSwap
                    ? normalizeTargetPath(`${normalizedTargetPath}.staging-${deployId}`)
                    : normalizedTargetPath;
                const archiveName = 'flatsite-deploy.zip';

                console.log(`FTPES Verbindung hergestellt. Modus: ${wantsZip ? 'ZIP' : 'DIRECT'}`);

                let staleCleanup = { staleFiles: 0, staleDirs: 0 };
                let previousRemoteManifest = null;
                if (normalizedTargetPath === '/') {
                    previousRemoteManifest = await readRemoteDeployManifestFtp(client, normalizedTargetPath);
                }
                if (normalizedTargetPath === '/') {
                    await cleanupManagedMediaFtp(client, normalizedTargetPath);
                    if (previousRemoteManifest && deployManifest) {
                        staleCleanup = await removeRemoteStaleFromManifestFtp(
                            client,
                            normalizedTargetPath,
                            previousRemoteManifest,
                            deployManifest
                        );
                    }
                }

                if (supportsStagingSwap) {
                    await removeFtpPathIfExists(client, stagingPath);
                }
                await client.ensureDir(stagingPath);

                if (wantsZip) {
                    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flatsite-deploy-'));
                    const zipPath = path.join(tmpDir, archiveName);
                    const token = crypto.randomBytes(24).toString('hex');
                    const unzipScriptPath = path.join(tmpDir, 'flatsite-unzip.php');

                    try {
                        await createDeployZip(sourceFolder, zipPath);
                        fs.writeFileSync(unzipScriptPath, buildUnzipScript(token), 'utf-8');

                        await client.uploadFrom(zipPath, archiveName);
                        await client.uploadFrom(unzipScriptPath, 'flatsite-unzip.php');

                        const triggerUrls = buildUnzipTriggerUrls({
                            websiteUrl: normalizedWebsiteUrl,
                            host,
                            targetPath: stagingPath,
                            token,
                            archive: archiveName
                        });

                        const triggerResult = await triggerRemoteUnzip(triggerUrls);

                        if (triggerResult.ok) {
                            const verifiedStartFile = await waitForRemoteStartFileFtp(client, {
                                remotePath: stagingPath
                            });
                            if (supportsStagingSwap) {
                                await promoteFtpStagingDirectory(client, {
                                    targetPath: normalizedTargetPath,
                                    stagingPath,
                                    deployId
                                });
                                await waitForRemoteStartFileFtp(client, {
                                    remotePath: normalizedTargetPath
                                });
                            }
                            res.json({
                                success: true,
                                mode: 'zip',
                                targetPath: normalizedTargetPath,
                                triggerUrl: triggerResult.url,
                                verifiedStartFile,
                                assetReport,
                                staleCleanup,
                                project: {
                                    id: activeProjectId || null,
                                    name: activeProjectName || null
                                },
                                log: `Erfolgreich nach ${host} (via FTPES, ZIP) deployed. ZIP wurde serverseitig entpackt. Zielpfad: ${normalizedTargetPath}. Trigger: ${triggerResult.url}`
                            });
                            return;
                        }

                        console.warn('ZIP Trigger fehlgeschlagen, fallback auf Direkt-Upload...', triggerResult.attempts);

                        if (supportsStagingSwap) {
                            await removeFtpPathIfExists(client, stagingPath);
                        }
                        await client.ensureDir(stagingPath);
                        await client.uploadFromDir(sourceFolder, '.');
                        const verifiedStartFile = await waitForRemoteStartFileFtp(client, {
                            remotePath: stagingPath
                        });
                        if (supportsStagingSwap) {
                            await promoteFtpStagingDirectory(client, {
                                targetPath: normalizedTargetPath,
                                stagingPath,
                                deployId
                            });
                            await waitForRemoteStartFileFtp(client, {
                                remotePath: normalizedTargetPath
                            });
                        }

                        res.json({
                            success: true,
                            mode: 'direct-fallback',
                            targetPath: normalizedTargetPath,
                            verifiedStartFile,
                            assetReport,
                            staleCleanup,
                            project: {
                                id: activeProjectId || null,
                                name: activeProjectName || null
                            },
                            warning: 'ZIP Upload war erfolgreich, automatisches Entpacken aber nicht erreichbar. Fallback Direkt-Upload wurde ausgeführt.',
                            attempts: triggerResult.attempts,
                            log: `Erfolgreich nach ${host} (via FTPES) hochgeladen. ZIP-Trigger nicht erreichbar, daher Fallback Direkt-Upload. Zielpfad: ${normalizedTargetPath}`
                        });
                        return;
                    } finally {
                        fs.rmSync(tmpDir, { recursive: true, force: true });
                    }
                }

                await client.uploadFromDir(sourceFolder, '.');
                const verifiedStartFile = await waitForRemoteStartFileFtp(client, {
                    remotePath: stagingPath
                });
                if (supportsStagingSwap) {
                    await promoteFtpStagingDirectory(client, {
                        targetPath: normalizedTargetPath,
                        stagingPath,
                        deployId
                    });
                    await waitForRemoteStartFileFtp(client, {
                        remotePath: normalizedTargetPath
                    });
                }
                res.json({
                    success: true,
                    mode: 'direct',
                    targetPath: normalizedTargetPath,
                    verifiedStartFile,
                    assetReport,
                    staleCleanup,
                    project: {
                        id: activeProjectId || null,
                        name: activeProjectName || null
                    },
                    log: `Erfolgreich nach ${host} (via FTPES) hochgeladen. Zielpfad: ${normalizedTargetPath}`
                });
            } finally {
                client.close();
            }
        }

    } catch (err) {
        console.error("Deployment Fehler:", err);
        res.status(500).json({ error: err.message, log: err.toString() });
    } finally {
        try {
            cleanupStaticExport();
        } catch {
            // ignore cleanup errors
        }
        deployInProgress = false;
    }
});


// ENDPOINT: UPDATE THEME VARIABLES (CSS Manipulation)
app.post('/api/update-theme', (req, res) => {
    const { font, fontHeading, fontBody, colorPrimary, colorBg, colorText } = req.body;
    const cssPath = LIVE_CUSTOM_CSS_PATH;
    const resolvedBodyFont = fontBody || font || '"Inter", sans-serif';
    const resolvedHeadingFont = fontHeading || font || '"Inter", sans-serif';

    // This simulates injecting Flatsite's choices into the Kirby Theme
    const cssContent = `:root {
  --color-primary: ${colorPrimary || '#000'};
  --color-background: ${colorBg || '#fff'};
  --color-text: ${colorText || '#000'};
  --font-family: ${resolvedBodyFont};
  --color-bg: var(--color-background);
  --color-accent: var(--color-primary);
  --font-primary: ${resolvedBodyFont};
  --font-heading: ${resolvedHeadingFont};
}`;

    try {
        // Falls assets/css nicht existiert, erstellen
        const cssDir = path.dirname(cssPath);
        if (!fs.existsSync(cssDir)) {
            fs.mkdirSync(cssDir, { recursive: true });
        }

        fs.writeFileSync(cssPath, cssContent);
        res.json({ success: true });
    } catch (err) {
        console.error('Fehler beim Aktualisieren des CSS:', err);
        res.status(500).json({ error: 'Fehler beim Speichern der Farben' });
    }
});

// ENDPOINT: UPDATE SITE TITLE
app.post('/api/update-site-title', async (req, res) => {
    const { title } = req.body ?? {};
    const contentDir = LIVE_CONTENT_DIR;

    try {
        await withLiveContentLock(() => {
            updateSiteTitleInContent(contentDir, title);
        });
        res.json({ success: true });
    } catch (err) {
        console.error('Fehler beim Aktualisieren des Site-Titels:', err);
        res.status(500).json({ error: 'Fehler beim Speichern des Site-Titels' });
    }
});

// ENDPOINT: UPDATE SITE META (title + footer fields from Flatsite UI)
app.post('/api/update-site-meta', async (req, res) => {
    const { title, siteLogoUrl, footerLine1 = '', footerLine2 = '', footerLine3 = '' } = req.body ?? {};
    const contentDir = LIVE_CONTENT_DIR;

    try {
        await withLiveContentLock(() => {
            updateSiteMetaInContent(contentDir, { title, siteLogoUrl, footerLine1, footerLine2, footerLine3 });
        });
        res.json({ success: true });
    } catch (err) {
        console.error('Fehler beim Aktualisieren der Site-Metadaten:', err);
        res.status(500).json({ error: 'Fehler beim Speichern der Site-Metadaten' });
    }
});

app.get('/api/site-meta', (req, res) => {
    try {
        const contentDir = LIVE_CONTENT_DIR;
        const siteMeta = readSiteMetaFromContent(contentDir);
        res.json({ success: true, siteMeta });
    } catch (err) {
        console.error('Fehler beim Laden der Site-Metadaten:', err);
        res.status(500).json({ error: 'Site-Metadaten konnten nicht geladen werden' });
    }
});

app.post('/api/seo/suggest', express.json(), (req, res) => {
    const { pageId = '', projectName = '' } = req.body ?? {};
    const slug = sanitizeSlug(pageId);
    if (!slug) {
        return res.status(400).json({ error: 'Ungültige Seite' });
    }

    try {
        const contentRoot = LIVE_CONTENT_DIR;
        const txtFilePath = resolvePageDefaultFileBySlug(contentRoot, slug);
        if (!txtFilePath) {
            return res.status(404).json({ error: 'Seiteninhalt nicht gefunden' });
        }

        const raw = fs.readFileSync(txtFilePath, 'utf-8');
        const fields = parseSingleLineKirbyFields(raw);
        const pageTitle = normalizeSingleLineFieldValue(fields.Title || humanizeSlug(slug));
        const layoutRaw = String(fields.Layout || '');
        const suggestion = buildSeoDescriptionSuggestion({
            pageTitle,
            layoutRaw,
            projectName: normalizeSingleLineFieldValue(projectName || '')
        });

        res.json({
            success: true,
            pageId: slug,
            pageTitle,
            suggestion
        });
    } catch (err) {
        console.error('Fehler beim Erzeugen der SEO-Beschreibung:', err);
        res.status(500).json({ error: 'SEO-Vorschlag konnte nicht erstellt werden' });
    }
});

app.post('/api/seo/update', express.json(), async (req, res) => {
    const { pageId = '', description = '' } = req.body ?? {};
    const slug = sanitizeSlug(pageId);
    if (!slug) {
        return res.status(400).json({ error: 'Ungültige Seite' });
    }

    const normalizedDescription = trimSeoDescription(description, 160);
    if (!normalizedDescription) {
        return res.status(400).json({ error: 'Beschreibung fehlt' });
    }

    try {
        const contentRoot = LIVE_CONTENT_DIR;
        const txtFilePath = resolvePageDefaultFileBySlug(contentRoot, slug);
        if (!txtFilePath) {
            return res.status(404).json({ error: 'Seiteninhalt nicht gefunden' });
        }

        await withLiveContentLock(() => {
            const current = fs.readFileSync(txtFilePath, 'utf-8');
            const fields = parseSingleLineKirbyFields(current);
            const merged = {
                ...fields,
                Title: normalizeSingleLineFieldValue(fields.Title || humanizeSlug(slug)),
                Seodesc: normalizedDescription
            };

            const orderedKeys = ['Title', 'Layout', 'Seodesc', 'Uuid'];
            const restKeys = Object.keys(merged).filter((key) => !orderedKeys.includes(key)).sort();
            const allKeys = [...orderedKeys, ...restKeys];
            const updated = stringifyKirbyFields(allKeys.map((key) => [key, merged[key]]));
            fs.writeFileSync(txtFilePath, updated, 'utf-8');
        });

        res.json({
            success: true,
            pageId: slug,
            description: normalizedDescription
        });
    } catch (err) {
        console.error('Fehler beim Speichern der SEO-Beschreibung:', err);
        res.status(500).json({ error: 'SEO-Beschreibung konnte nicht gespeichert werden' });
    }
});

const LOGO_MIME_TO_EXT = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/svg+xml': 'svg'
};

const extractImagePayloadFromDataUrl = (dataUrl = '') => {
    const raw = String(dataUrl || '').trim();
    const match = raw.match(/^data:([^;,]+);base64,(.+)$/i);
    if (!match) {
        throw new Error('Ungültiges Bildformat');
    }

    const mime = String(match[1] || '').toLowerCase();
    const base64Data = String(match[2] || '');
    const extFromMime = LOGO_MIME_TO_EXT[mime];
    if (!extFromMime) {
        throw new Error('Dateityp wird nicht unterstützt');
    }

    const buffer = Buffer.from(base64Data, 'base64');
    if (!buffer.length) {
        throw new Error('Leere Bilddatei');
    }

    return { mime, extFromMime, buffer };
};

const deriveLogoExtension = (filename = '', fallbackExt = 'png') => {
    const fileExt = String(path.extname(String(filename || '') || '').replace('.', '')).toLowerCase();
    if (['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(fileExt)) {
        return fileExt === 'jpeg' ? 'jpg' : fileExt;
    }
    return fallbackExt;
};

app.post('/api/upload-site-logo', async (req, res) => {
    const { filename = '', dataUrl = '' } = req.body ?? {};
    const maxBytes = 5 * 1024 * 1024;

    try {
        const { extFromMime, buffer } = extractImagePayloadFromDataUrl(dataUrl);
        if (buffer.length > maxBytes) {
            return res.status(400).json({ error: 'Logo ist zu gross (max. 5 MB)' });
        }

        const ext = deriveLogoExtension(filename, extFromMime);
        const targetName = `site-logo.${ext}`;
        await withLiveContentLock(() => {
            fs.mkdirSync(LIVE_UPLOADS_DIR, { recursive: true });

            for (const entry of fs.readdirSync(LIVE_UPLOADS_DIR)) {
                if (/^site-logo\./i.test(entry)) {
                    fs.rmSync(path.join(LIVE_UPLOADS_DIR, entry), { force: true });
                }
            }

            const targetPath = path.join(LIVE_UPLOADS_DIR, targetName);
            fs.writeFileSync(targetPath, buffer);
        });

        res.json({
            success: true,
            logoPath: `/assets/uploads/${targetName}`
        });
    } catch (err) {
        const message = String(err?.message || 'Logo konnte nicht gespeichert werden');
        const status = /zu gross|format|unterstützt|leer/i.test(message) ? 400 : 500;
        res.status(status).json({ error: message });
    }
});

// ENDPOINT: CREATE NEW KIRBY PAGE
app.post('/api/create-page', express.json(), async (req, res) => {
    const { slug, title } = req.body;
    if (!slug || !title) {
        return res.status(400).json({ error: 'Fehlende Parameter: slug oder title' });
    }

    try {
        await withLiveContentLock(() => {
            const contentRoot = LIVE_CONTENT_DIR;
            if (!fs.existsSync(contentRoot)) {
                fs.mkdirSync(contentRoot, { recursive: true });
            }

            const existingDirName = findExistingPageDirName(contentRoot, slug);
            let targetDirName = existingDirName ?? nextListedDirName(contentRoot, slug);

            // If page exists as unlisted slug folder, promote it to listed numbering
            if (existingDirName && /^\d+_/.test(existingDirName) === false) {
                const promotedDirName = nextListedDirName(contentRoot, slug);
                fs.renameSync(
                    path.join(contentRoot, existingDirName),
                    path.join(contentRoot, promotedDirName)
                );
                targetDirName = promotedDirName;
            }

            const contentDir = path.join(contentRoot, targetDirName);
            const txtFileName = `default.txt`; // UNIVERSAL TEMPLATE
            const txtFilePath = path.join(contentDir, txtFileName);

            // Ordner erstellen (wenn er nicht existiert)
            if (!fs.existsSync(contentDir)) {
                fs.mkdirSync(contentDir, { recursive: true });
            }

            // Do not destroy existing content: update title in place if file exists.
            if (fs.existsSync(txtFilePath)) {
                const current = fs.readFileSync(txtFilePath, 'utf-8');
                let updated = current;
                if (/^Title:/m.test(updated)) {
                    updated = updated.replace(/^Title:.*$/m, `Title: ${title}`);
                } else {
                    updated = `Title: ${title}\n\n----\n\n${updated}`;
                }
                fs.writeFileSync(txtFilePath, updated, 'utf-8');
            } else {
                // Minimales Content-File schreiben (ohne UUID, damit Kirby eine neue generiert)
                const fileContent = `Title: ${title}\n\n----\n\nLayout: []\n`;
                fs.writeFileSync(txtFilePath, fileContent, 'utf-8');
            }

            console.log(`Neue Kirby-Seite angelegt: ${targetDirName}/${txtFileName}`);
        });
        res.json({ success: true, message: 'Seite erfolgreich angelegt' });

    } catch (err) {
        console.error('Fehler beim Erstellen der Kirby Seite:', err);
        res.status(500).json({ error: 'Serverfehler beim Erstellen der Seite' });
    }
});

// ENDPOINT: SYNC SELECTED PAGES FROM ONBOARDING TO KIRBY CONTENT
app.post('/api/sync-pages', express.json(), async (req, res) => {
    const pages = Array.isArray(req.body?.pages) ? req.body.pages : [];
    const contentRoot = LIVE_CONTENT_DIR;

    try {
        let activeProjectPath = '';
        let activeProjectId = '';
        try {
            const activeRef = getActiveProjectRef();
            activeProjectPath = resolveProjectPathFromRequest({
                projectId: activeRef.projectId,
                projectPath: activeRef.projectPath
            });
            if (activeProjectPath) {
                const manifest = readProjectManifest(activeProjectPath, { migrate: true });
                activeProjectId = normalizeProjectId(manifest?.id);
            }
        } catch {
            activeProjectPath = '';
            activeProjectId = '';
        }

        const result = await withLiveContentLock(() => syncPagesInContent(contentRoot, pages, {
            projectPath: activeProjectPath,
            projectId: activeProjectId
        }));
        res.json({ success: true, ...result });
    } catch (err) {
        console.error('Fehler beim Synchronisieren der Seiten:', err);
        res.status(500).json({ error: 'Seiten konnten nicht synchronisiert werden' });
    }
});

// ENDPOINT: HARD RESET PAGES FOR "NEW PROJECT"
app.post('/api/reset-pages', express.json(), async (req, res) => {
    const pages = Array.isArray(req.body?.pages) ? req.body.pages : [];
    const contentRoot = LIVE_CONTENT_DIR;

    try {
        const result = await withLiveContentLock(() => hardResetPagesInContent(contentRoot, pages));
        res.json({ success: true, ...result });
    } catch (err) {
        console.error('Fehler beim Zuruecksetzen der Seiten:', err);
        res.status(500).json({ error: 'Seiten konnten nicht zurueckgesetzt werden' });
    }
});

app.get('/api/content-pages', (req, res) => {
    const contentRoot = LIVE_CONTENT_DIR;

    try {
        const pages = listPagesForFlatsiteUi(contentRoot);
        res.json({ success: true, pages });
    } catch (err) {
        console.error('Fehler beim Laden der Content-Seiten:', err);
        res.status(500).json({ success: false, error: 'Content-Seiten konnten nicht geladen werden' });
    }
});

// ENDPOINT: ENSURE KIRBY ACCOUNT EXISTS (Invisible to the user)
app.post('/api/ensure-account', (req, res) => {
    const { email = '' } = req.body ?? {};
    const accountsDir = path.join(KIRBY_ROOT, 'site', 'accounts');

    try {
        const account = ensureAdminAccount(accountsDir, { email });
        console.log(`Kirby Admin-Account bereit: ${account.email} (${account.id})`);
        res.json({ success: true, message: 'Account ist bereit', accountId: account.id, email: account.email });

    } catch (err) {
        console.error('Fehler beim Erstellen des Accounts:', err);
        res.status(500).json({ error: 'Account-Erstellung fehlgeschlagen' });
    }
});


// ENDPOINT: AUTO-LOGIN (Kirby-native login via API and forwarded session cookie)
app.post('/api/auto-login', async (req, res) => {
    try {
        const accountsDir = path.join(KIRBY_ROOT, 'site', 'accounts');
        const account = ensureAdminAccount(accountsDir, {});

        const loginResponse = await fetch('http://127.0.0.1:8000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: account.email,
                password: account.password,
                long: true
            })
        });

        let setCookies = [];
        if (typeof loginResponse.headers.getSetCookie === 'function') {
            setCookies = loginResponse.headers.getSetCookie();
        } else if (typeof loginResponse.headers.raw === 'function') {
            setCookies = loginResponse.headers.raw()['set-cookie'] || [];
        } else {
            const single = loginResponse.headers.get('set-cookie');
            if (single) setCookies = [single];
        }

        if (setCookies.length > 0) {
            res.setHeader('Set-Cookie', setCookies);
        }

        if (!loginResponse.ok) {
            const errorBody = await loginResponse.text();
            console.error('Auto-Login Fehler (Kirby API):', loginResponse.status, errorBody);
            return res.status(502).json({
                success: false,
                message: `Kirby Login fehlgeschlagen (${loginResponse.status})`
            });
        }

        console.log('Auto-Login: Erfolgreich über Kirby API für', account.email);
        res.json({ success: true });
    } catch (err) {
        console.log('Auto-Login Fehler:', err.message);
        res.json({ success: false, message: err.message });
    }
});


app.listen(PORT, () => {
    console.log(`Backend Server läuft auf http://localhost:${PORT}`);
    console.log(`CORS aktiviert für Proxy-Kommunikation`);
});
