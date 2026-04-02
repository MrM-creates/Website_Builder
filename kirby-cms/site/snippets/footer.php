</main>

<?php
$defaultCopyright = '© ' . date('Y') . ' ' . $site->title();
$footerLine1 = trim((string)$site->footerline1()->value());
$footerLine2 = trim((string)$site->footerline2()->value());
$footerLine3 = trim((string)$site->footerline3()->value());

if (preg_match('/^Footerline[0-9]+:/i', $footerLine1)) {
    $footerLine1 = '';
}
if (preg_match('/^Footerline[0-9]+:/i', $footerLine2)) {
    $footerLine2 = '';
}
if (preg_match('/^Footerline[0-9]+:/i', $footerLine3)) {
    $footerLine3 = '';
}

$rawCopyrightName = $footerLine1 !== '' ? $footerLine1 : trim((string)$site->title());
if ($rawCopyrightName === '') {
    $copyrightText = $defaultCopyright;
} elseif (preg_match('/©|&copy;|\b\d{4}\b/u', $rawCopyrightName) === 1) {
    // If user already entered a full copyright string, keep it as-is
    $copyrightText = $rawCopyrightName;
} else {
    $copyrightText = '© ' . date('Y') . ' ' . $rawCopyrightName;
}

$line2Value = $footerLine2 !== '' ? $footerLine2 : trim((string)$site->instagram()->value());
$line3Value = $footerLine3 !== '' ? $footerLine3 : trim((string)$site->email()->value());

$normalizeLink = function (string $value): string {
    $trimmed = trim($value);
    if ($trimmed === '') return '';
    if (preg_match('~^(https?://|mailto:|tel:)~i', $trimmed) === 1) return $trimmed;
    return 'https://' . ltrim($trimmed, '/');
};

$line2Link = $normalizeLink($line2Value);
$line3Link = '';
if ($line3Value !== '') {
    if (filter_var($line3Value, FILTER_VALIDATE_EMAIL)) {
        $line3Link = 'mailto:' . $line3Value;
    } else {
        $line3Link = $normalizeLink($line3Value);
    }
}

$toRelativePath = function ($url) {
    $raw = trim((string)($url ?? ''));
    if ($raw === '') return '/';
    if (str_starts_with($raw, '/')) return $raw;
    $parts = parse_url($raw);
    if ($parts === false) return $raw;
    $path = $parts['path'] ?? '/';
    if ($path === '') $path = '/';
    if (!str_starts_with($path, '/')) {
        $path = '/' . ltrim($path, '/');
    }
    if (isset($parts['query']) && $parts['query'] !== '') {
        $path .= '?' . $parts['query'];
    }
    if (isset($parts['fragment']) && $parts['fragment'] !== '') {
        $path .= '#' . $parts['fragment'];
    }
    return $path;
};

$legalLinks = [];
foreach ([
    'impressum' => 'Impressum',
    'datenschutz' => 'Datenschutz'
] as $slug => $label) {
    $legalPage = $site->find($slug);
    if ($legalPage) {
        $legalLinks[] = [
            'label' => $label,
            'url' => $toRelativePath($legalPage->url())
        ];
    }
}
?>

