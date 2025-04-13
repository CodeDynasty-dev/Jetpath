<br/>
<p align="center">
     <img src="icon.webp" alt="JetPath" width="190" height="190">

<h1 align="center">JetPath</h1>

<p align="center">
    JetPath 🚀 - the granular, fast and minimalist framework for Node, Deno and Bun. Embrace new standards!!!
    <br/>
    <br/>
    <a href="https://jetpath.codedynasty.dev"><strong>Explore JetPath APIs »</strong></a>
    <br/>
    <br/>
    <a href="https://jetpath.codedynasty.dev">Join Community</a>
    .
    <a href="https://github.com/codedynasty-dev/JetPath/issues">Report Bug</a>
    .
    <a href="https://github.com/codedynasty-dev/JetPath/issues">Request Feature</a>
  </p>
</p>

![Contributors](https://img.shields.io/github/contributors/codedynasty-dev/JetPath?color=dark-green)
[![npm Version](https://img.shields.io/npm/v/jetpath.svg)](https://www.npmjs.com/package/JetPath)
![Forks](https://img.shields.io/github/forks/codedynasty-dev/JetPath?style=social)
![Stargazers](https://img.shields.io/github/stars/codedynasty-dev/JetPath?style=social)

--

## Latest version info

In this version, we added/tested these features on all runtimes.

1. auto-generated api documentation UI (Jetpath UI).
2. file uploads [check this example](tests/uploading-files.md)
3. support for websockets [check this example](tests/websockets-usage.md).
4. Jet Plugins.
5. Robust schema validation

In this version, multi-runtime support is no-longer based on
compatibility but pure engine api(s). 

- more speed, same size, more power.

# Rationale - [Docs](https://jetpath.codedynasty.dev/)

JetPath is the Granular web framework aimed for speed and ease of use.

[benchmark repo](https://github.com/FridayCandour/jetpath-benchmark)

- JetPath now runs on the runtime you are using, bun or node or deno.
- Function names as routing patterns (newest innovation you haven't seen
  before).
- Pre and Error request hooks.
- Inbuilt Cors handlers hook.
- Fast, Small and easy as peasy.
- Inbuilt API auto doc functionality.

JetPath is designed as a light, simple and powerful, using the an intuitive
route as function name system. you can be able to design and manage your api(s)
with the smallest granularity possible.

--
  

## Installation

Install JetPath Right away on your project using npm or Javascript other package
managers.

```
npm i jetpath --save
```

#### A basic project setup

```ts
// in your src/index.jet.js
import { Context, JetFunc, JetPath } from "./dist/index.js";

const app = new JetPath({ APIdisplay: "HTTP" });

//? listening for requests
app.listen();

// this goes to = get /
export const GET_: JetFunc = async function (ctx) {
  ctx.send("hello world!");
};

// this goes to = post /
export const POST_: JetFunc = async function (ctx) {
  ctx.send("a simple post path!");
};
 
 
```
 

## Apache 2.0 Licensed

Open sourced And Free.

### Contribution and License Agreement

If you contribute code to this project, you are implicitly allowing your code to
be distributed under the MIT license. You are also implicitly verifying that all
code are your original work.

### Support

Your contribution(s) is a good force for change anytime you do it, you can
ensure JetPath's continues growth and improvement by contributing a re-occurring
or fixed donations to our Github sponsors.