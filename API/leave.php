<?php
require_once __DIR__ . '/config.php';
cors();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    json_response(['ok' => false, 'error' => 'method_not_allowed'], 405);
}

$data = request_json();
$installationId = clean_string($data['installationId'] ?? '', 128);

if ($installationId === '' || !preg_match('/^[A-Za-z0-9._:-]{16,128}$/', $installationId)) {
    json_response(['ok' => false, 'error' => 'invalid_installation_id'], 400);
}

try {
    $pdo = db();
    $stmt = $pdo->prepare('DELETE FROM launcher_presence WHERE installation_id = :installation_id');
    $stmt->execute([':installation_id' => $installationId]);
    json_response(['ok' => true, 'left' => true]);
} catch (Throwable $e) {
    error_log('[BinerLauncher API] leave: ' . $e->getMessage());
    json_response(['ok' => false, 'error' => 'database_error'], 500);
}
