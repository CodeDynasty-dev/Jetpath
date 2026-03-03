import { describe, test, expect, beforeEach } from 'bun:test';
import { validator } from '../src/primitives/validator.ts';
import { JetServer, use } from '../src/index.ts';
import { v } from '../src/primitives/functions.ts';
import type { JetRoute } from '../src/primitives/types.ts';

describe('Validation System - Core validator()', () => {
  test('validates simple schema with valid data', () => {
    const schema = {
      name: { type: 'string', required: true },
      age: { type: 'number', required: true },
    };
    const result = validator(schema, { name: 'John', age: 25 });
    expect(result.name).toBe('John');
    expect(result.age).toBe(25);
  });

  test('throws for missing required field', () => {
    const schema = {
      name: { type: 'string', required: true },
      age: { type: 'number', required: true },
    };
    expect(() => validator(schema, { name: 'John' })).toThrow();
  });

  test('skips optional missing fields without error', () => {
    const schema = {
      name: { type: 'string', required: true },
      nickname: { type: 'string', required: false },
    };
    const result = validator(schema, { name: 'Alice' });
    expect(result.name).toBe('Alice');
    expect(result.nickname).toBeUndefined();
  });

  test('throws for wrong type', () => {
    const schema = { age: { type: 'number', required: true } };
    expect(() => validator(schema, { age: 'not-a-number' })).toThrow();
  });

  test('validates nested objects', () => {
    const schema = {
      user: {
        type: 'object',
        required: true,
        objectSchema: {
          name: { type: 'string', required: true },
          email: { type: 'string', required: true },
        },
      },
    };
    const result = validator(schema, {
      user: { name: 'John Doe', email: 'john@example.com' },
    });
    expect(result.user.name).toBe('John Doe');
    expect(result.user.email).toBe('john@example.com');
  });

  test('validates array of primitives', () => {
    const schema = {
      tags: { type: 'array', required: true, arrayType: 'string' },
    };
    const result = validator(schema, { tags: ['js', 'ts', 'bun'] });
    expect(result.tags).toEqual(['js', 'ts', 'bun']);
  });

  test('throws when array contains wrong type', () => {
    const schema = {
      ids: { type: 'array', required: true, arrayType: 'number' },
    };
    expect(() => validator(schema, { ids: [1, 'two', 3] })).toThrow();
  });

  test('validates array of objects', () => {
    const schema = {
      items: {
        type: 'array',
        required: true,
        arrayType: 'object',
        objectSchema: {
          id: { type: 'number', required: true },
          label: { type: 'string', required: true },
        },
      },
    };
    const result = validator(schema, {
      items: [
        { id: 1, label: 'first' },
        { id: 2, label: 'second' },
      ],
    });
    expect(result.items).toHaveLength(2);
    expect(result.items[0].label).toBe('first');
  });

  test('throws when array-of-objects item fails validation', () => {
    const schema = {
      items: {
        type: 'array',
        required: true,
        arrayType: 'object',
        objectSchema: {
          id: { type: 'number', required: true },
        },
      },
    };
    expect(() =>
      validator(schema, { items: [{ id: 1 }, { notId: 'x' }] })
    ).toThrow();
  });

  test('validates regex pattern', () => {
    const schema = {
      email: {
        type: 'string',
        required: true,
        RegExp: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      },
    };
    expect(() => validator(schema, { email: 'not-an-email' })).toThrow();
    const result = validator(schema, { email: 'user@example.com' });
    expect(result.email).toBe('user@example.com');
  });

  test('custom validator returning string is used as error message', () => {
    const schema = {
      age: {
        type: 'number',
        required: true,
        validator: (v: number) => (v < 0 ? 'Age cannot be negative' : true),
      },
    };
    expect(() => validator(schema, { age: -1 })).toThrow(
      'Age cannot be negative'
    );
    expect(() => validator(schema, { age: 25 })).not.toThrow();
  });

  test('custom validator returning false uses fallback error', () => {
    const schema = {
      score: {
        type: 'number',
        required: true,
        validator: (v: number) => v >= 0,
      },
    };
    expect(() => validator(schema, { score: -5 })).toThrow();
  });

  test('respects depth limit for recursion protection', () => {
    let deepSchema: any = {};
    let current = deepSchema;
    for (let i = 0; i < 30; i++) {
      current.nested = { type: 'object', required: true, objectSchema: {} };
      current = current.nested.objectSchema;
    }
    let deepData: any = {};
    let d = deepData;
    for (let i = 0; i < 30; i++) {
      d.nested = {};
      d = d.nested;
    }
    expect(() => validator(deepSchema, deepData, 0, 20)).toThrow(
      'Maximum validation depth'
    );
  });

  test('collects multiple errors and throws combined message', () => {
    const schema = {
      name: { type: 'string', required: true },
      age: { type: 'number', required: true },
    };
    let msg = '';
    try {
      validator(schema, {});
    } catch (e: any) {
      msg = e.message;
    }
    expect(msg).toContain('name');
    expect(msg).toContain('age');
  });
});

