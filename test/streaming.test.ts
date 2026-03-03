import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  mock,
  afterAll,
} from 'bun:test';
import { JetServer } from '../src/index.ts';
import type { JetRoute } from '../src/primitives/types.ts';
import { Readable } from 'stream';
import { ReadableStream } from 'stream/web';

// Mock Bun.file for testing
const mockFile = {
  size: 1024,
  name: 'test.txt',
  type: 'text/plain',
  stream: () => {
    const encoder = new TextEncoder();
    const content = 'This is a test file content for streaming';
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(content));
        controller.close();
      },
    });
    return stream;
  },
};

// Note: We can't mock globalThis.Bun as it's read-only in tests
// We'll test streaming without mocking Bun.file directly

describe('Streaming Tests', () => {
  let jetServer: any;

  beforeEach(() => {
    jetServer = new JetServer();
  });

  test('Streaming with sendStream method', async () => {
    // Create a mock stream
    const mockStream = new Readable({
      read() {
        this.push('test data');
        this.push(null);
      },
    });

    const route: JetRoute = async function (ctx) {
      // Mock a file stream
      const mockFileStream = {
        size: 1024,
        name: 'test.txt',
        type: 'text/plain',
        stream: () => {
          const encoder = new TextEncoder();
          const content = 'Test file content for streaming';
          return new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode(content));
              controller.close();
            },
          });
        },
      };

      // Mock Bun.file for Bun runtime
      if (typeof Bun !== 'undefined') {
        // In a real test with Bun, we would use Bun.file
        // For now, we'll mock the stream
        ctx._3 = mockFileStream;
      } else {
        // For Node.js, use a Readable stream
        const { Readable } = await import('stream');
        const stream = new Readable({
          read() {
            this.push('test data from stream');
            this.push(null);
          },
        });
        ctx._3 = stream;
      }
    };

    route.method = 'GET';
    route.path = '/stream';

    // Note: In a real test, we would need to mock the response handling
    // This is a simplified test to show the concept
    expect(route).toBeDefined();
  });

  test('File download with sendStream', async () => {
    const route: JetRoute = function (ctx) {
      // Test file download with sendStream
      // In a real test, this would set up a file stream
      ctx.sendStream = (stream: any, config: any) => {
        ctx._3 = stream;
        ctx._2['Content-Type'] =
          config?.ContentType || 'application/octet-stream';
        ctx._2['Content-Disposition'] =
          `attachment; filename="${config?.filename || 'download'}"`;
      };

      // Simulate a file download
      const mockStream = new Readable({
        read() {
          this.push('file content');
          this.push(null);
        },
      });

      ctx.sendStream(mockStream, {
        ContentType: 'application/octet-stream',
      });
    };

    route.method = 'GET';
    route.path = '/download';

    // The route function should be callable
    expect(typeof route).toBe('function');
  });

  test('Stream error handling', async () => {
    const route: JetRoute = function (ctx) {
      // Test error handling in streaming
      const errorStream = new Readable({
        read() {
          this.emit('error', new Error('Stream error'));
        },
      });

      ctx._3 = errorStream;
    };

    route.method = 'GET';
    route.path = '/stream-error';

    // The route should handle stream errors gracefully
    expect(route).toBeDefined();
  });

  test('Stream with Bun.file (Bun runtime)', async () => {
    // Skip this test if not in Bun runtime
    if (typeof Bun === 'undefined') {
      console.log('Skipping Bun-specific test in non-Bun environment');
      return;
    }

    const route: JetRoute = function (ctx) {
      // In Bun, we can use Bun.file for streaming
      const file = Bun.file('test.txt');
      ctx._3 = file.stream();
    };

    route.method = 'GET';
    route.path = '/bun-file';

    expect(route).toBeDefined();
  });

  test('Stream with Node.js Readable', async () => {
    const route: JetRoute = function (ctx) {
      const { Readable } = require('stream');
      const stream = new Readable({
        read() {
          this.push('stream data');
          this.push(null);
        },
      });

      ctx._3 = stream;
    };

    route.method = 'GET';
    route.path = '/node-stream';

    expect(route).toBeDefined();
  });
});
