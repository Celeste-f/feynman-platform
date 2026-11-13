import { Routes,Route } from 'react-router-dom'
import './App.css'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/login" element={<LoginPage />}/>
        <Route path="/register" element={<RegisterPage />}/>
        {/*受保护页面，必须登录*/}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<DashboardPage />}/>
        </Route>
      </Route>
    </Routes>
  )
}
export default App
