
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

import {
  FunctionsHttpError,
  FunctionsRelayError,
  FunctionsFetchError,
} from "@supabase/supabase-js";




export default function Todos({ user }) {






    const [aiText, setAiText] = useState("");
    const [aiLoading, setAiLoading] = useState(false);
    const [aiPreview, setAiPreview] = useState(null); // optional preview of json/tasks


    const generateFromText = async () => {
        try {
            setAiLoading(true);

            const { data, error } = await supabase.functions.invoke("ai-todos", {
                body: { text: aiText },
            }); // invoke JSON(https://supabase.com/docs/reference/javascript/functions-invoke)

            if (error) throw error;

            const tasks = data?.tasks ?? [];
            setAiPreview(data); // save raw_json  tasks для "download json"

            if (!tasks.length) return;

            // перетворюємо в рядки
            const rows = tasks.map((t) => ({
                title: t.title,
                is_done: false,
                user_id: user.id,
            }));

            const { error: insErr } = await supabase.from("todos").insert(rows);
            if (insErr) throw insErr;

            setAiText("");
            await loadTodos();
        } catch (e) {
            console.error("invoke error:", e);

            if (e instanceof FunctionsHttpError) {
                const errBody = await e.context.json().catch(() => ({}));
                console.error("HTTP error body:", errBody);
                alert("Edge Function повернула HTTP помилку.");
            } else if (e instanceof FunctionsRelayError) {
                console.error("Relay error:", e.message);
                alert("Relay error (промлема з Supabase gateway).");
            } else if (e instanceof FunctionsFetchError) {
                console.error("Fetch error:", e.message);
                alert("Fetch error: запрос не пішов (URL/CORS/сеть/ENV).");
            } else {
                alert(e?.message ?? String(e));
            }
        } finally {
            setAiLoading(false);
        }
    };



    const deleteAccount = async () => {
        const ok = confirm("Впевнені що бажаєти видалити акаунт ? Всі записи буде втрачено");
        if (!ok) return;

        try {
            const { data, error } = await supabase.functions.invoke("delete-account", {
                body: {}, 
            });

            if (error) throw error;

            // на всякий, для підстраховки вийдемо 
            await supabase.auth.signOut();

            alert("Аккаунт видалено.");
            // оновлення сторінки після видалення акаунту і виходу
            window.location.reload();
        } catch (e) {
            console.error(e);
            alert(e?.message ?? String(e));
        }
    };



    const [todos, setTodos] = useState([]);
    const [title, setTitle] = useState("");

    const loadTodos = async () => {
        const { data, error } = await supabase
            .from("todos")
            .select("*")
            .order("inserted_at", { ascending: false });

        if (error) alert(error.message);
        else setTodos(data);
    };

    useEffect(() => {
        loadTodos();
    }, []);

    const addTodo = async (e) => {
        e.preventDefault();
        if (!title.trim()) return;

        const { error } = await supabase.from("todos").insert({
            title: title.trim(),
            user_id: user.id, // важно: owner
        });

        if (error) alert(error.message);
        else {
            setTitle("");
            loadTodos();
        }
    };

    const toggleTodo = async (todo) => {
        const { error } = await supabase
            .from("todos")
            .update({ is_done: !todo.is_done })
            .eq("id", todo.id);

        if (error) alert(error.message);
        else loadTodos();
    };

    const deleteTodo = async (id) => {
        const { error } = await supabase.from("todos").delete().eq("id", id);
        if (error) alert(error.message);
        else loadTodos();
    };

    const signOut = async () => {
        await supabase.auth.signOut();
    };
    
    return (
        <div style={{ maxWidth: 520, margin: "40px auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2>Мій Todo</h2>
                <button onClick={signOut}>Выйти</button>
     
                
                <button // кнопка видалення акаунту
                    onClick={deleteAccount}
                    style={{ background: "#ff4d4f", color: "white", border: 0, padding: "6px 10px", borderRadius: 6 }}
                >
                    Видалити аккаунт
                </button>


            </div>

            <form onSubmit={addTodo} style={{ display: "flex", gap: 8 }}>
                <input
                    placeholder="Новая задача..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    style={{ flex: 1 }}
                />
                <button type="submit">Добавити</button>
            </form>



            <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
                <h3>AI → TODO</h3>

                <textarea
                    rows={4}
                    placeholder="Опищіть що вам треба зробити, вони будуть розбиті на менші та перетворені в задачі...'"
                    value={aiText}
                    onChange={(e) => setAiText(e.target.value)}
                    style={{ width: "100%", resize: "vertical" }}
                />

                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button onClick={generateFromText} disabled={aiLoading || !aiText.trim()}>
                        {aiLoading ? "Генерую..." : "Розбити на задачі"}
                    </button>

                    {aiPreview?.raw_json && (
                        <button
                            type="button"
                            onClick={() => {
                                const blob = new Blob([aiPreview.raw_json], { type: "application/json" });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = "ai-todos.json";
                                a.click();
                                URL.revokeObjectURL(url);
                            }}
                        >
                            download JSON
                        </button>
                    )}
                </div>
            </div>



            <ul style={{ listStyle: "none", padding: 0, marginTop: 16 }}>
                {todos.map((t) => (
                    <li key={t.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 0" }}>
                        <input type="checkbox" checked={t.is_done} onChange={() => toggleTodo(t)} />
                        <span style={{ textDecoration: t.is_done ? "line-through" : "none", flex: 1 }}>
                            {t.title}
                        </span>
                        <button onClick={() => deleteTodo(t.id)}>🗑</button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
