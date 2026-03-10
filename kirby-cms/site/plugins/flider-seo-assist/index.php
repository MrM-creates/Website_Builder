<?php

$seoNormalizeText = static function (string $value): string {
    $decoded = html_entity_decode($value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $withoutTags = strip_tags($decoded);
    $singleLine = preg_replace('/\s+/u', ' ', (string)$withoutTags);
    $withoutLinks = preg_replace('/\b(?:file|https?):\/\/\S+/iu', ' ', (string)$singleLine);
    return trim((string)$withoutLinks);
};

$seoTextLength = static function (string $value): int {
    if (function_exists('mb_strlen')) {
        return mb_strlen($value, 'UTF-8');
    }
    return strlen($value);
};

$seoTextSlice = static function (string $value, int $length): string {
    if (function_exists('mb_substr')) {
        return mb_substr($value, 0, $length, 'UTF-8');
    }
    return substr($value, 0, $length);
};

$seoTrimDescription = static function (string $value, int $max = 160) use ($seoTextLength, $seoTextSlice): string {
    $normalized = trim($value);
    if ($normalized === '') {
        return '';
    }

    if ($seoTextLength($normalized) <= $max) {
        return $normalized;
    }

    $cut = rtrim($seoTextSlice($normalized, $max));
    $lastSpace = function_exists('mb_strrpos') ? mb_strrpos($cut, ' ', 0, 'UTF-8') : strrpos($cut, ' ');
    if ($lastSpace !== false && $lastSpace > 70) {
        $cut = function_exists('mb_substr')
            ? rtrim(mb_substr($cut, 0, $lastSpace, 'UTF-8'))
            : rtrim(substr($cut, 0, (int)$lastSpace));
    }

    return $cut;
};

$seoCollectLayoutSnippets = static function (string $layoutRaw) use ($seoNormalizeText): array {
    $raw = trim($layoutRaw);
    if ($raw === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return [];
    }

    $allowedKeys = [
        'text' => true,
        'title' => true,
        'caption' => true,
        'description' => true,
        'headline' => true,
        'subheadline' => true,
        'alt' => true,
        'label' => true,
        'name' => true,
    ];

    $snippets = [];

    $walk = static function ($value, string $keyHint = '') use (&$walk, &$snippets, $allowedKeys, $seoNormalizeText): void {
        if ($value === null) {
            return;
        }

        if (is_string($value)) {
            if ($keyHint === '' || isset($allowedKeys[strtolower($keyHint)])) {
                $text = $seoNormalizeText($value);
                if (
                    $text !== '' &&
                    strlen($text) >= 3 &&
                    !preg_match('/^[0-9a-f-]{8,}$/i', $text) &&
                    stripos($text, 'file://') === false
                ) {
                    $snippets[] = $text;
                }
            }
            return;
        }

        if (is_array($value)) {
            foreach ($value as $key => $nested) {
                $nextHint = is_string($key) ? $key : $keyHint;
                $walk($nested, $nextHint);
            }
        }
    };

    $walk($decoded, '');

    $unique = [];
    $seen = [];
    foreach ($snippets as $snippet) {
        $fingerprint = strtolower($snippet);
        if (isset($seen[$fingerprint])) {
            continue;
        }
        $seen[$fingerprint] = true;
        $unique[] = $snippet;
        if (count($unique) >= 8) {
            break;
        }
    }

    return $unique;
};

$seoBuildSuggestion = static function (Kirby\Cms\Page $page) use (
    $seoCollectLayoutSnippets,
    $seoNormalizeText,
    $seoTrimDescription,
    $seoTextLength
): string {
    $title = $seoNormalizeText((string)$page->title()->value());
    if ($title === '') {
        $title = 'Diese Seite';
    }

    $layoutRaw = (string)$page->content()->get('layout')->value();
    $snippets = $seoCollectLayoutSnippets($layoutRaw);
    $joined = trim(implode(' ', $snippets));

    // Only generate when enough real content is available.
    if ($seoTextLength($joined) < 80) {
        return '';
    }

    return $seoTrimDescription("{$title}: {$joined}", 160);
};

Kirby::plugin('flider/seo-assist', [
    'routes' => [
        [
            'pattern' => 'flider/seo/suggest',
            'method' => 'POST',
            'action' => function () use ($seoBuildSuggestion) {
                if (!kirby()->user()) {
                    return new Kirby\Http\Response(
                        body: json_encode(['success' => false, 'error' => 'Nicht angemeldet']),
                        type: 'application/json',
                        code: 403
                    );
                }

                $data = kirby()->request()->data();
                $pageId = trim((string)($data['pageId'] ?? ''));
                if ($pageId === '') {
                    return new Kirby\Http\Response(
                        body: json_encode(['success' => false, 'error' => 'Ungueltige Seite']),
                        type: 'application/json',
                        code: 400
                    );
                }

                $page = page($pageId);
                if (!$page) {
                    return new Kirby\Http\Response(
                        body: json_encode(['success' => false, 'error' => 'Seite nicht gefunden']),
                        type: 'application/json',
                        code: 404
                    );
                }

                $suggestion = $seoBuildSuggestion($page);
                if ($suggestion === '') {
                    return new Kirby\Http\Response(
                        body: json_encode([
                            'success' => false,
                            'error' => 'Noch zu wenig Inhalt auf dieser Seite fuer einen sinnvollen Vorschlag.'
                        ]),
                        type: 'application/json',
                        code: 422
                    );
                }

                return new Kirby\Http\Response(
                    body: json_encode([
                        'success' => true,
                        'suggestion' => $suggestion,
                        'pageId' => $page->id()
                    ]),
                    type: 'application/json',
                    code: 200
                );
            }
        ]
    ]
]);
