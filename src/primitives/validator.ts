import type { HTTPBody } from './types.js';

/**
 * NOTE: Unknown fields (not defined in schema) are silently stripped from the output.
 * This provides mass-assignment protection by default.
 */
export function validator<T extends Record<string, any>>(
  schema: HTTPBody<T> | undefined,
  data: any,
  depth = 0,
  maxDepth = 20
): T {
  if (!schema || typeof data !== 'object') {
    throw new Error('Invalid schema or data');
  }

  // Check recursion depth to prevent stack overflow
  if (depth > maxDepth) {
    throw new Error(`Jetpath: Maximum validation depth (${maxDepth}) exceeded`);
  }

  const errors: string[] = [];
  const out: Partial<T> = {};

  for (const [key, defsRaw] of Object.entries(schema)) {
    const defs = defsRaw as {
      RegExp?: RegExp;
      arrayType?: string;
      err?: string;
      objectSchema?: HTTPBody<any>;
      required?: boolean;
      type?: string;
      validator?: (v: any) => boolean | string;
    };
    const {
      RegExp,
      arrayType,
      err,
      objectSchema,
      required,
      type,
      validator: validate,
    } = defs;
    const value = data[key];

    // Required check
    // eslint-disable-next-line eqeqeq
    if (required && value == null) {
      errors.push(`${key} is required`);
      continue;
    }

    // Skip if optional and undefined
    // eslint-disable-next-line eqeqeq
    if (!required && value == null) {
      continue;
    }

    // Type validation
    if (type) {
      if (type === 'array') {
        if (!Array.isArray(value)) {
          errors.push(`${key} must be an array`);
          continue;
        }
        if (arrayType === 'object' && objectSchema) {
          try {
            const validatedArray = value.map((item) =>
              validator(objectSchema, item, depth + 1, maxDepth)
            );
            out[key as keyof T] = validatedArray as T[keyof T];
            continue;
          } catch (e) {
            errors.push(`${key}: ${String(e)}`);
            continue;
          }
        } else if (
          arrayType &&
          !value.every((item) => typeof item === arrayType)
        ) {
          errors.push(`${key} must be an array of ${arrayType}`);
          continue;
        }
      } else if (type === 'object') {
        if (typeof value !== 'object' || Array.isArray(value)) {
          errors.push(`${key} must be an object`);
          continue;
        }
        // Handle objectSchema validation
        if (objectSchema) {
          try {
            out[key as keyof T] = validator(
              objectSchema,
              value,
              depth + 1,
              maxDepth
            ) as T[keyof T];
            continue;
          } catch (e) {
            errors.push(`${key}: ${String(e)}`);
            continue;
          }
        }
      } else {
        if (typeof value !== type) {
          if (type === 'file' && typeof value === 'object') {
            out[key as keyof T] = value;
            continue;
          }
          errors.push(`${key} must be of type ${type}`);
          continue;
        }
      }
    }

    // Regex validation
    if (RegExp && !RegExp.test(value)) {
      errors.push(err || `${key} is incorrect`);
      continue;
    }

    // Custom validator
    if (validate) {
      const result = validate(value);
      if (result !== true) {
        errors.push(
          typeof result === 'string'
            ? result
            : err || `${key} validation failed`
        );
        continue;
      }
    }

    out[key as keyof T] = value;
  }

  if (errors.length > 0) {
    throw new Error(errors.join(', '));
  }

  return out as T;
}
