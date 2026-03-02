<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= $site->title() ?> — <?= $page->title() ?></title>
    <meta name="description" content="<?= $page->seodesc()->or($site->seodesc())->or('Fotografie von Mr M Imagines')->html() ?>">
    <meta property="og:title" content="<?= $site->title() ?> — <?= $page->title() ?>">
    <meta property="og:description" content="<?= $page->seodesc()->or($site->seodesc())->or('Fotografie von Mr M Imagines')->html() ?>">
    <meta property="og:url" content="<?= $page->url() ?>">
    <link rel="canonical" href="<?= $page->url() ?>">
    <?= css("assets/style.css") ?>
    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Syncopate:wght@400;700&display=swap" rel="stylesheet">

    <style>
    /* Inline Global Link Style to bypass Cache */
    main p a,
    main li a,
    .album-description a {
        color: inherit !important;
        text-decoration: none !important;
        border-bottom: 2px solid rgba(0,0,0,0.8) !important;
        transition: all 0.3s ease !important;
        padding-bottom: 2px !important;
        display: inline-block !important;
    }
    main p a:hover,
    main li a:hover,
    .album-description a:hover {
        background-color: rgba(0,0,0,0.05) !important;
        border-bottom-color: #000 !important;
        transform: translateY(-1px) !important;
    }
    </style>
</head>
<body>
    <header class="site-header">
        <div class="logo">
            <a href="<?= $site->url() ?>" style="display: flex; flex-direction: column; align-items: center; text-align: center; line-height: 1.1; text-decoration: none;">
                <span style="font-family: 'Playfair Display', serif; font-weight: 700; font-size: 2.8rem; letter-spacing: -0.02em; color: var(--color-text);">Mr M</span>
                <span style="font-family: 'Space Mono', monospace; font-weight: 400; font-size: 0.9rem; letter-spacing: 0.25em; text-transform: uppercase; color: var(--color-text-light);">IMAGINES</span>
            </a>
        </div>
        <nav class="main-navigation">
            <button class="menu-toggle" aria-label="Menu öffnen"><span></span><span></span></button>
            <ul class="nav-links">
                <?php foreach ($site->children()->listed() as $item): ?>
                <li><a href="<?= $item->url() ?>" class="<?= $item->isOpen() ? 'active' : '' ?>"><?= $item->title() ?></a></li>
                <?php endforeach ?>
            </ul>
        </nav>
    </header>
    <main class="site-content">