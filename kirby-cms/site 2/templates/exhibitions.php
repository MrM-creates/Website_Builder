<?php snippet('header')?>
<main class="site-content" style="max-width: 900px; margin: 4rem auto; padding: 0 5%;">
    <h1 class="fade-in"
        style="font-family: var(--font-heading); text-transform: uppercase; letter-spacing: 2px; margin-bottom: 2rem;">
        <?= $page->title()?>
    </h1>

    <?php if ($page->text()->isNotEmpty()): ?>
    <div class="fade-in" style="color: var(--color-text-light); margin-bottom: 4rem; line-height: 1.8;">
        <?= $page->text()->kt()?>
        <div style="margin-top: 2rem;">
            <a href="#projekte"
                style="padding: 12px 24px; background: #000; border-radius: 30px; text-decoration: none; color: #fff; text-transform: uppercase; font-size: 0.8rem; transition: opacity 0.3s;"
                onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">Das interessiert mich
                &darr;</a>
        </div>
    </div>
    <?php
endif ?>

    <div id="projekte" class="exhibitions-list fade-in delay-1" style="margin-top: 5rem;">
        <?php foreach ($page->children()->listed() as $ex): ?>
        <article style="border-top: 1px solid #ddd; padding: 4rem 0;">
            <h2
                style="font-family: var(--font-heading); margin-bottom: 1rem; text-transform: uppercase; font-size: 1.5rem;">
                <?= $ex->title()?>
            </h2>
            <?php if ($ex->text()->isNotEmpty()): ?>
            <div style="color: var(--color-text-light); margin-bottom: 2rem; line-height: 1.6;">
                <?= $ex->text()->kt()?>
            </div>
            <?php
    endif ?>

            <?php if ($ex->images()->count() > 0): ?>
            <!-- Mini horizontal preview -->
            <div
                style="display: flex; gap: 1rem; overflow-x: auto; scrollbar-width: none; padding-bottom: 1rem; margin-bottom: 2rem;">
                <?php foreach ($ex->images()->limit(5)->sortBy('sort') as $img): ?>
                <div style="flex: 0 0 150px; aspect-ratio: 1; overflow: hidden; border-radius: 4px;">
                    <img src="<?= $img->url()?>" style="width:100%; height:100%; object-fit:cover;">
                </div>
                <?php
        endforeach ?>
            </div>
            <?php
    endif ?>
        </article>
        <?php
endforeach ?>
    </div>
</main>

<style>
    /* Hide scrollbar for Chrome, Safari and Opera */
    .exhibitions-list div::-webkit-scrollbar {
        display: none;
    }
</style>

<?php snippet('footer')?>