<!-- Footer -->
<footer class="site-footer fade-in">
    <div class="footer-content">
        <p class="footer-item"><?= html($copyrightText) ?></p>

        <?php if ($line2Value !== ''): ?>
            <p class="footer-item">
                <?php if ($line2Link !== ''): ?>
                    <a href="<?= esc($line2Link, 'attr') ?>" target="_blank" rel="noopener noreferrer" aria-label="Instagram" title="Instagram" style="display:inline-flex;align-items:center;justify-content:center;line-height:1;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                            <path d="M16 11.37a4 4 0 1 1-3.37-3.37 4 4 0 0 1 3.37 3.37z"></path>
                            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                        </svg>
                    </a>
                <?php else: ?>
                    <?= html($line2Value) ?>
                <?php endif ?>
            </p>
        <?php endif ?>

        <?php if ($line3Value !== ''): ?>
            <p class="footer-item">
                <?php if ($line3Link !== ''): ?>
                    <?php if (str_starts_with($line3Link, 'mailto:')): ?>
                        <a href="<?= esc($line3Link, 'attr') ?>"><?= html($line3Value) ?></a>
                    <?php else: ?>
                        <a href="<?= esc($line3Link, 'attr') ?>" target="_blank" rel="noopener noreferrer"><?= html($line3Value) ?></a>
                    <?php endif ?>
                <?php else: ?>
                    <?= html($line3Value) ?>
                <?php endif ?>
            </p>
        <?php endif ?>

        <?php if (count($legalLinks) > 0): ?>
            <nav class="footer-legal-links" aria-label="Rechtliches">
                <?php foreach ($legalLinks as $index => $link): ?>
                    <a href="<?= esc($link['url'], 'attr') ?>"><?= html($link['label']) ?></a><?= $index < count($legalLinks) - 1 ? '<span class="footer-legal-separator">·</span>' : '' ?>
                <?php endforeach ?>
            </nav>
        <?php endif ?>
    </div>
</footer>

<!-- Animations Setup Script -->
<script>
    document.addEventListener("DOMContentLoaded", () => {
        const observerOptions = {
            root: null,
            rootMargin: '0px',
            threshold: 0.1
        };

        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        document.querySelectorAll('.fade-in').forEach(element => {
            observer.observe(element);
        });
    });

    // Image Protection: Prevent right-click context menu on all images
    document.addEventListener('contextmenu', function (e) {
        if (e.target.tagName === 'IMG') {
            e.preventDefault();
        }
    });

    // Image Protection: Prevent dragging of images
    document.addEventListener('dragstart', function (e) {
        if (e.target.tagName === 'IMG') {
            e.preventDefault();
        }
    });
</script>

<!-- Mobile UX Fixes -->
<style>
/* 1. Fix iOS Lightbox Bug & Disable annoying hover on touch */
@media (hover: none) {
    .masonry-item img:hover { transform: none !important; filter: none !important; }
}
/* Re-enable pointer events for iOS Safari hit detection */
.masonry-item a, .masonry-item img {
    pointer-events: auto !important; 
    -webkit-touch-callout: none !important; /* Prevents long-press save menu */
}

/* 2. Fix Navigation & Footer Wrapping on Mobile */
@media (max-width: 900px) {
    .footer-content {
        flex-direction: column;
        gap: 0.8rem;
        text-align: center;
    }
    
    /* Navigation Dropdown */
    .nav-links {
        display: none;
        flex-direction: column;
        position: absolute;
        top: 100px;
        left: 0;
        width: 100%;
        background-color: rgba(252, 252, 252, 0.98);
        padding: 2rem 5%;
        box-shadow: 0 10px 20px rgba(0,0,0,0.05);
        border-top: 1px solid rgba(0,0,0,0.05);
        align-items: center;
        gap: 1.5rem;
    }
    
    .nav-links.nav-mobile-open {
        display: flex !important;
    }
    
    /* Hamburger to X Animation */
    .menu-toggle.nav-mobile-open span:nth-child(1) { transform: translateY(4px) rotate(45deg); }
    .menu-toggle.nav-mobile-open span:nth-child(2) { transform: translateY(-4px) rotate(-45deg); }
}
</style>

<script>
    document.addEventListener("DOMContentLoaded", () => {
        // Mobile navigation toggler Javascript
        const menuBtn = document.querySelector(".menu-toggle");
        const navLinks = document.querySelector(".nav-links");

        if (menuBtn && navLinks) {
            menuBtn.addEventListener("click", () => {
                menuBtn.classList.toggle("nav-mobile-open");
                navLinks.classList.toggle("nav-mobile-open");
            });
        }
    });
</script>

</body>

</html>
