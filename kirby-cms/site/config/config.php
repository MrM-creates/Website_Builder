<?php
return [
    'url' => 'http://localhost:5173',
    'debug' => false,
    'panel' => [
        'install' => true,
        'frame' => true,
        'css' => 'assets/css/panel.css'
    ],
    'api' => [
        'csrf' => '' // disable strict CSRF port matching for local iframe dev
    ],
    'session' => [
        'durationNormal' => 7200, // 2 hours
        'durationLong' => 1209600, // 2 weeks
        'timeout' => 1800, // 30 min idle
        'cookieName' => 'kirby_session',
        'gcInterval' => 100,
    ],
    // Default session cookie settings applied natively by Kirby
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
                // Filter excluding templates if necessary, e.g. error page
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