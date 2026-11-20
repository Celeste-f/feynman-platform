// src/pages/KnowledgeUniversePage.jsx
// 第十四次课：Three.js进阶 —— 数据驱动的3D知识宇宙
// 相比上节课的随机分布，这里用 d3-force-3d 力导向布局让星球自动组织成星系：
//   斥力(电荷) + 向心力(聚拢) + 连线引力(有关联的知识点被拉近)
// 交互：Raycaster 鼠标点击拾取星球 -> 高亮 + 右上角信息浮层（挑战作业，替代 alert）
// 连接线（终极挑战）：复用 /graph/knowledge-map 的"标题引用"关系生成 links
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as d3 from 'd3-force-3d';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/axios';

const STATUS_TEXT = {
  not_started: '未学习',
  learned_not_mastered: '已学习但未掌握',
  mastered: '已学习且已掌握'
};

function statusColor(node) {
  if (node.status === 'mastered') return 0x2e7d32;
  if (node.reviewList) return 0xed6c02;
  return 0x5b8ff9;
}

// 内容摘要（富文本先剥掉标签）
function plainExcerpt(html, n = 200) {
  const text = String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > n ? text.slice(0, n) + '…' : text;
}

function KnowledgeUniversePage() {
  const mountRef = useRef(null);
  const [graphData, setGraphData] = useState(null); // { nodes, links }
  const [selected, setSelected] = useState(null); // 信息浮层数据
  const navigate = useNavigate();

  useEffect(() => {
    apiClient
      .get('/graph/knowledge-map')
      .then((res) => setGraphData(res.data))
      .catch((err) => {
        console.error('获取图谱数据失败：', err);
        setGraphData({ nodes: [], links: [] });
      });
  }, []);

  useEffect(() => {
    if (!graphData || graphData.nodes.length === 0) return;
    const currentMount = mountRef.current;
    if (!currentMount) return;

    // ---------- 三要素：场景 / 相机 / 渲染器 ----------
    // 与"3D视界"（深蓝教学场景）区分：这里用深紫太空 + 满天星斗
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x120b1e);

    // 星空背景：随机分布的发光点，营造宇宙纵深
    const starCount = 800;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 1600;
      starPositions[i * 3 + 1] = (Math.random() - 0.5) * 1600;
      starPositions[i * 3 + 2] = (Math.random() - 0.5) * 1600;
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starField = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({ color: 0x99aadd, size: 1.6, sizeAttenuation: true, transparent: true, opacity: 0.8 })
    );
    scene.add(starField);

    const camera = new THREE.PerspectiveCamera(
      75,
      currentMount.clientWidth / currentMount.clientHeight,
      0.1,
      2000
    );
    camera.position.set(0, 30, 160);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    currentMount.appendChild(renderer.domElement);

    // ---------- 光照 ----------
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const pointLight = new THREE.PointLight(0xffffff, 1.5);
    pointLight.position.set(60, 80, 60);
    scene.add(pointLight);

    // ---------- 数据驱动创建星球 ----------
    const sphereGeometry = new THREE.SphereGeometry(1, 32, 32);
    const nodeMeshes = graphData.nodes.map((node) => {
      const mesh = new THREE.Mesh(
        sphereGeometry,
        new THREE.MeshStandardMaterial({ color: statusColor(node) })
      );
      // 星球大小随内容长度变化
      const size = 2.5 + Math.min((node.symbolSize || 20) / 8, 6);
      mesh.scale.setScalar(size);
      mesh.position.set(
        (Math.random() - 0.5) * 160,
        (Math.random() - 0.5) * 160,
        (Math.random() - 0.5) * 160
      );
      mesh.userData = { ...node };
      scene.add(mesh);
      return mesh;
    });
    const meshById = new Map(nodeMeshes.map((m) => [m.userData.id, m]));

    // ---------- 力导向模拟（3D） ----------
    const forceNodes = graphData.nodes.map((n) => ({ id: n.id }));
    const forceLinks = graphData.links.map((l) => ({ source: l.source, target: l.target }));

    const simulation = d3
      .forceSimulation(forceNodes, 3) // 3 = 三维空间
      .force('charge', d3.forceManyBody().strength(-120)) // 节点间斥力
      .force('center', d3.forceCenter(0, 0, 0)) // 质心回到场景中心
      // forceCenter 只平移质心、不限制个体距离，光靠斥力星系会越飞越散；
      // 加三个弱向心力把整体"弹簧"在中心附近，保证始终在视野内
      .force('fx', d3.forceX(0).strength(0.03))
      .force('fy', d3.forceY(0).strength(0.03))
      .force('fz', d3.forceZ(0).strength(0.03))
      .force('link', d3.forceLink(forceLinks).id((d) => d.id).distance(60)); // 关联引力

    // ---------- 连接线（每帧随模拟更新端点） ----------
    const lineMat = new THREE.LineBasicMaterial({ color: 0xb48ae8, transparent: true, opacity: 0.55 });
    const lineObjs = forceLinks.map((l) => {
      const line = new THREE.Line(new THREE.BufferGeometry(), lineMat);
      scene.add(line);
      return { line, l };
    });

    // ---------- 轨道控制器 ----------
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 40; // 限制缩放，避免穿进星系里或缩到看不见
    controls.maxDistance = 600;

    // ---------- Raycaster 鼠标拾取（区分点击与拖拽） ----------
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downPos = null;
    let selectedMesh = null;

    const pickAt = (event) => {
      const rect = currentMount.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObjects(nodeMeshes);
      return intersects.length > 0 ? intersects[0].object : null;
    };

    const onPointerDown = (e) => {
      downPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e) => {
      // 位移超过 5px 视为拖拽视角，不触发拾取
      if (!downPos || Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 5) return;
      const mesh = pickAt(e);

      if (selectedMesh) {
        selectedMesh.material.emissive.setHex(0x000000);
        selectedMesh = null;
      }

      if (mesh) {
        selectedMesh = mesh;
        mesh.material.emissive.setHex(0xff2244); // 高亮选中星球
        const d = mesh.userData;
        setSelected({
          id: d.id,
          title: d.name,
          type: d.type || '笔记',
          status: d.status || 'not_started',
          reviewList: d.reviewList,
          excerpt: d.value || plainExcerpt('')
        });
      } else {
        setSelected(null); // 点空白取消选中
      }
    };

    currentMount.addEventListener('pointerdown', onPointerDown);
    currentMount.addEventListener('pointerup', onPointerUp);

    // ---------- 动画循环：每帧推进模拟并同步 Three.js ----------
    let rafId = 0;
    const animate = () => {
      rafId = requestAnimationFrame(animate);

      simulation.tick();

      // 把力导向计算出的坐标写回星球
      forceNodes.forEach((d, i) => {
        nodeMeshes[i].position.set(d.x, d.y, d.z);
      });

      // 更新每条连线的端点
      lineObjs.forEach(({ line, l }) => {
        const s = meshById.get(typeof l.source === 'object' ? l.source.id : l.source);
        const t = meshById.get(typeof l.target === 'object' ? l.target.id : l.target);
        if (s && t) line.geometry.setFromPoints([s.position, t.position]);
      });

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // ---------- 窗口自适应 ----------
    const handleResize = () => {
      camera.aspect = currentMount.clientWidth / currentMount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // ---------- 卸载清理 ----------
    // 同 ThreeJSPage：必须 forceContextLoss 释放 WebGL 上下文，
    // 否则 StrictMode 双挂载 + 反复切页会耗尽浏览器上下文，旧画面整体变黑
    return () => {
      cancelAnimationFrame(rafId);
      simulation.stop();
      window.removeEventListener('resize', handleResize);
      currentMount.removeEventListener('pointerdown', onPointerDown);
      currentMount.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach((m) => m.dispose());
      });
      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement.parentNode === currentMount) {
        currentMount.removeChild(renderer.domElement);
      }
    };
  }, [graphData]);

  const empty = graphData && graphData.nodes.length === 0;

  return (
    <div style={{ padding: '1.5rem 2rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <h1 style={{ margin: 0 }}>知识宇宙 · 3D力导向星系</h1>
        <span style={{ color: '#8a93a6', fontSize: '13px' }}>
          d3-force-3d 自动布局 ｜ 点击星球查看信息 ｜ 拖拽旋转、滚轮缩放
        </span>
      </div>

      {graphData === null ? (
        <p>正在推演星系演化...</p>
      ) : (
        <div
          ref={mountRef}
          style={{
            width: '100%',
            height: '72vh',
            borderRadius: '12px',
            overflow: 'hidden',
            position: 'relative',
            background: '#120b1e'
          }}
        >
          {/* 挑战作业：信息浮层替代 alert */}
          {selected && (
            <div
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                width: '320px',
                maxWidth: '80%',
                background: 'rgba(16,24,38,0.92)',
                border: '1px solid #2c3a55',
                borderRadius: '12px',
                padding: '16px 18px',
                color: '#e8edf5',
                zIndex: 5
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <b style={{ fontSize: '15px' }}>🪐 {selected.title}</b>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: '12px',
                    color: selected.status === 'mastered' ? '#7ddc8a' : selected.reviewList ? '#f5a35c' : '#8fb4f5',
                    border: '1px solid currentColor',
                    borderRadius: '999px',
                    padding: '1px 8px'
                  }}
                >
                  {STATUS_TEXT[selected.status] || '未学习'}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#8a97ad', marginBottom: '8px' }}>类型：{selected.type}</div>
              <div style={{ fontSize: '13px', lineHeight: 1.7, color: '#c6d0e0', maxHeight: '140px', overflowY: 'auto' }}>
                {selected.excerpt || '（内容为空）'}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                <button onClick={() => navigate(`/feynman/${selected.id}`)} style={overlayBtn('#45e0b8', '#0c1218')}>🎤 复述</button>
                <button onClick={() => navigate(`/quiz/${selected.id}`)} style={overlayBtn('#6ea8fe', '#0c1218')}>📝 测评</button>
                <button onClick={() => navigate(`/knowledge/edit/${selected.id}`)} style={overlayBtn('transparent', '#c6d0e0', '#2c3a55')}>编辑</button>
                <button onClick={() => setSelected(null)} style={overlayBtn('transparent', '#c6d0e0', '#2c3a55')}>关闭</button>
              </div>
            </div>
          )}
        </div>
      )}
      {empty && <p style={{ color: '#8a93a6' }}>还没有知识点，先去创建几个，再来点亮星系。</p>}
    </div>
  );
}

// 浮层按钮样式
function overlayBtn(bg, color, border) {
  return {
    background: bg,
    color,
    border: border ? `1px solid ${border}` : 'none',
    borderRadius: '8px',
    padding: '6px 12px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer'
  };
}

export default KnowledgeUniversePage;
