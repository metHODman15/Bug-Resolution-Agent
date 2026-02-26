import * as assert from 'assert';
import { redactSecrets, isSecretFile } from '../agent/safety/secretsRedaction';

suite('Secrets Redaction Tests', () => {

    test('redacts Anthropic API keys', () => {
        const input = 'key: sk-ant-api03-abcdefghijklmnopqrstuvwxyz';
        const result = redactSecrets(input);
        assert.ok(!result.includes('sk-ant-api03'));
        assert.ok(result.includes('[REDACTED]'));
    });

    test('redacts xAI keys', () => {
        const input = 'token: xai-abcdefghijklmnopqrstuvwxyz';
        const result = redactSecrets(input);
        assert.ok(!result.includes('xai-abcdefgh'));
        assert.ok(result.includes('[REDACTED]'));
    });

    test('redacts GitHub tokens', () => {
        const input = 'GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz0123456789';
        const result = redactSecrets(input);
        assert.ok(!result.includes('ghp_'));
        assert.ok(result.includes('[REDACTED]'));
    });

    test('redacts AWS access key IDs', () => {
        const input = 'AWS key: AKIAIOSFODNN7EXAMPLE';
        const result = redactSecrets(input);
        assert.ok(!result.includes('AKIAIOSFODNN7EXAMPLE'));
        assert.ok(result.includes('[REDACTED]'));
    });

    test('redacts Bearer tokens', () => {
        const input = 'Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9';
        const result = redactSecrets(input);
        assert.ok(!result.includes('eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9'));
        assert.ok(result.includes('[REDACTED]'));
    });

    test('does not redact normal text', () => {
        const input = 'This is a normal line of code with no secrets.';
        const result = redactSecrets(input);
        assert.strictEqual(result, input);
    });

    test('isSecretFile detects .env files', () => {
        assert.strictEqual(isSecretFile('.env'), true);
        assert.strictEqual(isSecretFile('.env.local'), true);
        assert.strictEqual(isSecretFile('.env.production'), true);
    });

    test('isSecretFile detects key/cert files', () => {
        assert.strictEqual(isSecretFile('server.key'), true);
        assert.strictEqual(isSecretFile('cert.pem'), true);
        assert.strictEqual(isSecretFile('keystore.p12'), true);
    });

    test('isSecretFile returns false for normal files', () => {
        assert.strictEqual(isSecretFile('index.ts'), false);
        assert.strictEqual(isSecretFile('README.md'), false);
        assert.strictEqual(isSecretFile('package.json'), false);
    });
});
