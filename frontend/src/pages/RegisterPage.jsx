import { useState } from 'react';
import apiClient from '../api/axios';
import { useNavigate, Link } from 'react-router-dom';

function RegisterPage() {
  const [formData, setFormData] = useState({
    username:'',
    email:'',
    password:''
  })
  const [error,setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e)=>{
    setFormData({...formData,[e.target.name]:e.target.value})
  }

  const handleSubmit = async(e)=>{
    e.preventDefault();
    setError('');
    try{
      await apiClient.post('/users/register',formData);
      navigate('/login');
    }catch(err){
      setError(err.response?.data?.msg || "注册失败");
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1 className="auth-title">用户注册</h1>
        <p className="auth-sub">创建账号，开始你的 Feynman 之旅</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">用户名</label>
            <input
              className="form-input"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="请输入用户名"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">邮箱</label>
            <input
              className="form-input"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="请输入邮箱"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">密码</label>
            <input
              className="form-input"
              name="password"
              value={formData.password}
              onChange={handleChange}
              type="password"
              placeholder="请输入密码"
              required
            />
          </div>
          <button className="btn-primary" type="submit">注册</button>
        </form>
        {error && <p className="form-error">{error}</p>}
        <p className="auth-switch">已有账号？<Link to="/login">去登录</Link></p>
      </div>
    </div>
  )
}
export default RegisterPage;
