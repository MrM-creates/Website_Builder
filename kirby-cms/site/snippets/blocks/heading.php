<?php
$level = $block->level()->or('h2');
$align = $block->align()->or('left');
?>
<<?= $level ?> style="text-align: <?= $align ?>;"><?= $block->text() ?></<?= $level ?>>