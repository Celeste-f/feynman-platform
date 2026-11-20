// src/pages/ThreeJSPage.jsx
// 第十三次课：3D可视化入门与Three.js
// 核心三要素：场景 Scene / 相机 Camera / 渲染器 Renderer
// 功能：①旋转立方体（知识太阳）②知识图谱数据映射为3D星球+星际航线 ③OrbitControls 交互 ④Raycaster 悬停高亮（挑战目标）
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import apiClient from '../api/axios';

// 星球按掌握状态着色（与2D知识图谱一致）：已掌握绿 / 需复习橙 / 其他蓝
function statusColor(node) {
  if (node.status === 'mastered') return 0x2e7d32;
  if (node.reviewList) return 0xed6c02;
  return 0x5b8ff9;
}

function ThreeJSPage() {
  const mountRef = useRef(null);
  const [graphData, setGraphData] = useState(null); // null=加载中
  const [hoverTitle, setHoverTitle] = useState('');

  // 1. 获取图谱数据（复用第十二次课接口）
  useEffect(() => {
    apiClient
      .get('/graph/knowledge-map')
      .then((res) => setGraphData(res.data))
      .catch((err) => {
        console.error('获取图谱数据失败：', err);
        setGraphData({ nodes: [], links: [] });
      });
  }, []);

  // 2. Three.js 主场景，依赖图谱数据
  useEffect(() => {
    if (!graphData) return;
    const currentMount = mountRef.current;
    if (!currentMount) return;

    // ---------- 场景 ----------
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1522);

    // ---------- 相机（透视相机：近大远小） ----------
    const camera = new THREE.PerspectiveCamera(
      75,
      currentMount.clientWidth / currentMount.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 6, 22);

    // ---------- 渲染器 ----------
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    currentMount.appendChild(renderer.domElement);

    // ---------- 光照（MeshStandardMaterial 需要光才看得见） ----------
    scene.add(new THREE.AmbientLight(0xffffff, 0.5)); // 环境光：基础照明
    const pointLight = new THREE.PointLight(0xffffff, 1.2); // 点光源：灯泡
    pointLight.position.set(8, 12, 8);
    scene.add(pointLight);

    // ---------- 旋转立方体：知识太阳（课程第二部分里程碑） ----------
    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 1.6, 1.6),
      new THREE.MeshStandardMaterial({ color: 0x45e0b8, emissive: 0x0a3d2e })
    );
    scene.add(cube);

    // ---------- 数据驱动：知识点 -> 星球，引用关系 -> 航线 ----------
    const planets = []; // 所有星球 Mesh，供 Raycaster 检测
    const nodeObjects = new Map(); // id -> Mesh
    const linesByNode = new Map(); // id -> 与之相连的线列表
    const sphereGeometry = new THREE.SphereGeometry(1, 32, 32); // 单位球，用 scale 控制大小

    graphData.nodes.forEach((node) => {
      const mat = new THREE.MeshStandardMaterial({ color: statusColor(node) });
      const sphere = new THREE.Mesh(sphereGeometry, mat);
      const r = 0.35 + Math.min(node.symbolSize || 20, 50) / 70; // 内容越长星球越大
      sphere.scale.setScalar(r);
      sphere.position.set(
        (Math.random() - 0.5) * 18,
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 18
      );
      sphere.userData = { id: node.id, title: node.name, baseColor: statusColor(node) };
      scene.add(sphere);
      planets.push(sphere);
      nodeObjects.set(node.id, sphere);
      linesByNode.set(node.id, []);
    });

    graphData.links.forEach((edge) => {
      const s = nodeObjects.get(edge.source);
      const t = nodeObjects.get(edge.target);
      if (!s || !t) return;
      const lineMat = new THREE.LineBasicMaterial({ color: 0x8899bb, transparent: true, opacity: 0.45 });
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([s.position, t.position]),
        lineMat
      );
      scene.add(line);
      // 记录两端节点，悬停时高亮相关航线
      linesByNode.get(edge.source)?.push({ line, other: t });
      linesByNode.get(edge.target)?.push({ line, other: s });
    });

    // ---------- 轨道控制器：左键旋转 / 滚轮缩放 / 右键平移 ----------
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 8; // 限制缩放范围：太近会穿进物体里，太远星球会变成看不见的像素点
    controls.maxDistance = 80;

    // ---------- Raycaster 悬停高亮（挑战目标） ----------
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(-10, -10); // 初始移出场景外
    let hovered = null;

    const onMouseMove = (event) => {
      // NDC 归一化设备坐标：以画布矩形为基准，-1 ~ +1
      const rect = currentMount.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };
    currentMount.addEventListener('mousemove', onMouseMove);

    const setHover = (mesh) => {
      if (hovered === mesh) return;
      // 恢复上一个悬停星球与其航线
      if (hovered) {
        hovered.material.emissive.setHex(0x000000);
        linesByNode.get(hovered.userData.id)?.forEach(({ line }) => {
          line.material.color.setHex(0x8899bb);
          line.material.opacity = 0.45;
        });
      }
      hovered = mesh;
      if (hovered) {
        hovered.material.emissive.setHex(0xff2244); // 星球发红高亮
        linesByNode.get(hovered.userData.id)?.forEach(({ line }) => {
          line.material.color.setHex(0xff2244); // 相连航线同步高亮
          line.material.opacity = 0.95;
        });
        setHoverTitle(hovered.userData.title);
      } else {
        setHoverTitle('');
      }
    };

    // ---------- 动画循环 ----------
    let rafId = 0;
    const animate = () => {
      rafId = requestAnimationFrame(animate);

      cube.rotation.x += 0.008;
      cube.rotation.y += 0.008;

      // 悬停检测：从相机沿鼠标方向发射光线
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(planets);
      setHover(intersects.length > 0 ? intersects[0].object : null);

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
    // 关键：必须 forceContextLoss 释放 WebGL 上下文。
    // StrictMode 下每次进页面会创建两个上下文，只 dispose 不释放的话，
    // 来回切页超过浏览器上限（约16个）后旧 canvas 会被强制变黑。
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      currentMount.removeEventListener('mousemove', onMouseMove);
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

  return (
    <div style={{ padding: '1.5rem 2rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <h1 style={{ margin: 0 }}>3D视界 · 基础场景（知识太阳 + 星球）</h1>
        <span style={{ color: '#8a93a6', fontSize: '13px' }}>
          中央青色旋转立方体是"知识太阳" ｜ 星球随机分布 ｜ 悬停星球高亮其航线
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: '14px', fontSize: '13px', color: '#3a4252' }}>
          <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#2e7d32', marginRight: 4 }}></i>已掌握</span>
          <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#ed6c02', marginRight: 4 }}></i>需复习</span>
          <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#5b8ff9', marginRight: 4 }}></i>其他</span>
        </span>
      </div>

      {graphData === null ? (
        <p>正在装载3D基础场景...</p>
      ) : (
        <div
          ref={mountRef}
          style={{
            width: '100%',
            height: '72vh',
            borderRadius: '12px',
            overflow: 'hidden',
            position: 'relative',
            background: '#0d1522'
          }}
        >
          {hoverTitle && (
            <div
              style={{
                position: 'absolute',
                top: 12,
                left: 12,
                background: 'rgba(13,21,34,0.85)',
                color: '#fff',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '14px',
                pointerEvents: 'none',
                zIndex: 5
              }}
            >
              🪐 {hoverTitle}
            </div>
          )}
        </div>
      )}
      {graphData && graphData.nodes.length === 0 && (
        <p style={{ color: '#8a93a6' }}>还没有知识点星球，中央只有"知识太阳"立方体。先去创建几个知识点吧。</p>
      )}
    </div>
  );
}

export default ThreeJSPage;
