<?php if ($block->text()->isNotEmpty()): ?>
<?php
$urlObject = $block->link()->toUrl();
if (empty($urlObject) || $urlObject === '/' || $urlObject === '') {
    $finalUrl = site()->url();
} else if (strpos($urlObject, 'http') !== 0 && strpos($urlObject, '/') !== 0) {
    $finalUrl = site()->url() . '/' . $urlObject;
} else {
    $finalUrl = $urlObject;
}
$align = $block->align()->or('left');
?>
<div style="text-align: <?= $align ?>; width: 100%;">
    <a href="<?= $finalUrl ?>" class="order-btn" style="display: inline-block; padding: 12px 24px; border: 1px solid #000; border-radius: 30px; text-decoration: none; color: #000; text-transform: uppercase; font-size: 0.8rem; transition: background 0.3s, color 0.3s; margin-right: 0.5rem; margin-bottom: 0.5rem; text-align: center;" onmouseover="this.style.background='#000'; this.style.color='#fff';" onmouseout="this.style.background='transparent'; this.style.color='#000';">
        <?= $block->text() ?>
    </a>
</div>
<?php endif ?>