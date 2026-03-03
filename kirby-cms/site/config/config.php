<?php
return [
    'url' => 'http://localhost:5173',
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