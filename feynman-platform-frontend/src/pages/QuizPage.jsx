import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axios';

const DIFFICULTIES = ['基础', '中等', '困难'];

const TYPE_OPTIONS = [
  { key: 'single-choice', label: '单选题' },
  { key: 'multiple-choice', label: '多选题' },
  { key: 'judge', label: '判断题' },
  { key: 'short-answer', label: '简答题' }
];

const TYPE_LABEL = TYPE_OPTIONS.reduce((acc, t) => ({ ...acc, [t.key]: t.label }), {});

function QuizPage() {
  const { id } = useParams();

  const [knowledgePoint, setKnowledgePoint] = useState(null);
  const [selectedType, setSelectedType] = useState('single-choice');
  const [difficulty, setDifficulty] = useState('基础');
  const [count, setCount] = useState(2);

  const [questionList, setQuestionList] = useState([]);
  const [answersMap, setAnswersMap] = useState({});
  const [resultMap, setResultMap] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 加载知识点详情
  useEffect(() => {
    const fetchKp = async () => {
      try {
        const res = await api.get(`/knowledge-points/${id}`);
        setKnowledgePoint(res.data);
      } catch (err) {
        console.error('获取知识点失败：', err);
        setError('获取知识点失败，请返回首页重试');
      }
    };
    fetchKp();
  }, [id]);

  // 测评结果回写：有错题 → 需复习 + 未掌握；全部答对 → 清除复习 + 已掌握
  const updateReview = async (hasWrong) => {
    const reviewList = hasWrong;
    const status = hasWrong ? 'learned_not_mastered' : 'mastered';
    try {
      await api.put(`/knowledge-points/${id}`, { reviewList, status });
      setKnowledgePoint((prev) => (prev ? { ...prev, reviewList, status } : prev));
    } catch (err) {
      console.error('更新复习/掌握状态失败：', err);
    }
  };

  // 批量出题
  const fetchQuestions = async () => {
    if (!knowledgePoint) return;
    if (!selectedType) {
      alert('请选择题型');
      return;
    }
    const n = Number(count);
    if (!Number.isInteger(n) || n < 1 || n > 6) {
      alert('题目数量范围为 1~6 题');
      return;
    }
    setLoading(true);
    setError('');
    setQuestionList([]);
    setAnswersMap({});
    setResultMap({});
    setSubmitted(false);
    try {
      const res = await api.post('/ai/generate-question', {
        knowledgePointContent: knowledgePoint.content,
        difficulty,
        questionTypes: [selectedType],
        count: n
      });
      setQuestionList(res.data.list || []);
    } catch (err) {
      console.error('AI 出题失败：', err);
      setError('AI 出题失败：' + (err.response?.data?.msg || err.message));
    } finally {
      setLoading(false);
    }
  };

  const setAnswer = (idx, val) => setAnswersMap((prev) => ({ ...prev, [idx]: val }));

  // 多选题勾选切换
  const toggleMulti = (idx, optKey, checked) => {
    const old = answersMap[idx] || [];
    const next = checked ? [...old, optKey] : old.filter((k) => k !== optKey);
    setAnswer(idx, next);
  };

  const arraysEqual = (a, b) =>
    [...a].sort().join(',') === [...b].sort().join(',');

  // 全部提交批改
  const submitAll = async () => {
    if (!questionList.length) return;
    const resMap = {};
    let hasWrong = false;

    for (let i = 0; i < questionList.length; i += 1) {
      const q = questionList[i];
      const userAns = answersMap[i];

      if (q.type === 'single-choice') {
        if (!userAns) {
          resMap[i] = { isCorrect: false, explanation: '未作答' };
          hasWrong = true;
          continue;
        }
        const ok = userAns === q.answer;
        resMap[i] = { isCorrect: ok, explanation: q.explanation, stdAnswer: q.answer };
        if (!ok) hasWrong = true;
      } else if (q.type === 'judge') {
        if (userAns === undefined) {
          resMap[i] = { isCorrect: false, explanation: '未作答' };
          hasWrong = true;
          continue;
        }
        const ok = Boolean(userAns) === Boolean(q.answer);
        resMap[i] = { isCorrect: ok, explanation: q.explanation, stdAnswer: q.answer ? '正确' : '错误' };
        if (!ok) hasWrong = true;
      } else if (q.type === 'multiple-choice') {
        if (!userAns || !userAns.length) {
          resMap[i] = { isCorrect: false, explanation: '未作答' };
          hasWrong = true;
          continue;
        }
        const ok = arraysEqual(userAns, q.answer || []);
        resMap[i] = { isCorrect: ok, explanation: q.explanation, stdAnswer: (q.answer || []).join('、') };
        if (!ok) hasWrong = true;
      } else if (q.type === 'short-answer') {
        if (!userAns || !String(userAns).trim()) {
          resMap[i] = { isCorrect: false, explanation: '未作答', score: 0, referenceAnswer: '' };
          hasWrong = true;
          continue;
        }
        try {
          const gradeRes = await api.post('/ai/grade-answer', {
            question: q.question,
            answer_key_points: q.answer_key_points,
            studentAnswer: userAns
          });
          resMap[i] = gradeRes.data;
          if (!gradeRes.data.isCorrect) hasWrong = true;
        } catch (err) {
          resMap[i] = { isCorrect: false, explanation: 'AI 阅卷失败：' + (err.response?.data?.msg || err.message), score: 0, referenceAnswer: '' };
          hasWrong = true;
        }
      }
    }

    setResultMap(resMap);
    setSubmitted(true);
    await updateReview(hasWrong);
  };

  if (error && !knowledgePoint) {
    return (
      <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
        <p style={{ color: 'red' }}>{error}</p>
        <button onClick={() => window.location.href = '/'} style={{ padding: '8px 16px' }}>← 返回首页</button>
      </div>
    );
  }

  if (!knowledgePoint) {
    return <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>加载知识点信息...</div>;
  }

  const correctCount = Object.values(resultMap).filter((r) => r && r.isCorrect).length;

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <h2>知识点测评：{knowledgePoint.title}</h2>

      {/* 出题设置 */}
      <div style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ marginBottom: '10px' }}>
          <span style={{ marginRight: '10px' }}>选择题型：</span>
          {TYPE_OPTIONS.map((t) => (
            <button
              key={t.key}
              onClick={() => setSelectedType(t.key)}
              disabled={submitted}
              style={{
                marginRight: '8px',
                padding: '6px 14px',
                cursor: 'pointer',
                border: selectedType === t.key ? '2px solid #1976d2' : '1px solid #ccc',
                background: selectedType === t.key ? '#e3f2fd' : '#fff'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: '10px' }}>
          <span style={{ marginRight: '10px' }}>难度：</span>
          {DIFFICULTIES.map((level) => (
            <button
              key={level}
              onClick={() => setDifficulty(level)}
              disabled={submitted}
              style={{
                marginRight: '8px',
                padding: '6px 14px',
                cursor: 'pointer',
                border: difficulty === level ? '2px solid #1976d2' : '1px solid #ccc',
                background: difficulty === level ? '#e3f2fd' : '#fff'
              }}
            >
              {level}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: '10px' }}>
          <span style={{ marginRight: '10px' }}>题目数量（1~6）：</span>
          <input
            type="number"
            min={1}
            max={6}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            disabled={submitted}
            style={{ width: '70px', padding: '6px' }}
          />
        </div>

        <button
          onClick={fetchQuestions}
          disabled={loading || submitted}
          style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          {loading ? '🤖 AI 出题中...' : '生成题目'}
        </button>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* 题目列表 */}
      {questionList.map((q, idx) => {
        const res = resultMap[idx];
        const answer = answersMap[idx];
        return (
          <div key={idx} style={{ border: '1px solid #eee', borderRadius: '8px', padding: '1rem', marginBottom: '1.2rem' }}>
            <h3>
              第{idx + 1}题
              <span style={{ fontSize: '13px', color: '#666', marginLeft: '8px' }}>
                【{TYPE_LABEL[q.type] || q.type}】
              </span>
            </h3>
            <p>{q.question}</p>

            {/* 单选 */}
            {q.type === 'single-choice' && (
              <div>
                {Object.entries(q.options || {}).map(([k, v]) => (
                  <label
                    key={k}
                    style={{ display: 'block', margin: '8px 0', padding: '10px 12px', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    <input
                      type="radio"
                      name={`q-${idx}`}
                      value={k}
                      checked={answer === k}
                      disabled={submitted}
                      onChange={(e) => setAnswer(idx, e.target.value)}
                      style={{ marginRight: '8px' }}
                    />
                    <b>{k}.</b> {v}
                  </label>
                ))}
              </div>
            )}

            {/* 多选 */}
            {q.type === 'multiple-choice' && (
              <div>
                {Object.entries(q.options || {}).map(([k, v]) => (
                  <label
                    key={k}
                    style={{ display: 'block', margin: '8px 0', padding: '10px 12px', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    <input
                      type="checkbox"
                      checked={(answer || []).includes(k)}
                      disabled={submitted}
                      onChange={(e) => toggleMulti(idx, k, e.target.checked)}
                      style={{ marginRight: '8px' }}
                    />
                    <b>{k}.</b> {v}
                  </label>
                ))}
              </div>
            )}

            {/* 判断 */}
            {q.type === 'judge' && (
              <div>
                <label style={{ marginRight: '16px', cursor: 'pointer' }}>
                  <input type="radio" name={`j-${idx}`} checked={answer === true} disabled={submitted} onChange={() => setAnswer(idx, true)} style={{ marginRight: '4px' }} />
                  正确
                </label>
                <label style={{ cursor: 'pointer' }}>
                  <input type="radio" name={`j-${idx}`} checked={answer === false} disabled={submitted} onChange={() => setAnswer(idx, false)} style={{ marginRight: '4px' }} />
                  错误
                </label>
              </div>
            )}

            {/* 简答 */}
            {q.type === 'short-answer' && (
              <textarea
                value={answer || ''}
                disabled={submitted}
                onChange={(e) => setAnswer(idx, e.target.value)}
                placeholder="写下你的答案……"
                rows={5}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }}
              />
            )}

            {/* 批改结果 */}
            {submitted && res && (
              <div style={{ marginTop: '10px', padding: '10px', background: '#f8f9fa', borderRadius: '6px' }}>
                <p style={{ color: res.isCorrect ? '#28a745' : '#dc3545', fontWeight: 600, margin: '0 0 6px' }}>
                  {res.isCorrect ? '✅ 正确' : '❌ 错误'}
                  {res.score !== undefined && <span style={{ marginLeft: '8px' }}>得分：{res.score} / 100</span>}
                </p>
                {res.stdAnswer && <p style={{ margin: '4px 0' }}><strong>标准答案：</strong>{res.stdAnswer}</p>}
                <p style={{ margin: '4px 0' }}><strong>解析：</strong>{res.explanation}</p>
                {res.referenceAnswer && (
                  <div style={{ background: '#f5f7fa', padding: '8px 10px', borderRadius: '4px', marginTop: '6px' }}>
                    <strong>📖 参考答案：</strong>
                    <p style={{ margin: '4px 0 0', lineHeight: 1.7 }}>{res.referenceAnswer}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* 底部操作 */}
      {questionList.length > 0 && !submitted && (
        <div>
          <button
            onClick={submitAll}
            style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            全部提交批改
          </button>
          <button onClick={() => window.location.href = '/'} style={{ marginLeft: '10px', padding: '8px 16px', cursor: 'pointer' }}>
            ← 返回首页
          </button>
        </div>
      )}

      {submitted && (
        <div style={{ marginTop: '1rem' }}>
          <p style={{ fontWeight: 600 }}>
            本次答对 {correctCount} / {questionList.length} 题
          </p>
          <p style={{ color: correctCount === questionList.length ? '#28a745' : '#ed6c02' }}>
            {correctCount === questionList.length
              ? '🎉 全部作答正确，已清除复习标记。'
              : '存在错题，该知识点已加入复习列表，建议巩固后再来测评。'}
          </p>
          <button onClick={fetchQuestions} style={{ marginRight: '10px', padding: '8px 16px', cursor: 'pointer' }}>
            🔁 重新出题
          </button>
          <button onClick={() => window.location.href = '/'} style={{ padding: '8px 16px', cursor: 'pointer' }}>
            ← 返回首页
          </button>
        </div>
      )}
    </div>
  );
}

export default QuizPage;
