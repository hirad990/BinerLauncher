<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
cors();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    json_response(['ok' => false, 'error' => 'method_not_allowed'], 405);
}

$data = request_json();
$installationId = clean_string($data['installationId'] ?? '', 128);
$launcherVersion = clean_string($data['launcherVersion'] ?? 'unknown', 32);
$platform = clean_string($data['platform'] ?? 'windows', 32);

if ($installationId === '' || !preg_match('/^[A-Za-z0-9._:-]{16,128}$/', $installationId)) {
    json_response(['ok' => false, 'error' => 'invalid_installation_id'], 400);
}

try {
    $pdo = db();
    $sql = 'INSERT INTO launcher_presence
            (installation_id, launcher_version, platform, last_seen, created_at)
            VALUES (:installation_id, :launcher_version, :platform, UTC_TIMESTAMP(), UTC_TIMESTAMP())
            ON DUPLICATE KEY UPDATE
              launcher_version = VALUES(launcher_version),
              platform = VALUES(platform),
              last_seen = UTC_TIMESTAMP()';
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':installation_id' => $installationId,
        ':launcher_version' => $launcherVersion,
        ':platform' => $platform,
    ]);

    $stmt = $pdo->query('SELECT COUNT(*) AS online FROM launcher_presence WHERE last_seen >= (UTC_TIMESTAMP() - INTERVAL ' . ONLINE_WINDOW_SECONDS . ' SECOND)');
    $online = (int)($stmt->fetch()['online'] ?? 0);

    json_response([
        'ok' => true,
        'online' => $online,
        'serverTime' => gmdate('c'),
    ]);
} catch (Throwable $e) {
    error_log('[BinerLauncher API] heartbeat: ' . $e->getMessage());
    json_response(['ok' => false, 'error' => 'database_error'], 500);
}
