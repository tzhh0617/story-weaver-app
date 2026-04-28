const statusLabels: Record<string, string> = {
  creating: '创建中',
  building_world: '构建世界观',
  building_outline: '生成大纲',
  writing: '写作中',
  paused: '已暂停',
  completed: '已完成',
  error: '出错',
};

export function getStatusLabel(status: string) {
  return statusLabels[status] ?? status;
}
