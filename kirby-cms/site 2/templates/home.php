<?php snippet('header')?>

<main class="site-content fade-in" style="max-width: 1200px; margin: 4rem auto; padding: 0 5%;">
    <?php foreach ($page->layout()->toLayouts() as $layout): ?>
    <section class="layout" id="<?= $layout->id()?>"
        style="display: grid; grid-template-columns: repeat(12, 1fr); gap: 2rem; margin-bottom: 4rem; align-items: center;">
        <?php foreach ($layout->columns() as $column): ?>
        <div class="column" style="grid-column: span <?= $column->span()?>; min-width: 0;">
            <div class="blocks-container" style="display: flex; flex-direction: column; gap: 1.5rem;">
                <?= $column->blocks()?>
            </div>
        </div>
        <?php
    endforeach ?>
    </section>
    <?php
endforeach ?>
</main>

<style>
    /* Responsive Layout für Handys */
    @media (max-width: 768px) {
        .layout .column {
            grid-column: span 12 !important;
            /* Auf dem Handy wird alles 1-spaltig untereinander */
        }
    }

    /* Styling für die Standard-Blöcke (damit sie zum Rest der Seite passen) */
    .blocks-container h1,
    .blocks-container h2,
    .blocks-container h3,
    .blocks-container h4 {
        font-family: var(--font-heading);
        text-transform: uppercase;
        margin-bottom: 1rem;
    }

    .blocks-container p {
        color: var(--color-text-light);
        line-height: 1.8;
    }

    .blocks-container img {
        width: 100%;
        height: auto;
        border-radius: 4px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
    }

    .blocks-container a {
        color: #000;
        text-decoration: underline;
    }
</style>

<?php snippet('footer')?>