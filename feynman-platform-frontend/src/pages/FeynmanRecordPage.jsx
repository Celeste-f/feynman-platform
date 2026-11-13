import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../api/axios';

function FeynmanRecordPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [kpTitle, setKpTitle] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [transcribedText, setTranscribedText] = useState('');
  const [recording, setRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [aiFeedback, setAiFeedback] = useState(null);
  const recognitionRef = useRef(null);

  // 初始化语音识别 + 获取知识点
  useEffect(() => {
    const fetchKp = async () => {
      try {
        const res = await axios.get(`/knowledge-points/${id}`);
        setKpTitle(res.data.title);
        setOriginalContent(res.data.content);
      } catch (err) {
        console.error('获取知识点失败：', err);
        alert('获取知识点失败');
        navigate('/');
      }
    };
    fetchKp();

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
        setTranscribedText(transcript);
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
  }, [id, navigate]);

  // 开始/停止录音
  const toggleRecord = () => {
    if (!recognitionRef.current) {
      alert('您的浏览器不支持语音识别，请使用 Chrome 或 Edge 浏览器');
      return;
    }

    if (recording) {
      recognitionRef.current.stop();
      setRecording(false);
      // 停止录音后自动触发 AI 评价
      if (transcribedText) {
        getAiEvaluation(transcribedText);
      }
    } else {
      try {
        setTranscribedText('');
        setAiFeedback(null);
        recognitionRef.current.start();
        setRecording(true);
      } catch (err) {
        console.error('启动语音识别失败：', err);
        alert('启动语音识别失败，请重试');
      }
    }
  };

  // 调用 AI 评价
  const getAiEvaluation = async (transcribed) => {
    if (!originalContent || !transcribed) return;

    setIsEvaluating(true);
    setAiFeedback(null);

    try {
      const res = await axios.post('/audio/evaluate', {
        originalContent,
        transcribedText: transcribed
      });
      setAiFeedback(res.data);
    } catch (err) {
      console.error('AI 评价失败：', err);
      alert('AI 评价失败：' + (err.response?.data?.msg || err.message));
    } finally {
      setIsEvaluating(false);
    }
  };

  // 手动触发评价（如果自动评价没触发）
  const handleEvaluate = () => {
    if (!transcribedText) {
      alert('请先录音');
      return;
    }
    getAiEvaluation(transcribedText);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <h2>复述知识点：{kpTitle}</h2>

      {/* 录音区域 */}
      <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
        <h3>语音复述</h3>
        <button
          onClick={toggleRecord}
          style={{
            background: recording ? '#dc3545' : '#2563eb',
            color: '#fff',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '6px',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          {recording ? '⏹ 停止录音' : '🎤 开始录音'}
        </button>
        {recording && <span style={{ marginLeft: '12px', color: '#dc3545' }}>● 录音中...</span>}
      </div>

      {/* 转录结果 */}
      {transcribedText && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#fff3cd', borderRadius: '8px' }}>
          <h3>转录文本</h3>
          <p style={{ whiteSpace: 'pre-wrap' }}>{transcribedText}</p>
          <button
            onClick={handleEvaluate}
            disabled={isEvaluating}
            style={{
              background: '#28a745',
              color: '#fff',
              padding: '8px 16px',
              border: 'none',
              borderRadius: '6px',
              cursor: isEvaluating ? 'not-allowed' : 'pointer',
              opacity: isEvaluating ? 0.6 : 1
            }}
          >
            {isEvaluating ? 'AI 正在批阅...' : '🤖 获取 AI 评价'}
          </button>
        </div>
      )}

      {/* AI 加载中 */}
      {isEvaluating && (
        <div style={{ padding: '1rem', background: '#e8f4fd', borderRadius: '8px', marginBottom: '1.5rem' }}>
          <p>🤖 AI 教练正在批阅您的答卷，请稍候...</p>
        </div>
      )}

      {/* AI 反馈结果 */}
      {aiFeedback && (
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '300px' }}>
            <h3>AI 润色后的文本</h3>
            <p style={{ background: '#eef', padding: '1rem', borderRadius: '6px', whiteSpace: 'pre-wrap' }}>
              {aiFeedback.polishedText}
            </p>

            <h3>综合评价</h3>
            <p>{aiFeedback.evaluation}</p>

            <h3 style={{ color: '#28a745' }}>优点 👍</h3>
            <ul>
              {aiFeedback.strengths && aiFeedback.strengths.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>

            <h3 style={{ color: '#dc3545' }}>待改进 👇</h3>
            <ul>
              {aiFeedback.weaknesses && aiFeedback.weaknesses.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>

          <div style={{ flex: '0 0 150px', textAlign: 'center', alignSelf: 'flex-start' }}>
            <h3>综合得分</h3>
            <div style={{
              fontSize: '3rem',
              fontWeight: 'bold',
              color: aiFeedback.score > 80 ? '#28a745' : aiFeedback.score > 60 ? '#ffc107' : '#dc3545'
            }}>
              {aiFeedback.score}
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => navigate('/')}
        style={{ marginTop: '2rem', padding: '8px 16px', cursor: 'pointer' }}
      >
        ← 返回首页
      </button>
    </div>
  );
}

export default FeynmanRecordPage;
