const statusLabels: Record<string, string> = {
  creating: '创建中',
  naming_title: '生成书名',
  building_world: '构建世界观',
  building_outline: '生成大纲',
  planning_chapters: '规划章节',
  writing: '写作中',
  auditing_chapter: '章节审校',
  revising_chapter: '章节修订',
  extracting_continuity: '提取连续性',
  extracting_state: '提取叙事状态',
  checkpoint_review: '叙事复盘',
  paused: '已暂停',
  completed: '已完成',
  error: '出错',
};

export function getStatusLabel(status: string) {
  return statusLabels[status] ?? status;
}
