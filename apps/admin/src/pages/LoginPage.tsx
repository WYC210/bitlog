import React, { useState } from "react";
import type { ApiError } from "../api";
import { adminLogin } from "../api";

export function LoginPage(props: { onLoggedIn: () => void; onError: (m: string) => void }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("123456");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  return (
    <div className="card">
      <h2 style={{ margin: "0 0 8px" }}>登录</h2>
      <div className="muted">默认账号：admin / 123456（可在设置里改密码）。</div>
      <div style={{ height: 12 }} />
      <div className="row">
        <label>
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
      </div>
      <div style={{ height: 10 }} />
      <label
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          fontWeight: 600,
          color: "rgba(255,255,255,0.80)"
        }}
      >
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        记住我（30 天）
      </label>
      <div style={{ height: 12 }} />
      <button
        className="chip chip-primary"
        disabled={loading}
        onClick={async () => {
          props.onError("");
          setLoading(true);
          try {
            await adminLogin(username.trim(), password, remember);
            props.onLoggedIn();
          } catch (e) {
            const err = e as ApiError;
            props.onError(err.message || "登录失败");
          } finally {
            setLoading(false);
          }
        }}
      >
        {loading ? "登录中..." : "登录"}
      </button>
    </div>
  );
}

