# 出海攻略 - 海外社媒运营中文教程博客

🚀 专注海外社交媒体运营教程与实操指南，涵盖 Twitter、Instagram、Facebook、TikTok、Discord 等主流平台。

## 📁 项目结构

```
blog-site/
├── index.html              # 首页（文章列表）
├── articles/               # 文章独立HTML页面
│   ├── twitter-register-guide.html
│   ├── instagram-account-setup.html
│   ├── facebook-marketing-beginner.html
│   ├── tiktok-account-tips.html
│   └── discord-server-build.html
├── api/
│   ├── track.js            # 访问追踪 API
│   └── stats.js             # 统计数据 API
├── css/
│   └── style.css            # 全站样式
├── js/
│   ├── main.js              # 首页交互
│   └── analytics.js         # 埋点脚本
├── data/
│   └── articles.json        # 文章元数据
├── sitemap.xml              # SEO sitemap
├── robots.txt               # SEO robots
├── vercel.json              # Vercel 配置
└── _headers                 # 安全响应头
```

## 🚀 部署到 Vercel

### 方式一：GitHub 导入（推荐）

1. 将项目推送到 GitHub 仓库
2. 登录 [Vercel](https://vercel.com)
3. 点击 "Import Project"
4. 选择你的 GitHub 仓库
5. 点击 "Deploy"

### 方式二：Vercel CLI

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署
cd blog-site
vercel

# 生产环境部署
vercel --prod
```

### 方式三：直接上传

1. 打包 `blog-site` 文件夹为 ZIP
2. 在 Vercel Dashboard 选择 "Import Third-Party Project" → "From ZIP"
3. 上传并部署

## 📊 配置 KV 存储（可选）

分析功能需要绑定 Vercel KV：

1. 在 Vercel Dashboard 中进入你的项目
2. 点击 "Storage" → "Create Database"
3. 选择 "KV" 类型
4. 创建后，在项目设置中绑定到你的项目
5. 更新 `vercel.json` 中的 KV namespace ID

> ⚠️ 如果不配置 KV，分析功能会自动降级为内存存储（开发模式），不影响网站正常使用。

## 🔧 本地开发

由于网站使用了 `api/` 目录作为 Serverless Functions，你需要使用 Vercel CLI 进行本地测试：

```bash
# 安装依赖
npm install -g vercel

# 本地运行
cd blog-site
vercel dev
```

## 📝 添加新文章

1. 在 `data/articles.json` 中添加文章元数据
2. 在 `articles/` 目录创建新的 HTML 文件
3. 在 `sitemap.xml` 中添加新页面
4. 更新相关文章的 "related" 字段

### 文章模板

参考现有文章 HTML 文件的格式，确保包含：
- 完整的 `<head>` SEO 标签
- Open Graph 标签
- JSON-LD 结构化数据
- 面包屑导航
- CTA 购买引导
- 相关推荐

## 🎨 自定义配置

### 修改站点信息

编辑 `data/articles.json` 中的 `site` 字段：
```json
"site": {
  "name": "你的站点名",
  "url": "https://你的域名.com",
  "targetUrl": "https://引导购买的链接.com"
}
```

### 修改配色

编辑 `css/style.css` 中的 CSS 变量：
```css
:root {
  --primary: #4361ee;      /* 主色调 */
  --secondary: #7209b7;   /* 辅助色 */
  --gradient: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
}
```

## 📈 SEO 检查清单

- [x] 每篇文章有独立 `<title>` 和 `<meta description>`
- [x] Open Graph 标签配置完整
- [x] JSON-LD 结构化数据
- [x] `<link rel="canonical">` 设置
- [x] 语义化 HTML 标签
- [x] sitemap.xml 已生成
- [x] robots.txt 已配置

## 📄 许可证

本项目仅供学习交流使用。

---

Built with ❤️ for 海外社媒运营者
