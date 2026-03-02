<?php
/**
 * Flatsite Auto-Login Plugin
 * Creates an admin account and logs in automatically on localhost.
 */
Kirby::plugin('flatsite/autologin', [
    'hooks' => [
        'route:before' => function ($route, $path, $method) {
            $kirby = kirby();

            // Safety: only on localhost
            $host = $_SERVER['HTTP_HOST'] ?? '';
            if (strpos($host, 'localhost') === false && strpos($host, '127.0.0.1') === false) {
                return;
            }

            // Only for panel routes
            if (strpos($path, 'panel') !== 0) {
                return;
            }

            // Already logged in
            if ($kirby->user()) {
                return;
            }

            // Loop prevention
            if (isset($_COOKIE['flatsite_al'])) {
                return;
            }

            $kirby->impersonate('kirby');

            // Fix empty user.txt files
            $accountsDir = $kirby->root('accounts');
            if (is_dir($accountsDir)) {
                foreach (new DirectoryIterator($accountsDir) as $item) {
                    if ($item->isDot() || !$item->isDir())
                        continue;
                    $userFile = $item->getPathname() . '/user.txt';
                    if (file_exists($userFile) && filesize($userFile) === 0) {
                        file_put_contents($userFile, "Email: admin@flatsite.app\n\n----\n\nName: Flatsite Admin\n\n----\n\nLanguage: de\n\n----\n\nRole: admin\n");
                    }
                }
            }

            // Get or create admin
            $admin = $kirby->users()->role('admin')->first();

            if (!$admin) {
                // Create account manually via filesystem
                $folderName = bin2hex(random_bytes(4));
                $dir = $accountsDir . '/' . $folderName;
                @mkdir($dir, 0755, true);

                file_put_contents($dir . '/user.txt', "Email: admin@flatsite.app\n\n----\n\nName: Flatsite Admin\n\n----\n\nLanguage: de\n\n----\n\nRole: admin\n");
                file_put_contents($dir . '/.htpasswd', password_hash('flatsite2026', PASSWORD_BCRYPT));
                file_put_contents($dir . '/index.php', "<?php\n\ndie();\n");

                // Reload users
                $admin = $kirby->users()->role('admin')->first();
            }

            if (!$admin) {
                return;
            }

            // Set session
            try {
                $session = $kirby->session(['long' => true]);
                $session->set('kirby.userId', $admin->id());
                setcookie('flatsite_al', '1', time() + 5, '/');
                header('Location: /' . $path);
                exit;
            }
            catch (\Exception $e) {
                return;
            }
        }
    ]
]);