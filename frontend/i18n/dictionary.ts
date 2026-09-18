/**
 * Prisma Studio 界面汉化字典(英文 → 简体中文)。
 *
 * 字典来源:对 @prisma/studio-core@0.33.0 打包产物的字符串提取 + 实际运行界面的
 * DOM 文本收割(主表格视图、筛选器、Insert row 对话框、SQL 编辑器、Console、
 * 架构可视化视图等)。
 *
 * 该字典同时用于两处:
 * 1. 构建期:对打包产物 studio.js 中的完整字符串字面量做替换(scripts/build.ts);
 * 2. 运行时:DOM 文本节点兜底翻译(frontend/i18n/runtime.ts)。
 *
 * 安全规则:
 * - 只翻译「显示文案」。实测 BFF/URL 协议使用符号或小写标记(如 operator "="、
 *   视图名 "sql"/"console"),与显示词不同,因此下列英文键不跨协议边界;
 * - 但仍避免翻译 SQL 关键字形态的字符串(如 "IS"、"IS NOT"、"SELECT");
 * - 键为界面上的完整英文文本(区分大小写,含标点与省略号);
 * - 含数字等动态拼接的文本用 PATTERNS 正则规则处理(仅运行时)。
 */

export const TRANSLATIONS: Record<string, string> = {
  // —— 侧边栏与导航 ——
  'Visualizer': '可视化',
  'Console': '控制台',
  'Tables': '数据表',
  'Models': '模型',
  'All models': '所有模型',
  'Show all models': '显示所有模型',
  'Select schema': '选择架构',
  'Schema': '架构',
  'Command palette': '命令面板',
  'Search commands': '搜索命令',
  'Close navigation': '收起导航栏',
  'Resize navigation': '调整导航栏宽度',
  'Notifications': '通知',

  // —— 工具栏 ——
  'Add filter': '添加筛选',
  'Apply filter': '应用筛选',
  'Remove filter': '移除筛选',
  'Grouped filter': '分组筛选',
  'Remove grouped filter': '移除分组筛选',
  'Insert row': '插入行',
  'Refresh table': '刷新数据表',
  'Refresh tables': '刷新数据表',
  'Refresh streams': '刷新数据流',
  'Search tables': '搜索数据表',
  'Search tables...': '搜索数据表…',
  'Search rows': '搜索行',
  'Search streams': '搜索数据流',
  'Global search': '全局搜索',
  'Close search': '关闭搜索',
  'Text Search': '文本搜索',

  // —— 数据表格 ——
  'Table grid': '数据表格',
  'Row selection spacer': '行选择列',
  'No tables found': '未找到数据表',
  'Pin column': '固定列',
  'Unpin column': '取消固定列',
  'Resize column': '调整列宽',
  'Resize details panel': '调整详情面板宽度',
  'Clear sorting': '清除排序',
  'Sort ascending': '升序排序',
  'Sort descending': '降序排序',
  'No data': '暂无数据',
  'No results': '无结果',
  'No records found': '未找到记录',
  'Nothing found': '没有找到任何内容',
  'Pagination': '分页',
  'Page number': '页码',
  'Go to first page': '跳到第一页',
  'Go to previous page': '上一页',
  'Go to next page': '下一页',
  'Go to last page': '跳到最后一页',
  'Rows per page': '每页行数',
  'rows per page': '行/页',
  // 分页计数「1 of 2」中的独立分隔节点(数据单元格已被 SKIP_SELECTOR 排除)
  'of': '/',
  'Infinite scroll': '无限滚动',
  'infinite scroll': '无限滚动',

  // —— 筛选器 ——
  'Select column to filter': '选择要筛选的列',
  'Select column to filter...': '选择要筛选的列…',
  'Select operator': '选择运算符',
  'Select operator...': '选择运算符…',
  'Choose operator': '选择运算符',
  'Comparison': '比较',
  'COMPARISON': '比较',
  'Null Checks': '空值检查',
  'NULL CHECKS': '空值检查',
  'Equal': '等于',
  'Not equal': '不等于',
  'Greater than': '大于',
  'Greater than or equal': '大于等于',
  'Less than': '小于',
  'Less than or equal': '小于等于',
  'Is': '为',
  'Is not': '不为',
  'Empty': '空',
  // 文本搜索运算符(value 仍是协议小写标记,只有 label 参与替换)
  'Like': 'LIKE 匹配',
  'Not like': 'NOT LIKE 匹配',
  'Ilike': 'ILIKE 匹配',
  'Not ilike': 'NOT ILIKE 匹配',
  'SQL WHERE clause': 'SQL WHERE 子句',
  'WHERE clause': 'WHERE 子句',
  'Raw SQL': '原生 SQL',
  'Filter with AI': 'AI 筛选',
  'Filter with AI ...': '用 AI 筛选…',
  'Apply AI filter': '应用 AI 筛选',
  'Apply SQL filter': '应用 SQL 筛选',
  'AI filtering failed.': 'AI 筛选失败。',

  // —— 行编辑 ——
  'Save': '保存',
  'Save changes': '保存更改',
  'Cancel': '取消',
  'Cancel changes': '取消更改',
  'Discard': '放弃',
  'Discard changes': '放弃更改',
  'Discard edits': '放弃修改',
  'yes, discard': '是,放弃',
  'no, keep editing': '否,继续编辑',
  'Confirm row deletion': '确认删除行',
  'Confirm staged edit discard': '确认放弃已暂存的修改',
  'Confirm staged row save': '确认保存已暂存的行',
  'Delete': '删除',
  'Delete row': '删除行',
  'Delete record': '删除记录',
  'Edit': '编辑',
  'Edit row': '编辑行',
  'Copy': '复制',
  'Copied': '已复制',
  'Copy row': '复制行',
  'Duplicate row': '复制副本行',
  'Are you sure?': '确定吗?',
  'This action cannot be undone.': '此操作无法撤销。',
  '(auto-increment)': '(自增)',
  '(empty string)': '(空字符串)',
  '(default value)': '(默认值)',
  'Set to NULL': '设为 NULL',
  'Set default': '设为默认值',
  'Invalid value': '无效的值',
  'Required': '必填',
  'Optional': '可选',
  'Formatted value': '格式化后的值',
  'Copy selection as': '复制所选为',
  // 多选行后工具条上的「复制为」下拉按钮及菜单项(界面显示为小写原文)
  'copy as': '复制为',
  'include column header': '包含表头',
  'copy markdown': '复制为 Markdown',
  'copy csv': '复制为 CSV',
  'save markdown': '保存为 Markdown',
  'save csv': '保存为 CSV',
  'yes, write to db': '是,写入数据库',
  'Expand': '展开',
  'Collapse': '收起',
  'JSON editor': 'JSON 编辑器',
  'Format': '格式化',
  'Download': '下载',
  'Export': '导出',
  'Import': '导入',
  'Export CSV': '导出 CSV',

  // —— SQL 编辑器 / 查询 ——
  'Run SQL': '运行 SQL',
  'Run query': '运行查询',
  'SQL editor': 'SQL 编辑器',
  'Copy SQL': '复制 SQL',
  'Copy SQL query': '复制 SQL 查询',
  'Copy SQL text': '复制 SQL 文本',
  'Analyze query': '分析查询',
  'Analyzing query': '正在分析查询',
  'Retry query analysis': '重试查询分析',
  'Generate SQL': '生成 SQL',
  'Generate SQL with AI': '用 AI 生成 SQL',
  'Copy recommendation': '复制建议',
  'All good': '全部正常',
  'Write SQL...': '编写 SQL…',
  'Query Details': '查询详情',
  'Analysis': '分析',
  'Waiting for the current analysis to finish.': '等待当前分析完成。',
  'Query error:': '查询错误:',
  'AI rationale:': 'AI 依据:',
  'AI SQL correction error:': 'AI SQL 修正错误:',
  'AI SQL generation error:': 'AI SQL 生成错误:',
  'AI SQL generation failed.': 'AI SQL 生成失败。',
  'AI SQL correction failed.': 'AI SQL 修正失败。',

  // —— 查询活动(Console)——
  'Sort queries': '查询排序',
  'Filter queries by table': '按数据表筛选查询',
  'Rows Returned': '返回行数',
  'Avg latency': '平均延迟',
  'Latency': '延迟',
  'Latency high to low': '按延迟从高到低',
  'Latency low to high': '按延迟从低到高',
  'Total': '总计',
  'Errors': '错误数',
  'Queries': '查询',
  'Absolute time range': '绝对时间范围',
  'Apply range': '应用时间范围',
  'More quick ranges': '更多快捷范围',
  'Last 5 minutes': '最近 5 分钟',
  'Last 15 minutes': '最近 15 分钟',
  'Last 30 minutes': '最近 30 分钟',
  'Last 1 hour': '最近 1 小时',
  'Last 3 hours': '最近 3 小时',
  'Last 6 hours': '最近 6 小时',
  'Last 12 hours': '最近 12 小时',
  'Last 24 hours': '最近 24 小时',
  'Last 2 days': '最近 2 天',
  'Last 7 days': '最近 7 天',
  'Executions high to low': '按执行次数从高到低',
  'Executions low to high': '按执行次数从低到高',
  'Rows returned high to low': '按返回行数从高到低',
  'Rows returned low to high': '按返回行数从低到高',
  'Select activity time range': '选择活动时间范围',
  'Waiting for query activity': '等待查询活动',
  'SQL Query': 'SQL 查询',
  'Parameters': '参数',

  // —— 架构可视化 ——
  'Primary Key': '主键',
  'Foreign Key': '外键',
  'Nullable': '可空',
  // 数据表格列头徽标(注意与上面架构可视化的大小写不同)
  'Primary key': '主键',
  'Auto-increment': '自增',
  'Computed': '计算列',
  'Required - not nullable, computed, auto-incrementing, and has no default value':
    '必填——不可为空、计算列、自增且无默认值',
  'Foreign key - references': '外键 - 引用',
  'Find roots': '查找根节点',
  'Zoom to Fit': '缩放至适应',
  'zoom in': '放大',
  'zoom out': '缩小',
  'fit view': '适应视图',
  'React Flow mini map': 'React Flow 小地图',
  'Press enter or space to select a node.': '按回车或空格键选中节点。',
  'You can then use the arrow keys to move the node around.': '然后使用方向键移动节点。',
  'Press delete to remove it and escape to cancel.': '按 Delete 键删除,按 Esc 取消。',
  'Press enter or space to select an edge. You can then press delete to remove it or escape to cancel.':
    '按回车或空格键选中连线,然后按 Delete 键删除或按 Esc 取消。',

  // —— 架构 / 元数据状态 ——
  'Could not load schema metadata': '无法加载架构元数据',
  'Schema metadata unavailable': '架构元数据不可用',
  'Schema refresh failed': '架构刷新失败',
  'Schema sync': '架构同步',
  'Studio could not load schema and table metadata. Retry after checking database permissions or connectivity.':
    'Studio 无法加载架构与数据表元数据。请检查数据库权限或连接状况后重试。',
  'Retry to reload schema and table metadata.': '重试以重新加载架构与数据表元数据。',

  // —— 通用状态与提示 ——
  'Loading': '加载中',
  'Loading...': '加载中…',
  'Error': '错误',
  'Warning': '警告',
  'Success': '成功',
  'Error Details': '错误详情',
  'Something went wrong': '出了点问题',
  'Something went wrong.': '出了点问题。',
  'An error occurred': '发生错误',
  'Connection error': '连接错误',
  'Connection failed': '连接失败',
  'Reconnecting': '正在重新连接',
  'Disconnected': '已断开连接',
  'Try again': '重试',
  'Retry': '重试',
  'Learn more': '了解更多',
  'Documentation': '文档',
  'Feedback': '反馈',
  'Help': '帮助',
  'Keyboard shortcuts': '键盘快捷键',
  'Shortcuts': '快捷键',
  'Theme': '主题',
  'Dark mode': '深色模式',
  'Light theme': '浅色主题',
  'Dark theme': '深色主题',
  'System theme': '跟随系统',
  'Studio theme': 'Studio 主题',
  'Toggle theme': '切换主题',
  'Control character': '控制字符',
  // 「数据库」页签激活时,Studio 的兜底视图(被看板面板覆盖,仅作兜底翻译)
  'This view was incorrectly loaded, please report this bug.': '视图加载有误,请反馈此问题。',

  // —— 日期选择器 ——
  'Choose the Month': '选择月份',
  'Choose the Year': '选择年份',
  'Go to the Next Month': '下个月',
  'Go to the Previous Month': '上个月',
  'Week Number': '周数',
  // 日期单元格编辑弹层:JSX 把它拆成「前缀 + 时区 + )」三个文本节点,
  // 运行时按整节点精确匹配等不到右括号,必须靠构建期替换这一段前缀
  'Editing in local time (': '以本地时间编辑(',

  // —— 空状态、检索与命令面板 ——
  'No results found': '未找到结果',
  "It doesn't look like you have any data in this table.": '这个表里好像还没有任何数据。',
  'No columns match this search.': '没有符合该搜索的列。',
  'No operators match this search.': '没有符合该搜索的运算符。',
  'No matching commands.': '没有匹配的命令。',
  'Invalid search query': '搜索查询无效',
  'Search commands, tables, and Studio views.': '搜索命令、数据表与 Studio 视图。',
  'No database tables found. Connect to a database to see your schema.': '未找到数据表。请连接数据库以查看架构。',
  'No schemas found': '未找到架构',
  'Loading schemas...': '正在加载架构…',
  'No positive numeric values to visualize.': '没有可可视化的正数值。',
  'Jump to beginning': '跳到开头',
  'Jump to end': '跳到末尾',
  'Match system theme': '跟随系统主题',
  'Find out how to see your Prisma ORM calls.': '了解如何查看你的 Prisma ORM 调用。',
  'toggle interactivity': '切换画布交互',

  // —— 数据列统计面板 ——
  'Aggregations': '聚合',
  'Numeric': '数值',
  'Indexed': '已建索引',
  'Preview': '预览',
  'Suggested': '建议',
  'Table': '数据表',

  // —— 拖拽辅助说明(dnd-kit)——
  'To pick up a draggable item, press the space bar.':
    '要拾取可拖动项,请按空格键。',
  'While dragging, use the arrow keys to move the item.':
    '拖动时,使用方向键移动该项。',
  'Press space again to drop the item in its new position, or press escape to cancel.':
    '再次按空格键放置到新位置,或按 Esc 键取消。',
  'Press space to start dragging.': '按空格键开始拖动。',
}

