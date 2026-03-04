<?php

$configuredUrl = getenv('KIRBY_URL');
$configuredUrl = $configuredUrl !== false ? trim($configuredUrl) : '';

if ($configuredUrl !== '') {
    $kirbyUrl = rtrim($configuredUrl, '/');
} else {
    $host = $_SERVER['HTTP_HOST'] ?? '';
    $forwardedProto = strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''));
    $isHttps = (
        (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ||
        $forwardedProto === 'https'
    );

    $localHosts = [
        '127.0.0.1:8000',
        'localhost:8000',
        '127.0.0.1:5173',
        'localhost:5173'
    ];

    // Local dev always uses Vite host to keep the embedded panel same-origin.
    if (in_array($host, $localHosts, true)) {
        $kirbyUrl = 'http://127.0.0.1:5173';
    } elseif ($host !== '') {
        $scheme = $isHttps ? 'https' : 'http';
        $kirbyUrl = $scheme . '://' . $host;
    } else {
        // Safe fallback for CLI contexts without HTTP host.
        $kirbyUrl = 'http://127.0.0.1:5173';
    }
}

return [
    'url' => $kirbyUrl,
    'debug' => false,
    'panel' => [
        'install' => false,
        'frame' => true,
        'css' => 'assets/css/panel.css'
    ],
    'api' => [
        'csrf' => false
    ],
    'session' => [
        'durationNormal' => 7200,
        'durationLong' => 1209600,
        'timeout' => 1800,
        'cookieName' => 'kirby_session',
        'gcInterval' => 100,
    ],
    'routes' => [
        [
            'pattern' => '(:all)',
            'method' => 'HEAD',
            'action' => function () {
                return new \Kirby\Cms\Response('OK', 'text/plain', 200);
            }
        ],
        [
            'pattern' => 'sitemap.xml',
            'action' => function () {
                $pages = site()->pages()->index();
                $ignore = kirby()->option('sitemap.ignore', ['error']);
                $content = snippet('sitemap', ['pages' => $pages, 'ignore' => $ignore], true);
                return new Kirby\Cms\Response($content, 'application/xml');
            }
        ],
        [
            'pattern' => 'sitemap',
            'action' => function () {
                return go('sitemap.xml', 301);
            }
        ]
    ]
];
