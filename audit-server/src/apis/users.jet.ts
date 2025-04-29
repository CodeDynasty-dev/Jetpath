import { type JetFile, type JetFunc, type JetMiddleware, use } from "jetpath";
import { file, user, voucher } from "../db/index.ts";
import { auth } from "../index.jet.ts";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";


export const MIDDLEWARE_user: JetMiddleware = async (ctx) => {
    
    let token =  ctx.get("Authorization");
    if (!token) {
        ctx.throw({
            message: "Unauthorized",
            code: 401
        })
        return;
    }
    token = token.replace("Bearer ", "");
    try {
        const { id, username } = await auth.verify(token);
        const userinfo = await user.query.select("*").where("id = ?", id).getOne();
        if (!userinfo) {
            ctx.throw({
                message: "User not found",
                code: 404
            })
            return;
        }
        ctx.state.id = id;
        ctx.state.username = username;
        ctx.state.role = userinfo.role;
        ctx.state.isAdmin = userinfo.isAdmin;
        ctx.state.user = userinfo;
        return;
    } catch (error) {
        console.log((error), "error");
        ctx.throw({
            message: "Unauthorized",
            code: 401
        })
        return;
    }
}

export const GET_user: JetFunc = async (ctx) => {
    const data: { user: any; files: any[]; voucher: any[] } = {
        user: undefined,
        files: [],
        voucher: []
    } 
    const files = await file.query.select("*").where("userId = ?", ctx.state.id).limit(10).get();
    const vouchers = await voucher.query.select("*").where("createdBy = ?", ctx.state.id).limit(10).get();
    data.user = ctx.state.user;
    data.files = files;
    data.voucher = vouchers;
    ctx.send({
        message: "User fetched successfully",
        code: 200,
        data: data
    })
}


export const POST_user_create_voucher: JetFunc<{ body: { code: string; amount: number; createdBy: string } }> = async (ctx) => {
    let { code, amount } = ctx.body;
    code = code.toUpperCase();
    amount = Number(amount);
    await voucher.query.insert({
        code,
        amount,
        isUsed: false,
        expiresAt: Date.now() + 60 * 60 * 1000,
        createdBy: ctx.state.id,
        createdAt: Date.now()
    })
    ctx.send({
        message: "Voucher created successfully",
        code: 200
    })
}

use(POST_user_create_voucher).body((t) => {
    return {
        code: t.string().required(),
        amount: t.number().required(),
    }
})


export const POST_user_upload: JetFunc<{ body: { fileHere: JetFile } }> = async (ctx) => {
    const { fileHere } = ctx.body;
    const filePath = path.join("./files", Date.now() +"_"+ fileHere.fileName);
    await mkdir(path.dirname(filePath), { recursive: true });
    try {
        await writeFile(filePath, fileHere.content);
        await file.query.insert({
            name: fileHere.fileName,
            path: filePath.replace("./files", ""),
            size: fileHere.content.length,
            createdAt: Date.now(),
            userId: ctx.state.id,
            mimeType: fileHere.mimeType
        })
    } catch (error) {
        console.log(error);
        ctx.send({
            message: "File upload failed",
            code: 500
        })
        return;
    }
    ctx.send({
        message: "File uploaded successfully",
        code: 200
    })
}

use(POST_user_upload).body((t) => {
    return {
        fileHere: t.file().required()
    }
})

export const GET_user_file$0: JetFunc<{params:{ "*": string }}> = async (ctx) => {
    const fileHere = await file.query.select("*").where("path = ?", ctx.params["*"]).getOne();
    if (!fileHere) {
        ctx.throw(404, {
            message: "File not found",
            code: 404
        });
        return;
    }
    ctx.sendStream(fileHere.path, "./files", fileHere.mimeType);
}

use(GET_user_file$0).info("Get file by path");

export const GET_static$0: JetFunc<{params:{ "*": string }}> = async (ctx) => {
    ctx.sendStream(ctx.params["*"], "./files");
}

