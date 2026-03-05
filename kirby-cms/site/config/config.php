<?php
return [
    'url' => 'http://127.0.0.1:5173',
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
            'pattern' => '/',
            'method' => 'GET',
            'action' => function () {
                $first = site()->children()->listed()->first();
                if ($first) {
                    return new Kirby\Http\Response(
                        body: '',
                        type: 'text/plain',
                        code: 302,
                        headers: ['Location' => '/' . $first->id()]
                    );
                }
                return site()->visit('error');
            }
        ],
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
