import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../api/axios';
import { TARGET_RATE, toPcmBlob, mergeChunks } from '../utils/pcmRecorder';
import { getStatusInfo } from '../utils/kpStatus';

const MAX_RECORD_MS = 58000; // 百度短语音识别单次最长约60秒，留2秒余量

function FeynmanRecordPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [kpTitle, setKpTitle] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [transcribedText, setTranscribedText] = useState('');
  const [recording, setRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [aiFeedback, setAiFeedback] = useState(null);
  const [seconds, setSeconds] = useState(0);

  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);
  const processorRef = useRef(null);
  const chunksRef = useRef([]);
  const stopTimerRef = useRef(null);
  const tickTimerRef = useRef(null);
  const recordedRateRef = useRef(TARGET_RATE);

  // 获取知识点
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
  }, [id, navigate]);

  // 离开页面时清理录音资源
  useEffect(() => {
    return () => {
      clearTimeout(stopTimerRef.current);
      clearInterval(tickTimerRef.current);
      releaseAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const releaseAudio = () => {
    try {
      processorRef.current?.disconnect();
      sourceRef.current?.disconnect();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close();
    } catch (e) {
      console.warn('释放录音资源失败：', e);
    }
    processorRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    audioCtxRef.current = null;
  };

  // 开始录音
  const startRecording = async () => {
    setTranscribedText('');
    setAiFeedback(null);
    setSeconds(0);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
      });
      streamRef.current = stream;

      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx({ sampleRate: TARGET_RATE });
      audioCtxRef.current = ctx;
      recordedRateRef.current = ctx.sampleRate;
      if (ctx.state === 'suspended') await ctx.resume();

      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e) => {
        chunksRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      };
      processorRef.current = processor;

      source.connect(processor);
      processor.connect(ctx.destination);

      setRecording(true);

      tickTimerRef.current = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);

      // 到时间自动停止，避免超过百度短语音 60 秒限制
      stopTimerRef.current = setTimeout(() => {
        stopRecording();
      }, MAX_RECORD_MS);
    } catch (err) {
      console.error('获取麦克风失败：', err);
      alert('无法访问麦克风：' + (err.message || err.name) + '\n请检查浏览器麦克风权限');
      releaseAudio();
    }
  };

  // 停止录音并上传识别
  const stopRecording = () => {
    clearTimeout(stopTimerRef.current);
    clearInterval(tickTimerRef.current);
    setRecording(false);
    releaseAudio();

    const totalLength = chunksRef.current.reduce((n, c) => n + c.length, 0);
    if (totalLength === 0) {
      alert('没有录到音频，请重试');
      return;
    }

    const merged = mergeChunks(chunksRef.current);
    chunksRef.current = [];
    setSeconds(0);

    const pcmBlob = toPcmBlob(merged, recordedRateRef.current);
    uploadAndTranscribe(pcmBlob);
  };

  // 上传 PCM 到后端百度语音识别
  const uploadAndTranscribe = async (pcmBlob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('audio', pcmBlob, 'audio.pcm');
      formData.append('format', 'pcm');
      formData.append('rate', String(TARGET_RATE));

      const res = await axios.post('/audio/transcribe-local', formData, {
        timeout: 60000
      });

      const text = (res.data.result || '').trim();
      if (!text) {
        alert('没有识别出内容，请靠近麦克风、放慢语速后重试');
        return;
      }
      setTranscribedText(text);
      getAiEvaluation(text);
    } catch (err) {
      console.error('语音识别失败：', err);
      alert('语音识别失败：' + (err.response?.data?.msg || err.message));
    } finally {
      setIsTranscribing(false);
    }
  };

  const toggleRecord = () => {
    if (recording) stopRecording();
    else startRecording();
  };

  // 调用 AI 评价
  const getAiEvaluation = async (transcribed) => {
    if (!originalContent || !transcribed) return;

    setIsEvaluating(true);
    setAiFeedback(null);

    try {
      const res = await axios.post('/audio/evaluate', {
        // 富文本知识点存的是 HTML，送给 AI 前先去掉标签
        originalContent: (originalContent || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim(),
        transcribedText: transcribed,
        knowledgePointId: id
      });
      setAiFeedback(res.data);
    } catch (err) {
      console.error('AI 评价失败：', err);
      alert('AI 评价失败：' + (err.response?.data?.msg || err.message));
    } finally {
      setIsEvaluating(false);
    }
  };

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
          disabled={isTranscribing}
          style={{
            background: recording ? '#dc3545' : '#2563eb',
            color: '#fff',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '6px',
            fontSize: '16px',
            cursor: isTranscribing ? 'not-allowed' : 'pointer',
            opacity: isTranscribing ? 0.6 : 1
          }}
        >
          {recording ? '⏹ 停止录音' : '🎤 开始录音'}
        </button>
        {recording && (
          <span style={{ marginLeft: '12px', color: '#dc3545' }}>
            ● 录音中 {seconds}s / 最长 58s
          </span>
        )}
        <p style={{ color: '#888', fontSize: '13px', marginTop: '8px' }}>
          录音经后端调用百度短语音识别转成文字，停止后自动请求 AI 评价。
        </p>
      </div>

      {/* 识别中 */}
      {isTranscribing && (
        <div style={{ padding: '1rem', background: '#e8f4fd', borderRadius: '8px', marginBottom: '1.5rem' }}>
          <p>🎧 正在识别语音，请稍候...</p>
        </div>
      )}

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
            {isEvaluating ? 'AI 正在批阅...' : '🤖 重新获取 AI 评价'}
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
            {/* 评分后自动写入的知识点状态 */}
            {aiFeedback.status && (() => {
              const s = getStatusInfo(aiFeedback.status);
              return (
                <div style={{ marginTop: '10px' }}>
                  <span style={{
                    color: s.color,
                    background: s.bg,
                    border: `1px solid ${s.color}`,
                    padding: '3px 10px',
                    borderRadius: '10px',
                    fontSize: '13px'
                  }}>
                    {s.label}
                  </span>
                  <p style={{ color: '#888', fontSize: '12px', marginTop: '6px' }}>
                    （≥60 分自动标记为已掌握）
                  </p>
                </div>
              );
            })()}
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
