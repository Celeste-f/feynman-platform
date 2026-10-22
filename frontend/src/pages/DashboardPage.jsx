import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function DashboardPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    const getUserInfo = async () => {
      try {
        const res = await axios.get('http://localhost:3000/api/profile', {
          headers: { "x-auth-token": token }
        });
        setUser(res.data);
      } catch (err) {
        localStorage.removeItem('token');
        navigate('/login');
      } finally {
        setLoading(false);
      }
    }
    getUserInfo();
  }, [token, navigate])

  const logout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  }

  if (loading) return <div>加载控制台...</div>

  return (
    <div style={{maxWidth:'500px',margin:'0 auto'}}>
      <h2>控制台 Dashboard</h2>
      <div style={{border:'1px solid #ccc',padding:'20px',borderRadius:'8px'}}>
        <p>👤用户名：{user.username}</p>
        <p>📧邮箱：{user.email}</p>
      </div>
      <br/>
      <button onClick={logout} style={{padding:'8px 16px',background:'#c82423',color:'white',border:'none'}}>
        退出登录
      </button>
    </div>
  )
}
export default DashboardPage;
