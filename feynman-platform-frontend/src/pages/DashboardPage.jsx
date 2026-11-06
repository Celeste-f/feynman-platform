import { useState, useEffect } from 'react';
import api from '../api/axios';
import { useNavigate } from 'react-router-dom';
import MarkdownRenderer from '../components/MarkdownRenderer';

const TYPE_LIST = ['笔记', '公式', '表格', '流程图', '状态图'];
const TYPE_COLORS = {
  '笔记': '#888',
  '公式': '#1976d2',
  '表格': '#2e7d32',
  '流程图': '#ed6c02',
  '状态图': '#9c27b0'
};

export default function DashboardPage() {
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState('全部');
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState({ _id: '', title: '', content: '', type: '笔记' });
  const navigate = useNavigate();

  const fetchList = async () => {
    try {
      const res = await api.get('/knowledge-points');
      setList(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  // 按类型筛选
  const shownList = filter === '全部'
    ? list
    : list.filter((it) => (it.type || '笔记') === filter);

  const handleDelete = async (id) => {
    if (!window.confirm('确定删除？')) return;
    try {
      await api.delete(`/knowledge-points/${id}`);
      fetchList();
    } catch (e) {
      alert('删除失败');
    }
  };

  const openEdit = (item) => {
    setEditItem({ _id: item._id, title: item.title, content: item.content, type: item.type || '笔记' });
    setEditOpen(true);
  };

  const submitEdit = async () => {
    if (!editItem.title || !editItem.content) {
      alert('标题和内容不能为空');
      return;
    }
    try {
      await api.put(`/knowledge-points/${editItem._id}`, {
        title: editItem.title,
        content: editItem.content,
        type: editItem.type
      });
      setEditOpen(false);
      fetchList();
    } catch (e) {
      alert('修改失败');
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>控制台 Dashboard</h1>
      <p>欢迎使用 Feynman 平台</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        <button
          onClick={() => navigate(`/knowledge/new${filter !== '全部' ? `?type=${filter}` : ''}`)}
          style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}
        >
          + 新建知识点
        </button>
        <span style={{ color: '#888' }}>按类型筛选：</span>
        {['全部', ...TYPE_LIST].map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            style={{
              padding: '0.3rem 0.7rem',
              cursor: 'pointer',
              border: filter === t ? '2px solid #1976d2' : '1px solid #ccc',
              background: filter === t ? '#e3f2fd' : '#fff'
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <h2>知识点列表（{shownList.length}）</h2>
      <div style={{ marginTop: '1rem' }}>
        {shownList.length === 0 && <p style={{ color: '#888' }}>该类型暂无知识点，点击右上角新建</p>}
        {shownList.map((item) => (
          <div
            key={item._id}
            style={{
              border: '1px solid #ccc',
              padding: '1rem',
              marginBottom: '1rem',
              borderRadius: '6px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <h3 style={{ margin: 0 }}>{item.title}</h3>
              <span
                style={{
                  background: TYPE_COLORS[item.type || '笔记'],
                  color: '#fff',
                  fontSize: '12px',
                  padding: '2px 8px',
                  borderRadius: '10px'
                }}
              >
                {item.type || '笔记'}
              </span>
            </div>
            <MarkdownRenderer content={item.content} />
            <div style={{ marginTop: '10px' }}>
              <button onClick={() => openEdit(item)} style={{ marginRight: '8px' }}>
                编辑
              </button>
              <button onClick={() => handleDelete(item._id)} style={{ color: 'red' }}>
                删除
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 编辑弹窗 */}
      {editOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            style={{
              background: 'white',
              padding: '2rem',
              borderRadius: '8px',
              width: '400px'
            }}
          >
            <h3>编辑知识点</h3>
            <div style={{ marginBottom: '1rem' }}>
              <label>类型</label>
              <select
                value={editItem.type}
                onChange={(e) => setEditItem({ ...editItem, type: e.target.value })}
                style={{ display: 'block', width: '100%', padding: '0.4rem' }}
              >
                {TYPE_LIST.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label>标题</label>
              <input
                type="text"
                value={editItem.title}
                onChange={(e) => setEditItem({ ...editItem, title: e.target.value })}
                style={{ width: '100%', marginBottom: '1rem', padding: '0.4rem' }}
              />
            </div>
            <div>
              <label>内容</label>
              <textarea
                value={editItem.content}
                onChange={(e) => setEditItem({ ...editItem, content: e.target.value })}
                rows={4}
                style={{ width: '100%', marginBottom: '1rem', padding: '0.4rem' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={submitEdit}>保存修改</button>
              <button onClick={() => setEditOpen(false)}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
