/**
 * Secrets Redaction — prevents leaking credentials in prompts and responses.
 *
 * Scans text for common secret patterns and replaces them with [REDACTED].
 */

const SECRET_PATTERNS: RegExp[] = [
    // Generic API keys
    /(?:api[_-]?key|apikey)\s*[:=]\s*["']?[A-Za-z0-9_\-/.]{16,}["']?/gi,
    // Bearer tokens
    /Bearer\s+[A-Za-z0-9_\-/.]{20,}/g,
    // AWS keys
    /(?:AKIA|ASIA)[A-Z0-9]{16}/g,
    // Anthropic keys
    /sk-ant-[A-Za-z0-9_-]{20,}/g,
    // OpenAI / xAI keys
    /(?:sk-|xai-)[A-Za-z0-9_-]{20,}/g,
    // GitHub tokens
    /gh[ps]_[A-Za-z0-9_]{36,}/g,
    // Generic secrets in env-style assignments
    /(?:SECRET|TOKEN|PASSWORD|CREDENTIAL|AUTH)[_A-Z]*\s*[:=]\s*["']?[^\s"']{8,}["']?/gi,
    // .env style lines (KEY=value where key suggests a secret)
    /^(?:DATABASE_URL|REDIS_URL|MONGO_URI|DB_PASSWORD|JWT_SECRET)\s*=\s*.+$/gm,
    // Connection strings
    /(?:mongodb|postgres|mysql|redis):\/\/[^\s'"]+/gi,
];

/**
 * Redact secrets from text, replacing matches with [REDACTED].
 */
export function redactSecrets(text: string): string {
    let result = text;
    for (const pattern of SECRET_PATTERNS) {
        // Reset lastIndex for global regexps
        pattern.lastIndex = 0;
        result = result.replace(pattern, '[REDACTED]');
    }
    return result;
}

/**
 * Check if a file path likely contains secrets.
 */
export function isSecretFile(filePath: string): boolean {
    const basename = filePath.split(/[\\/]/).pop()?.toLowerCase() ?? '';
    const secretFiles = ['.env', '.env.local', '.env.production', '.env.development'];
    const secretExtensions = ['.key', '.pem', '.p12', '.pfx', '.jks', '.keystore'];

    if (secretFiles.includes(basename)) { return true; }
    for (const ext of secretExtensions) {
        if (basename.endsWith(ext)) { return true; }
    }
    return false;
}