use(GET_static$0).info("Get file by path");


export const GET_user_vouchers: JetFunc<{query:{ next: number; limit: number}}> = async (ctx) => {
    let { next, limit } = ctx.query;
    next = Number(next);
    limit = Number(limit);
    if(!next || !limit) {
      next = 0;
      limit = 10;
    }
    const voucherInfo = await voucher.query.select("*").offset(next).limit(limit).where("createdBy = ?", ctx.state.id).get();
    const total = await voucher.query.select("*").where("createdBy = ?", ctx.state.id).count();
    if (!voucherInfo) {
        ctx.throw({
            message: "Voucher not found",
            code: 404
        })
    }
    ctx.send({
        message: "Voucher fetched successfully",
        code: 200,
        data: voucherInfo,
        pagination: {
            limit: limit,
            next: next + limit,
            total: total
        }
    })
}

use(GET_user_vouchers).query((t) => {
    return {
        next: t.number().required(),
        limit: t.number().required()
    }
}).info("Get user vouchers use ?next and ?limit for pagination");

export const GET_user_files: JetFunc<{query:{ next: number; limit: number}}> = async (ctx) => {
    let { next, limit } = ctx.query;
    next = Number(next);
    limit = Number(limit);
    if(!next || !limit) {
      next = 0;
      limit = 10;
    }
    console.log(ctx.state.id, next, limit);
    
    const files = await file.query.select("*").offset(next).limit(limit).where("userId = ?", ctx.state.id).get();
    const total = await file.query.select("*").where("userId = ?", ctx.state.id).count();
    ctx.send({
        message: "Files fetched successfully",
        code: 200,
        data: files,
        pagination: {
            limit: limit,
            next: next + limit,
            total: total
        }
    })
}

use(GET_user_files).query((t) => {
    return {
        next: t.number().required(),
        limit: t.number().required()
    }
}).info("Get user files use ?next and ?limit for pagination");


export const PATCH_user_use_voucher: JetFunc<{ body: { code: string } }> = async (ctx) => {
    const { code } = ctx.body;
    const voucherInfo = await voucher.query.select("*").where("code = ?", code).getOne();
    if (!voucherInfo) {
        ctx.throw({
            message: "Voucher not found",
            code: 404
        })
    }
    if(voucherInfo.isUsed) {
        ctx.throw({
            message: "Voucher already used",
            code: 400
        })
    }
    await voucher.query
    .where("code = ?", code)
        .update({
        isUsed: true
    })
    ctx.send({
        message: "Voucher used successfully",
        code: 200,
        data: voucherInfo
    })
}

use(PATCH_user_use_voucher).body((t) => {
    return {
        code: t.string().required()
    }
}).info("Use voucher");

 
const sockets = new Set<any>();
export const GET_live_room_chat: JetFunc = (ctx) => {
  ctx.upgrade(); 
  const conn = ctx.connection!;
  if (!conn) {
    ctx.code = 500;
    ctx.send({
      status: "error",
      message: "WebSocket connection failed!!!"
    });
    return;
  }
 
    // Handle new connections
    conn.addEventListener("open", (socket) => {
      sockets.add(socket);
      console.log("New client connected to live updates"); 
      socket.send("All your messages are belong to us");
    });

    // Handle incoming messages
    conn.addEventListener("message", (socket, event) => {
      const message = event.data; 
        // Handle subscription requests
        if (message === "ping") {
          // Handle ping-pong for connection health checks 
          Array.from(sockets).filter(s => s !== socket).forEach(s => s.send("pong"));
          return
        } 
        Array.from(sockets).filter(s => s !== socket).forEach(s => s.send(message));
    });

    // Handle connection close
    conn.addEventListener("close", (socket) => {
      sockets.delete(socket);
      console.log("Client disconnected from live updates");
    });
};

use(GET_live_room_chat).info("Websocket chatting room");

export const GET_chat: JetFunc = (ctx) => {
    ctx.sendStream("chat.html");
};

use(GET_chat).info("Chat page");
