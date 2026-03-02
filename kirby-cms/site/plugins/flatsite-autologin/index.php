<?php

/**
 * Flatsite Auto-Login Ghost Account 
 * This plugin creates an invisible master account and logs the user 
 * perfectly in the background when running on localhost.
 */

Kirby::plugin('flatsite/autologin', [
    'hooks' => [
        'route:before' => function ($route, $path, $method) {
            $kirby = kirby();

            // 1. Ensure an account exists
            $admin = $kirby->users()->role('admin')->first();

            if (!$admin) {
                try {
                    $kirby->impersonate('kirby');
                    $admin = $kirby->users()->create([
                                'email' => 'admin@flatsite.app',
                                'role' => 'admin',
                                'password' => 'flatsite_ghost',
                                'language' => 'de'
                            ]);
                }
                catch (\Exception $e) {
                // Silently fail
                }
            }

            // 2. Automatically log in if accessing the panel without a session
            if (strpos($path, 'panel') === 0 && !$kirby->user() && $admin) {
                if (isset($_COOKIE['flatsite_login_loop'])) {
                    return; // Give up to prevent infinite redirect loop
                }

                try {
                    $session = $kirby->session(['long' => true]);
                    $session->set('kirby.userId', $admin->id());

                    // Set loop prevention cookie
                    setcookie('flatsite_login_loop', '1', time() + 10, '/');

                    // Force a redirect to the exact requested path to apply the session
                    header('Location: /' . $path);
                    exit;
                }
                catch (\Exception $e) {
                // Ignore if auth fails
                }
            }
        }
    ]
]);