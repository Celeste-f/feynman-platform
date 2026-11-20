// src/pages/GraphPage.jsx
// 第十二次课：知识图谱可视化（ECharts 力导向图）
// 节点 = 知识点，边 = "A 的内容里提到了 B 的标题"（引用关系）
import { useEffect, useState } from 'react';
import apiClient from '../api/axios';
import ReactECharts from 'echarts-for-react';
import { useNavigate } from 'react-router-dom';

// 挑战作业：按掌握状态着色 —— 已掌握绿色 / 需复习橙色 / 其他蓝色
function nodeColor(node) {
  if (node.status === 'mastered') return '#2e7d32';
  if (node.reviewList) return '#ed6c02';
  return '#5b8ff9';
}

const STATUS_TEXT = {
  not_started: '未学习',
  learned_not_mastered: '已学习但未掌握',
  mastered: '已学习且已掌握'
};

function GraphPage() {
  const [option, setOption] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [count, setCount] = useState({ nodes: 0, links: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await apiClient.get('/graph/knowledge-map');
        const graphData = response.data;
        setCount({ nodes: graphData.nodes.length, links: graphData.links.length });

        if (graphData.nodes.length === 0) {
          setLoading(false);
          return;
        }

        const chartOption = {
          tooltip: {
            // 悬停小卡片：标题 + 类型 + 创建时间 + 状态 + 内容摘要
            formatter: (params) => {
              if (params.dataType === 'node') {
                const d = params.data;
                const created = d.createdAt ? new Date(d.createdAt).toLocaleString() : '-';
                return [
                  `<b>${d.name}</b>`,
                  `类型：${d.type || '笔记'} ｜ 状态：${STATUS_TEXT[d.status] || '未学习'}`,
                  `创建时间：${created}`,
                  `内容摘要：${d.value || '(空)'}`
                ].join('<br/>');
              }
              return '引用关系';
            }
          },
          series: [
            {
              type: 'graph',
              layout: 'force',
              data: graphData.nodes.map((n) => ({
                ...n,
                itemStyle: { color: nodeColor(n), borderColor: '#fff', borderWidth: 1 },
                label: { color: '#1f2430' }
              })),
              links: graphData.links,
              roam: true, // 鼠标滚轮缩放 + 拖拽画布平移
              draggable: true, // 拖拽节点调整布局
              categories: [],
              label: {
                show: true,
                position: 'right',
                formatter: '{b}',
                fontSize: 12
              },
              lineStyle: {
                color: '#aab4c6',
                curveness: 0.15,
                width: 1.5
              },
              force: {
                repulsion: 260, // 节点斥力
                edgeLength: [80, 160],
                gravity: 0.08
              },
              emphasis: {
                // 悬停高亮：只聚焦当前节点及其邻接边（课程要求的悬停高亮交互）
                focus: 'adjacency',
                lineStyle: { width: 6, color: '#2563eb' },
                itemStyle: { shadowBlur: 12, shadowColor: 'rgba(37,99,235,0.4)' }
              }
            }
          ]
        };
        setOption(chartOption);
        setLoading(false);
      } catch (err) {
        console.error('获取图谱数据失败', err);
        setError('获取图谱数据失败，请确认已登录且后端服务正常');
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // 点击节点 → 跳转到该知识点的编辑页
  const onChartClick = (params) => {
    if (params.componentType === 'series' && params.dataType === 'node') {
      navigate(`/knowledge/edit/${params.data.id}`);
    }
  };

  const wrapperStyle = { padding: '1.5rem 2rem' };

  if (loading) {
    return <div style={wrapperStyle}>正在生成知识图谱...</div>;
  }
  if (error) {
    return <div style={wrapperStyle}><p style={{ color: 'red' }}>{error}</p></div>;
  }
  if (!option) {
    return (
      <div style={wrapperStyle}>
        <h1>知识图谱</h1>
        <p style={{ color: '#8a93a6' }}>还没有知识点，先去创建几个吧。知识点之间若存在标题引用，会自动连成关系网络。</p>
      </div>
    );
  }

  return (
    <div style={wrapperStyle}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>知识图谱</h1>
        <span style={{ color: '#8a93a6', fontSize: '13px' }}>
          共 {count.nodes} 个节点、{count.links} 条引用关系 ｜ 悬停高亮邻居，拖拽调整布局，点击节点进入编辑
        </span>
        {/* 图例：节点颜色含义 */}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: '14px', fontSize: '13px', color: '#3a4252' }}>
          <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#2e7d32', marginRight: 4 }}></i>已掌握</span>
          <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#ed6c02', marginRight: 4 }}></i>需复习</span>
          <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#5b8ff9', marginRight: 4 }}></i>其他</span>
        </span>
      </div>
      <ReactECharts
        option={option}
        style={{ height: '640px', width: '100%', marginTop: '12px' }}
        notMerge={true}
        onEvents={{ click: onChartClick }}
      />
    </div>
  );
}

export default GraphPage;
