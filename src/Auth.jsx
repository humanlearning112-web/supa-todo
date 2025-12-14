
import { useState } from "react";
import { supabase } from "./supabaseClient";

export default function Auth() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const signUp = async () => {
        const { error } = await supabase.auth.signUp({
            email: email.trim(),
            password,
        });
        if (error) alert(error.message);
        else alert("Готово! Проверь почту (если включено подтверждение).");
    };

    const signIn = async () => {
        const { error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
        });
        if (error) alert(error.message);
    };

    // ✅ GitHub OAuth
    const signInWithGitHub = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: "github",
            options: {
                // отправим пользователя обратно на текущий origin (localhost:5173 или 5176)
                redirectTo: window.location.origin,
            },
        });
        if (error) alert(error.message);
    };

    return (
        <div style={{ maxWidth: 360, margin: "40px auto", display: "grid", gap: 12 }}>
            <h2>Вход / Регистрация</h2>

            <button onClick={signInWithGitHub}>
                Войти через GitHub
            </button>

            <hr />

            <input
                type="email"
                placeholder="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
            />
            <input
                placeholder="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />

            <button onClick={signIn}>Войти</button>
            <button onClick={signUp}>Зарегистрироваться</button>
        </div>
    );
}
