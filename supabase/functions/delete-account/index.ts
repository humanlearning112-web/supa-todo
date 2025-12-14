
// <reference lib="deno.ns" />

import { createClient } from "npm:@supabase/supabase-js@2";

// CORS (как у тебя уже было для ai-todos)
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

Deno.serve(async (req) => {
    console.log("METHOD:", req.method, "ORIGIN:", req.headers.get("origin"));

    // 1) Preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return jsonResponse({ error: "Use POST" }, 405);
    }

    // 2) Проверяем Authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
        return jsonResponse({ error: "Missing Authorization header" }, 401);
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
        return jsonResponse({ error: "Missing Bearer token" }, 401);
    }

    // 3) Клиент "как пользователь" (anon key + auth context), чтобы получить user по JWT
    // Supabase рекомендует прокидывать Authorization header в createClient внутри handler. [6](https://supabase.com/docs/guides/functions/auth)
    const supabaseUser = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        {
            global: { headers: { Authorization: authHeader } },
        }
    );

    const { data: userData, error: userErr } = await supabaseUser.auth.getUser(token);
    if (userErr || !userData?.user) {
        return jsonResponse({ error: "Invalid session / user not found", details: userErr?.message }, 401);
    }

    const userId = userData.user.id;

    // 4) Админ-клиент (service role) — ТОЛЬКО на сервере/edge function!
    // SUPABASE_SERVICE_ROLE_KEY доступен как secret в Edge Functions, и не должен быть в браузере. [3](https://supabase.com/docs/guides/functions/secrets)[2](https://supabase.com/docs/reference/javascript/admin-api)
    const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        {
            auth: { autoRefreshToken: false, persistSession: false },
        }
    );

    // 5) Удаляем пользователя
    // deleteUser требует service_role key и user id из auth.users.id. [1](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser)
    // Можно также сделать "soft delete" вторым аргументом (true). [1](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser)
    const { data, error } = await supabaseAdmin.auth.admin.deleteUser(userId /*, false */);

    if (error) {
        return jsonResponse({ error: "Failed to delete user", details: error.message }, 500);
    }

    return jsonResponse({ ok: true, deletedUserId: userId, data }, 200);
});
