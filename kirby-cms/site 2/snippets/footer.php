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
</body>

</html>