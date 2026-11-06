import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabaseClient";
import "../../app.css";

export default function AppLayout({ children }) {
  const { user, signOut } = useAuth();
  const [name, setName] = useState("");

  useEffect(() => {
    let active = true;

    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setName(data?.full_name ?? "");
      });

    return () => {
      active = false;
    };
  }, [user.id]);

  return (
    <div className="dashboard">
      <header className="topbar">
        <Link to="/" className="brand" aria-label="Connect IF - início">
          <img src="/logo.png" alt="Connect IF" className="topbar-logo" />
        </Link>
        <div>
          <span>{name || user.email}</span>
          <button onClick={signOut}>Sair</button>
        </div>
      </header>

      <main className="content">{children}</main>
    </div>
  );
}
