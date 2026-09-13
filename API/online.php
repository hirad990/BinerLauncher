<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
cors();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    json_response(['ok' => false, 'error' => 'method_not_allowed'], 405);
}

try {
    $pdo = db();
    $stmt = $pdo->query('SELECT COUNT(*) AS online FROM launcher_presence WHERE last_seen >= (UTC_TIMESTAMP() - INTERVAL ' . ONLINE_WINDOW_SECONDS . ' SECOND)');
    $online = (int)($stmt->fetch()['online'] ?? 0);

    json_response([
        'ok' => true,
        'online' => $online,
        'serverTime' => gmdate('c'),
        'windowSeconds' => ONLINE_WINDOW_SECONDS,
    ]);
} catch (Throwable $e) {
    error_log('[BinerLauncher API] online: ' . $e->getMessage());
    json_response(['ok' => false, 'error' => 'database_error'], 500);
}
