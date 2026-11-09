export const workflowLibraryZh = {
  workflowLibrary: '流程库',
  workflowLibraryHint: '管理可复用流程；每次调用保存独立快照，后续编辑不会改变历史任务。',
  workflowSearch: '搜索流程名称或 ID',
  workflowCreate: '新建流程',
  workflowDuplicate: '复制当前流程',
  workflowRename: '重命名当前流程',
  workflowCreateHint: '从通用测试流程开始，可调整节点、依赖、审核点和 Agent 绑定。',
  workflowCreateName: '新流程名称',
  workflowCreateConfirm: '创建并打开',
  workflowDelete: '删除当前流程',
  workflowDeleteHint: '仅删除流程模板。历史会话、运行快照和产物保留；选择此模板的会话需重新选择流程。',
  workflowDeleteConfirm: '确认删除模板',
  workflowDirtyGuard: '当前流程有未保存修改。请先保存或放弃修改，再切换、新建或删除流程。',
  workflowDiscard: '放弃流程修改',
  workflowLibraryEmpty: '暂无已保存流程，保存当前流程或新建流程即可开始。',
  workflowSelected: '当前流程',
  workflowClose: '关闭流程库',
};
export const workflowLibraryEn: Record<keyof typeof workflowLibraryZh, string> = {
  workflowLibrary: 'Workflow library',
  workflowLibraryHint:
    'Manage reusable workflows. Each invocation keeps a snapshot; later edits never change historical runs.',
  workflowSearch: 'Search workflow names or IDs',
  workflowCreate: 'New workflow',
  workflowDuplicate: 'Duplicate current workflow',
  workflowRename: 'Rename current workflow',
  workflowCreateHint:
    'Start from the general testing workflow and adjust nodes, dependencies, reviews and Agent bindings.',
  workflowCreateName: 'New workflow name',
  workflowCreateConfirm: 'Create and open',
  workflowDelete: 'Delete current workflow',
  workflowDeleteHint:
    'Only the template is deleted. Historical sessions, snapshots and artifacts remain. Sessions using this template must select another workflow.',
  workflowDeleteConfirm: 'Delete template',
  workflowDirtyGuard:
    'This workflow has unsaved changes. Save or discard them before switching, creating or deleting workflows.',
  workflowDiscard: 'Discard workflow changes',
  workflowLibraryEmpty: 'No saved workflows. Save the current workflow or create one to get started.',
  workflowSelected: 'Current workflow',
  workflowClose: 'Close workflow library',
};
