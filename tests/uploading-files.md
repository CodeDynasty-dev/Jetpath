uploading files with JetPath

## Node

https://github.com/mscdex/busboy

```js
// install

// npm i busboy

// usage

import busboy from "busboy";
import { WriteStream, createWriteStream } from "fs";
export async function POST_(ctx: Context) {
  const bb = busboy({ headers: ctx.request.headers });
  bb.on(
    "file",
    (
      name: any,
      file: { pipe: (arg0: WriteStream) => void },
      info: { filename: string }
    ) => {
      console.log({
        name,
        info,
      });
      const saveTo = path.join(info.filename);
      file.pipe(createWriteStream(saveTo));
    }
  );
  bb.on("field", (name, val, info) => {
    console.log(`Field [${name}]: value: %j`, val);
  });
  bb.on("close", () => {
    ctx.send("done!");
  });
  ctx.request.pipe(bb)
}
export const BODY_: JetSchema = {
  body: {
    filefield: { type: "file", inputType: "file" },
    textfield: { type: "string" },
  },
  method: "POST",
};
```

## Bun

https://bun.sh/guides/http/file-uploads

```js
// usage
export const POST_upload_image = (ctx) => {
  const formdata = await ctx.request.formData();
  const profilePicture = formdata.get("image");
  console.log(profilePicture);
  if (!profilePicture) throw new Error("Must upload image.");
  // write profilePicture to disk
  await Bun.write("profilePicture.png", profilePicture);
  ctx.send("done!");
};
```

## Deno

https://medium.com/deno-the-complete-reference/handle-file-uploads-in-deno-ee14bd2b16d9

```js
// usage
POST_upload_files(ctx) {
const SAVE_PATH = "./";
const reader = ctx.request?.body?.getReader();
  const f = await Deno.open(SAVE_PATH + fileName, {
    create: true,
    write: true,
  });
  await Deno.copy(readerFromStreamReader(reader), f);
  await f.close();
ctx.send("done!")
},
```
