
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export default function Todos({ user }) {
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
                <h2>Мой Todo</h2>
                <button onClick={signOut}>Выйти</button>
            </div>

            <form onSubmit={addTodo} style={{ display: "flex", gap: 8 }}>
                <input
                    placeholder="Новая задача..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    style={{ flex: 1 }}
                />
                <button type="submit">Добавить</button>
            </form>

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
