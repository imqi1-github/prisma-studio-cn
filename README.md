# Prisma Studio 中文版

[Prisma Studio](https://www.prisma.io/docs/orm/prisma-studio) 的中文汉化独立发行版,仅支持 **PostgreSQL**。

在官方基础上做了四件事:

1. **界面全面汉化** — 数据表格、筛选器、插入行对话框、SQL 编辑器、控制台、架构可视化等所有界面均为简体中文;
2. **登录认证** — 整个页面(含所有数据接口)都在登录之后,凭据必须通过环境变量或配置文件提供;
3. **「数据库」看板** — 侧边栏新增只读的数据库页签,查看库级定义与每张表的建表 DDL;
4. **彻底脱离外部依赖** — 所有第三方代码已收入 `vendor/`,安装即用,无需从 npm 拉取任何运行时依赖。

## 快速开始

零安装,直接运行已构建好的产物:

```bash
# 通过环境变量提供登录凭据
STUDIO_USERNAME=admin STUDIO_PASSWORD=你的密码 \
node build/cli.js --url="postgres://用户名:密码@localhost:5432/数据库名"
```

启动后会自动打开浏览器,首先进入登录页;若默认端口 `51212` 被占用,会自动向下扫描可用端口。

## 登录认证(必须配置)

**未配置用户名或密码时,程序直接报错退出**,支持两种配置方式,环境变量优先于配置文件:

方式一:环境变量

```bash
STUDIO_USERNAME=admin      # 登录用户名
STUDIO_PASSWORD=s3cret     # 登录密码
```

方式二:JSON 配置文件(`--config` 指定的文件,或当前目录的 `prisma-studio.config.json`)

```json
{
  "url": "postgres://...",
  "username": "admin",
  "password": "s3cret"
}
```

认证行为:

- 未登录时访问页面会看到中文登录页;**登录前服务端拒绝一切数据操作**(页面资源与 `/bff` 数据接口均返回 401),数据库只读浏览与增删改全部被拦在门外;
- 登录成功后下发 `HttpOnly + SameSite=Strict` 的会话 Cookie,有效期 7 天;
- 页面右缘有「退出登录」按钮,点击即注销会话回到登录页;
- 会话保存在服务进程内存中,**重启 Studio 后需要重新登录**;
- 密码校验使用 SHA-256 摘要 + 恒定时间比较,进程内不保留明文(启动横幅也只显示用户名)。

### 反向代理与跨域

服务端做同源检查,以下情形开箱即用、**无需任何配置**:本机直接访问(`localhost` / `127.0.0.1`),以及通过域名反向代理访问(nginx、宝塔等默认透传 `Host` 头的部署方式)。

若你的反代会改写 `Host` 头,或需要从别的域名访问,把站点域名加入白名单,环境变量与配置文件取并集:

```bash
STUDIO_ALLOWED_ORIGINS=https://studio.example.com,https://api.example.com
```

```json
{
  "url": "postgres://...",
  "username": "admin",
  "password": "s3cret",
  "allowedOrigins": ["https://studio.example.com"]
}
```

不在白名单内的跨站请求会被拒绝(403 禁止访问),这是 CSRF 防护层。

### 命令行参数

```
用法: node build/cli.js [选项]

选项:
  -u, --url <连接串>     PostgreSQL 连接字符串(优先级最高)
  -c, --config <路径>    从 JSON 配置文件读取连接串与登录凭据
  -p, --port <端口>      指定服务端口(默认 51212,被占用时自动向下扫描)
  -b, --browser <方式>   打开浏览器:none 或可执行文件路径
  -h, --help             显示帮助
```

连接串还可以通过以下方式提供(按优先级):

1. `--url` 命令行参数;
2. `--config` 指定的 JSON 文件,格式为 `{ "url": "postgres://...", "username": "...", "password": "..." }`;
3. 当前目录下的 `prisma-studio.config.json`(同样格式);
4. `prisma.config.ts` / `prisma7.config.ts` 中出现的 PostgreSQL 连接字符串字面量;
5. 环境变量 `DATABASE_URL`。

登录凭据(`STUDIO_USERNAME` / `STUDIO_PASSWORD` 环境变量,或配置文件中的 `username` / `password` 字段)是必填项,不提供任何命令行参数形式。

> **注意**:中文版仅接受 `postgres://` 或 `postgresql://` 协议的连接串,不支持 MySQL、SQLite 等其他数据库。

## 界面功能

- **数据表**:浏览、筛选(列运算符 / SQL WHERE 子句)、排序、分页 / 无限滚动、插入行、编辑、删除;
- **SQL**:直接运行 SQL 查询;
- **控制台**:查看 Studio 发出的真实 SQL 与参数;
- **可视化**:查看表结构与外键关系图;
- **数据库**:只读看板,查看数据库定义(所有者、编码、排序规则、大小、连接数、版本、扩展)与每张表的完整建表 DDL。

### 「数据库」看板

侧边栏第四个页签,内容与 Studio 主界面隔离(独立页面,样式互不干扰),全部信息只读、取自 PostgreSQL 系统目录:

- **数据库概览**:当前数据库、所有者、编码、排序规则、占用大小、连接数(及上限)、服务器版本、架构列表与已装扩展;
- **数据表 DDL**:在左侧选中任意一张表,右侧即时生成完整建表语句 —— 列定义(默认值 / 自增 / 生成列 / 非空)、所有者、主键 / 外键 / 检查约束、独立索引与表 / 列注释,可一键复制;
- **数据库 DDL**:点击右上角「数据库 DDL」按钮,一次性生成整个数据库的定义 —— 建库语句、扩展、非系统 Schema 与全部数据表的完整 DDL。

看板经同一登录会话保护,不会暴露任何超出 Studio 权限的信息;对连接串的要求与主界面一致。

汉化采用双层方案,兼顾覆盖率与数据安全:

| 层 | 时机 | 说明 |
|---|---|---|
| 构建期替换 | `npm run build` | 把打包产物中的完整字符串字面量按字典替换为中文;自动跳过对象键、`case` 标签与比较运算符操作数,不会破坏协议逻辑 |
| 运行时兜底 | 浏览器内 | `MutationObserver` 监听 DOM,对动态拼接的文本(如「保存 1 行」「第 1 / 2 页」)按字典与正则规则翻译;跳过数据网格、输入框等用户数据区域 |

## 开发

```bash
npm install          # 安装构建工具(esbuild、tsx、TypeScript,仅 devDependencies)
npm run build        # 构建 build/cli.js + build/studio.js + build/studio.css
npm run prune-vendor # 按构建 metafile 清理 vendor 中未使用的包
npm run typecheck    # 类型检查
npm start            # 等价于 node build/cli.js
```

汉化字典位于 [`frontend/i18n/dictionary.ts`](frontend/i18n/dictionary.ts):

- `TRANSLATIONS`:英文 → 中文精确对照表(构建期与运行时共用);
- `PATTERNS`:动态文本正则规则(如 `/^Save\s+(\d+)\s+rows?$/` → `保存 $1 行`);
- `SKIP_SELECTOR`:运行时翻译跳过的选择器(数据网格、可编辑区域),保证表格里的列名与数据永不被误改。

修改字典后重新 `npm run build` 即可生效。

## 目录结构

```
├── build/               # 构建产物(cli.js、studio.js、studio.css)
├── frontend/            # 浏览器端入口与汉化层
│   ├── entry.ts         #   React 挂载(postgres 适配器)+ 退出登录按钮
│   └── i18n/            #   汉化字典与运行时翻译器
├── scripts/             # 构建脚本与工具
├── src/                 # CLI 与服务器(登录认证、端口扫描、BFF、静态资源)
└── vendor/              # 本地化的第三方依赖(零运行时外部依赖)
```

## 许可

- 原始 Prisma ORM / Studio 代码遵循 [Apache-2.0](LICENSE)(Prisma Corporation);
- 汉化层的修改同样以 Apache-2.0 发布。
