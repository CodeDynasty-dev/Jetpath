<docmach type="wrapper" file="docs/fragments/docs.html" replacement="content">

# Request Lifecycle

Understanding Jetpath's request lifecycle is essential for building efficient and maintainable applications. This document outlines the complete journey of a request from request to response.

<img src="/Request-Lifecycle.svg" alt="Request Lifecycle" style="max-width: 550px; margin: 2rem auto;" />

## 1. Request 

When a request is received:

- The request path is matched against registered routes
- A `Context` instance is retrieved from the pool for the request
- Request metadata is extracted (method, headers, path)
- Query parameters are normalized

## 2. Pre-Handler Middleware

Before reaching the route handler, the request passes through pre-handler middleware:

- Executed before the route handler
- Can modify the request or response
- Used for authentication, validation, rate limiting, and logging

## 3. Route Handler Execution

Once the request reaches the handler:

- The handler executes the business logic
- Processes request data
- Generates the response

## 4. Post-Processing

### Post-Handler Middleware

After the handler executes, the response passes through post-handler middleware:

- Modifies the response as needed
- Performs final processing
- Sends the response to the client

## Error Handling

Error handling is integrated throughout the lifecycle:
- Catches and handles errors at each stage
- Ensures consistent error responses
- Provides error recovery mechanisms
</docmach>