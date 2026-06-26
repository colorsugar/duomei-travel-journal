# Travel Journal 3.0 后台部署说明

目标：手机打开网站，管理员登录，编辑内容，点击发布，由 Cloudflare Worker 安全调用 GitHub API 更新仓库，GitHub Pages 自动重新部署。

## 架构

访客浏览：

```text
GitHub Pages -> dist/index.html -> JSON / 图片
```

管理员发布：

```text
浏览器 Admin 面板
  -> Cloudflare Access 登录
  -> Cloudflare Worker
  -> GitHub API
  -> colorsugar/duomei-travel-journal
  -> GitHub Pages 自动发布
```

GitHub Token 只保存在 Cloudflare Worker Secret，永远不会写入 HTML、JS 或 localStorage。

## 1. 创建 GitHub Token

在 GitHub 创建 Fine-grained personal access token：

- Repository access：只选择 `colorsugar/duomei-travel-journal`
- Permissions：
  - Contents：Read and write
  - Metadata：Read

复制 token，后面只粘贴到 Cloudflare Worker secret。

## 2. 创建 Cloudflare Worker

安装并登录 Wrangler：

```powershell
npm install -g wrangler
wrangler login
```

复制配置文件：

```powershell
copy worker\wrangler.toml.example worker\wrangler.toml
```

编辑 `worker/wrangler.toml`：

```toml
ADMIN_EMAILS = "你的 Cloudflare Access 登录邮箱"
ALLOWED_ORIGINS = "https://colorsugar.github.io"
```

设置 GitHub Token：

```powershell
cd worker
wrangler secret put GITHUB_TOKEN
```

部署 Worker：

```powershell
wrangler deploy
```

记下 Worker 地址，例如：

```text
https://duomei-travel-journal-admin.your-name.workers.dev
```

## 3. 管理员登录方式

如果 Cloudflare Zero Trust 要求付款信息，先用 `ADMIN_KEY` 简化方案即可。

设置管理员密钥：

```powershell
cd worker
wrangler secret put ADMIN_KEY
```

输入一个足够长的随机密钥，例如 24 位以上。这个密钥不要发给别人。

网站后台登录时填写：

- Worker 地址
- ADMIN_KEY

浏览器只保存 ADMIN_KEY 到 `sessionStorage`，关闭浏览器后会消失。GitHub Token 仍然只在 Worker Secret 里。

## 4. 可选：用 Cloudflare Access 保护 Worker

在 Cloudflare Zero Trust：

1. Access
2. Applications
3. Add an application
4. Self-hosted
5. Application domain：你的 Worker 域名
6. Policy：只允许你的邮箱

这样只有你登录后，Worker 才会收到：

```text
cf-access-authenticated-user-email
```

Worker 会再次检查这个邮箱是否在 `ADMIN_EMAILS` 里。

## 5. 网站管理员入口

打开：

```text
https://colorsugar.github.io/duomei-travel-journal/
```

进入后台方式：

- 点击右下角 `Admin`
- 或连续点击 Logo 5 次
- 或打开 `/admin`

第一次进入时填写 Worker 地址，点击连接后台。

连接成功后才会显示：

- 编辑模式
- 上传
- 新增城市
- 导入 / 导出
- 发布

普通访客看不到这些功能。

## 6. 发布

编辑时先保存在本地草稿。

点击 `发布` 后：

1. 填写发布说明
2. Worker 校验管理员身份
3. Worker 写入：
   - `dist/content/journeys.json`
   - `dist/content/settings.json`
   - `dist/content/tags.json`
   - `dist/content/versions.json`
4. Worker 创建 Git commit
5. GitHub Pages 自动重新发布

## 7. 当前已完成

- Cloudflare Worker 发布接口
- Cloudflare Access 邮箱校验
- ADMIN_KEY 简化登录
- GitHub Token 只保存在 Worker Secret
- 前端 Admin 入口
- 管理员登录后才显示编辑按钮
- 本地草稿
- 发布按钮
- 发布历史 JSON
- `/admin` 跳转入口

## 8. 下一阶段

建议下一步继续做：

- Worker 图片上传接口，把 dataURL 图片转成仓库里的真实图片文件
- HEIC 转换
- EXIF 读取
- 版本恢复按钮
- 发布历史面板
- AI 辅助接口
