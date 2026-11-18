import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

// 富文本编辑器（Quill 内核，带完整图标工具栏）
// 输出 HTML 字符串，直接存进知识点 content 字段
const MODULES = {
  toolbar: [
    ['bold', 'italic', 'underline', 'strike'],                       // B I U S
    [{ header: [1, 2, 3, false] }],                                  // 标题级别
    [{ color: [] }, { background: [] }],                             // 字体色 / 背景色
    ['link', 'image', 'video'],                                      // 链接 / 图片 / 视频
    ['blockquote', 'code-block'],                                    // 引用 / 代码块
    [{ list: 'ordered' }, { list: 'bullet' }],                       // 有序 / 无序列表
    [{ indent: '-1' }, { indent: '+1' }],                            // 缩进
    [{ align: [] }],                                                 // 对齐
    ['clean']                                                        // 清除格式
  ]
};

const FORMATS = [
  'bold', 'italic', 'underline', 'strike',
  'header', 'color', 'background',
  'link', 'image', 'video',
  'blockquote', 'code-block',
  'list', 'indent', 'align'
];

export default function RichTextEditor({ value, onChange, disabled = false }) {
  return (
    <div style={{ background: disabled ? '#f5f5f5' : '#fff' }}>
      <ReactQuill
        theme="snow"
        value={value || ''}
        onChange={onChange}
        readOnly={disabled}
        modules={MODULES}
        formats={FORMATS}
        placeholder="在这里输入内容，支持加粗、标题、列表、颜色、链接、图片、表格代码块…"
        style={{ minHeight: '200px' }}
      />
    </div>
  );
}
