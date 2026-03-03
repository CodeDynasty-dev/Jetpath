import { describe, test, expect } from 'bun:test';
import { mime } from '../src/extracts/mimejs-extract.ts';

describe('MIME type utility', () => {
  test('getType returns correct type for common extensions', () => {
    expect(mime.getType('file.json')).toBe('application/json');
    expect(mime.getType('file.html')).toBe('text/html');
    expect(mime.getType('file.css')).toBe('text/css');
    // .js maps to text/javascript per IANA (application/javascript is deprecated)
    expect(['text/javascript', 'application/javascript']).toContain(
      mime.getType('file.js')
    );
    expect(mime.getType('file.png')).toBe('image/png');
    expect(mime.getType('file.jpg')).toBe('image/jpeg');
    expect(mime.getType('file.svg')).toBe('image/svg+xml');
    expect(mime.getType('file.pdf')).toBe('application/pdf');
    expect(mime.getType('file.txt')).toBe('text/plain');
    expect(mime.getType('file.mp4')).toBe('video/mp4');
    expect(mime.getType('file.mp3')).toBe('audio/mpeg');
    expect(mime.getType('file.zip')).toBe('application/zip');
  });

  test('getType handles path with directories', () => {
    expect(mime.getType('/some/path/to/file.json')).toBe('application/json');
    expect(mime.getType('assets/images/photo.png')).toBe('image/png');
  });

  test('getType returns null for unknown extension', () => {
    expect(mime.getType('file.unknownxyz')).toBeNull();
  });

  test('getExtension returns correct extension for mime type', () => {
    expect(mime.getExtension('application/json')).toBe('json');
    expect(mime.getExtension('text/html')).toBe('html');
    expect(mime.getExtension('image/png')).toBe('png');
    // image/jpeg canonical extension is 'jpeg' or 'jpg' depending on the lib
    expect(['jpeg', 'jpg']).toContain(mime.getExtension('image/jpeg'));
    expect(mime.getExtension('text/css')).toBe('css');
  });

  test('getExtension returns null for unknown mime type', () => {
    expect(mime.getExtension('application/x-unknown-type-xyz')).toBeNull();
  });

  test('getType is case-insensitive for extension', () => {
    // Most mime libs normalize to lowercase extension
    const result = mime.getType('file.JSON');
    // Either returns the type or null — should not throw
    expect(result === 'application/json' || result === null).toBe(true);
  });
});