describe('Validation System - use() API', () => {
  let jetServer: JetServer;

  beforeEach(() => {
    jetServer = new JetServer();
  });

  test('use().body() attaches schema to route', () => {
    const route: JetRoute = function (ctx) {
      ctx.send({ ok: true });
    };
    use(route).body((t) => ({
      email: t.string().required().email(),
      password: t.string().required().min(8),
    }));
    expect(route.body!['email'].required).toBe(true);
    expect(route.body!['password'].required).toBe(true);
  });

  test('use().response() attaches response schema to route', () => {
    const route: JetRoute = function (ctx) {
      ctx.send({ ok: true });
    };
    use(route).response((t) => ({
      ok: t.boolean(),
    }));
    expect(route.response).toBeDefined();
    expect(route.response!['ok'].type).toBe('boolean');
  });

  test('use().query() attaches query schema to route', () => {
    const route: JetRoute = function (ctx) {
      ctx.send({ ok: true });
    };
    use(route).query((t) => ({
      q: t.string().required(),
      page: t.number(),
    }));
    expect(route.query!['q'].required).toBe(true);
  });

  test('use().title() and .description() set metadata', () => {
    const route: JetRoute = function (ctx) {
      ctx.send({ ok: true });
    };
    use(route).title('My Route').description('Does something useful');
    expect(route.title).toBe('My Route');
    expect(route.description).toBe('Does something useful');
  });

  test('response validation runs on ctx.send()', async () => {
    const route: JetRoute = function (ctx) {
      ctx.send({ name: 'Alice', count: 5 });
    };
    route.method = 'GET';
    route.path = '/resp-validate';
    use(route).response((t) => ({
      name: t.string().required(),
      count: t.number().required(),
    }));

    const result = await jetServer.runBare(route);
    expect(result.code).toBe(200);
    expect(result.body.name).toBe('Alice');
    expect(result.body.count).toBe(5);
  });

  test('response validation throws when data does not match schema', async () => {
    const route: JetRoute = function (ctx) {
      // count is missing — should fail response validation
      ctx.send({ name: 'Alice' });
    };
    route.method = 'GET';
    route.path = '/resp-fail';
    use(route).response((t) => ({
      name: t.string().required(),
      count: t.number().required(),
    }));

    const result = await jetServer.runBare(route);
    // Validation error causes 500
    expect(result.code).toBe(500);
  });

  test('body validation runs on ctx.parse() with real request', async () => {
    const route: JetRoute = async function (ctx) {
      const body = await ctx.parse();
      ctx.send({ email: body.email, ok: true });
    };
    route.method = 'POST';
    route.path = '/login';
    use(route).body((t) => ({
      email: t.string().required().email(),
      password: t.string().required().min(8),
    }));

    const req = new Request('http://localhost/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'secret99' }),
    });
    const ctx = jetServer.createCTX(req, new Response(), '/login', route, {});
    const result = await jetServer.runWithCTX(route, ctx);
    expect(result.code).toBe(200);
    expect(result.body.ok).toBe(true);
  });

  test('body validation fails with invalid data on ctx.parse()', async () => {
    const route: JetRoute = async function (ctx) {
      const body = await ctx.parse();
      ctx.send({ email: body.email });
    };
    route.method = 'POST';
    route.path = '/login-fail';
    use(route).body((t) => ({
      email: t.string().required().email(),
      password: t.string().required().min(8),
    }));

    const req = new Request('http://localhost/login-fail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: 'short' }),
    });
    const ctx = jetServer.createCTX(
      req,
      new Response(),
      '/login-fail',
      route,
      {}
    );
    const result = await jetServer.runWithCTX(route, ctx);
    expect(result.code).toBeGreaterThanOrEqual(400);
  });
});

