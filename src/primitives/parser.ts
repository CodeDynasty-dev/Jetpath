export function parseFormData(
  rawBody: Uint8Array,
  contentType: string,
  options: { maxBodySize?: number; maxFileSize?: number } = {},
) {
  const { maxBodySize, maxFileSize = 10 * 1024 * 1024 } = options; // Default 10MB max file size

  if (maxBodySize && rawBody.byteLength > maxBodySize) {
    throw new Error(
      `Body exceeds max size: ${rawBody.byteLength} > ${maxBodySize}`,
    );
  }

  const boundaryMatch = contentType.match(/boundary="?([^";]+)"?/i);
  if (!boundaryMatch) throw new Error("Invalid multipart boundary");

  const boundary = `--${boundaryMatch[1]}`;
  const boundaryBytes = new TextEncoder().encode(boundary);

  const decoder = new TextDecoder("utf-8");
  const fields: Record<string, string | string[]> = {};
  const files: Record<
    string,
    { fileName: string; content: Uint8Array; mimeType: string; size: number }
  > = {};

  const parts = splitBuffer(rawBody, boundaryBytes).slice(1, -1); // remove preamble and epilogue

  for (const part of parts) {
    const headerEndIndex = indexOfDoubleCRLF(part);
    if (headerEndIndex === -1) continue;

    const headerBytes = part.slice(0, headerEndIndex);
    let body = part.slice(headerEndIndex + 4); // Skip \r\n\r\n
    // 2) Strip leading CRLF
    if (body[0] === 13 && body[1] === 10) {
      body = body.slice(2);
    }
    // 3) Strip trailing CRLF
    if (body[body.length - 2] === 13 && body[body.length - 1] === 10) {
      body = body.slice(0, body.length - 2);
    }
    const headerText = decoder.decode(headerBytes);
    const headers = parseHeaders(headerText);

    const disposition = headers["content-disposition"];
    if (!disposition) continue;

    const nameMatch = disposition.match(/name="([^"]+)"/);
    if (!nameMatch) continue;

    const fieldName = nameMatch[1];
    const fileNameMatch = disposition.match(/filename="([^"]*)"/);
    const fileName = fileNameMatch?.[1] || null;

    if (fileName) {
      // Validate file size at parse time
      if (maxFileSize && body.length > maxFileSize) {
        throw new Error(
          `File '${fileName}' exceeds max size: ${body.length} > ${maxFileSize}`,
        );
      }

      const mimeType = headers["content-type"] || "application/octet-stream";
      files[fieldName] = {
        fileName,
        content: body,
        mimeType,
        size: body.length,
      };
    } else {
      const value = decoder.decode(body);
      if (fieldName in fields) {
        const existing = fields[fieldName];
        fields[fieldName] = Array.isArray(existing)
          ? [...existing, value]
          : [existing, value];
      } else {
        try {
          fields[fieldName] = JSON.parse(value.toString());
        } catch {
          fields[fieldName] = value;
        }
      }
    }
  }

  return { ...fields, ...files };
}

function parseHeaders(headerText: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const lines = headerText.split(/\r\n/);
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const val = line.slice(idx + 1).trim();
    headers[key] = val;
  }
  return headers;
}

function indexOfDoubleCRLF(buffer: Uint8Array): number {
  for (let i = 0; i < buffer.length - 3; i++) {
    if (
      buffer[i] === 13 &&
      buffer[i + 1] === 10 &&
      buffer[i + 2] === 13 &&
      buffer[i + 3] === 10
    ) {
      return i;
    }
  }
  return -1;
}

function splitBuffer(buffer: Uint8Array, delimiter: Uint8Array): Uint8Array[] {
  const parts: Uint8Array[] = [];
  let start = 0;

  while (start < buffer.length) {
    const idx = indexOf(buffer, delimiter, start);
    if (idx === -1) break;
    parts.push(buffer.slice(start, idx));
    start = idx + delimiter.length;
  }

  if (start <= buffer.length) {
    parts.push(buffer.slice(start));
  }

  return parts;
}

function indexOf(buffer: Uint8Array, search: Uint8Array, from = 0): number {
  outer: for (let i = from; i <= buffer.length - search.length; i++) {
    for (let j = 0; j < search.length; j++) {
      if (buffer[i + j] !== search[j]) continue outer;
    }
    return i;
  }
  return -1;
}

export function parseUrlEncoded(
  bodyText: string,
): Record<string, string | string[]> {
  const params = new URLSearchParams(bodyText);
  const result: Record<string, string | string[]> = {};
  for (const [key, value] of params.entries()) {
    // eslint-disable-next-line no-prototype-builtins
    if (result.hasOwnProperty(key)) {
      if (Array.isArray(result[key])) {
        result[key].push(value);
      } else {
        result[key] = [result[key], value];
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Helper for Node.js: Reads the IncomingMessage stream, collecting chunks and checking size.
 */
function collectRequestBody(
  req: any,
  maxBodySize: number,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (maxBodySize && size > maxBodySize) {
        reject(new Error("Payload Too Large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      resolve(new Uint8Array(Buffer.concat(chunks)));
    });
    req.on("error", (err: any) => reject(err));
  });
}

/**
 * Reads the request/stream and returns a Promise that resolves to the parsed body.
 */
export async function parseRequest(
  req: any,
  options: {
    maxBodySize?: number;
    maxFileSize?: number;
    contentType?: string;
  } = {},
): Promise<Record<string, any>> {
  const { maxBodySize = 5 * 1024 * 1024, maxFileSize = 10 * 1024 * 1024 } =
    options;
  let contentType = options.contentType || "";
  let rawBody: Uint8Array;

  if (typeof req.arrayBuffer === "function") {
    if (!contentType && req.headers && typeof req.headers.get === "function") {
      contentType = req.headers.get("content-type") || "";
    }
    const arrayBuffer = await req.arrayBuffer();
    rawBody = new Uint8Array(arrayBuffer);
    if (rawBody.byteLength > maxBodySize) {
      throw new Error("Payload Too Large");
    }
  } else if (typeof req.on === "function") {
    if (!contentType && req.headers) {
      contentType = req.headers["content-type"] || "";
    }
    rawBody = await collectRequestBody(req, maxBodySize);
  } else {
    throw new Error("Unsupported request object type");
  }

  const ct = contentType.toLowerCase();
  const decoder = new TextDecoder("utf-8");
  let bodyText: string;

  if (ct.includes("application/json")) {
    bodyText = decoder.decode(rawBody);
    return JSON.parse(bodyText || "{}");
  } else if (ct.includes("application/x-www-form-urlencoded")) {
    bodyText = decoder.decode(rawBody);
    return parseUrlEncoded(bodyText);
  } else if (ct.includes("multipart/form-data")) {
    return parseFormData(rawBody, contentType, { maxBodySize, maxFileSize });
  } else {
    bodyText = decoder.decode(rawBody);
    return { parsed: bodyText };
  }
}
