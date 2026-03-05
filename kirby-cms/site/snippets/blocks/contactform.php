<?php
$alert = null;
$success = false;
$data = [];

if (kirby()->request()->is('POST') && get('submit')) {
    if (empty(get('website')) === false) { go($page->url()); exit; }
    $data = [
        'name' => get('name'),
        'email' => get('email'),
        'topic' => get('topic'),
        'text' => get('text')
    ];
    $rules = [
        'name'  => ['required', 'minLength' => 3],
        'email' => ['required', 'email'],
        'text'  => ['required', 'minLength' => 10]
    ];
    $messages = [
        'name'  => 'Bitte gib einen gueltigen Namen ein.',
        'email' => 'Bitte gib eine gueltige E-Mail-Adresse ein.',
        'text'  => 'Bitte schreibe eine kurze Nachricht.'
    ];
    
    if ($invalid = invalid($data, $rules, $messages)) {
        $alert = $invalid;
    } else {
        try {
            kirby()->email([
                'from'     => 'info@mrmimagines.ch',
                'replyTo'  => $data['email'],
                'to'       => $page->email()->or('info@mrmimagines.ch')->value(),
                'subject'  => 'Neue Kontaktanfrage: ' . $data['topic'] . ' (von ' . $data['name'] . ')',
                'body'     => "Name: " . $data['name'] . "\nEmail: " . $data['email'] . "\nThema: " . $data['topic'] . "\n\nNachricht:\n" . $data['text']
            ]);
            $success = true;
        } catch (Exception $error) {
            $alert = ['Es gab ein technisches Problem beim Senden. (' . $error->getMessage() . ')'];
        }
    }
}
?>

<div class="contact-form-block">
    <?php if ($success): ?>
    <div class="alert success" style="background: #e6f6e6; color: #006600; padding: 2rem; border-radius: 4px; text-align: center; margin-bottom: 2rem;">
        <h3 style="margin-bottom: 1rem;">Vielen Dank fuer deine Nachricht!</h3>
        <p>Ich werde mich so bald wie moeglich bei dir melden.</p>
    </div>
    <?php else: ?>
    
    <?php if (isset($alert)): ?>
    <div class="alert error" style="background: #fdf2f2; border-left: 4px solid #cc0000; padding: 1.5rem; margin-bottom: 2rem;">
        <ul style="color: #cc0000; padding-left: 1rem; margin:0;">
            <?php foreach ($alert as $message): ?><li><?= $message ?></li><?php endforeach ?>
        </ul>
    </div>
    <?php endif ?>

    <form method="post" action="<?= $page->url() ?>" style="display: flex; flex-direction: column; gap: 1.5rem; width: 100%;">
        <div class="honeypot" style="display: none;">
            <label for="website">Website <abbr title="required">*</abbr></label>
            <input type="url" id="website" name="website" tabindex="-1">
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
            <div class="field">
                <label for="name" style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem; text-transform: uppercase;">Name *</label>
                <input type="text" id="name" name="name" value="<?= htmlspecialchars($data['name'] ?? '') ?>" required style="width: 100%; padding: 1rem; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            <div class="field">
                <label for="email" style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem; text-transform: uppercase;">Email *</label>
                <input type="email" id="email" name="email" value="<?= htmlspecialchars($data['email'] ?? '') ?>" required style="width: 100%; padding: 1rem; border: 1px solid #ddd; border-radius: 4px;">
            </div>
        </div>
        <div class="field">
            <label for="topic" style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem; text-transform: uppercase;">Thema</label>
            <select id="topic" name="topic" style="width: 100%; padding: 1rem; border: 1px solid #ddd; border-radius: 4px; appearance: auto;">
                <option value="Allgemeine Anfrage" <?= (isset($data['topic']) && $data['topic'] === 'Allgemeine Anfrage') ? 'selected' : '' ?>>Allgemeine
Anfrage</option>
<option value="Kaufanfrage" <?=(isset($data['topic']) && $data['topic']==='Kaufanfrage') ? 'selected' : '' ?>>
    Kaufanfrage</option>
<option value="Individueller Auftrag" <?=(isset($data['topic']) && $data['topic']==='Individueller Auftrag') ?
    'selected' : '' ?>>Individueller Auftrag</option>
</select>
</div>
<div class="field">
    <label for="text"
        style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem; text-transform: uppercase;">Mitteilung
        *</label>
    <textarea id="text" name="text" rows="8" required
        style="width: 100%; padding: 1rem; border: 1px solid #ddd; border-radius: 4px; resize: vertical;"><?= htmlspecialchars($data['text'] ?? '') ?></textarea>
</div>
<div>
    <input type="submit" name="submit" value="<?= $block->buttonText()->or('Nachricht Senden') ?>"
        style="padding: 1rem 2rem; background: var(--color-accent); color: var(--color-bg); border: none; border-radius: 30px; text-transform: uppercase; font-size: 0.9rem; cursor: pointer;">
</div>
</form>
<?php endif ?>
</div>
