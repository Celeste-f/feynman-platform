import KnowledgePointFormPage from './pages/KnowledgePointFormPage';
import FeynmanRecordPage from './pages/FeynmanRecordPage';
import QuizPage from './pages/QuizPage';
import AgentPage from './pages/AgentPage';
import GraphPage from './pages/GraphPage';
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
          <Route path="/knowledge/new" element={<KnowledgePointFormPage />} />
          <Route path="/knowledge/edit/:id" element={<KnowledgePointFormPage />} />
          <Route path="/feynman/:id" element={<FeynmanRecordPage />} />
          <Route path="/quiz/:id" element={<QuizPage />} />
          {/* 第十一次课：RAG 知识库问答 Agent */}
          <Route path="/agent" element={<AgentPage />} />
          {/* 第十二次课：知识图谱可视化 */}
          <Route path="/graph" element={<GraphPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
export default App