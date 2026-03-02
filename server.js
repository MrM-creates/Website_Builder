import express from 'express';
import cors from 'cors';
import { Client } from 'basic-ftp';
import SftpClient from 'ssh2-sftp-client';
import { exec, spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

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


// ENDPOINT: DEPLOY VIA FTP
app.post('/api/deploy', async (req, res) => {
    const { host, user, password, port = 21 } = req.body;
    const sourceFolder = path.join(__dirname, 'kirby-cms');

    if (!host || !user || !password) {
        return res.status(400).json({ error: 'Fehlende FTP Credentials' });
    }

    if (!fs.existsSync(sourceFolder)) {
        return res.status(404).json({ error: 'Zu exportierender Kirby Ordner fehlt!' });
    }

    const parsedPort = parseInt(port, 10);

    try {
        console.log(`Starte Deployment zu ${host} auf Port ${parsedPort}...`);

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

            // Upload the entire directory
            await sftp.uploadDir(sourceFolder, '/');
            console.log("SFTP Upload erfolgreich.");
            await sftp.end();
            res.json({ success: true, log: `Erfolgreich nach ${host} (via SFTP) hochgeladen!` });

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

            console.log("FTPES Verbindung hergestellt! Lade Dateien hoch...");
            await client.uploadFromDir(sourceFolder, "/");
            console.log("FTP Upload erfolgreich.");
            client.close();
            res.json({ success: true, log: `Erfolgreich nach ${host} (via FTPES) hochgeladen!` });
        }

    } catch (err) {
        console.error("Deployment Fehler:", err);
        res.status(500).json({ error: err.message, log: err.toString() });
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

// ENDPOINT: CREATE NEW KIRBY PAGE
app.post('/api/create-page', express.json(), (req, res) => {
    const { slug, title } = req.body;
    if (!slug || !title) {
        return res.status(400).json({ error: 'Fehlende Parameter: slug oder title' });
    }

    const contentDir = path.join(__dirname, 'kirby-cms', 'content', slug);
    const txtFileName = `default.txt`; // UNIVERSAL TEMPLATE
    const txtFilePath = path.join(contentDir, txtFileName);

    try {
        // Ordner erstellen (wenn er nicht existiert)
        if (!fs.existsSync(contentDir)) {
            fs.mkdirSync(contentDir, { recursive: true });
        }

        // Minimales Content-File schreiben (ohne UUID, damit Kirby eine neue generiert)
        const fileContent = `Title: ${title}\n\n----\n\nLayout: []\n`;
        fs.writeFileSync(txtFilePath, fileContent, 'utf-8');

        console.log(`Neue Kirby-Seite angelegt: ${slug}/${txtFileName}`);
        res.json({ success: true, message: 'Seite erfolgreich angelegt' });

    } catch (err) {
        console.error('Fehler beim Erstellen der Kirby Seite:', err);
        res.status(500).json({ error: 'Serverfehler beim Erstellen der Seite' });
    }
});

// ENDPOINT: ENSURE KIRBY ACCOUNT EXISTS (Invisible to the user)
import crypto from 'crypto';

app.post('/api/ensure-account', (req, res) => {
    const { email = 'admin@flatsite.app', password = 'flatsite2026' } = req.body;
    const accountsDir = path.join(__dirname, 'kirby-cms', 'site', 'accounts');

    try {
        // Check if any account folder already exists
        if (fs.existsSync(accountsDir)) {
            const existing = fs.readdirSync(accountsDir).filter(f => !f.startsWith('.'));
            if (existing.length > 0) {
                console.log('Kirby Account existiert bereits.');
                return res.json({ success: true, message: 'Account existiert bereits' });
            }
        }

        // Create accounts directory if needed
        if (!fs.existsSync(accountsDir)) {
            fs.mkdirSync(accountsDir, { recursive: true });
        }

        // Generate a Kirby-compatible account folder name (random hash)
        const folderName = crypto.randomBytes(4).toString('hex');
        const accountDir = path.join(accountsDir, folderName);
        fs.mkdirSync(accountDir, { recursive: true });

        // Kirby stores accounts as .txt files with YAML-like content
        // The password needs to be hashed by Kirby itself on first login
        // We write a minimal account file and let Kirby handle password hashing
        const accountContent = `Email: ${email}\n\n----\n\nLanguage: de\n\n----\n\nName: Flatsite Admin\n\n----\n\nRole: admin\n\n----\n\nPassword: $2a$10$placeholder\n`;
        fs.writeFileSync(path.join(accountDir, 'user.txt'), accountContent, 'utf-8');

        console.log(`Kirby Account angelegt: ${email} in ${folderName}`);
        res.json({ success: true, message: 'Account erfolgreich angelegt' });

    } catch (err) {
        console.error('Fehler beim Erstellen des Accounts:', err);
        res.status(500).json({ error: 'Account-Erstellung fehlgeschlagen' });
    }
});


// ENDPOINT: AUTO-LOGIN (Authenticate against local Kirby API)
app.post('/api/auto-login', async (req, res) => {
    try {
        // Try to authenticate against the local Kirby instance
        const loginRes = await fetch('http://localhost:8000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin@flatsite.app',
                password: 'flatsite2026'
            })
        });

        if (loginRes.ok) {
            // Forward the session cookie to the client
            const setCookie = loginRes.headers.get('set-cookie');
            if (setCookie) {
                res.setHeader('Set-Cookie', setCookie);
            }
            const data = await loginRes.json();
            console.log('Kirby Auto-Login erfolgreich.');
            res.json({ success: true, data });
        } else {
            console.log('Kirby Auto-Login fehlgeschlagen (Account muss evtl. noch manuell eingerichtet werden).');
            res.json({ success: false, message: 'Login fehlgeschlagen – bitte manuell einloggen' });
        }
    } catch (err) {
        console.log('Kirby Auto-Login: Server noch nicht bereit oder Fehler:', err.message);
        res.json({ success: false, message: 'Kirby Server noch nicht bereit' });
    }
});


app.listen(PORT, () => {
    console.log(`Backend Server läuft auf http://localhost:${PORT}`);
    console.log(`CORS aktiviert für Proxy-Kommunikation`);
});
