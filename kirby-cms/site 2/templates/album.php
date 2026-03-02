<?php snippet('header')?>

<main class="site-content">
    <div class="album-intro fade-in" style="max-width: 800px; margin: 0 auto; text-align: center; padding: 4rem 5%;">
        <h1>
            <?= $page->title()?>
        </h1>
        <?php if ($page->text()->isNotEmpty()): ?>
        <div class="album-text" style="color: var(--color-text-light); margin-top: 1rem;">
            <?= $page->text()->kt()?>
        </div>
        <?php
endif ?>
    </div>

    <section class="featured-categories" style="padding-top: 2rem;">
        <div class="category-grid" style="grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem;">
            <?php foreach ($page->images()->sortBy('sort') as $image): ?>
            <div class="image-wrapper fade-in" style="aspect-ratio: auto; margin-bottom: 0;">
                <img src="<?= $image->url()?>" alt="<?= $image->alt()?>" style="width: 100%; height: auto;">
            </div>
            <?php
endforeach ?>
        </div>
    </section>
</main>

<?php snippet('footer')?>