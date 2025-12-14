
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
        else alert("Готово! перевірте на пошту надійшо посилання для підтвердження.");
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
                // 
                redirectTo: window.location.origin,
            },
        });
        if (error) alert(error.message);
    };

    return (
        <div style={{ maxWidth: 360, margin: "40px auto", display: "grid", gap: 12 }}>
            <h2>Вхід / регістрація</h2>

            <button onClick={signInWithGitHub}>
                 Авторизація GitHub 
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

            <button onClick={signIn}>Увійти</button>
            <button onClick={signUp}>Створити акаунт</button>
        </div>
    );
}
