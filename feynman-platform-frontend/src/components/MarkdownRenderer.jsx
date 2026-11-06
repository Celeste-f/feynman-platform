import { useState, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import mermaid from 'mermaid';
import DOMPurify from 'dompurify';

mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' });

// 渲染 mermaid 流程图/状态图/时序图/类图
function MermaidBlock({ code }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    if (!code) return;
    let active = true;
    const id = 'mmd' + Math.random().toString(36).slice(2, 10);
    mermaid
      .render(id, code)
      .then((res) => { if (active) setSvg(res.svg); })
      .catch(() => { if (active) setSvg('<p style="color:red">⚠️ 流程图语法错误，请检查 mermaid 代码</p>'); });
    return () => { active = false; };
  }, [code]);
  return <div dangerouslySetInnerHTML={{ __html: svg }} />;
}

// 自定义代码块渲染：mermaid 特殊处理，其余保持普通代码
function CodeBlock({ node, inline, className, children, ...props }) {
  const match = /language-(\w+)/.exec(className || '');
  const lang = match ? match[1] : '';
  const text = String(children).replace(/\n$/, '');
  if (!inline && lang === 'mermaid') {
    return <MermaidBlock code={text} />;
  }
  if (inline) {
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  }
  return (
    <pre>
      <code className={className} {...props}>
        {children}
      </code>
    </pre>
  );
}

// 过滤危险 HTML 标签（script、iframe、object、embed、event handler 等）
function sanitizeContent(content) {
  if (!content) return '';
  // 移除 <script>...</script> 整块
  let cleaned = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  // 移除 <iframe>、<object>、<embed>、<form> 标签
  cleaned = cleaned.replace(/<(iframe|object|embed|form|applet)\b[^>]*>.*?<\/\1>/gi, '');
  cleaned = cleaned.replace(/<(iframe|object|embed|form|applet)\b[^>]*\/?>/gi, '');
  // 移除所有 onxxx 事件处理器属性（onerror, onclick, onload 等）
  cleaned = cleaned.replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, '');
  // 移除 javascript: 协议
  cleaned = cleaned.replace(/javascript\s*:/gi, '');
  // 移除 src="x" 或 src='' 等无效/可疑的 img 标签
  cleaned = cleaned.replace(/<img\b[^>]*src\s*=\s*["']?[^"'\s>]*["']?[^>]*>/gi, '');
  return cleaned;
}

// 统一富文本渲染入口：支持 Markdown表格 + 流程图/状态图 + $数学公式$
export default function MarkdownRenderer({ content }) {
  const safeContent = useMemo(() => sanitizeContent(content), [content]);

  return (
    <div className="md-render">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{ code: CodeBlock }}
      >
        {safeContent || ''}
      </ReactMarkdown>
    </div>
  );
}
