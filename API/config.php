<?php
declare(strict_types=1);

// BinerLauncher Presence API configuration.
// IMPORTANT: replace these values with the MySQL database details from cPanel.
const DB_HOST = 'localhost';
const DB_NAME = 'YOUR_DATABASE_NAME';
const DB_USER = 'YOUR_DATABASE_USER';
const DB_PASS = 'YOUR_DATABASE_PASSWORD';
const DB_CHARSET = 'utf8mb4';

const API_CORS_ORIGIN = '*';
const ONLINE_WINDOW_SECONDS = 90;
const MAX_HEARTBEAT_BODY_BYTES = 4096;

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $pdo;
}

function json_response(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function cors(): void
{
    header('Access-Control-Allow-Origin: ' . API_CORS_ORIGIN);
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Accept');
    header('Access-Control-Max-Age: 86400');

    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function request_json(): array
{
    $length = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($length > MAX_HEARTBEAT_BODY_BYTES) {
        json_response(['ok' => false, 'error' => 'request_too_large'], 413);
    }

    $raw = file_get_contents('php://input') ?: '';
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function clean_string(mixed $value, int $max = 100): string
{
    $value = trim((string)$value);
    $value = preg_replace('/[^\x20-\x7E\x{0080}-\x{FFFF}]/u', '', $value) ?? '';
    return mb_substr($value, 0, $max);
}
