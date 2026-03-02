<!DOCTYPE html>
<html lang="de">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>
        <?= $site->title()?> —
        <?= $page->title()?>
    </title>

    <?= css('assets/style.css')?>

    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link
        href="https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Syncopate:wght@400;700&display=swap"
        rel="stylesheet">
</head>

<body>

    <!-- Header / Navigation -->
    <header class="site-header">
        <div class="logo">
            <a href="<?= $site->url()?>">
                <?= $site->title()?>
            </a>
        </div>
        <nav class="main-navigation">
            <button class="menu-toggle" aria-label="Menu öffnen">
                <span></span>
                <span></span>
            </button>
            <ul class="nav-links">
                <?php foreach ($site->children()->listed() as $item): ?>
                <li>
                    <a href="<?= $item->url()?>" class="<?= $item->isOpen() ? 'active' : ''?>">
                        <?= $item->title()?>
                    </a>
                </li>
                <?php
endforeach ?>
            </ul>
        </nav>
    </header>

    <!-- Main Content -->
    <main class="site-content">