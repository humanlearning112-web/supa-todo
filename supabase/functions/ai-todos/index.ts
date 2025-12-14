
// <reference lib="deno.ns" />

/**
 * Edge Function: ai-todos
 * - Принимает { text }
 * - Вызывает Gemini
 * - Возвращает { tasks: [{title,is_done}], raw_json }
 *
 * ВАЖНО ДЛЯ БРАУЗЕРА:
 * - CORS preflight (OPTIONS) должен обрабатываться первым
 * - CORS headers должны быть во ВСЕХ ответах
 * Supabase docs: https://supabase.com/docs/guides/functions/cors
 */

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

function safeJsonParse<T>(s: string): T | null {
    try {
        return JSON.parse(s) as T;
    } catch {
        return null;
    }
}

type GeminiTask = { title: string; is_done?: boolean };
type GeminiResponse = {
    candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
    }>;
    promptFeedback?: unknown;
};

Deno.serve(async (req) => {
    // ✅ Логи — чтобы в Supabase Dashboard → Logs видеть OPTIONS/POST
    console.log("METHOD:", req.method, "ORIGIN:", req.headers.get("origin"));

    // ✅ 1) CORS preflight должен быть самым первым
    // Это критично, иначе браузер заблокирует запрос (OPTIONS → POST) [1](https://fallendeity.github.io/gemini-ts-cookbook/quickstarts/JSON_mode.html)[5](https://www.raymondcamden.com/2024/06/11/using-json-schema-with-google-gemini)
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    // Разрешаем только POST
    if (req.method !== "POST") {
        return jsonResponse({ error: "Use POST" }, 405);
    }

    // ✅ 2) Для POST требуем Authorization (пользователь должен быть залогинен)
    // (OPTIONS мы НЕ проверяем — иначе preflight не пройдёт)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
        return jsonResponse({ error: "Missing Authorization header" }, 401);
    }

    // Прочитаем входной текст
    const { text } = await req.json().catch(() => ({ text: "" }));
    const input = String(text ?? "").trim();

    if (!input) {
        return jsonResponse({ error: "Empty text" }, 400);
    }

    // небольшой лимит на длину запроса (экономия токенов/денег)
    if (input.length > 4000) {
        return jsonResponse({ error: "Text too long (max 4000 chars)" }, 413);
    }

    // Ключ Gemini хранится в Secrets: GEMINI_API_KEY
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
        return jsonResponse({ error: "GEMINI_API_KEY is not set" }, 500);
    }

    // Промпт: требуем строго JSON массив задач
    const prompt = `
Ты помощник по планированию.
Разбей текст пользователя на конкретные TODO-задачи.

Правила:
- Верни ТОЛЬКО валидный JSON без markdown и без пояснений.
- Формат: массив объектов.
- Каждый объект: { "title": string, "is_done": boolean }.
- title короткий (до 120 символов), без нумерации в начале.
- is_done всегда false.
- Максимум 12 задач. Если текста мало — верни 1-3 задачи.

Текст пользователя:
"""${input}"""
`.trim();

    // Gemini endpoint generateContent (REST)
    // Документация: https://ai.google.dev/api/generate-content [4](https://supabase.com/docs/reference/cli/supabase-functions-serve)
    const geminiUrl =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

    // JSON mode (response_mime_type: application/json) — чтобы получить парсимый JSON [3](https://supabase.com/docs/guides/functions/function-configuration)[4](https://supabase.com/docs/reference/cli/supabase-functions-serve)
    const geminiBody = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            response_mime_type: "application/json",
            temperature: 0.2,
            maxOutputTokens: 800,
        },
    };

    const geminiResp = await fetch(geminiUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            // Можно передавать ключ заголовком x-goog-api-key [4](https://supabase.com/docs/reference/cli/supabase-functions-serve)
            "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify(geminiBody),
    });

    if (!geminiResp.ok) {
        const details = await geminiResp.text().catch(() => "");
        return jsonResponse(
            { error: "Gemini error", status: geminiResp.status, details },
            502,
        );
    }

    const data = (await geminiResp.json()) as GeminiResponse;
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    const tasks = safeJsonParse<GeminiTask[]>(raw);

    if (!Array.isArray(tasks)) {
        return jsonResponse({ error: "Model did not return JSON array", raw_json: raw }, 422);
    }

    // Нормализация + лимиты
    const normalized = tasks
        .map((t) => ({
            title: String(t?.title ?? "").trim().slice(0, 120),
            is_done: false,
        }))
        .filter((t) => t.title.length > 0)
        .slice(0, 12);

    return jsonResponse({ tasks: normalized, raw_json: raw }, 200);
});

