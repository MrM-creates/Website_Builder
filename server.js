import express from 'express';
import cors from 'cors';
import { Client } from 'basic-ftp';
import SftpClient from 'ssh2-sftp-client';
import { exec, spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const DEFAULT_ADMIN_EMAIL = 'admin@flatsite.app';
const DEFAULT_ADMIN_PASSWORD = 'flatsite2026';
const DEFAULT_ADMIN_NAME = 'Flatsite Admin';
const DEFAULT_ADMIN_LANGUAGE = 'de';
const DEFAULT_ADMIN_ROLE = 'admin';
const DEFAULT_ADMIN_BCRYPT = '$2y$12$KtDqJZUN.tjtrv9dktoYS.4F6PYxZtEvM0t3rxGzEfjQGg5ln0lBK';
const FLATSITE_DIR = path.join(__dirname, '.flatsite');
const STORAGE_CONFIG_FILE = path.join(FLATSITE_DIR, 'config.json');
const ACTIVE_PROJECT_FILE = path.join(FLATSITE_DIR, 'active-project.json');
const LIVE_CONTENT_DIR = path.join(__dirname, 'kirby-cms', 'content');
const LIVE_CUSTOM_CSS_PATH = path.join(__dirname, 'kirby-cms', 'assets', 'css', 'custom.css');

const parseField = (content, key) => {
    const match = content.match(new RegExp(`^${key}:\\s*(.+)$`, 'mi'));
    return match?.[1]?.trim() || null;
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

const ensureAdminAccount = (accountsDir, { email = DEFAULT_ADMIN_EMAIL, password = DEFAULT_ADMIN_PASSWORD } = {}) => {
    fs.mkdirSync(accountsDir, { recursive: true });

    const admin = findAdminAccount(accountsDir);
    const accountId = admin?.id || crypto.randomBytes(4).toString('hex');
    const accountDir = path.join(accountsDir, accountId);

    const accountData = {
        email: admin?.email || email,
        name: admin?.name || DEFAULT_ADMIN_NAME,
        language: admin?.language || DEFAULT_ADMIN_LANGUAGE,
        role: DEFAULT_ADMIN_ROLE,
        passwordHash: DEFAULT_ADMIN_BCRYPT
    };

    ensureAdminAccountFiles(accountDir, accountData);

    return {
        id: accountId,
        email: accountData.email,
        password
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
    { title = '', footerLine1 = '', footerLine2 = '', footerLine3 = '' } = {}
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
        Footerline1: normalizeSingleLineFieldValue(footerLine1),
        Footerline2: normalizeSingleLineFieldValue(footerLine2),
        Footerline3: normalizeSingleLineFieldValue(footerLine3)
    };

    const orderedKeys = ['Title', 'Footerline1', 'Footerline2', 'Footerline3'];
    const restKeys = Object.keys(merged).filter((key) => !orderedKeys.includes(key)).sort();
    const allKeys = [...orderedKeys, ...restKeys];

    const updated = stringifyKirbyFields(allKeys.map((key) => [key, merged[key]]));
    fs.writeFileSync(siteFile, updated, 'utf-8');
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

const findMatchingDirForSlug = (dirs, slug, used = new Set()) => {
    const slugPattern = new RegExp(`^(?:\\d+_)?${escapeRegex(slug)}$`);
    return dirs.find((entry) => used.has(entry) === false && slugPattern.test(entry)) || null;
};

const syncPagesInContent = (contentRoot, rawPages = []) => {
    if (!fs.existsSync(contentRoot)) {
        fs.mkdirSync(contentRoot, { recursive: true });
    }

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
    const blockedNames = new Set(
        dirs.filter((name) => renameFromSet.has(name) === false)
    );
    for (const page of selected) {
        blockedNames.add(page.desiredDir);
    }

    const listedDirs = dirs.filter((entry) => /^\d+_/.test(entry));
    let legacyCounter = 1;
    for (const entry of listedDirs) {
        if (usedDirs.has(entry)) continue;
        if (renameFromSet.has(entry)) continue;

        const baseSlug = sanitizeSlug(entry.replace(/^\d+_/, '')) || 'page';
        let candidate = `${baseSlug}-legacy`;
        while (blockedNames.has(candidate)) {
            legacyCounter += 1;
            candidate = `${baseSlug}-legacy-${legacyCounter}`;
        }

        renameOps.push({ from: entry, to: candidate });
        blockedNames.add(candidate);
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
        fs.renameSync(fromPath, toPath);
    }

    for (const page of selected) {
        const finalDir = path.join(contentRoot, page.desiredDir);
        if (!fs.existsSync(finalDir)) {
            fs.mkdirSync(finalDir, { recursive: true });
        }
        upsertPageContentFile(finalDir, page.title);
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
    const listedPages = [];

    if (fs.existsSync(contentRoot)) {
        const dirs = fs
            .readdirSync(contentRoot, { withFileTypes: true })
            .filter((entry) => entry.isDirectory() && /^\d+_/.test(entry.name))
            .map((entry) => entry.name)
            .sort((a, b) => {
                const aNum = parseInt(a.split('_')[0], 10) || 0;
                const bNum = parseInt(b.split('_')[0], 10) || 0;
                return aNum - bNum;
            });

        for (const dir of dirs) {
            const slug = dir.replace(/^\d+_/, '').trim();
            if (!slug || slug === 'error') continue;
            listedPages.push(`/${slug}`);
        }
    }

    return ['/', ...listedPages];
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

// State to keep track of the running PHP server
let phpServerProcess = null;

const startKirbyPhpServer = async (kirbyPath) =>
    new Promise((resolve) => {
        console.log(`Starte Kirby PHP Server im Ordner: ${kirbyPath}...`);

        exec('lsof -t -i:8000 | xargs kill -9', () => {
            const routerPath = path.join(kirbyPath, 'kirby', 'router.php');
            phpServerProcess = spawn('/opt/homebrew/bin/php', ['-S', '127.0.0.1:8000', routerPath], {
                cwd: kirbyPath,
                stdio: 'inherit'
            });

            phpServerProcess.on('error', (err) => {
                console.error('Fehler beim Starten des PHP Servers:', err);
            });

            setTimeout(resolve, 1100);
        });
    });

const ensureKirbyReachable = async (kirbyPath) => {
    if (await isKirbyReachable()) {
        return;
    }

    await startKirbyPhpServer(kirbyPath);
    await delay(500);

    if (await isKirbyReachable()) {
        return;
    }

    throw new Error('Kirby Server ist nicht erreichbar. Bitte Server starten und erneut versuchen.');
};

const buildStaticDeploySource = async ({ kirbyRoot, websiteUrl, targetPath }) => {
    await ensureKirbyReachable(kirbyRoot);

    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'flatsite-static-'));
    const exportRoot = path.join(tempRoot, 'site-export');
    fs.mkdirSync(exportRoot, { recursive: true });

    const contentRoot = path.join(kirbyRoot, 'content');
    const pagePaths = listPublicPagePaths(contentRoot);

    for (const pagePath of pagePaths) {
        const rawHtml = await fetchKirbyPageHtml(pagePath);
        const rewrittenHtml = rewriteHtmlForStaticDeploy(rawHtml, { websiteUrl, targetPath });
        writeStaticPage(exportRoot, pagePath, rewrittenHtml);
    }

    copyDirectoryIfExists(path.join(kirbyRoot, 'assets'), path.join(exportRoot, 'assets'));
    copyDirectoryIfExists(path.join(kirbyRoot, 'media'), path.join(exportRoot, 'media'));
    removePathIfExists(path.join(exportRoot, 'media', 'panel'));
    writeUtf8Htaccess(exportRoot);

    return {
        sourceFolder: exportRoot,
        pageCount: pagePaths.length,
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
    const contentRoot = path.join(__dirname, 'kirby-cms', 'content');
    const customCssPath = path.join(__dirname, 'kirby-cms', 'assets', 'css', 'custom.css');

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

const writeJsonFile = (filePath, payload) => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
};

const readJsonFileOrNull = (filePath) => {
    if (!fs.existsSync(filePath)) return null;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
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

const projectManifestPath = (projectPath, options = {}) =>
    path.join(resolveProjectMetaDir(projectPath, options), 'manifest.json');
const projectStatePath = (projectPath, options = {}) =>
    path.join(resolveProjectMetaDir(projectPath, options), 'state.json');
const projectSnapshotContentPath = (projectPath, options = {}) =>
    path.join(resolveProjectMetaDir(projectPath, options), 'snapshot', 'content');
const projectSnapshotCssPath = (projectPath, options = {}) =>
    path.join(resolveProjectMetaDir(projectPath, options), 'snapshot', 'custom.css');
const HISTORY_FILE = path.join(FLATSITE_DIR, 'projects-history.json');

const projectIdFromPath = (projectPath) =>
    crypto.createHash('sha1').update(projectPath).digest('hex').slice(0, 12);

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

const setActiveProjectPath = (projectPath) => {
    ensureFlatsiteDir();
    writeJsonFile(ACTIVE_PROJECT_FILE, { projectPath });
};

const getActiveProjectPath = () => {
    const data = readJsonFileOrNull(ACTIVE_PROJECT_FILE);
    return data?.projectPath ? normalizeProjectPath(data.projectPath) : '';
};

const readProjectHistory = () => {
    const data = readJsonFileOrNull(HISTORY_FILE);
    if (!Array.isArray(data?.projects)) {
        return { projects: [] };
    }
    return {
        projects: data.projects.filter((entry) => Boolean(entry?.path))
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

    const filtered = history.projects.filter((entry) => normalizeProjectPath(entry.path) !== normalizedPath);
    filtered.unshift({
        id: manifest.id,
        name: manifest.name,
        path: normalizedPath,
        updatedAt: now
    });

    writeProjectHistory({ projects: filtered.slice(0, 50) });
};

const snapshotLiveProjectToStore = (projectPath) => {
    const snapshotContentDir = projectSnapshotContentPath(projectPath, { forWrite: true });
    const snapshotCss = projectSnapshotCssPath(projectPath, { forWrite: true });

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
};

const restoreStoredProjectToLive = (projectPath) => {
    const snapshotContentDir = projectSnapshotContentPath(projectPath);
    const snapshotCss = projectSnapshotCssPath(projectPath);

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
};

const saveProjectAtPath = (projectPathInput, statePayload = {}) => {
    const projectPath = normalizeProjectPath(projectPathInput);
    const metaDir = resolveProjectMetaDir(projectPath, { forWrite: true });
    const previousManifest = readJsonFileOrNull(projectManifestPath(projectPath));
    const now = new Date().toISOString();

    fs.mkdirSync(projectPath, { recursive: true });
    fs.mkdirSync(metaDir, { recursive: true });

    const fallbackName = path.basename(projectPath) || 'Unbenanntes Projekt';
    const name = String(statePayload?.projectName || previousManifest?.name || fallbackName).trim() || fallbackName;
    const manifest = {
        id: previousManifest?.id || projectIdFromPath(projectPath),
        name,
        path: projectPath,
        createdAt: previousManifest?.createdAt || now,
        updatedAt: now
    };

    writeJsonFile(projectManifestPath(projectPath, { forWrite: true }), manifest);
    writeJsonFile(projectStatePath(projectPath, { forWrite: true }), statePayload || {});
    snapshotLiveProjectToStore(projectPath);
    touchProjectInHistory(manifest);
    setActiveProjectPath(projectPath);

    return manifest;
};

const resolveProjectPathFromRequest = ({ projectId = '', projectPath = '' } = {}) => {
    if (projectPath) {
        return normalizeProjectPath(projectPath);
    }

    if (projectId) {
        const history = readProjectHistory();
        const match = history.projects.find((entry) => entry.id === projectId);
        if (match?.path) {
            return normalizeProjectPath(match.path);
        }
    }

    const active = getActiveProjectPath();
    if (active) return active;
    throw new Error('Projekt konnte nicht gefunden werden');
};

const openProjectByPath = (projectPathInput) => {
    const projectPath = normalizeProjectPath(projectPathInput);
    const manifest = readJsonFileOrNull(projectManifestPath(projectPath));
    if (!manifest) throw new Error('In diesem Ordner wurde kein Flatsite-Projekt gefunden');

    const state = readJsonFileOrNull(projectStatePath(projectPath)) || {};
    restoreStoredProjectToLive(projectPath);

    const now = new Date().toISOString();
    const nextManifest = { ...manifest, updatedAt: now, path: projectPath };
    writeJsonFile(projectManifestPath(projectPath, { forWrite: true }), nextManifest);
    touchProjectInHistory(nextManifest);
    setActiveProjectPath(projectPath);

    return { ...nextManifest, state };
};

const listProjects = () => {
    const history = readProjectHistory();
    const activeProjectPath = getActiveProjectPath();

    const projects = [];
    for (const entry of history.projects) {
        try {
            const projectPath = normalizeProjectPath(entry.path);
            if (!fs.existsSync(projectManifestPath(projectPath))) continue;
            const manifest = readJsonFileOrNull(projectManifestPath(projectPath));
            if (!manifest) continue;

            projects.push({
                id: manifest.id || projectIdFromPath(projectPath),
                name: manifest.name || entry.name || path.basename(projectPath) || 'Unbenanntes Projekt',
                path: projectPath,
                createdAt: manifest.createdAt || null,
                updatedAt: manifest.updatedAt || entry.updatedAt || null,
                isActive: activeProjectPath ? projectPath === activeProjectPath : false
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

    return projects;
};

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
        const activeProjectPath = getActiveProjectPath() || null;
        res.json({ success: true, projects, activeProjectPath });
    } catch (err) {
        console.error('Fehler beim Laden der Projekte:', err);
        res.status(500).json({ success: false, error: 'Projekte konnten nicht geladen werden' });
    }
});

app.post('/api/projects/create', express.json(), (req, res) => {
    try {
        const projectPath = normalizeProjectPath(req.body?.projectPath || '');
        const state = req.body?.state || {};
        const project = saveProjectAtPath(projectPath, state);
        res.json({ success: true, project });
    } catch (err) {
        console.error('Fehler beim Erstellen des Projekts:', err);
        res.status(400).json({ success: false, error: err.message || 'Projekt konnte nicht erstellt werden' });
    }
});

app.post('/api/projects/save', express.json(), (req, res) => {
    try {
        const projectPath = resolveProjectPathFromRequest({
            projectId: req.body?.projectId,
            projectPath: req.body?.projectPath
        });
        const state = req.body?.state || {};
        const project = saveProjectAtPath(projectPath, state);
        res.json({ success: true, project });
    } catch (err) {
        console.error('Fehler beim Speichern des Projekts:', err);
        res.status(400).json({ success: false, error: err.message || 'Projekt konnte nicht gespeichert werden' });
    }
});

app.post('/api/projects/open', express.json(), (req, res) => {
    try {
        const projectPath = resolveProjectPathFromRequest({
            projectId: req.body?.projectId,
            projectPath: req.body?.projectPath
        });
        const project = openProjectByPath(projectPath);
        res.json({ success: true, project });
    } catch (err) {
        console.error('Fehler beim Oeffnen des Projekts:', err);
        res.status(404).json({ success: false, error: err.message || 'Projekt konnte nicht geoeffnet werden' });
    }
});

app.get('/api/projects/current', (req, res) => {
    try {
        const activePath = getActiveProjectPath();
        if (!activePath) {
            return res.json({ success: true, project: null });
        }
        const project = openProjectByPath(activePath);
        res.json({ success: true, project });
    } catch {
        res.json({ success: true, project: null });
    }
});

// ENDPOINT: START PHP SERVER (Kirby CMS)
app.post('/api/start-kirby', async (req, res) => {
    const kirbyPath = path.join(__dirname, 'kirby-cms');

    if (!fs.existsSync(kirbyPath)) {
        return res.status(404).json({ error: 'Der Ordner "kirby-cms" wurde nicht gefunden.' });
    }

    try {
        await startKirbyPhpServer(kirbyPath);
        res.json({ success: true, message: 'Kirby Server erfolgreich auf Port 8000 gestartet.' });
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
    const kirbyRoot = path.join(__dirname, 'kirby-cms');

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

    try {
        normalizedTargetPath = normalizeTargetPath(targetPath);
        normalizedWebsiteUrl = normalizeWebsiteUrl(websiteUrl);
    } catch (error) {
        return res.status(400).json({ error: error.message || 'Ungueltige Deploy-Parameter' });
    }

    try {
        updateSiteMetaInContent(path.join(kirbyRoot, 'content'), {
            title: siteTitle,
            footerLine1,
            footerLine2,
            footerLine3
        });

        const staticExport = await buildStaticDeploySource({
            kirbyRoot,
            websiteUrl: normalizedWebsiteUrl,
            targetPath: normalizedTargetPath
        });
        sourceFolder = staticExport.sourceFolder;
        cleanupStaticExport = staticExport.cleanup;

        console.log(`Static Export erstellt (${staticExport.pageCount} Seiten): ${sourceFolder}`);
        console.log(`Starte Deployment zu ${host} auf Port ${parsedPort} (Zielpfad: ${normalizedTargetPath})...`);

        if (parsedPort === 22) {
            // SFTP (SSH Protocol) via ssh2-sftp-client
            const sftp = new SftpClient();
            await sftp.connect({
                host: host,
                port: 22,
                username: user,
                password: password,
                readyTimeout: 10000 // 10 seconds timeout
            });
            console.log("SFTP Verbindung hergestellt! Lade Dateien hoch...");

            await sftp.mkdir(normalizedTargetPath, true);
            // Upload the entire directory
            await sftp.uploadDir(sourceFolder, normalizedTargetPath);
            console.log("SFTP Upload erfolgreich.");
            await sftp.end();
            res.json({
                success: true,
                mode: 'direct',
                targetPath: normalizedTargetPath,
                log: `Erfolgreich nach ${host} (via SFTP) hochgeladen. Zielpfad: ${normalizedTargetPath}`
            });

        } else {
            // Standard FTP / FTPES via basic-ftp
            // Hostpoint Erfordert oft explizites FTPES (FTP over explicit TLS) auf Port 21
            const client = new Client();
            // client.ftp.verbose = true;
            await client.access({
                host: host,
                user: user,
                password: password,
                port: parsedPort || 21,
                secure: true,
                secureOptions: { rejectUnauthorized: false }
            });

            const wantsZip = deployMode === 'zip' || (deployMode === 'auto' && Boolean(normalizedWebsiteUrl));
            const archiveName = 'flatsite-deploy.zip';

            console.log(`FTPES Verbindung hergestellt. Modus: ${wantsZip ? 'ZIP' : 'DIRECT'}`);

            await client.ensureDir(normalizedTargetPath);

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
                        targetPath: normalizedTargetPath,
                        token,
                        archive: archiveName
                    });

                    const triggerResult = await triggerRemoteUnzip(triggerUrls);

                    if (triggerResult.ok) {
                        client.close();
                        res.json({
                            success: true,
                            mode: 'zip',
                            targetPath: normalizedTargetPath,
                            triggerUrl: triggerResult.url,
                            log: `Erfolgreich nach ${host} (via FTPES, ZIP) deployed. ZIP wurde serverseitig entpackt. Zielpfad: ${normalizedTargetPath}. Trigger: ${triggerResult.url}`
                        });
                        return;
                    }

                    console.warn('ZIP Trigger fehlgeschlagen, fallback auf Direkt-Upload...', triggerResult.attempts);

                    await client.ensureDir(normalizedTargetPath);
                    await client.uploadFromDir(sourceFolder, '.');

                    client.close();
                    res.json({
                        success: true,
                        mode: 'direct-fallback',
                        targetPath: normalizedTargetPath,
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
            client.close();
            res.json({
                success: true,
                mode: 'direct',
                targetPath: normalizedTargetPath,
                log: `Erfolgreich nach ${host} (via FTPES) hochgeladen. Zielpfad: ${normalizedTargetPath}`
            });
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
    }
});


// ENDPOINT: UPDATE THEME VARIABLES (CSS Manipulation)
app.post('/api/update-theme', (req, res) => {
    const { font, colorPrimary, colorBg, colorText } = req.body;
    const cssPath = path.join(__dirname, 'kirby-cms', 'assets', 'css', 'custom.css');

    // This simulates injecting Flatsite's choices into the Kirby Theme
    const cssContent = `:root {
  --color-primary: ${colorPrimary || '#000'};
  --color-background: ${colorBg || '#fff'};
  --color-text: ${colorText || '#000'};
  --font-family: ${font || 'sans-serif'};
  --color-bg: var(--color-background);
  --color-accent: var(--color-primary);
  --font-primary: var(--font-family);
  --font-heading: var(--font-family);
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
app.post('/api/update-site-title', (req, res) => {
    const { title } = req.body ?? {};
    const contentDir = path.join(__dirname, 'kirby-cms', 'content');

    try {
        updateSiteTitleInContent(contentDir, title);
        res.json({ success: true });
    } catch (err) {
        console.error('Fehler beim Aktualisieren des Site-Titels:', err);
        res.status(500).json({ error: 'Fehler beim Speichern des Site-Titels' });
    }
});

// ENDPOINT: UPDATE SITE META (title + footer fields from Flatsite UI)
app.post('/api/update-site-meta', (req, res) => {
    const { title, footerLine1 = '', footerLine2 = '', footerLine3 = '' } = req.body ?? {};
    const contentDir = path.join(__dirname, 'kirby-cms', 'content');

    try {
        updateSiteMetaInContent(contentDir, { title, footerLine1, footerLine2, footerLine3 });
        res.json({ success: true });
    } catch (err) {
        console.error('Fehler beim Aktualisieren der Site-Metadaten:', err);
        res.status(500).json({ error: 'Fehler beim Speichern der Site-Metadaten' });
    }
});

// ENDPOINT: CREATE NEW KIRBY PAGE
app.post('/api/create-page', express.json(), (req, res) => {
    const { slug, title } = req.body;
    if (!slug || !title) {
        return res.status(400).json({ error: 'Fehlende Parameter: slug oder title' });
    }

    const contentRoot = path.join(__dirname, 'kirby-cms', 'content');
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

    try {
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
        res.json({ success: true, message: 'Seite erfolgreich angelegt' });

    } catch (err) {
        console.error('Fehler beim Erstellen der Kirby Seite:', err);
        res.status(500).json({ error: 'Serverfehler beim Erstellen der Seite' });
    }
});

// ENDPOINT: SYNC SELECTED PAGES FROM ONBOARDING TO KIRBY CONTENT
app.post('/api/sync-pages', express.json(), (req, res) => {
    const pages = Array.isArray(req.body?.pages) ? req.body.pages : [];
    const contentRoot = path.join(__dirname, 'kirby-cms', 'content');

    try {
        const result = syncPagesInContent(contentRoot, pages);
        res.json({ success: true, ...result });
    } catch (err) {
        console.error('Fehler beim Synchronisieren der Seiten:', err);
        res.status(500).json({ error: 'Seiten konnten nicht synchronisiert werden' });
    }
});

// ENDPOINT: HARD RESET PAGES FOR "NEW PROJECT"
app.post('/api/reset-pages', express.json(), (req, res) => {
    const pages = Array.isArray(req.body?.pages) ? req.body.pages : [];
    const contentRoot = path.join(__dirname, 'kirby-cms', 'content');

    try {
        const result = hardResetPagesInContent(contentRoot, pages);
        res.json({ success: true, ...result });
    } catch (err) {
        console.error('Fehler beim Zuruecksetzen der Seiten:', err);
        res.status(500).json({ error: 'Seiten konnten nicht zurueckgesetzt werden' });
    }
});

// ENDPOINT: ENSURE KIRBY ACCOUNT EXISTS (Invisible to the user)
app.post('/api/ensure-account', (req, res) => {
    const { email = DEFAULT_ADMIN_EMAIL, password = DEFAULT_ADMIN_PASSWORD } = req.body ?? {};
    const accountsDir = path.join(__dirname, 'kirby-cms', 'site', 'accounts');

    try {
        const account = ensureAdminAccount(accountsDir, { email, password });
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
        const accountsDir = path.join(__dirname, 'kirby-cms', 'site', 'accounts');
        const account = ensureAdminAccount(accountsDir, {
            email: DEFAULT_ADMIN_EMAIL,
            password: DEFAULT_ADMIN_PASSWORD
        });

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
