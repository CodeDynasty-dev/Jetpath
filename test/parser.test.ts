import { describe, test, expect } from 'bun:test';
import {
  parseRequest,
  parseFormData,
  parseUrlEncoded,
} from '../src/primitives/parser.ts';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeJsonRequest(body: unknown): Request {
  return new Request('http://localhost/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeFormRequest(body: string): Request {
  return new Request('http://localhost/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
}

function makeMultipartRequest(body: Uint8Array, boundary: string): Request {
  return new Request('http://localhost/test', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
  });
}

function buildMultipart(
  boundary: string,
  parts: { name: string; value: string; filename?: string; type?: string }[]
): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  for (const part of parts) {
    let header = `--${boundary}\r\nContent-Disposition: form-data; name="${part.name}"`;
    if (part.filename) header += `; filename="${part.filename}"`;
    header += '\r\n';
    if (part.type) header += `Content-Type: ${part.type}\r\n`;
    header += '\r\n';
    chunks.push(enc.encode(header));
    chunks.push(enc.encode(part.value));
    chunks.push(enc.encode('\r\n'));
  }
  chunks.push(enc.encode(`--${boundary}--\r\n`));
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

// ─── parseRequest ────────────────────────────────────────────────────────────

describe('parseRequest - JSON', () => {
  test('parses flat JSON object', async () => {
    const req = makeJsonRequest({ name: 'Alice', age: 30 });
    const result = await parseRequest(req);
    expect(result.name).toBe('Alice');
    expect(result.age).toBe(30);
  });

  test('parses nested JSON object', async () => {
    const req = makeJsonRequest({ user: { id: 1, role: 'admin' } });
    const result = await parseRequest(req);
    expect(result.user.id).toBe(1);
    expect(result.user.role).toBe('admin');
  });

  test('parses JSON array at root', async () => {
    const req = makeJsonRequest([1, 2, 3]);
    const result = await parseRequest(req);
    expect(Array.isArray(result)).toBe(true);
  });

  test('parses empty JSON body as empty object', async () => {
    const req = new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '',
    });
    const result = await parseRequest(req);
    expect(typeof result).toBe('object');
  });

  test('throws on invalid JSON', async () => {
    const req = new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ invalid json }',
    });
    await expect(parseRequest(req)).rejects.toThrow();
  });

  test('throws when body exceeds maxBodySize', async () => {
    const big = JSON.stringify({ data: 'x'.repeat(200) });
    const req = new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: big,
    });
    await expect(parseRequest(req, { maxBodySize: 50 })).rejects.toThrow(
      'Payload Too Large'
    );
  });
});

describe('parseRequest - URL-encoded', () => {
  test('parses simple key=value pairs', async () => {
    const req = makeFormRequest('name=Bob&age=25');
    const result = await parseRequest(req);
    expect(result.name).toBe('Bob');
    expect(result.age).toBe('25');
  });

  test('parses URL-encoded special characters', async () => {
    const req = makeFormRequest('email=test%40example.com&msg=hello+world');
    const result = await parseRequest(req);
    expect(result.email).toBe('test@example.com');
    expect(result.msg).toBe('hello world');
  });

  test('parses duplicate keys into array', async () => {
    const req = makeFormRequest('tag=js&tag=ts&tag=bun');
    const result = await parseRequest(req);
    expect(Array.isArray(result.tag)).toBe(true);
    expect((result.tag as string[]).length).toBe(3);
  });
});

