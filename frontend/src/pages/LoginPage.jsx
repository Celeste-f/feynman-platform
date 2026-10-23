import { useState } from 'react'
import apiClient from '../api/axios'
import { useNavigate, useLocation } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const location = useLocation()
  const [email,setEmail] = useState(location.state?.prefillEmail || '')
  const [password,setPassword] = useState(location.state?.prefillPassword || '')
  const [error,setError] = useState('')
  const navigate = useNavigate()
  const { login } = useAuth()

  const handleSubmit = async(e)=>{
    e.preventDefault()
    setError('')
    try{
      const res = await apiClient.post('/users/login',{email,password})
      login(res.data.token, res.data.user)
      navigate('/')
    }catch(err){
      setError(err.response?.data?.msg || "登录失败")
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1 className="auth-title">用户登录</h1>
        <p className="auth-sub">欢迎回来，请登录你的账号</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">邮箱</label>
            <input
              className="form-input"
              type="email"
              placeholder="请输入邮箱"
              value={email}
              onChange={e=>setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">密码</label>
            <input
              className="form-input"
              type="password"
              placeholder="请输入密码"
              value={password}
              onChange={e=>setPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn-primary" type="submit">登录</button>
        </form>
        {error && <p className="form-error">{error}</p>}
        <p className="auth-switch">还没有账号？<Link to="/register">立即注册</Link></p>
      </div>
    </div>
  )
}
