<?php snippet('header')?>

<main class="site-content">
    <div class="category-intro fade-in" style="max-width: 800px; margin: 0 auto; text-align: center; padding: 4rem 5%;">
        <h1>
            <?= $page->title()?>
        </h1>
        <?php if ($page->text()->isNotEmpty()): ?>
        <div class="category-text" style="color: var(--color-text-light); margin-top: 1rem;">
            <?= $page->text()->kt()?>
        </div>
        <?php
endif ?>
    </div>

    <!-- Gallery Grid: Albums inside this Category -->
    <div class="featured-categories" style="padding-top: 2rem;">

        <?php foreach ($page->children()->listed() as $album): ?>
        <section class="album-section" style="margin-top: 4rem;">
            <div class="album-header fade-in"
                style="padding: 0 5%; display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 1rem;">
                <h2
                    style="margin-bottom: 1rem; text-transform: uppercase; font-family: var(--font-heading); font-size: 1.5rem; letter-spacing: 1px;">
                    <?= $album->title()?>
                </h2>
                <?php if ($album->orderLink()->isNotEmpty()): ?>
                <a href="<?= $album->orderLink()?>" target="_blank" class="order-btn"
                    style="text-decoration:none; background: #000; color:#fff; padding: 10px 20px; border-radius: 30px; font-size: 0.8rem; text-transform: uppercase; transition: opacity 0.3s;"
                    onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">Jetzt bestellen</a>
                <?php
    endif ?>
            </div>

            <div class="horizontal-gallery-container fade-in delay-1"
                style="width: 100%; overflow-x: auto; padding: 0 5% 2rem 5%; scroll-behavior: smooth; -webkit-overflow-scrolling: touch; display: flex; gap: 1.5rem; scrollbar-width: none;">
                <?php foreach ($album->images()->sortBy('sort') as $image): ?>
                <div class="gallery-item"
                    style="flex: 0 0 auto; height: 55vh; max-height: 500px; aspect-ratio: auto; overflow: hidden; cursor: pointer; box-shadow: 0 10px 30px rgba(0,0,0,0.05);"
                    onclick="openLightbox('<?= $image->url()?>')">
                    <img src="<?= $image->url()?>" loading="lazy" alt="<?= $image->alt()?>"
                        style="width: auto; height: 100%; object-fit: contain; transition: transform 0.4s ease;"
                        onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                </div>
                <?php
    endforeach ?>

                <?php if ($album->images()->count() === 0): ?>
                <div
                    style="flex: 0 0 auto; width: 80vw; max-width: 500px; aspect-ratio: 3/2; background: #fafafa; border: 1px dashed #ddd; display:flex; align-items:center; justify-content:center; color:#999; border-radius: 4px;">
                    Noch keine Bilder in diesem Album
                </div>
                <?php
    endif ?>
            </div>
        </section>
        <?php
endforeach ?>

    </div>
</main>

<!-- Lightbox Overlay -->
<div id="lightbox"
    style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.95); z-index:9999; align-items:center; justify-content:center; cursor:pointer;"
    onclick="closeLightbox()">
    <img id="lightbox-img" src=""
        style="max-width:90vw; max-height:90vh; object-fit:contain; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
    <div style="position:absolute; top: 20px; right: 30px; color: #fff; font-size: 2rem; font-family: sans-serif;">
        &times;</div>
</div>

<script>
    function openLightbox(url) {
        document.getElementById('lightbox-img').src = url;
        document.getElementById('lightbox').style.display = 'flex';
        document.body.style.overflow = 'hidden'; // prevent background scrolling
    }
    function closeLightbox() {
        document.getElementById('lightbox').style.display = 'none';
        document.getElementById('lightbox-img').src = '';
        document.body.style.overflow = '';
    }
</script>

<style>
    /* Hide scrollbar for Chrome, Safari and Opera */
    .horizontal-gallery-container::-webkit-scrollbar {
        display: none;
    }
</style>

<?php snippet('footer')?>