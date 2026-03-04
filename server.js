import express from 'express';
import cors from 'cors';
import { Client } from 'basic-ftp';
import SftpClient from 'ssh2-sftp-client';
import { exec, execFile, spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import os from 'os';
import { promisify } from 'util';

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
const DEFAULT_REMOTE_PATH = '/flatsite-test';
const DEPLOY_ARCHIVE_BASENAME = 'flatsite-deploy.zip';
const DEPLOY_UNZIP_SCRIPT_BASENAME = 'flatsite-unzip.php';

const execFileAsync = promisify(execFile);

const normalizeSiteUrl = (input = '') => {
    const raw = String(input || '').trim();
    if (!raw) return null;

    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    let parsed;

    try {
        parsed = new URL(withProtocol);
    } catch {
        throw new Error('Ungueltige Website-URL fuer ZIP-Deploy.');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Website-URL muss mit http:// oder https:// erreichbar sein.');
    }

    return parsed.origin;
};

const buildPublicFileUrl = (origin, targetPath, filename) => {
    const cleanOrigin = String(origin || '').replace(/\/+$/, '');
    const encodedPath = String(targetPath || '')
        .split('/')
        .filter(Boolean)
        .map((segment) => encodeURIComponent(segment))
        .join('/');
    const encodedFilename = encodeURIComponent(filename);
    return `${cleanOrigin}/${encodedPath ? `${encodedPath}/` : ''}${encodedFilename}`;
};

const buildUnzipScript = ({ archiveName, token }) => `<?php
header('Content-Type: application/json; charset=utf-8');

$expectedToken = '${token}';
$providedToken = $_GET['token'] ?? '';

if (!hash_equals($expectedToken, $providedToken)) {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'error' => 'invalid token'
    ]);
    exit;
}

$archive = basename($_GET['archive'] ?? '${archiveName}');
$cleanup = ($_GET['cleanup'] ?? '1') !== '0';
$zipPath = __DIR__ . DIRECTORY_SEPARATOR . $archive;

if (class_exists('ZipArchive') === false) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'ZipArchive missing'
    ]);
    exit;
}

if (is_file($zipPath) === false) {
    http_response_code(404);
    echo json_encode([
        'success' => false,
        'error' => 'archive not found',
        'archive' => $archive
    ]);
    exit;
}

$zip = new ZipArchive();
$openResult = $zip->open($zipPath);

if ($openResult !== true) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'unable to open archive',
        'code' => $openResult
    ]);
    exit;
}

if ($zip->extractTo(__DIR__) === false) {
    $zip->close();
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'extract failed'
    ]);
    exit;
}

$zip->close();

if ($cleanup) {
    @unlink($zipPath);
    @unlink(__FILE__);
}

echo json_encode([
    'success' => true,
    'archive' => $archive,
    'cleanup' => $cleanup
]);
`;

const createDeployArchive = async (sourceFolder) => {
    const tmpRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'flatsite-deploy-'));
    const archivePath = path.join(tmpRoot, DEPLOY_ARCHIVE_BASENAME);

    try {
        await execFileAsync('zip', ['-rq', archivePath, '.'], {
            cwd: sourceFolder,
            maxBuffer: 20 * 1024 * 1024
        });
    } catch (err) {
        if (String(err?.code || '').toUpperCase() === 'ENOENT') {
            throw new Error('Systemkommando "zip" fehlt. Bitte auf dem Rechner installieren.');
        }
        throw err;
    }

    return {
        archivePath,
        cleanup: async () => {
            await fs.promises.rm(tmpRoot, { recursive: true, force: true });
        }
    };
};

const normalizeRemotePath = (input = DEFAULT_REMOTE_PATH) => {
    let remotePath = String(input || '').trim();

    if (!remotePath) {
        remotePath = DEFAULT_REMOTE_PATH;
    }

    remotePath = remotePath.replace(/\\/g, '/');
    remotePath = remotePath.replace(/\/{2,}/g, '/');
    remotePath = remotePath.startsWith('/') ? remotePath : `/${remotePath}`;
    remotePath = remotePath.length > 1 ? remotePath.replace(/\/$/, '') : remotePath;

    if (remotePath.includes('..')) {
        throw new Error('Ungueltiger Zielpfad: ".." ist nicht erlaubt.');
    }

    if (remotePath === '/') {
        throw new Error('Aus Sicherheitsgruenden ist "/" als Zielpfad nicht erlaubt. Bitte einen Unterordner angeben.');
    }

    return remotePath;
};

