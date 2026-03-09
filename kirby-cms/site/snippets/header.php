<!DOCTYPE html>
<html lang="de">
<head>
    <?php
    $toRelativePath = function ($url) {
        $raw = trim((string)($url ?? ''));
        if ($raw === '') return '/';
        if (str_starts_with($raw, '/')) return $raw;
        $parts = parse_url($raw);
        if ($parts === false) return $raw;
        $path = $parts['path'] ?? '/';
        if ($path === '') $path = '/';
        if (!str_starts_with($path, '/')) {
            $path = '/' . ltrim($path, '/');
        }
        if (isset($parts['query']) && $parts['query'] !== '') {
            $path .= '?' . $parts['query'];
        }
        if (isset($parts['fragment']) && $parts['fragment'] !== '') {
            $path .= '#' . $parts['fragment'];
        }
        return $path;
    };
    $siteLogoValue = trim((string)$site->logo()->value());
    $siteLogoPath = $siteLogoValue !== '' ? $toRelativePath($siteLogoValue) : '';
    $siteLogoFsPath = '';
    if ($siteLogoPath !== '') {
        $logoPathOnly = parse_url($siteLogoPath, PHP_URL_PATH) ?: '';
        if ($logoPathOnly !== '') {
            $siteLogoFsPath = kirby()->root('index') . '/' . ltrim($logoPathOnly, '/');
        }
    }
    $canRenderSiteLogo = $siteLogoPath !== '' && $siteLogoFsPath !== '' && is_file($siteLogoFsPath);
    ?>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= $site->title() ?> — <?= $page->title() ?></title>
    <meta name="description" content="<?= $page->seodesc()->or($site->seodesc())->or('Website von ' . $site->title())->html() ?>">
    <meta property="og:title" content="<?= $site->title() ?> — <?= $page->title() ?>">
    <meta property="og:description" content="<?= $page->seodesc()->or($site->seodesc())->or('Website von ' . $site->title())->html() ?>">
    <meta property="og:url" content="<?= $page->url() ?>">
    <link rel="canonical" href="<?= $page->url() ?>">
    <link href="/assets/style.css" rel="stylesheet">
    <link href="/assets/css/custom.css" rel="stylesheet">
    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;900&family=Inter+Tight:wght@700;800;900&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Source+Sans+3:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Roboto:wght@300;400;500;700&family=Libre+Baskerville:wght@400;700&family=Lora:wght@400;500;700&family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Syncopate:wght@400;700&display=swap" rel="stylesheet">

    <style>
    /* Inline Global Link Style to bypass Cache */
    main p a,
    main li a,
    .album-description a {
        color: var(--color-accent) !important;
        text-decoration: none !important;
        border-bottom: 2px solid var(--color-accent) !important;
        transition: all 0.3s ease !important;
        padding-bottom: 2px !important;
        display: inline-block !important;
    }
    main p a:hover,
    main li a:hover,
    .album-description a:hover {
        border-bottom-color: var(--color-accent) !important;
        opacity: 0.85 !important;
        transform: translateY(-1px) !important;
    }
    </style>
</head>
<body>
    <header class="site-header">
        <div class="logo">
            <a href="/" style="display: block; text-align: center; line-height: 1.1; text-decoration: none; color: var(--color-accent);">
                <?php if ($canRenderSiteLogo): ?>
                    <img src="<?= htmlspecialchars($siteLogoPath, ENT_QUOTES, 'UTF-8') ?>" alt="<?= esc($site->title()->value(), 'attr') ?>" class="site-logo-image" />
                <?php else: ?>
                    <?= html($site->title()) ?>
                <?php endif ?>
            </a>
        </div>
        <nav class="main-navigation">
            <button class="menu-toggle" aria-label="Menu öffnen"><span></span><span></span></button>
            <ul class="nav-links">
                <?php foreach ($site->children()->listed() as $item): ?>
                <li><a href="<?= $toRelativePath($item->url()) ?>" class="<?= $item->isOpen() ? 'active' : '' ?>"><?= $item->title() ?></a></li>
                <?php endforeach ?>
            </ul>
        </nav>
    </header>
    <main class="site-content">
