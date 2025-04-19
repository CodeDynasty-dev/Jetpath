<br/>
<p align="center">
     <img src="https://github.com/CodeDynasty-dev/Jetpath/raw/main/icon.png" alt="Jetpath" width="190" height="190">

<h1 align="center">Jetpath</h1>

<p align="center">
   Jetpath is the fast and minimalist framework for Node, Deno and Bun.
    <br/>
    <br/>
    <a href="https://jetpath.codedynasty.dev"><strong>Explore Jetpath APIs »</strong></a>
    <br/>
    <br/>
    <a href="https://jetpath.codedynasty.dev">Join Community</a>
    .
    <a href="https://github.com/codedynasty-dev/jetpath/issues">Report Bug</a>
    .
    <a href="https://github.com/codedynasty-dev/jetpath/issues">Request Feature</a>
  </p>
</p>

![Contributors](https://img.shields.io/github/contributors/codedynasty-dev/jetpath?color=dark-green)
[![npm Version](https://img.shields.io/npm/v/jetpath.svg)](https://www.npmjs.com/package/jetpath)
![Forks](https://img.shields.io/github/forks/codedynasty-dev/jetpath?style=social)
![Stargazers](https://img.shields.io/github/stars/codedynasty-dev/jetpath?style=social)
 
## Latest version info

In this version, we added/tested these features on all runtimes.

1. auto-generated api documentation UI (Jetpath UI).
2. file uploads
3. support for websockets
4. Jet Plugins.
5. Robust schema validation
6. Multi-runtime support
7. Robust Context and body parser
8. Security audits and fixes
9. Robust error handling
10. Robust logging
11. Robust middleware
12. Performance enhancements

In this version, multi-runtime support is no-longer based on
compatibility but pure engine api(s). 

- more speed, same size, more power.


## Syntax

```ts
// src/index.jet.js
import { type JetFunc, Jetpath } from "jetpath";

const app = new Jetpath({ APIdisplay: "HTTP" });

//? listening for requests
app.listen();

// this goes to = get /
export const GET_: JetFunc = async function (ctx) {
  ctx.send("hello world!");
};

// this goes to = post /
export const POST_: JetFunc = async function (ctx) {
  ctx.send( ctx.parse() );
};

// this goes to = post /api/v1/payments
export const POST_api_v1_payments: JetFunc = async function (ctx) {
    const { amount, currency, account } = ctx.parse();
    ctx.plugin.charge({ amount, currency, account });
    ctx.send({ success: true, message: "Payment successful" });
};
```

# Rationale - [Docs](https://jetpath.codedynasty.dev/)

Jetpath is designed for high performance, security and ease of use, using convention over configuration method, jetpath ensure you spend less time on configuration and more time on the functionalities and concise organization of all your projects.

[benchmark repo](https://github.com/FridayCandour/jetpath-benchmark)

- Jetpath now runs on the runtime you are using, bun or node or deno.
- Function names as routing patterns.
- Middleware and error handler design.
- Inbuilt Cors, body parser, websocket, cookies and logger handlers.
- Inbuilt API auto doc functionality. 
- Fast, Small and easy as peasy - jetpath will make your projects shine.

--
  

## Installation

Install Jetpath Right away on your project using npm or Javascript other package
managers.

```
npm i jetpath --save
```
 

## Apache 2.0 Licensed

Open sourced And Free.

### Contribution and License Agreement

If you contribute code to this project, you are implicitly allowing your code to
be distributed under the Apache 2.0 license. You are also implicitly verifying that all
code are your original work.
See our [contributing guide](https://github.com/CodeDynasty-dev/Jetpath/blob/main/contributing.md)

### Support

Your contribution(s) is a good force for change anytime you do it, you can
ensure Jetpath's continues growth and improvement by contributing a re-occurring
or fixed donations to our Github sponsors.