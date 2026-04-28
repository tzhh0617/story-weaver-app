const statusLabels: Record<string, string> = {
  creating: '创建中',
  naming_title: '生成书名',
  building_world: '构建世界观',
  building_outline: '生成大纲',
  planning_chapters: '规划章节',
  writing: '写作中',
  paused: '已暂停',
  completed: '已完成',
  error: '出错',
};

export function getStatusLabel(status: string) {
  return statusLabels[status] ?? status;
}
