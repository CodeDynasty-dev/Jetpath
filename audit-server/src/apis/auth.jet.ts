import {type JetFunc, use } from "jetpath";
import { user } from "../db/index.ts";
import * as bcryptjs from "bcryptjs";
import { auth } from "../index.jet.ts";


export const POST_auth_register: JetFunc<{ body: { username: string; password: string; email: string; role: string; isAdmin: string } }> = async (ctx) => {
    let { username, password, email, role, isAdmin } = ctx.body;
    console.log(ctx.body);
    password = bcryptjs.hashSync(password, 10);
    username = username.toLowerCase();
    email = email.toLowerCase();
    role = role.toLowerCase();
    isAdmin = isAdmin.length > 0 ? 1 : 0;
    // 
 await   user.query.insert({
        username,
        password,
        email,
        role,
        isAdmin,
        createdAt: Date.now(),
        banned: false,
        id: ""
    })
    ctx.send({
        message: "User registered successfully",
        code: 200
    })
}


use(POST_auth_register).body((t) => {
    return {
        username: t.string().min(4).required(),
        password: t.string().min(4).required(),
        email: t.string().email().required(),
        role: t.string().required(),
        isAdmin: t.string().required()
    }
})

export const POST_auth_login: JetFunc<{ body: { username: string; password: string } }> = async (ctx) => {
 
    let { username, password } = ctx.body;
    username = username.toLowerCase(); 
    const userinfo = await user.query.select("*").where("username = ?", username).getOne();
    if (!userinfo) {
        ctx.send({
            message: "User not found",
            code: 404
        })
        return;
    }
    if(userinfo.banned) {
        ctx.send({
            message: "User is banned",
            code: 401
        })
        return;
    }
    if (!bcryptjs.compareSync(password, userinfo.password)) {
        ctx.send({
            message: "Invalid password",
            code: 401
        })
        return;
    }
    const token = await auth.create({
        username: username,
        id: userinfo.id!,
        isAdmin: userinfo.isAdmin
    })
    ctx.send({
        message: "Login successful",
        code: 200,
        token,
       data: userinfo
    })
}

use(POST_auth_login).body((t) => {
    return {
        username: t.string().required(),
        password: t.string().required()
    }
})

export const POST_auth_reset_password: JetFunc<{ body: { username: string; password: string; token: string } }> = async (ctx) => {
    let { username, password, token } = ctx.body;
    await auth.verify(token);
    username = username.toLowerCase();
    password = bcryptjs.hashSync(password, 10);
    const userinfo = await user.query.select("*").where("username = ?", username).getOne();
    if (!userinfo) {
        ctx.send({
            message: "User not found",
            code: 404
        })
        return;
    }
    
    await user.query.where("id = ?", userinfo.id!).update({
        password
    });
    ctx.send({
        message: "Password reset successfully",
        code: 200
    })
}

use(POST_auth_reset_password).body((t) => {
    return {
        username: t.string().required(),
        password: t.string().required(),
        token: t.string().required()
    }
})
