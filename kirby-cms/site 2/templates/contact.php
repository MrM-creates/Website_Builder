<?php snippet('header')?>
<main class="site-content fade-in" style="max-width: 800px; margin: 4rem auto; padding: 0 5%;">
    <h1
        style="text-align:center; font-family: var(--font-heading); text-transform: uppercase; letter-spacing: 2px; margin-bottom: 3rem;">
        <?= $page->title()?>
    </h1>

    <div style="display: flex; flex-wrap: wrap; gap: 4rem;">
        <div style="flex: 1 1 300px;">
            <?php if ($page->text()->isNotEmpty()): ?>
            <div style="margin-bottom: 3rem; color: var(--color-text-light); line-height: 1.6;">
                <?= $page->text()->kt()?>
            </div>
            <?php
endif ?>

            <?php if ($page->address()->isNotEmpty()): ?>
            <div style="font-family: var(--font-primary); font-size: 0.95rem; line-height: 1.8;">
                <strong
                    style="text-transform: uppercase; letter-spacing: 1px; font-family: var(--font-heading);">Adresse</strong><br>
                <?= $page->address()->kt()?>
            </div>
            <?php
endif ?>
        </div>

        <div style="flex: 2 1 400px;">
            <?php if ($success): ?>
            <div
                style="padding: 2rem; background: #e6f6e6; color: #1e561e; border-radius: 4px; border: 1px solid #c3e6c3;">
                Deine Nachricht wurde erfolgreich gesendet! Ich melde mich in Kürze.
            </div>
            <?php
else: ?>
            <?php if ($error): ?>
            <div
                style="padding: 1rem; background: #fdf5f5; color: #d00; border-radius: 4px; border: 1px solid #f2dede; margin-bottom: 2rem;">
                <?= $error?>
            </div>
            <?php
    endif ?>

            <form method="POST" action="<?= $page->url()?>"
                style="display: flex; flex-direction: column; gap: 1.5rem;">
                <div>
                    <label for="name"
                        style="display:block; margin-bottom: 0.5rem; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 1px;">Dein
                        Name *</label>
                    <input type="text" id="name" name="name" required
                        style="width: 100%; padding: 12px; border: 1px solid #ddd; background: #f9f9f9; font-family: inherit; font-size: 1rem;">
                </div>
                <div>
                    <label for="email"
                        style="display:block; margin-bottom: 0.5rem; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 1px;">Deine
                        E-Mail *</label>
                    <input type="email" id="email" name="email" required
                        style="width: 100%; padding: 12px; border: 1px solid #ddd; background: #f9f9f9; font-family: inherit; font-size: 1rem;">
                </div>
                <div>
                    <label for="subject"
                        style="display:block; margin-bottom: 0.5rem; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 1px;">Thema</label>
                    <select id="subject" name="subject"
                        style="width: 100%; padding: 12px; border: 1px solid #ddd; background: #f9f9f9; font-family: inherit; font-size: 1rem; appearance: auto;">
                        <option>Allgemeine Anfrage</option>
                        <option>Bestellung Fotografie</option>
                        <option>Projektanfrage</option>
                    </select>
                </div>
                <div>
                    <label for="text"
                        style="display:block; margin-bottom: 0.5rem; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 1px;">Nachricht
                        *</label>
                    <textarea id="text" name="text" rows="6" required
                        style="width: 100%; padding: 12px; border: 1px solid #ddd; background: #f9f9f9; font-family: inherit; font-size: 1rem; resize: vertical;"></textarea>
                </div>
                <div>
                    <button type="submit"
                        style="padding: 15px 30px; background: #000; color: #fff; border: none; border-radius: 30px; text-transform: uppercase; font-family: inherit; font-size: 0.9rem; letter-spacing: 1px; cursor: pointer; transition: opacity 0.3s; width: 100%; max-width: 250px;"
                        onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">Senden</button>
                </div>
            </form>
            <?php
endif ?>
        </div>
    </div>
</main>
<?php snippet('footer')?>