describe('Validation System - Schema Builders (v)', () => {
  test('v.string() creates string schema', () => {
    const def = v.string().required().min(3).max(100).getDefinition();
    expect(def.type).toBe('string');
    expect(def.required).toBe(true);
    expect(typeof def.validator).toBe('function');
  });

  test('v.string().email() sets RegExp', () => {
    const def = v.string().email().getDefinition();
    expect(def.RegExp).toBeInstanceOf(RegExp);
  });

  test('v.string().url() sets RegExp', () => {
    const def = v.string().url().getDefinition();
    expect(def.RegExp).toBeInstanceOf(RegExp);
  });

  test('v.number() creates number schema', () => {
    const def = v.number().required().min(0).max(100).getDefinition();
    expect(def.type).toBe('number');
    expect(def.required).toBe(true);
  });

  test('v.number().integer() validates integers', () => {
    const schema = { n: v.number().required().integer().getDefinition() };
    expect(() => validator(schema, { n: 3.5 })).toThrow();
    expect(() => validator(schema, { n: 3 })).not.toThrow();
  });

  test('v.number().positive() validates positive numbers', () => {
    const schema = { n: v.number().required().positive().getDefinition() };
    expect(() => validator(schema, { n: -1 })).toThrow();
    expect(() => validator(schema, { n: 1 })).not.toThrow();
  });

  test('v.boolean() creates boolean schema', () => {
    const def = v.boolean().getDefinition();
    expect(def.type).toBe('boolean');
  });

  test('v.array() creates array schema', () => {
    const def = v.array(v.string()).getDefinition();
    expect(def.type).toBe('array');
    expect(def.arrayType).toBe('string');
  });

  test('v.array(v.object()) creates array-of-objects schema', () => {
    const def = v
      .array(v.object({ id: v.number().required() }))
      .getDefinition();
    expect(def.type).toBe('array');
    expect(def.arrayType).toBe('object');
    expect(def.objectSchema).toBeDefined();
  });

  test('v.object() creates object schema with shape', () => {
    const def = v
      .object({ name: v.string().required(), age: v.number() })
      .getDefinition();
    expect(def.type).toBe('object');
    expect(def.objectSchema!['name'].required).toBe(true);
  });

  test('v.date() creates date schema', () => {
    const def = v.date().getDefinition();
    expect(def.type).toBe('date');
  });

  test('v.file() creates file schema', () => {
    const def = v.file().getDefinition();
    expect(def.type).toBe('file');
  });

  test('v.string().default() sets inputDefaultValue', () => {
    const def = v.string().default('hello').getDefinition();
    expect(def.inputDefaultValue).toBe('hello');
  });

  test('v.string().optional() marks field as not required', () => {
    const def = v.string().required().optional().getDefinition();
    expect(def.required).toBe(false);
  });

  test('v.string().regex() sets custom RegExp', () => {
    const pattern = /^[A-Z]{3}$/;
    const def = v.string().regex(pattern).getDefinition();
    expect(def.RegExp).toBe(pattern);
  });
});
