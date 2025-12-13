
import { useState } from "react";
import { supabase } from "./supabaseClient";

export default function Auth() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const signUp = async () => {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) alert(error.message);
        else alert("Ready! Проверь почту (если включено подтверждение).");
    };

    const signIn = async () => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) alert(error.message);
    };

    return (
        <div style={{ maxWidth: 360, margin: "40px auto", display: "grid", gap: 12 }}>
            <h2>Вход / Регистрация</h2>
            <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button onClick={signIn}>Sing IN</button>
            <button onClick={signUp}>Зарегистрироваться</button>
        </div>
    );
} 
