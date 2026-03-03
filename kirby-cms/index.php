<?php

// SECURITY/BUGFIX: Prevent 500 Errors in Local Headless Dev Environments.
// Browsers (like Chrome/Safari) and Dev-Servers (like Vite) often send `HEAD` requests
// to validate iframe cache freshness. Kirby's internal Panel logic crashes on these.
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'HEAD') {
    $_SERVER['REQUEST_METHOD'] = 'GET';
}

require 'kirby/bootstrap.php';

// Force removal of restrictive headers set by Kirby Panel
header_register_callback(function () {
    header_remove('X-Frame-Options');
    header_remove('Content-Security-Policy');
});

try {
    echo (new Kirby)->render();
}
catch (Throwable $e) {
    error_log("KIRBY CRASH: " . $e->getMessage());
    error_log("KIRBY CRASH FILE: " . $e->getFile() . ":" . $e->getLine());
    error_log("KIRBY CRASH TRACE: " . $e->getTraceAsString());
}