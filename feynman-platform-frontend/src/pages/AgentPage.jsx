// src/pages/AgentPage.jsx
// 第十一次课：AI Agent 问答界面 —— 与整个私有知识库对话
import { useState, useRef, useEffect } from 'react';
import apiClient from '../api/axios';
import './AgentPage.css';

function AgentPage() {
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: '你好！我是你的专属知识库 AI 助手。我已经“读过”你创建的所有知识点，试着问问我吧！比如：某个概念是什么、它们之间有什么关系。'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // 自动滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const question = inputValue.trim();
    if (!question || isLoading) return;

    setMessages((prev) => [...prev, { sender: 'user', text: question }]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await apiClient.post('/ai/rag-qa', { question });
      const { answer, sources } = response.data;
      setMessages((prev) => [...prev, { sender: 'bot', text: answer, sources }]);
    } catch (error) {
      console.error('Error fetching AI response:', error);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: '抱歉，我遇到了一些问题：' + (error.response?.data?.msg || error.message) + '，请稍后再试。'
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="agent-page">
      <div className="agent-header">
        🤖 知识库 AI 助手
        <small>基于你的私有知识库（RAG 向量检索 + AI 生成），回答附带引用来源</small>
      </div>

      <div className="chat-window">
        {messages.map((msg, index) => (
          <div key={index}>
            <div className={`message ${msg.sender}`}>
              <div className="message-bubble">{msg.text}</div>
            </div>
            {/* 选做作业：显示 AI 是根据哪些文档片段作出的回答 */}
            {msg.sender === 'bot' && msg.sources && msg.sources.length > 0 && (
              <div className="sources">
                <div className="sources-title">📚 引用来源（{msg.sources.length} 个片段）</div>
                {msg.sources.map((s, i) => (
                  <div key={i} className="source-item">
                    <b>《{s.title}》</b>
                    <span className="source-score">相关度 {s.score}</span>
                    <div>{s.excerpt}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="message bot">
            <div className="message-bubble typing-indicator">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-form" onSubmit={handleSendMessage}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="在这里输入你的问题..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !inputValue.trim()}>
          {isLoading ? '检索思考中...' : '发送'}
        </button>
      </form>
    </div>
  );
}

export default AgentPage;
