<docmach type="wrapper" file="docs/fragments/docs.html" replacement="content">

# Validation

Validation ensures that incoming requests to your Jetpath routes meet the expected structure and data types. This helps prevent invalid data from reaching your application logic, making your APIs safer and easier to maintain.

## What is Validation?

Validation is the process of checking that incoming data—such as request bodies, query parameters, or file uploads—matches the expected format before your route handler runs. Jetpath provides a built-in, declarative validation system that integrates directly into your route definitions.

## Defining Validation Rules

In Jetpath, you define validation by chaining `.body()`, `.query()`, or `.params()` methods to your route using the `use()` helper. Each method takes a function that receives a validator object `t` and returns a schema describing the expected shape of the data.

### Example: Validating a Request Body

```typescript
import { use } from "jetpath";

export const POST_pets = (ctx) => {
  // Your handler logic here
};

use(POST_pets).body((t) => {
  return {
    name: t.string().required(),
    species: t.string().required(),
    age: t.number().required(),
    price: t.number().required(),
    available: t.boolean().optional(),
  };
});
```

In this example:
- The request body must include `name`, `species`, `age`, and `price` (all required).
- The `available` field is optional.

### Example: Validating Query Parameters

```typescript
export const GET_pets = (ctx) => {
  // Handler logic
};

use(GET_pets).query((t) => {
  return {
    limit: t.number().optional(),
    offset: t.number().optional(),
    species: t.string().optional(),
  };
});
```

### Example: Validating File Uploads

```typescript
export const POST_upload = (ctx) => {
  // Handler logic
};

use(POST_upload).body((t) => {
  return {
    image: t.file({ inputAccept: "image/*" }).required(),
  };
});
```

## Key Concepts

1. **Declarative Schemas**: Define the expected shape of incoming data using a simple, readable syntax.
2. **Automatic Enforcement**: Jetpath automatically checks requests against your schema before running your handler. Invalid requests receive a clear error response.
3. **Custom Error Messages**: You can provide custom error messages for each field.

   ```typescript
   name: t.string({ err: "Pet name is required" }).required()
   ```
4. **Nested Validation**: Use `t.object()` and `t.array()` for nested structures.

   ```typescript
   health: t.object({
     vaccinated: t.boolean().optional(),
     medicalHistory: t.array(t.string()).optional(),
   }).optional()
   ```

## Best Practices

- **Validate all user input**: Always define schemas for any data your routes accept.
- **Use clear error messages**: Help API consumers understand what went wrong.
- **Keep schemas in sync with your business logic**: Update validation rules as requirements change.
- **Prefer required fields for critical data**: Only mark fields as optional when truly optional.

## Next Steps

- Learn more about the [Context (`ctx`) Object](./context.html)
- Explore [Middleware](./middleware.html) for cross-cutting concerns
- Review [Error Handling](./error-handling.html) for customizing validation error responses


</docmach>
