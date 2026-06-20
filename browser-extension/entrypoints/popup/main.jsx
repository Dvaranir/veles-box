import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/style.css';

function Popup() {
  const [user, setUser] = useState(null); const [username, setUsername] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState('');
  useEffect(() => { browser.runtime.sendMessage({ type: 'auth:me' }).then((value) => setUser(value?.user || null)); }, []);
  const login = async (event) => { event.preventDefault(); try { const result = await browser.runtime.sendMessage({ type: 'auth:login', payload: { username, password } }); setUser(result.user); setPassword(''); } catch (cause) { setError(cause.message || 'Не удалось войти'); } };
  if (user) return <main className="veles-popup"><p>Вы вошли как <b>{user.username}</b></p><button onClick={async () => { await browser.runtime.sendMessage({ type: 'auth:logout' }); setUser(null); }}>Выйти</button></main>;
  return <main className="veles-popup"><h1>Veles Music</h1><form onSubmit={login}><input aria-label="Логин" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Логин" required/><input aria-label="Пароль" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Пароль" type="password" required/><button>Войти</button></form>{error && <p role="alert">{error}</p>}</main>;
}
createRoot(document.getElementById('root')).render(<Popup />);
