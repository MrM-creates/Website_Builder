<?php snippet("header") ?>

<main class="site-content fade-in" style="max-width: 1200px; margin: 4rem auto; padding: 0 5%;">
    <?php $layouts = $page->layout()->toLayouts(); ?>
    <?php if ($layouts->count() > 0): ?>
    <?php foreach ($layouts as $layout): ?>
    <?php 
        $align = "start";
        if ($layout->attrs()->alignment()->isNotEmpty()) {
            $align = $layout->attrs()->alignment()->value();
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
</main>

<style>
/* Responsive Layout für Handys */
@media (max-width: 768px) {
    .layout .column {
        grid-column: span 12 !important; /* Auf dem Handy wird alles 1-spaltig untereinander */
    }
}

/* Styling für die Standard-Blöcke (damit sie zum Rest der Standard passen) */
.blocks-container h1, .blocks-container h2, .blocks-container h3, .blocks-container h4 {
    font-family: var(--font-heading);
    text-transform: uppercase;

    margin-top: 0;
    margin-bottom: 1rem;
}
.blocks-container p {
    color: var(--color-text-light);
    line-height: 1.8;
    margin-top: 0;
    margin-bottom: 0;
}
.blocks-container figure {
    margin-top: 0 !important;
    margin-bottom: 0 !important;
}
.blocks-container img {
    width: 100%;
    height: auto;
    display: block;
    border-radius: 4px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.05);
}
.blocks-container a {
    color: var(--color-accent);
    text-decoration: underline;
}
</style>

<?php snippet("footer") ?>
