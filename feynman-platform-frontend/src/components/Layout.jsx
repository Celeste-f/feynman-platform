import { Link, useNavigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Layout(){
  const { token, user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = ()=>{
    logout();
    navigate('/login')
  }

  return (
    <>
      <nav className="nav-bar">
        <Link to="/" className="nav-brand">Feynman<span>平台</span></Link>
        {
          token ? (
            <>
              <Link to="/" className="nav-link">首页</Link>
              <Link to="/agent" className="nav-link">AI助手</Link>
              <Link to="/graph" className="nav-link">知识图谱</Link>
              <Link to="/3d-world" className="nav-link">3D视界</Link>
              <Link to="/universe" className="nav-link">知识宇宙</Link>
              <span className="nav-user">{user?.username || '用户'} · {user?.email || '-'}</span>
              <button className="btn-logout" onClick={handleLogout}>退出登录</button>
            </>
          ):(
            <>
              <Link to="/login" className="nav-link">登录</Link>
              <Link to="/register" className="nav-link">注册</Link>
            </>
          )
        }
      </nav>
      <Outlet />
    </>
  )
}