const isFtpsDataSocketTlsError = (error) => {
    const message = String(error?.message || error || '').toLowerCase();
    return (
        message.includes('data socket') ||
        message.includes('tlsv1 alert decode error') ||
        message.includes('ssl3_read_bytes')
    );
};

const deriveDeployOrigins = ({ deployOrigin, host }) => {
    const candidates = [];
    const push = (origin) => {
        if (!origin) return;
        if (!candidates.includes(origin)) candidates.push(origin);
    };

    push(deployOrigin);

    const cleanHost = String(host || '').trim().replace(/^ftps?:\/\//i, '').replace(/:\d+$/, '');
    if (!cleanHost) return candidates;

    const hostVariants = new Set([cleanHost]);
    if (cleanHost.startsWith('ftp.')) {
        hostVariants.add(cleanHost.slice(4));
    }
    if (cleanHost.startsWith('ftps.')) {
        hostVariants.add(cleanHost.slice(5));
    }

    for (const variant of hostVariants) {
        push(`https://${variant}`);
        push(`http://${variant}`);
    }

    return candidates;
};

const triggerRemoteUnzip = async ({ origins, targetPath, archiveName, token }) => {
    const attempts = [];

    for (const origin of origins) {
        const scriptUrl = buildPublicFileUrl(origin, targetPath, DEPLOY_UNZIP_SCRIPT_BASENAME);
        const url = new URL(scriptUrl);
        url.searchParams.set('token', token);
        url.searchParams.set('archive', archiveName);
        url.searchParams.set('cleanup', '1');

        try {
            const response = await fetch(url.toString(), {
                method: 'GET',
                redirect: 'follow',
                signal: AbortSignal.timeout(10000)
            });

            const bodyText = await response.text();
            let payload = null;
            try {
                payload = bodyText ? JSON.parse(bodyText) : null;
            } catch {
                payload = null;
            }

            if (response.ok && payload?.success === true) {
                return {
                    success: true,
                    triggerUrl: url.toString(),
                    responseText: bodyText
                };
            }

            attempts.push(`${url.toString()} -> HTTP ${response.status}`);
        } catch (err) {
            attempts.push(`${url.toString()} -> ${err.message}`);
        }
    }

    return {
        success: false,
        attempts
    };
};

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

// The intelligent Kirby Proxy
// Rewrite HEAD to GET to prevent the PHP 8 Built-in Server from crashing (500 Error Framebusting bug)
// State to keep track of the running PHP server
let phpServerProcess = null;

// ENDPOINT: START PHP SERVER (Kirby CMS)
app.post('/api/start-kirby', (req, res) => {
    const kirbyPath = path.join(__dirname, 'kirby-cms');

    if (!fs.existsSync(kirbyPath)) {
        return res.status(404).json({ error: 'Der Ordner "kirby-cms" wurde nicht gefunden.' });
    }

    // Fast-boot logic: We always try to start the detached server, ignoring state false positives

    console.log(`Starte Kirby PHP Server im Ordner: ${kirbyPath}...`);

    // Kill any hanging PHP processes on port 8000 first (macOS specific)
    // Ignore errors because lsof returns 1 if no process is found
    exec('lsof -t -i:8000 | xargs kill -9', (err) => {
        // Start PHP server on port 8000
        // Using absolute Homebrew path since Node.js on macOS sometimes doesn't inherit the bash $PATH correctly
        const routerPath = path.join(kirbyPath, 'kirby', 'router.php');
        phpServerProcess = spawn('/opt/homebrew/bin/php', ['-S', '127.0.0.1:8000', routerPath], {
            cwd: kirbyPath,
            stdio: 'inherit', // Debug mode to see PHP crash errors in the Terminal
        });

        phpServerProcess.on('error', (err) => {
            console.error('Fehler beim Starten des PHP Servers:', err);
        });
    });

    // Short delay to allow server to boot
    setTimeout(() => {
        res.json({ success: true, message: 'Kirby Server erfolgreich auf Port 8000 gestartet.' });
    }, 1000);
});


const parseDeployRequest = (body = {}) => {
    const { host, user, password, port = 21, remotePath = DEFAULT_REMOTE_PATH, siteUrl = '' } = body;
    const parsedPort = parseInt(port, 10) || 21;
    const targetPath = normalizeRemotePath(remotePath);
    const deployOrigin = normalizeSiteUrl(siteUrl);

    if (!host || !user || !password) {
        throw new Error('Fehlende FTP Credentials');
    }

    return {
        host,
        user,
        password,
        parsedPort,
        targetPath,
        deployOrigin
    };
};

// ENDPOINT: TEST DEPLOY CONNECTION
app.post('/api/deploy/test', async (req, res) => {
    let params;

    try {
        params = parseDeployRequest(req.body ?? {});
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }

    const { host, user, password, parsedPort, targetPath } = params;

    try {
        if (parsedPort === 22) {
            const sftp = new SftpClient();
            await sftp.connect({
                host,
                port: 22,
                username: user,
                password,
                readyTimeout: 10000
            });

            const startPath = await sftp.cwd().catch(() => '(unbekannt)');
            const exists = await sftp.exists(targetPath);
            await sftp.end();

            const targetExists = exists === true || exists === 'd' || exists === 'l';
            const targetInfo = targetExists
                ? `Zielpfad-Pruefung: vorhanden (Typ: ${String(exists)}).`
                : 'Zielpfad-Pruefung: nicht gefunden; wird beim ersten Deploy erstellt.';

            return res.json({
                success: true,
                log: `SFTP Verbindung erfolgreich zu ${host}:22. Startpfad (CWD): ${startPath}. Zielpfad: ${targetPath}. ${targetInfo}`
            });
        }

        const client = new Client();
        let dataChannelMode = 'PROT P';
        await client.access({
            host,
            user,
            password,
            port: parsedPort,
            secure: true,
            secureOptions: { rejectUnauthorized: false }
        });

        const startPath = await client.pwd();

        // Validate FTPS data channel early (LIST uses the data connection).
        try {
            await client.list(startPath || '.');
        } catch (err) {
            if (isFtpsDataSocketTlsError(err)) {
                await client.sendIgnoringError('PBSZ 0');
                await client.sendIgnoringError('PROT C');
                dataChannelMode = 'PROT C (Fallback)';
                await client.list(startPath || '.');
            } else {
                throw err;
            }
        }

        let targetExists = false;
        try {
            await client.cd(targetPath);
            targetExists = true;
        } catch {
            targetExists = false;
        } finally {
            try {
                await client.cd(startPath);
            } catch {
                // Ignore directory restore errors in test mode
            }
        }

        const targetInfo = targetExists
            ? 'Zielpfad-Pruefung: vorhanden (CWD erfolgreich).'
            : 'Zielpfad-Pruefung: nicht gefunden; wird beim ersten Deploy erstellt.';

        client.close();

        return res.json({
            success: true,
            log: `FTP/FTPES Verbindung erfolgreich zu ${host}:${parsedPort}. Startpfad (PWD): ${startPath}. Datenkanal: ${dataChannelMode}. Zielpfad: ${targetPath}. ${targetInfo}`
        });
    } catch (err) {
        console.error('Verbindungstest fehlgeschlagen:', err);
        return res.status(500).json({ error: err.message, log: err.toString() });
    }
});

// ENDPOINT: DEPLOY VIA FTP
app.post('/api/deploy', async (req, res) => {
    const sourceFolder = path.join(__dirname, 'kirby-cms');

    if (!fs.existsSync(sourceFolder)) {
        return res.status(404).json({ error: 'Zu exportierender Kirby Ordner fehlt!' });
    }

    let params;
    try {
        params = parseDeployRequest(req.body ?? {});
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }

    const { host, user, password, parsedPort, targetPath, deployOrigin } = params;

    if (parsedPort !== 22 && !deployOrigin) {
        return res.status(400).json({
            error: 'Bitte Website-URL angeben (z.B. https://deine-domain.ch), damit der ZIP-Upload automatisch entpackt werden kann.'
        });
    }

    try {
        console.log(`Starte Deployment zu ${host} auf Port ${parsedPort} in ${targetPath}...`);

        if (parsedPort === 22) {
            // SFTP (SSH Protocol) via ssh2-sftp-client
            const sftp = new SftpClient();
            await sftp.connect({
                host,
                port: 22,
                username: user,
                password,
                readyTimeout: 10000
            });

            console.log('SFTP Verbindung hergestellt! Lade Dateien hoch...');
            await sftp.mkdir(targetPath, true);
            await sftp.uploadDir(sourceFolder, targetPath);
            console.log('SFTP Upload erfolgreich.');
            await sftp.end();

            return res.json({
                success: true,
                log: `Erfolgreich nach ${host} (via SFTP) hochgeladen. Zielpfad: ${targetPath}`
            });
        }

        // FTP / FTPES: Upload as ZIP + remote unzip.php execution
        const deployOrigins = deriveDeployOrigins({ deployOrigin, host });
        const archive = await createDeployArchive(sourceFolder);
        const deployToken = crypto.randomBytes(24).toString('hex');
        const unzipScriptPath = path.join(path.dirname(archive.archivePath), DEPLOY_UNZIP_SCRIPT_BASENAME);

        try {
            await fs.promises.writeFile(
                unzipScriptPath,
                buildUnzipScript({
                    archiveName: DEPLOY_ARCHIVE_BASENAME,
                    token: deployToken
                }),
                'utf-8'
            );

            const uploadArchiveViaFtpes = async ({ useClearDataChannel = false } = {}) => {
                const client = new Client();
                try {
                    await client.access({
                        host,
                        user,
                        password,
                        port: parsedPort,
                        secure: true,
                        secureOptions: { rejectUnauthorized: false }
                    });

                    if (useClearDataChannel) {
                        await client.sendIgnoringError('PBSZ 0');
                        await client.sendIgnoringError('PROT C');
                    }

                    await client.ensureDir(targetPath);
                    await client.uploadFrom(archive.archivePath, path.posix.join(targetPath, DEPLOY_ARCHIVE_BASENAME));
                    await client.uploadFrom(unzipScriptPath, path.posix.join(targetPath, DEPLOY_UNZIP_SCRIPT_BASENAME));
                } finally {
                    client.close();
                }
            };

            let dataChannelMode = 'PROT P';
            try {
                await uploadArchiveViaFtpes({ useClearDataChannel: false });
            } catch (err) {
                if (!isFtpsDataSocketTlsError(err)) {
                    throw err;
                }

                console.warn('FTPS Datenkanal TLS-Fehler erkannt, retry mit PROT C...');
                await uploadArchiveViaFtpes({ useClearDataChannel: true });
                dataChannelMode = 'PROT C (Fallback)';
            }

            const unzipResult = await triggerRemoteUnzip({
                origins: deployOrigins,
                targetPath,
                archiveName: DEPLOY_ARCHIVE_BASENAME,
                token: deployToken
            });

            if (!unzipResult.success) {
                const manualBase = deployOrigin || deployOrigins[0];
                const manualUrl = manualBase
                    ? `${buildPublicFileUrl(manualBase, targetPath, DEPLOY_UNZIP_SCRIPT_BASENAME)}?token=${encodeURIComponent(deployToken)}&archive=${encodeURIComponent(DEPLOY_ARCHIVE_BASENAME)}&cleanup=1`
                    : '';
                const attemptSummary = unzipResult.attempts?.slice(0, 3).join(' | ') || 'keine HTTP-URL pruefbar';

                throw new Error(
                    `ZIP wurde hochgeladen, aber das automatische Entpacken war nicht erreichbar (${attemptSummary}). `
                    + (manualUrl ? `Bitte im Browser oeffnen: ${manualUrl}` : 'Bitte Website-URL im Hosting eintragen und erneut publizieren.')
                );
            }

            return res.json({
                success: true,
                log: `Erfolgreich nach ${host} (via FTPES, ${dataChannelMode}) deployed. ZIP wurde serverseitig entpackt. Zielpfad: ${targetPath}. Trigger: ${unzipResult.triggerUrl}`
            });
        } finally {
            await archive.cleanup().catch(() => {});
        }
    } catch (err) {
        console.error('Deployment Fehler:', err);
        return res.status(500).json({ error: err.message, log: err.toString() });
    }
});


// ENDPOINT: UPDATE THEME VARIABLES (CSS Manipulation)
app.post('/api/update-theme', (req, res) => {
    const { design, font, colorPrimary, colorBg, colorText } = req.body;
    const cssPath = path.join(__dirname, 'kirby-cms', 'assets', 'css', 'custom.css');

    // This simulates injecting Flatsite's choices into the Kirby Theme
    const cssContent = `:root {
  --color-primary: ${colorPrimary || '#000'};
  --color-background: ${colorBg || '#fff'};
  --color-text: ${colorText || '#000'};
  --font-family: ${font || 'sans-serif'};
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
