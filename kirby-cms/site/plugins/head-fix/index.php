<?php

/**
 * Kirby Head-Request Fix Plugin
 * Workaround for Chrome/Vite sending HEAD requests to the Panel,
 * which crashes the PHP Development Server.
 */

Kirby::plugin('flatsite/head-fix', [
    'hooks' => [
        'route:before' => function ($route, $path, $method) {
            // If Chrome/Vite sends a HEAD request to check caching
            // (especially for Panel and API routes)...
            if ($method === 'HEAD') {
                // ...we force PHP and Kirby to treat it as a GET request.
                // This prevents the "No route found for HEAD" 500 error 
                // deep inside the Panel router.
                $_SERVER['REQUEST_METHOD'] = 'GET';
                $this->request()->method('GET');
            }
        }
    ]
]);