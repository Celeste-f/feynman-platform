import { useNavigate } from 'react-router-dom';

function HomePage() {
  const navigate = useNavigate();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '80vh',
      textAlign: 'center'
    }}>
      <h1 style={{
        fontSize: '48px',
        marginBottom: '60px',
        color: '#333'
      }}>
        费曼学习平台
      </h1>
      <div style={{ display: 'flex', gap: '40px' }}>
        <button
          onClick={() => navigate('/login')}
          style={{
            padding: '12px 40px',
            fontSize: '18px',
            backgroundColor: '#2ea861',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          登录
        </button>
        <button
          onClick={() => navigate('/register')}
          style={{
            padding: '12px 40px',
            fontSize: '18px',
            backgroundColor: '#348ede',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          注册
        </button>
      </div>
    </div>
  );
}
export default HomePage;
