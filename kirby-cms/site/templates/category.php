<?php snippet('header') ?>

<main class="site-content fade-in" style="max-width: 1200px; margin: 4rem auto; padding: 0 5%;">
    
    <!-- Render Layout Builder blocks if available -->
    <?php $layouts = $page->layout()->toLayouts(); ?>
    <?php if ($layouts->count() > 0): ?>
        <?php foreach ($layouts as $layout): ?>
        <?php 
            $align = "start";
            if ($layout->attrs()->alignment()->isNotEmpty()) {
                $align = (string)$layout->attrs()->alignment()->value();
            }
        ?>
        <section class="layout" id="<?= $layout->id() ?>" style="display: grid; grid-template-columns: repeat(12, 1fr); gap: 2rem; margin-bottom: 4rem; align-items: stretch;">
            <?php foreach ($layout->columns() as $column): ?>
            <div class="column" style="grid-column: span <?= $column->span() ?>; min-width: 0; display: flex; flex-direction: column; justify-content: <?= $align === "center" ? "center" : ($align === "end" ? "flex-end" : "flex-start") ?>;">
                <div class="blocks-container" style="display: flex; flex-direction: column; gap: 1.5rem; width: 100%;">
                    <?= $column->blocks() ?>
                </div>
            </div>
            <?php endforeach ?>
        </section>
        <?php endforeach ?>
    <?php else: ?>
        <div style="text-align: center; margin-bottom: 4rem;">
            <h1 style="font-family: 'Playfair Display', serif; font-size: 3rem; text-transform: uppercase;"><?= $page->title() ?></h1>
            <div style="color: var(--color-text-light); margin-top: 1rem;"><?= $page->text()->kt() ?></div>
        </div>
    <?php endif ?>

    <!-- Render Albums Masonry Grid -->
    <?php foreach ($page->children()->listed() as $album): ?>
    <?php 
        $tAlign = (string)$album->titleAlign()->or('left');
        $tSize = (string)$album->titleSize()->or('2rem');
    ?>
    <section class="album-section" style="margin-top: 6rem;">
        <div class="album-header fade-in" style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 2.5rem; padding-bottom: 1.5rem; border-bottom: 1px solid rgba(0,0,0,0.05); text-align: <?= $tAlign ?>; align-items: <?= $tAlign === 'center' ? 'center' : ($tAlign === 'right' ? 'flex-end' : 'flex-start') ?>;">
            <div style="display: flex; flex-direction: <?= $tAlign === 'center' ? 'column' : 'row' ?>; justify-content: <?= $tAlign === 'right' ? 'flex-end' : 'flex-start' ?>; align-items: <?= $tAlign === 'center' ? 'center' : 'baseline' ?>; flex-wrap: wrap; gap: 1rem; width: 100%;">
                <h2 style="text-transform: uppercase; font-family: var(--font-heading); font-size: <?= $tSize ?>; letter-spacing: 1px; margin: 0; line-height: 1.2;"><?= $album->title() ?></h2>
                <?php if ($album->orderLink()->isNotEmpty()): ?>
                <a href="<?= $album->orderLink() ?>" target="_blank" class="order-btn" style="text-decoration:none; background: #000; color:#fff; padding: 10px 20px; border-radius: 30px; font-size: 0.8rem; text-transform: uppercase; transition: opacity 0.3s; white-space: nowrap; margin-top: <?= $tAlign === 'center' ? '0.5rem' : '0' ?>;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">Jetzt bestellen</a>
                <?php endif ?>
            </div>
            
            <?php if ($album->text()->isNotEmpty()): ?>
            <div class="album-description" style="color: var(--color-text-light); line-height: 1.8; max-width: 800px; font-size: 1.05rem; margin-top: 0.5rem; text-align: <?= $tAlign ?>;">
                <?= $album->text()->kt() ?>
            </div>
            <?php endif ?>
        </div>
        
        <div class="gallery-masonry fade-in delay-1">
            <div class="masonry-grid horizontal-flow">
                <?php foreach ($album->images()->sortBy('sort') as $image): ?>
                <div class="masonry-item">
                    <a href="javascript:void(0)" onclick="openLightbox('<?= $image->resize(1600)->url() ?>')">
                        <img src="<?= $image->resize(800)->url() ?>" loading="lazy" alt="<?= $image->alt() ?>">
                    </a>
                </div>
                <?php endforeach ?>
                
                <?php if ($album->images()->count() === 0): ?>
                <div style="width: 100%; aspect-ratio: 3/2; background: #fafafa; border: 1px dashed #ddd; display:flex; align-items:center; justify-content:center; color:#999; border-radius: 4px; grid-column: 1 / -1;">
                    Noch keine Bilder in diesem Album
                </div>
                <?php endif ?>
            </div>
        </div>
    </section>
    <?php endforeach ?>
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
/* Same CSS as home for Layout Builder responsiveness */
@media (max-width: 768px) {
    .layout .column { grid-column: span 12 !important; }
}
.blocks-container h1, .blocks-container h2, .blocks-container h3, .blocks-container h4 {
    font-family: var(--font-heading); text-transform: uppercase; margin-top: 0; margin-bottom: 1rem;
}
.blocks-container p { color: var(--color-text-light); line-height: 1.8; margin-top: 0; margin-bottom: 0; }
.blocks-container figure { margin-top: 0 !important; margin-bottom: 0 !important; }
.blocks-container img { width: 100%; height: auto; display: block; border-radius: 4px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); }

/* Masonry Grid Styles Restructured for horizontal flow */
.masonry-grid.horizontal-flow { 
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-gap: 2rem;
    align-items: start;
    width: 100%; 
    margin: 0 auto; 
}
.masonry-item img { width: 100%; height: auto; display: block; border-radius: 4px; transition: transform 0.4s ease, filter 0.4s ease; cursor: pointer; }
.masonry-item img:hover { transform: scale(1.02); filter: brightness(0.9); }
@media (max-width: 1024px) { .masonry-grid.horizontal-flow { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px) { .masonry-grid.horizontal-flow { grid-template-columns: 1fr; } }

/* Fix missing margins on single-line Writer text */
.album-description blockquote, .album-description p { margin-top: 0; margin-bottom: 0; }
</style>

<?php snippet('footer') ?>
