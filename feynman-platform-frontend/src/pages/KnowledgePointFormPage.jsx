import { useState, useRef, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from '../api/axios';
import { TARGET_RATE, toPcmBlob, mergeChunks } from '../utils/pcmRecorder';
import RichTextEditor from '../components/RichTextEditor';

const TYPE_LIST = ['笔记', '公式', '表格', '流程图', '状态图', '富文本'];
const MAX_RECORD_MS = 58000; // 百度短语音识别单次最长约60秒，留2秒余量

function KnowledgePointFormPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlType = searchParams.get('type');
  const defaultType = TYPE_LIST.includes(urlType) ? urlType : '笔记';

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState(defaultType);

  // 录音 / 识别 / 保存状态
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);
  const processorRef = useRef(null);
  const chunksRef = useRef([]);
  const stopTimerRef = useRef(null);
  const tickTimerRef = useRef(null);
  const recordedRateRef = useRef(TARGET_RATE);

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
  const startRecord = async () => {
    if (transcribing) return;
    chunksRef.current = [];
    setSeconds(0);

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
      tickTimerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      stopTimerRef.current = setTimeout(() => stopRecord(), MAX_RECORD_MS);
    } catch (err) {
      console.error('获取麦克风失败：', err);
      alert('无法访问麦克风：' + (err.message || err.name) + '\n请检查浏览器麦克风权限');
      releaseAudio();
    }
  };

  // 停止录音 -> 上传识别
  const stopRecord = () => {
    clearTimeout(stopTimerRef.current);
    clearInterval(tickTimerRef.current);
    setRecording(false);
    releaseAudio();

    if (chunksRef.current.every((c) => c.length === 0)) {
      alert('没有录到音频，请重试');
      return;
    }

    const merged = mergeChunks(chunksRef.current);
    chunksRef.current = [];
    setSeconds(0);

    const pcmBlob = toPcmBlob(merged, recordedRateRef.current);
    transcribe(pcmBlob);
  };

  // 上传音频到后端百度语音识别，结果追加到内容框
  const transcribe = async (pcmBlob) => {
    setTranscribing(true);
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
      setContent((prev) => (prev ? prev + '\n' + text : text));
    } catch (err) {
      console.error('语音识别失败：', err);
      alert('语音识别失败：' + (err.response?.data?.msg || err.message));
    } finally {
      setTranscribing(false);
    }
  };

  const toggleRecord = () => {
    if (recording) stopRecord();
    else startRecord();
  };

  // 提交保存（新增知识点不做 AI 评分，状态保持初始「未学习」）
  const submit = async () => {
    const plainContent = (content || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    if (!title || !plainContent) {
      alert('标题和内容不能为空');
      return;
    }
    setSaving(true);
    try {
      await axios.post('/knowledge-points', { title, content, type });
      setSaved(true);
    } catch (err) {
      console.error('提交失败：', err.response?.data || err.message);
      const msg = err.response?.data?.msg || err.response?.data || err.message;
      alert('提交失败：' + msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <h2>新增{type}</h2>
      <div>
        <label>类型</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          disabled={saved}
          style={{ padding: '6px', marginLeft: '8px' }}
        >
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
          disabled={saved}
          style={{ width: '100%', padding: '8px', marginTop: '6px' }}
        />
      </div>

      <div style={{ marginTop: '1rem' }}>
        <label>内容（{type}）</label>
        {type !== '富文本' && (
          <div style={{ marginBottom: '8px' }}>
            <button
              type="button"
              onClick={toggleRecord}
              disabled={transcribing || saved}
              style={{
                background: recording ? 'red' : '#2563eb',
                color: '#fff',
                padding: '6px 12px',
                border: 'none',
                borderRadius: '4px',
                cursor: transcribing || saved ? 'not-allowed' : 'pointer',
                opacity: transcribing || saved ? 0.6 : 1
              }}
            >
              {recording ? '⏹ 停止录音' : '🎤 语音输入'}
            </button>
            {recording && <span style={{ marginLeft: '10px', color: 'red' }}>● 录音中 {seconds}s / 最长 58s</span>}
            {transcribing && <span style={{ marginLeft: '10px', color: '#2563eb' }}>🎧 正在识别语音...</span>}
          </div>
        )}
        {type === '富文本' ? (
          <RichTextEditor value={content} onChange={setContent} disabled={saved} />
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={10}
            disabled={saved}
            style={{ width: '100%', padding: '8px', marginTop: '6px', fontFamily: 'monospace' }}
          />
        )}
      </div>

      {!saved && (
        <button
          onClick={submit}
          disabled={saving}
          style={{
            marginTop: '1rem',
            padding: '8px 16px',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1
          }}
        >
          {saving ? '正在保存...' : '提交保存'}
        </button>
      )}

      {saved && (
        <div style={{ marginTop: '1rem', padding: '1rem', background: '#e8f5e9', borderRadius: '8px', color: '#2e7d32' }}>
          ✅ 已保存成功，状态为「未学习」。去首页点「🎤 开始复述」做一次复述，AI 才会评分并更新状态。
        </div>
      )}

      {saved && (
        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '10px' }}>
          <button onClick={() => navigate('/')} style={{ padding: '8px 16px' }}>
            ← 返回首页
          </button>
          <button
            onClick={() => {
              setSaved(false);
              setTitle('');
              setContent('');
            }}
            style={{ padding: '8px 16px' }}
          >
            + 再录一条
          </button>
        </div>
      )}
    </div>
  );
}

export default KnowledgePointFormPage;
