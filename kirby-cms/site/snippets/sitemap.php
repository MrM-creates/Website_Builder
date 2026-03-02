<?= '<?xml version="1.0" encoding="utf-8"?>' ?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <?php foreach ($pages as $p): ?>
    <?php if (in_array($p->uri(), $ignore)) continue ?>
    <url>
        <loc><?= html($p->url()) ?></loc>
        <lastmod><?= $p->modified('Y-m-d') ?></lastmod>
        <priority><?= ($p->isHomePage()) ? 1 : ($p->depth() == 1 ? 0.8 : 0.6) ?></priority>
    </url>
    <?php endforeach ?>
</urlset>