<docmach type="wrapper" file="docs/fragments/docs.html" replacement="content">

# Validation

Validation ensures that incoming requests meet the expected structure and data types before your route handler runs. Jetpath provides a built-in, declarative validation system that integrates directly into your route definitions and auto-generated API documentation.

## What is Validation?

Validation checks that incoming data — request bodies, query parameters, or response payloads — matches the expected format. Invalid requests automatically receive an error response without reaching your handler.

## Defining Validation Rules

Use the `use()` helper to chain `.body()`, `.query()`, or `.response()` methods onto your route. Each method takes a function that receives a validator object `t` and returns a schema.

### Validating a Request Body

```typescript
import { type JetRoute, use } from "jetpath";

export const POST_pets: JetRoute = async (ctx) => {
  const body = await ctx.parse(); // Validated automatically
  ctx.send({ created: true, name: body.name }, 201);
};

use(POST_pets).body((t) => ({
  name: t.string().required(),
  species: t.string().required(),
  age: t.number().required().min(0),
  price: t.number().required().positive(),
  available: t.boolean().optional(),
}));
```

When `ctx.parse()` is called, the body is automatically validated against this schema. If validation fails, an error is thrown and caught by your middleware.

### Validating Query Parameters

```typescript
export const GET_pets: JetRoute = (ctx) => {
  const query = ctx.parseQuery(); // Validated automatically
  ctx.send({ results: [], ...query });
};

use(GET_pets).query((t) => ({
  limit: t.number().optional(),
  offset: t.number().optional(),
  species: t.string().optional(),
}));
```

### Validating Response Data

Response validation runs when `ctx.send()` is called with an object. This catches bugs where your handler sends data that doesn't match the documented API contract.

```typescript
export const GET_user: JetRoute = (ctx) => {
  ctx.send({ name: "Alice", age: 30 }); // Validated on send
};

use(GET_user).response((t) => ({
  name: t.string().required(),
  age: t.number().required(),
}));
```

If the response doesn't match the schema, a 500 error is thrown.

### Validating File Uploads

```typescript
export const POST_upload: JetRoute = async (ctx) => {
  const data = await ctx.parse();
  ctx.send({ fileName: data.image.fileName });
};

use(POST_upload).body((t) => ({
  image: t.file({ inputAccept: "image/*" }).required(),
}));
```

## Available Schema Types

The validator object `t` provides these builders:

| Method | Description |
|--------|-------------|
| `t.string()` | String values. Chain `.email()`, `.url()`, `.min(n)`, `.max(n)`, `.regex(pattern)` |
| `t.number()` | Numeric values. Chain `.min(n)`, `.max(n)`, `.integer()`, `.positive()`, `.negative()` |
| `t.boolean()` | Boolean values |
| `t.array(elementSchema)` | Arrays. e.g. `t.array(t.string())` or `t.array(t.object({...}))`. Chain `.min(n)`, `.max(n)`, `.nonempty()` |
| `t.object(shape)` | Nested objects with their own schema |
| `t.date()` | Date values. Chain `.min(date)`, `.max(date)`, `.future()`, `.past()` |
| `t.file(options?)` | File uploads. Chain `.maxSize(bytes)`, `.mimeType(types)` |

All types support `.required()`, `.optional()`, `.default(value)`, `.validate(fn)`, and `.regex(pattern)`.

## Nested Validation

```typescript
use(POST_pets).body((t) => ({
  name: t.string().required(),
  health: t.object({
    vaccinated: t.boolean().optional(),
    medicalHistory: t.array(t.string()).optional(),
  }).optional(),
  tags: t.array(t.string()).optional(),
}));
```

## Custom Error Messages

Pass an `err` option to any schema builder:

```typescript
use(POST_pets).body((t) => ({
  name: t.string({ err: "Pet name is required and must be a string" }).required(),
  age: t.number({ err: "Age must be a valid number" }).required().min(0),
}));
```

## Custom Validators

Use `.validate()` for custom logic:

```typescript
use(POST_pets).body((t) => ({
  age: t.number().required().validate(
    (val) => val >= 0 && val <= 30 || "Age must be between 0 and 30"
  ),
}));
```

Return `true` for valid, or a string error message for invalid.

## Mass-Assignment Protection

The validator only passes through fields defined in the schema. Unknown fields are silently stripped from the output. This prevents mass-assignment attacks where a client sends extra fields like `isAdmin: true`.

## API Documentation Integration

Schemas defined via `use()` are automatically reflected in the interactive API documentation UI. The documentation shows field names, types, required/optional status, and default values — all derived from your validation schemas.

## Adding Route Metadata

Use `use()` to add title and description for the API docs:

```typescript
use(GET_pets)
  .title("List Pets")
  .description("Returns a paginated list of pets with optional filtering.");
```

## Best Practices

- Always define schemas for any data your routes accept
- Use clear custom error messages to help API consumers
- Keep schemas in sync with your business logic
- Prefer `.required()` for critical fields, `.optional()` only when truly optional
- Use `.response()` schemas in development to catch contract violations early

## Next Steps

- Learn more about the [Context (`ctx`) Object](./context.html)
- Explore [Middleware](./middleware.html) for cross-cutting concerns
- Review [Error Handling](./error-handling.html) for customizing validation error responses


</docmach>