/**
 * 动态文本的正则翻译规则(仅运行时兜底;替换串支持 $1、$2 捕获组引用)。
 */
export const PATTERNS: Array<[RegExp, string]> = [
  // 可视化空状态节点标题:仅运行时翻译,避免破坏内部的空卡片判断值
  [/^No Tables Found$/, '未找到数据表'],
  // 行数 / 分页
  [/^(\d+)\s+rows?$/i, '$1 行'],
  [/^(\d+)\s+row(?:\(s\)|s?)\s+returned\s+in\s+([\d.]+)ms$/i, '返回 $1 行，耗时 $2 毫秒'],
  [/^Save\s+(\d+)\s+rows?$/, '保存 $1 行'],
  [/^Discard edits to (\d+)\s+cells?\?$/, '放弃对 $1 个单元格的修改?'],
  [/^Discard changes to (\d+)\s+cells?\?$/, '放弃对 $1 个单元格的更改?'],
  [/^Delete (\d+)\s+rows?\?$/, '删除 $1 行?'],
  // 多选行后工具条上的删除按钮(无问号)
  [/^Delete (\d+)\s+rows?$/, '删除 $1 行'],
  // 删除确认弹窗的提示语
  [/^Do you want to delete (\d+)\s+rows?\?$/, '确定要删除 $1 行吗?'],
  [/^(\d+)\s+rows per page$/, '$1 行/页'],
  [/^Showing\s+([\d,]+)\s+of\s+([\d,]+)\s+rows?$/i, '显示 $1 / $2 行'],
  [/^Page\s+(\d+)\s+of\s+(\d+)$/i, '第 $1 / $2 页'],
  [/^(\d+)\s+of\s+(\d+)$/, '$1 / $2'],
  [/^(\d+)\s+selected$/i, '已选中 $1 项'],
  // 动态 aria 标签
  [/^Choose operator for (.+)$/, '为「$1」选择运算符'],
  [/^Filter value for (.+)$/, '「$1」的筛选值'],
  [/^Open table (.+)$/, '打开数据表 $1'],
  [/^Edge from (.+) to (.+)$/, '从「$1」到「$2」的关联'],
  [/^Notifications\s+(.+)$/, '通知($1)'],
  [/^Loading\s+(.+)$/i, '正在加载 $1'],
  // 删除确认弹窗按钮:原文是泛词 "delete"/"keep",进构建期替换会误伤
  // type:"delete" 等协议值,因此只放在运行时按整文本节点精确匹配
  [/^delete$/, '删除'],
  [/^keep$/, '保留'],
  // 相对时间
  [/^(\d+)\s+seconds? ago$/i, '$1 秒前'],
  [/^(\d+)\s+minutes? ago$/i, '$1 分钟前'],
  [/^(\d+)\s+hours? ago$/i, '$1 小时前'],
  [/^(\d+)\s+days? ago$/i, '$1 天前'],
  [/^(\d+)\s+weeks? ago$/i, '$1 周前'],
  [/^(\d+)\s+months? ago$/i, '$1 个月前'],
  [/^(\d+)\s+years? ago$/i, '$1 年前'],
  // 时间编辑
  [/^Editing in local time \((.*)\)$/, '以本地时间编辑($1)'],
  // 拖拽整段说明(dnd-kit 拼接串)
  [/^To pick up a draggable item[\s\S]*escape to cancel\.$/,
    '要拾取可拖动项,请按空格键。拖动时,使用方向键移动该项;再次按空格键放置到新位置,或按 Esc 键取消。'],
  // 日期/统计面板的短词:打包产物里存在 `ye+"Month"` / `Cr(...,"Time")` /
  // `t+"Size"` 这类属性名拼接,若走构建期替换会破坏日期库与画布逻辑,
  // 因此只放在运行时正则里,翻译落到渲染后的文本节点
  [/^Month$/, '月'],
  [/^Time$/, '时间'],
  [/^Size$/, '大小'],
]

/**
 * 运行时翻译跳过的区域:
 * - 数据网格内的列名与单元格文本全部是用户数据/数据库标识符,绝不能翻译;
 * - 输入类元素的内容是用户正在编辑的数据;
 * - 相关 role 覆盖表格行列、列表框选项、可编辑区。
 */
export const SKIP_SELECTOR = [
  '[role="grid"]',
  '[role="gridcell"]',
  '[role="row"]',
  '[role="columnheader"]',
  '[role="rowheader"]',
  '[role="option"]',
  'input',
  'textarea',
  'select',
  '[contenteditable="true"]',
  '[contenteditable=""]',
  '[role="textbox"]',
].join(', ')
