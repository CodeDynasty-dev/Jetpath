<docmach type="wrapper" file="docs/fragments/other.html" replacement="content">

# Building APIs with Jetpath: A Framework Creator's Perspective

As the creator of Jetpath, I'm excited to share the story behind this framework and how it can revolutionize the way you build APIs. Jetpath was born from my frustration with existing frameworks and a vision for a simpler, more declarative approach to API development.

## The Journey to Jetpath

Before creating Jetpath, I spent years working with various frameworks, each with their own set of challenges:

- Too much boilerplate code
- Complex configuration
- Manual type definitions
- Tedious documentation maintenance
- Runtime-specific limitations

I wanted to create something different - a framework that would make API development enjoyable again.

## The Vision Behind Jetpath

When I designed Jetpath, I had several key principles in mind:

1. **Simplicity First** - No configuration needed to get started
2. **Type Safety** - Built-in TypeScript support with zero configuration
3. **Declarative Approach** - Routes as simple exports instead of complex registrations
4. **Developer Experience** - Automatic documentation and intuitive API design
5. **Cross-Platform** - Works seamlessly across Node.js, Deno, and Bun

## Building the Pet Shop API

To demonstrate Jetpath's capabilities, let's build a simple pet shop API. This example showcases the core principles that guided Jetpath's development.

### Step 1: Setting Up the Project

First, I created a new directory and initialized the project:

```bash
mkdir petshop-api
cd petshop-api
npm init -y
npm install jetpath
```

### Step 2: Creating the Application

I started with a simple `app.jet.ts`:

```typescript
import { Jetpath } from 'jetpath';

// Initialize Jetpath with configuration
const app = new Jetpath({
  port: 3000,
  apiDoc: {
    display: "UI",
    name: "Pet Shop API",
    color: "#7e57c2"
  }
});

// Start the server
app.listen();
```

### Step 3: Real-World Challenges

As the API grew, I encountered some common challenges:

1. **Type Safety** - Ensuring consistent data types across endpoints
2. **Error Handling** - Managing different types of errors gracefully
3. **Documentation** - Keeping API docs up to date

Jetpath solved these problems beautifully. The type inference system made it easy to maintain consistency, and the automatic documentation saved me hours of work.

### Step 4: Building the Pet Management System

Here's how I implemented the core functionality:

```typescript
// In-memory storage for our pets
const pets: Record<string, any> = {};
let nextId = 1;

// Get all pets
export const GET_pets = (ctx) => {
  // Tip: Use ctx.query to handle pagination
  const page = ctx.query.page || 1;
  const limit = ctx.query.limit || 10;
  
  const petsList = Object.values(pets);
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  
  ctx.send({
    pets: petsList.slice(startIndex, endIndex),
    total: petsList.length,
    page,
    limit
  });
};

// Create a new pet with validation
export const POST_pets: JetRoute<
  { body: { name: string; species: string; age: number } }
> = async (ctx) => {
  await ctx.parse();
  const { name, species, age } = ctx.body;

  // Create the pet
  const pet = {
    id: nextId++,
    name,
    species,
    age
  };

  // Save to our in-memory storage
  pets[pet.id] = pet;

  // Send success response
  ctx.send(pet, 201);
};

// Define our pet schema
use(POST_pets).body((t)=>{
  return {
    name: t.string().min(1).max(50),
    species: t.string().min(1).max(50),
    age: t.number().min(0).max(30)
  }
});
```

## Advanced Features I Love

### 1. Validation Made Easy

The validation system in Jetpath is a game-changer. Here's how I use it:

```typescript
// Define our pet schema
use(POST_pets).body((t)=>{
  // Real-world validation rules
  return {
    name: t.string().min(1).max(50)
      .withMessage('Name must be between 1 and 50 characters'),
    species: t.string().min(1).max(50)
      .withMessage('Species must be between 1 and 50 characters'),
    age: t.number().min(0).max(30)
      .withMessage('Age must be between 0 and 30')
  }
});
```

### 2. Middleware for Cross-Cutting Concerns

I implemented middleware to handle logging and error handling:

```typescript
export const MIDDLEWARE_ = (ctx) => {
  // Log every request with detailed information
  console.log(`[${new Date().toISOString()}] ${ctx.request.method} ${ctx.request.url} - ${ctx.request.headers['user-agent']}`);

  // Add useful headers to responses
  ctx.set('X-Request-ID', Date.now().toString());
  ctx.set('X-Response-Time', `${Date.now() - ctx.request.time}ms`);

  // Handle errors with proper logging
  return (ctx, err) => {
    if (err) {
      console.error('Error:', {
        timestamp: new Date().toISOString(),
        method: ctx.request.method,
        url: ctx.request.url,
        error: err.message,
        stack: err.stack
      });
      ctx.throw(500, 'Internal server error');
    }
  };
};
```

## Best Practices I've Learned

Here are some practical tips I've picked up along the way:

1. **Start Simple**
   - Begin with basic CRUD operations
   - Add complexity gradually
   - Keep your code DRY (Don't Repeat Yourself)

2. **Validation Tips**
   - Always validate input data
   - Use descriptive error messages
   - Consider edge cases (like empty strings or null values)

3. **Error Handling**
   - Use `ctx.throw()` for known errors
   - Implement global error handling
   - Log errors with context

## Real-World Use Cases

I've used Jetpath for several projects:

1. **Microservices** - Building small, focused services
2. **API Gateways** - Routing and transforming requests
3. **Internal Tools** - Creating admin interfaces and dashboards

## Next Steps for Your API

Now that you've built a basic API, here are some practical suggestions:

1. **Add Authentication**
   - Implement JWT tokens
   - Add role-based access control
   - Secure sensitive endpoints

2. **Performance Optimization**
   - Add caching layers
   - Implement rate limiting
   - Optimize database queries

3. **Monitoring and Logging**
   - Add error tracking
   - Monitor API performance
   - Set up alerting

4. **Testing**
   - Write unit tests
   - Add integration tests
   - Implement end-to-end tests

## Conclusion

Jetpath has transformed the way I build APIs. The declarative approach makes development faster, more reliable, and more enjoyable. Whether you're building a small microservice or a large-scale application, Jetpath provides the tools you need to succeed.

I hope this journey through Jetpath has been helpful. Remember, the key to success is starting simple and building incrementally. Happy coding!

</docmach>