describe('parseRequest - multipart', () => {
  test('parses text fields from multipart body', async () => {
    const boundary = 'testboundary123';
    const body = buildMultipart(boundary, [
      { name: 'username', value: 'charlie' },
      { name: 'city', value: 'Lagos' },
    ]);
    const req = makeMultipartRequest(body, boundary);
    const result = await parseRequest(req);
    expect(result.username).toBe('charlie');
    expect(result.city).toBe('Lagos');
  });

  test('parses file upload from multipart body', async () => {
    const boundary = 'fileboundary456';
    const body = buildMultipart(boundary, [
      {
        name: 'avatar',
        value: 'fake-image-bytes',
        filename: 'photo.png',
        type: 'image/png',
      },
    ]);
    const req = makeMultipartRequest(body, boundary);
    const result = await parseRequest(req);
    expect(result.avatar).toBeDefined();
    expect((result.avatar as any).fileName).toBe('photo.png');
    expect((result.avatar as any).mimeType).toBe('image/png');
  });

  test('parses mixed fields and files', async () => {
    const boundary = 'mixedboundary789';
    const body = buildMultipart(boundary, [
      { name: 'title', value: 'My Upload' },
      {
        name: 'file',
        value: 'content',
        filename: 'doc.txt',
        type: 'text/plain',
      },
    ]);
    const req = makeMultipartRequest(body, boundary);
    const result = await parseRequest(req);
    expect(result.title).toBe('My Upload');
    expect((result.file as any).fileName).toBe('doc.txt');
  });
});

describe('parseRequest - unknown content type', () => {
  test('returns raw text in parsed field for unknown content type', async () => {
    const req = new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'raw text body',
    });
    const result = await parseRequest(req);
    expect(result.parsed).toBe('raw text body');
  });
});

// ─── parseUrlEncoded ─────────────────────────────────────────────────────────

describe('parseUrlEncoded', () => {
  test('parses basic key=value', () => {
    const result = parseUrlEncoded('foo=bar&baz=qux');
    expect(result.foo).toBe('bar');
    expect(result.baz).toBe('qux');
  });

  test('handles empty string', () => {
    const result = parseUrlEncoded('');
    expect(Object.keys(result).length).toBe(0);
  });

  test('handles duplicate keys as array', () => {
    const result = parseUrlEncoded('x=1&x=2&x=3');
    expect(Array.isArray(result.x)).toBe(true);
    expect((result.x as string[]).length).toBe(3);
  });

  test('decodes percent-encoded values', () => {
    const result = parseUrlEncoded('q=hello%20world');
    expect(result.q).toBe('hello world');
  });
});

// ─── parseFormData ───────────────────────────────────────────────────────────

describe('parseFormData', () => {
  test('parses text field', () => {
    const boundary = 'bound1';
    const body = buildMultipart(boundary, [
      { name: 'field1', value: 'value1' },
    ]);
    const result = parseFormData(
      body,
      `multipart/form-data; boundary=${boundary}`
    );
    expect(result.field1).toBe('value1');
  });

  test('throws on missing boundary', () => {
    const body = new Uint8Array(10);
    expect(() => parseFormData(body, 'multipart/form-data')).toThrow(
      'Invalid multipart boundary'
    );
  });

  test('throws when body exceeds maxBodySize', () => {
    const boundary = 'bound2';
    const body = buildMultipart(boundary, [
      { name: 'f', value: 'x'.repeat(200) },
    ]);
    expect(() =>
      parseFormData(body, `multipart/form-data; boundary=${boundary}`, {
        maxBodySize: 50,
      })
    ).toThrow('Body exceeds max size');
  });

  test('throws when file exceeds maxFileSize', () => {
    const boundary = 'bound3';
    const body = buildMultipart(boundary, [
      {
        name: 'upload',
        value: 'x'.repeat(200),
        filename: 'big.bin',
        type: 'application/octet-stream',
      },
    ]);
    expect(() =>
      parseFormData(body, `multipart/form-data; boundary=${boundary}`, {
        maxFileSize: 50,
      })
    ).toThrow('exceeds max size');
  });

  test('parses JSON-encoded field value', () => {
    const boundary = 'bound4';
    const body = buildMultipart(boundary, [
      { name: 'meta', value: '{"key":"val"}' },
    ]);
    const result = parseFormData(
      body,
      `multipart/form-data; boundary=${boundary}`
    );
    expect((result.meta as any).key).toBe('val');
  });
});
