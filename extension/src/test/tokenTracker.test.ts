import * as assert from 'assert';
import { TokenTracker } from '../agent/tokenTracker';

suite('TokenTracker Tests', () => {
    let tracker: TokenTracker;

    setup(() => {
        tracker = new TokenTracker();
    });

    test('initial total is zero', () => {
        assert.strictEqual(tracker.getTotal(), 0);
    });

    test('addTokens increases total correctly', () => {
        tracker.addTokens(100, 50);
        assert.strictEqual(tracker.getTotal(), 150);

        tracker.addTokens(200, 75);
        assert.strictEqual(tracker.getTotal(), 425);
    });

    test('addTokens throws on negative input', () => {
        assert.throws(() => tracker.addTokens(-1, 50), Error);
        assert.throws(() => tracker.addTokens(100, -1), Error);
    });

    test('reset sets total to zero', () => {
        tracker.addTokens(100, 50);
        assert.strictEqual(tracker.getTotal(), 150);

        tracker.reset();
        assert.strictEqual(tracker.getTotal(), 0);
    });

    test('setWebview sends initial total', () => {
        let sentMessage: any = null;
        const mockWebview = {
            postMessage: (message: any) => { sentMessage = message; }
        };

        tracker.setWebview(mockWebview as any);
        assert.deepStrictEqual(sentMessage, { type: 'tokenUpdate', totalTokens: 0 });
    });

    test('addTokens notifies webview', () => {
        let sentMessage: any = null;
        const mockWebview = {
            postMessage: (message: any) => { sentMessage = message; }
        };

        tracker.setWebview(mockWebview as any);
        tracker.addTokens(100, 50);

        assert.deepStrictEqual(sentMessage, { type: 'tokenUpdate', totalTokens: 150 });
    });

    test('reset notifies webview', () => {
        let sentMessage: any = null;
        const mockWebview = {
            postMessage: (message: any) => { sentMessage = message; }
        };

        tracker.setWebview(mockWebview as any);
        tracker.addTokens(100, 50);
        sentMessage = null; // Reset for next call

        tracker.reset();
        assert.deepStrictEqual(sentMessage, { type: 'tokenUpdate', totalTokens: 0 });
    });
});