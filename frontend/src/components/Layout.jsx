import { Link, useNavigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Layout(){
  const { token,logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = ()=>{
    logout();
    navigate('/login')
  }

  return (
    <>
      <nav className="nav-bar">
        <Link to="/" className="nav-brand">Feynman<span>平台</span></Link>
        <Link to="/" className="nav-link">首页</Link>
        {
          token ? (
            <button className="btn-logout" onClick={handleLogout}>退出登录</button>
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
