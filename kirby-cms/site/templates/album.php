<?php snippet('header') ?>
<main class="site-content">
    <div class="album-intro fade-in" style="max-width: 800px; margin: 0 auto; text-align: center; padding: 4rem 5%;">
        <?php 
            $tSize = (string)$page->titleSize()->or('3rem');
        ?>
        <h1 style="font-family: 'Playfair Display', serif; font-weight: 400; font-size: <?= $tSize ?>; margin-bottom: 1rem;"><?= $page->title() ?></h1>
        <?php if ($page->text()->isNotEmpty()): ?>
        <div class="album-text" style="color: var(--color-text-light); line-height: 1.8;">
            <?= $page->text()->kt() ?>
        </div>
        <?php endif ?>
    </div>
    <section class="gallery-masonry fade-in" style="padding: 2rem 5% 5rem;">
        <div class="masonry-grid horizontal-flow">
            <?php foreach ($page->images()->sortBy('sort') as $image): ?>
            <div class="masonry-item">
                <a href="javascript:void(0)" onclick="openLightbox('<?= $image->resize(1600)->url() ?>')">
                    <img src="<?= $image->resize(800)->url() ?>" alt="<?= $image->alt() ?>" loading="lazy">
                </a>
            </div>
            <?php endforeach ?>
        </div>
    </section>
</main>

<!-- Lightbox Overlay -->
<div id="lightbox" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.95); z-index:9999; align-items:center; justify-content:center; cursor:pointer;" onclick="closeLightbox()">
    <img id="lightbox-img" src="" style="max-width:90vw; max-height:90vh; object-fit:contain; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
    <div style="position:absolute; top: 20px; right: 30px; color: #fff; font-size: 2rem; font-family: sans-serif;">&times;</div>
</div>

<script>
    function openLightbox(url) {
        document.getElementById('lightbox-img').src = url;
        document.getElementById('lightbox').style.display = 'flex';
        document.body.style.overflow = 'hidden'; 
    }
    function closeLightbox() {
        document.getElementById('lightbox').style.display = 'none';
        document.getElementById('lightbox-img').src = '';
        document.body.style.overflow = '';
    }
</script>

<style>
/* Masonry Grid Styles Restructured for horizontal flow */
.masonry-grid.horizontal-flow { 
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-gap: 2rem;
    align-items: start;
    width: 100%; 
    max-width: 1400px; 
    margin: 0 auto; 
}
.masonry-item img { width: 100%; height: auto; display: block; border-radius: 4px; transition: transform 0.4s ease, filter 0.4s ease; cursor: pointer; }
.masonry-item img:hover { transform: scale(1.02); filter: brightness(0.9); }
@media (max-width: 1024px) { .masonry-grid.horizontal-flow { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px) { .masonry-grid.horizontal-flow { grid-template-columns: 1fr; } }
</style>
<?php snippet('footer') ?>