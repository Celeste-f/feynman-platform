import { useState, useRef, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from '../api/axios';

const TYPE_LIST = ['笔记', '公式', '表格', '流程图', '状态图'];

function KnowledgePointFormPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlType = searchParams.get('type');
  const defaultType = TYPE_LIST.includes(urlType) ? urlType : '笔记';

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState(defaultType);
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef(null);

  // 初始化语音识别
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'zh-CN';
      recognition.continuous = true;
      recognition.interimResults = false;

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('');
        setContent(prev => prev + transcript);
      };

      recognition.onerror = (event) => {
        console.error('语音识别错误：', event.error);
        alert(`语音识别失败：${event.error}`);
        setRecording(false);
      };

      recognition.onend = () => {
        setRecording(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // 开始/停止录音
  const toggleRecord = () => {
    if (!recognitionRef.current) {
      alert('您的浏览器不支持语音识别，请使用 Chrome 或 Edge 浏览器');
      return;
    }

    if (recording) {
      recognitionRef.current.stop();
      setRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setRecording(true);
      } catch (err) {
        console.error('启动语音识别失败：', err);
        alert('启动语音识别失败，请重试');
      }
    }
  };

  const submit = async () => {
    if (!title || !content) {
      alert('标题和内容不能为空');
      return;
    }
    try {
      await axios.post('/knowledge-points', { title, content, type });
      alert('保存成功');
      navigate('/');
    } catch (err) {
      console.error('提交失败：', err.response?.data || err.message);
      const msg = err.response?.data?.msg || err.response?.data || err.message;
      alert('提交失败：' + msg);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <h2>新增{type}</h2>
      <div>
        <label>类型</label>
        <select value={type} onChange={(e) => setType(e.target.value)} style={{ padding: '6px', marginLeft: '8px' }}>
          {TYPE_LIST.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <label>{type + '标题'}</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={type + '标题'}
          style={{ width: '100%', padding: '8px', marginTop: '6px' }}
        />
      </div>

      <div style={{ marginTop: '1rem' }}>
        <label>内容（{type}）</label>
        <div style={{ marginBottom: '8px' }}>
          <button onClick={toggleRecord} style={{ background: recording ? 'red' : '#2563eb', color: '#fff', padding: '6px 12px', border: 'none', borderRadius: '4px' }}>
            {recording ? '⏹ 停止录音' : '🎤 语音输入'}
          </button>
          {recording && <span style={{ marginLeft: '10px', color: 'red' }}>● 录音中...</span>}
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={10}
          style={{ width: '100%', padding: '8px', marginTop: '6px', fontFamily: 'monospace' }}
        />
      </div>

      <button onClick={submit} style={{ marginTop: '1rem', padding: '8px 16px' }}>
        提交保存
      </button>
    </div>
  );
}

export default KnowledgePointFormPage;