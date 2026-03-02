</main>

<!-- Footer -->
<footer class="site-footer fade-in">
    <div class="footer-content">
        <p>&copy;
            <?= date('Y')?>
            <?= $site->title()?>. Alle Rechte vorbehalten.
        </p>
        <div class="social-links">
            <?php if ($site->instagram()->isNotEmpty()): ?>
            <a href="<?= $site->instagram()?>" target="_blank">Instagram</a>
            <?php
endif ?>
        </div>
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