import { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [form, setForm] = useState({
    email: "chenqi@test.com",
    password: "chenqi123"
  });
  const [msg, setMsg] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const handleLogin = async () => {
    try {
      const res = await axios.post('http://localhost:3000/api/login', form);
      setMsg("登录成功！Token：" + res.data.token);
      setIsSuccess(true);
      console.log('token', res.data.token);
    } catch (err) {
      setMsg("登录失败：" + (err.response?.data?.message || err.message));
      setIsSuccess(false);
    }
  }

  return (
    <div className="login-box">
      <h2>用户登录</h2>
      <div className="item">
        <label>邮箱：</label>
        <input
          value={form.email}
          onChange={(e) => setForm({...form, email:e.target.value})}
          type="email" placeholder="请输入邮箱"
        />
      </div>
      <div className="item">
        <label>密码：</label>
        <input
          value={form.password}
          onChange={(e) => setForm({...form, password:e.target.value})}
          type="password" placeholder="请输入密码"
        />
      </div>
      <button onClick={handleLogin}>登录</button>
      { msg && <p className={isSuccess ? "success" : ""}>{msg}</p> }
    </div>
  );
}

export default App;
