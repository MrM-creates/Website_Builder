<?php

/** @var \Kirby\Cms\Block $block */
$alt     = $block->alt();
$caption = $block->caption();
$crop    = $block->crop()->isTrue();
$link    = $block->link();
$ratio   = $block->ratio()->or('auto');
$src     = null;
$srcset  = null;

if ($block->location() === 'web') {
    $src = $block->src()->esc();
} elseif ($image = $block->image()->toFile()) {
    $alt = $alt->or($image->alt());

    // Render a deployment-friendly derivative instead of the full original.
    $thumb = $image->thumb(['width' => 2000]);
    $src   = $thumb->url();
    $srcset = $image->srcset([640, 960, 1280, 1600, 2000]);
}

?>
<?php if ($src): ?>
<figure<?= Html::attr(['data-ratio' => $ratio, 'data-crop' => $crop], null, ' ') ?>>
  <?php if ($link->isNotEmpty()): ?>
  <a href="<?= Str::esc($link->toUrl()) ?>">
    <img src="<?= $src ?>"<?php e($srcset, ' srcset="' . $srcset . '"') ?> alt="<?= $alt->esc() ?>" loading="lazy">
  </a>
  <?php else: ?>
  <img src="<?= $src ?>"<?php e($srcset, ' srcset="' . $srcset . '"') ?> alt="<?= $alt->esc() ?>" loading="lazy">
  <?php endif ?>

  <?php if ($caption->isNotEmpty()): ?>
  <figcaption>
    <?= $caption ?>
  </figcaption>
  <?php endif ?>
</figure>
<?php endif ?>

