import { type JetFunc, type JetMiddleware, use } from "jetpath";
import { file, user, voucher } from "../db/index.ts";
import { auth } from "../index.jet.ts";

export const MIDDLEWARE_admin: JetMiddleware = async (ctx) => {
    let token =  ctx.get("Authorization");
    if (!token) {
        ctx.throw({
            message: "Unauthorized",
            code: 401
        })
        return;
    }
    token = token.replace("Bearer ", "");
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
}

export const GET_admin_user$id: JetFunc<{ params: { id: string } }> = async (ctx) => {
    if (!ctx.state.isAdmin) {
        ctx.send({
            message: "Unauthorized",
            code: 401
        })
        return;
    }
    const data: { user: any; files: any[]; voucher: any[] } = {
        user: undefined,
        files: [],
        voucher: []
    }
    const userinfo = await user.query.select("*").where("id = ?", ctx.params.id).getOne();
    if (!userinfo) {
        ctx.send({
            message: "User not found",
            code: 404
        })
        return;
    }
    const files = await file.query.select("*").where("userId = ?", ctx.params.id).get();
    const vouchers = await voucher.query.select("*").where("createdBy = ?", ctx.params.id).get();
    data.user = userinfo;
    data.files = files;
    data.voucher = vouchers;
    ctx.send({
        message: "User fetched successfully",
        code: 200,
        data: data
    })
}

use(GET_admin_user$id).params((t) => {
    return {
        id: t.string().required()
    }
}).info("Get user by id");



export const GET_admin_users: JetFunc<{query:{ next: number; limit: number}}> = async (ctx) => {
    let { next, limit } = ctx.query;
    next = Number(next);
    limit = Number(limit);
    if(next < 0 || limit < 0) {
      next = 0;
      limit = 10;
    }
    if (!ctx.state.isAdmin) {
        ctx.send({
            message: "Unauthorized",
            code: 401
        })
        return;
    }
    const users = await user.query.select("*").offset(next).limit(limit).get();
    const total = await user.query.select("*").count();
    ctx.send({
        message: "Users fetched successfully",
        code: 200,
        data: users,
        pagination: {
            limit: limit,
            next: next + limit,
            total: total
        }
    })
}

use(GET_admin_users).query((t) => {
    return {
        next: t.number().required(),
        limit: t.number().required()
    }
}).info("Get all users use ?next and ?limit for pagination");


export const GET_admin_ban_user$id: JetFunc<{ params: { id: string } }> = async (ctx) => {
    if (!ctx.state.isAdmin) {
        ctx.send({
            message: "Unauthorized",
            code: 401
        })
        return;
    }
    const userinfo = await user.query.select("*").where("id = ?", ctx.params.id).getOne();
    if (!userinfo) {
        ctx.send({
            message: "User not found",
            code: 404
        })
        return;
    }
    await user.query
        .where("id = ?", ctx.params.id)
        .update({
            isAdmin: !userinfo.isAdmin
        })
    ctx.send({
        message: "User banned successfully",
        code: 200
    })
}

use(GET_admin_ban_user$id).params((t) => {
    return {
        id: t.string().required()
    }
}).info("Ban user by id");