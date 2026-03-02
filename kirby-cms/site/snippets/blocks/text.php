
<?php
$align = $block->align()->or('left');
?>
<div style="text-align: <?= $align ?>;">
  <?= $block->text() ?>
</div>