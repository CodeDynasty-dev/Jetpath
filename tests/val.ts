type HTTPBody<Obj extends Record<string, any>> = {
  [x in keyof Obj]: {
    err?: string;
    type?: "string" | "number" | "file" | "object" | "boolean" | "array";
    arrayType?:
      | "string"
      | "number"
      | "file"
      | "object"
      | "boolean"
      | "object"
      | "array";
    RegExp?: RegExp;
    inputAccept?: string;
    inputType?:
      | "date"
      | "email"
      | "file"
      | "password"
      | "number"
      | "time"
      | "tel"
      | "datetime"
      | "url";
    inputDefaultValue?: string | number | boolean;
    required?: boolean;
    validator?: (value: any) => boolean;
    objectSchema?: HTTPBody<Record<string, any>>;
  };
};

export function validator<T extends Record<string, any>>(
  schema: HTTPBody<T> | undefined,
  data: any,
): T {
  if (!schema || typeof data !== "object") {
    throw new Error("Invalid schema or data");
  }

  const errors: string[] = [];
  const out: Partial<T> = {};

  for (const [key, def] of Object.entries(schema)) {
    const value = data[key];

    // Required check
    if (def.required && (value === undefined || value === null)) {
      errors.push(`${key} is required`);
      continue;
    }

    // Skip if optional and undefined
    if (!def.required && value === undefined) {
      continue;
    }

    // Type validation
    if (def.type) {
      if (def.type === "array") {
        if (!Array.isArray(value)) {
          errors.push(`${key} must be an array`);
          continue;
        }
        if (def.arrayType === "object" && def.objectSchema) {
          try {
            const validatedArray = value.map((item) =>
              validator(def.objectSchema, item)
            );
            out[key as keyof T] = validatedArray as T[keyof T];
            continue;
          } catch (e) {
            errors.push(`${key}: ${e.message}`);
            continue;
          }
        } else if (
          def.arrayType &&
          !value.every((item) => typeof item === def.arrayType)
        ) {
          errors.push(`${key} must be an array of ${def.arrayType}`);
          continue;
        }
      } else if (def.type === "object") {
        if (typeof value !== "object" || Array.isArray(value)) {
          errors.push(`${key} must be an object`);
          continue;
        }
        // Handle objectSchema validation
        if (def.objectSchema) {
          try {
            out[key as keyof T] = validator(
              def.objectSchema,
              value,
            ) as T[keyof T];
            continue;
          } catch (e) {
            errors.push(`${key}: ${e.message}`);
            continue;
          }
        }
      } else if (typeof value !== def.type && def.type !== "file") {
        errors.push(`${key} must be of type ${def.type}`);
        continue;
      }
    }

    // Regex validation
    if (def.RegExp && !def.RegExp.test(value)) {
      errors.push(def.err || `${key} does not match required pattern`);
      continue;
    }

    // Custom validator
    if (def.validator) {
      const result = def.validator(value);
      if (result !== true) {
        errors.push(
          typeof result === "string"
            ? result
            : def.err || `${key} validation failed`,
        );
        continue;
      }
    }

    out[key as keyof T] = value;
  }

  if (errors.length > 0) {
    throw new Error(errors.join(", "));
  }

  return out as T;
}

// examples.ts

const userSchema: HTTPBody<{
  username: string;
  email: string;
  age: number;
  password: string;
  profilePicture: File;
  interests: string[];
  metadata: { theme: string };
  newsletter: boolean;
}> = {
  username: {
    type: "string",
    required: true,
    RegExp: /^[a-zA-Z0-9_]{3,20}$/,
    err:
      "Username must be 3-20 characters and contain only letters, numbers, and underscores",
  },
  email: {
    type: "string",
    required: true,
    inputType: "email",
    RegExp: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    err: "Invalid email format",
  },
  age: {
    type: "number",
    required: true,
    validator: (value: number) => value >= 18,
    err: "Must be 18 or older",
  },
  password: {
    type: "string",
    required: true,
    inputType: "password",
    RegExp: /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/,
    err:
      "Password must be at least 8 characters with at least one letter and one number",
  },
  profilePicture: {
    type: "file",
    inputAccept: "image/*",
    required: false,
  },
  interests: {
    type: "array",
    arrayType: "string",
    required: true,
    validator: (value: string[]) =>
      Array.isArray(value) && value.every((item) => typeof item === "string"),
  },
  metadata: {
    type: "array",
    arrayType: "object",
    // required: false,
    objectSchema: {
      theme: {
        type: "string",
        required: true,
        validator: (value: string) => ["light", "dark", "auto"].includes(value),
        err: "Invalid theme",
      },
    },
  },
  newsletter: {
    type: "boolean",
    required: false,
    inputDefaultValue: false,
  },
};

// Benchmark function
function runBenchmark() {
  const validData = {
    username: "john_doe123",
    email: "john@example.com",
    age: 25,
    password: "Password123",
    interests: ["coding", "reading"],
    metadata: [{ theme: "dark" }],
    newsletter: true,
  };

  const iterations = 10_000;
  console.time("Validation Benchmark");

  for (let i = 0; i < iterations; i++) {
    try {
      validator(userSchema, validData);
    } catch (error) {
      console.error("Validation failed:", error);
    }
  }

  console.timeEnd("Validation Benchmark");
}

// Example usage and tests
function runExamples() {
  // Valid data
  try {
    const validResult = validator(userSchema, {
      username: "john_doe123",
      email: "john@example.com",
      age: 25,
      password: "Password123",
      interests: ["coding", "reading"],
      metadata: { theme: "dark" },
      newsletter: true,
    });
    console.log("Valid data result:", validResult);
  } catch (error) {
    console.error("Validation failed:", error);
  }

  // Invalid data examples
  const invalidCases = [
    {
      case: "Missing required field",
      data: { username: "john_doe123" },
    },
    {
      case: "Invalid email",
      data: {
        username: "john_doe123",
        email: "invalid-email",
        age: 25,
        password: "Password123",
      },
    },
    {
      case: "Underage user",
      data: {
        username: "john_doe123",
        email: "john@example.com",
        age: 16,
        password: "Password123",
      },
    },
  ];

  for (const { case: testCase, data } of invalidCases) {
    try {
      validator(userSchema, data);
      console.log(`${testCase}: Unexpectedly passed`);
    } catch (error) {
      console.log(`${testCase}: ${error.message}`);
    }
  }
}

// Run examples and benchmark
// runExamples();
runBenchmark();
