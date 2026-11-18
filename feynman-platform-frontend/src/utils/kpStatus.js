// 知识点掌握状态（三态）统一配置
// 与后端 models/KnowledgePoint.js 的 status 枚举保持一致
export const KP_STATUS = {
  not_started: { label: '未学习', color: '#9e9e9e', bg: '#f5f5f5' },
  learned_not_mastered: { label: '已学习但未掌握', color: '#ed6c02', bg: '#fff4e5' },
  mastered: { label: '已学习且已掌握', color: '#2e7d32', bg: '#e8f5e9' }
};

export function getStatusInfo(status) {
  return KP_STATUS[status] || KP_STATUS.not_started;
}
