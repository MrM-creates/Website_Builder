<?php
/** @var \Kirby\Cms\Block $block */
$caption = $block->caption();
$crop = $block->crop()->isTrue();
$ratio = $block->ratio()->or('auto');
?>
<figure<?= Html::attr(['data-ratio' => $ratio, 'data-crop' => $crop], null, ' ') ?>>
  <ul>
    <?php foreach ($block->images()->toFiles() as $image): ?>
    <?php
      $alt = $image->alt()->or($image->filename());
      $src = $image->thumb([
          'width' => 1600,
          'quality' => 80
      ])->url();
    ?>
    <li>
      <img
        src="<?= $src ?>"
        alt="<?= $alt->esc() ?>"
        loading="lazy"
        decoding="async"
      >
    </li>
    <?php endforeach ?>
  </ul>
  <?php if ($caption->isNotEmpty()): ?>
  <figcaption>
    <?= $caption ?>
  </figcaption>
  <?php endif ?>
</figure>
