# DUOMEI_STUDIO.md

> **For any AI / Codex / Claude / Cursor / GPT working on this project: read this file first.**
>
> This file is the permanent product guide for **Duomei Studio**.  
> Do not redesign the product direction without explicit user permission.

---

## 0. Project Identity

**Project name:** Duomei Studio / 多美 Travel Journal  
**Public brand:** 多美 / Color  
**Repository:** `colorsugar/duomei-travel-journal`  
**Public site:** GitHub Pages  
**Current product type:** Personal travel photography studio + archive  
**Future direction:** Personal digital museum, travel archive, notes, classbook museum, photography gallery, AI companion.

This is **not** a normal blog.

This is **not** a generic CMS.

This is **not** a random template site.

This project is a long-term personal digital studio for:

- Travel records
- Photography
- Memories
- Writing
- High school classbook archive
- Future AI companion
- Future notes / comments / likes / map / timeline

The product should feel like:

> A personal creative studio, not an admin panel.

---

## 1. Product Philosophy

### 1.1 Core Feeling

The site should feel:

- Quiet
- Premium
- Image-first
- Personal
- Warm
- Long-term
- Cinematic
- Comfortable to browse
- Comfortable to maintain

The user wants a site that people open and feel:

> “This is not a template. This is someone carefully preserving their life.”

### 1.2 Visual References

Use these references as design direction:

- Apple Photos
- Apple TV
- Apple Music
- Netflix hero layout
- Arc Browser
- Notion
- Linear
- GitHub Desktop
- Adobe Portfolio
- Leica-style photography portfolio

Do **not** copy any single site completely. Combine their qualities:

- Apple: clarity, polish, spacing, typography
- Netflix / Apple TV: image hero, readable title over image
- Apple Photos: adaptive gallery layout
- Notion / Linear: clean CMS interaction
- Arc: elegant glass / motion
- Adobe Portfolio: photography-first presentation

### 1.3 What Must Be Avoided

Do not create:

- Cyberpunk style
- Rainbow gradients
- Over-designed animations
- Strange fonts
- Low-contrast text
- Invisible buttons
- Hidden admin access that user cannot find
- Developer-looking dashboards
- Random emoji icon systems
- Demo-like UI
- Hard-to-read backgrounds
- Custom artistic mouse cursor
- Untranslated mixed-language UI

---

## 2. Architecture Constraints

### 2.1 Do Not Modify Without Explicit Permission

The following are stable and must not be modified unless the user explicitly says so:

- Cloudflare Worker architecture
- Authentication flow
- `ADMIN_KEY`
- GitHub token secrets
- GitHub Pages deployment flow
- Publish API contract
- Worker route design
- Repository ownership
- Existing public URL

When fixing frontend UX bugs, do **not** touch Worker / auth / publish API.

### 2.2 Current Architecture

Current structure:

```text
GitHub Pages
  ↓
Static site in /dist
  ↓
Frontend CMS
  ↓
Cloudflare Worker
  ↓
GitHub API
  ↓
Commit to repository
  ↓
GitHub Pages deployment
```

Data is stored mainly in:

```text
dist/content/journeys.json
dist/content/settings.json
dist/content/tags.json
dist/content/versions.json
```

Images should be stored as repository files, not long-term base64 in JSON.

Preferred image path pattern:

```text
dist/photos/...
```

or equivalent existing project image directory.

### 2.3 High-Frequency Data

Do **not** store high-frequency interaction data in Git commits.

Future data such as:

- Likes
- Comments
- View counts
- User accounts
- AI comments

should use a database later, preferably:

```text
Cloudflare Worker + Cloudflare D1 / KV
```

GitHub is for content and versioned archive data, not live interaction counters.

---

## 3. Development Workflow

### 3.1 Sprint-Based Development

Do not mix everything in one change.

Use sprint format:

```text
Sprint Vx.x — Name

Objective
Constraints
P0 Tasks
P1 Tasks
Acceptance Criteria
```

Each sprint should focus on one of:

- Critical bug fix
- UX stabilization
- Visual polish
- CMS workflow
- Performance
- New module

Do not combine:

- Bug fixes
- New feature
- Visual redesign
- Architecture changes

unless explicitly requested.

### 3.2 Task Format for Codex

Use direct commands:

```text
FIX
REMOVE
REPLACE
REWRITE
IMPLEMENT
DO NOT
MUST
```

Avoid vague wording:

- “Maybe”
- “Could”
- “Try”
- “It would be nice”
- “If possible”

### 3.3 Required Acceptance Criteria

Every sprint must include measurable acceptance criteria.

Example:

```text
Acceptance Criteria:
1. Search input text is visible.
2. Searching 桂林 returns 桂林.
3. Buttons remain visible on dark and light backgrounds.
4. Worker/auth/publish API unchanged.
```

### 3.4 Git Workflow

Recommended local workflow:

```bash
git add .
git commit -m "Short sprint description"
git pull --rebase origin main
git push
```

If `git push` is rejected, use:

```bash
git pull --rebase origin main
git push
```

If conflict occurs, stop and ask before resolving.

---

## 4. Product Modes

### 4.1 Public Visitor Mode

Visitors should see:

- Beautiful frontend
- Clear navigation
- No CMS controls
- No editing buttons
- No upload buttons
- No developer UI

Public navigation should be content-based, not admin-based.

### 4.2 Admin Studio Mode

Admin sees a creative studio:

- Studio dashboard
- Journey manager
- Media manager
- Home settings
- Repository
- Recovery
- Settings

Admin mode should not feel like a debug panel.

### 4.3 Editor Mode

Editing must be explicit.

Admin browsing mode and editing mode are separate.

Editor mode should show:

- Save
- Cancel
- Back
- Undo
- Restore default
- Publish
- Upload controls

Do not overload “browse mode” as “exit backend.”

Use clear states:

```text
浏览网站
返回后台
进入编辑
退出编辑
```

---

## 5. Navigation Rules

### 5.1 Public Top Navigation

Do not show admin concepts like:

- Tags
- Stats
- Repository
- Recovery

as public top-level nav.

Public nav should represent content channels.

Default:

```text
游 / 景 / 想 / 文
```

Meaning:

```text
游 = 旅行 / Travel
景 = 摄影 / Photography
想 = 灵感 / Thought
文 = 文章 / Essays
```

This must be configurable, not hardcoded.

Store in settings:

```json
"navItems": [
  { "key": "travel", "label": "游", "title": "旅行", "visible": true, "order": 1, "target": "journey", "type": "travel" },
  { "key": "photo", "label": "景", "title": "摄影", "visible": true, "order": 2, "target": "gallery", "type": "photo" },
  { "key": "thought", "label": "想", "title": "灵感", "visible": true, "order": 3, "target": "thought", "type": "thought" },
  { "key": "essay", "label": "文", "title": "文章", "visible": true, "order": 4, "target": "essay", "type": "essay" }
]
```

If a channel has no content:

```text
这里还没有内容
```

Do not redirect all channels to Home.

---

## 6. Visual Design System

### 6.1 Typography

Use system fonts.

```css
font-family:
  -apple-system,
  BlinkMacSystemFont,
  "SF Pro Display",
  "SF Pro Text",
  "Helvetica Neue",
  Arial,
  "PingFang SC",
  "Noto Sans SC",
  "Microsoft YaHei",
  sans-serif;
```

Do not use strange decorative fonts for main UI.

Typography rules:

```text
Hero title: large, bold, readable
Section title: clear hierarchy
Body: comfortable, not too light
Caption: readable but secondary
Buttons: clear and bold enough
```

Chinese text must be clear and comfortable.

### 6.2 Color System

Default base colors:

```text
Dark cinematic background: #151716 / #181b1a
Light surface: rgba(255,255,255,.82)
Primary text dark: #222
Primary text light: #fff
Secondary dark: #666
Secondary light: rgba(255,255,255,.72)
Accent: #C8A977
Danger: #9f2f2f
```

Do not use gray-green default background that makes the site look unfinished.

### 6.3 Button System

All buttons must remain readable on:

- Light background
- Dark background
- Image background
- Gradient background
- Mobile
- Desktop
- Studio
- Frontend

Use Liquid Glass style where appropriate:

```css
border-radius: 999px;
background: rgba(255,255,255,.18);
backdrop-filter: blur(24px) saturate(1.4);
-webkit-backdrop-filter: blur(24px) saturate(1.4);
border: 1px solid rgba(255,255,255,.28);
color: #fff;
box-shadow: 0 12px 40px rgba(0,0,0,.18);
```

For light background:

```css
background: rgba(255,255,255,.82);
color: #222;
border: 1px solid rgba(0,0,0,.08);
```

Buttons must never disappear into the background.

### 6.4 Border Radius

Use consistent radius:

```text
Buttons: 999px
Cards: 24px
Images: 24px
Dialogs: 28px
Inputs: 18px
```

### 6.5 Motion

Motion should be:

- Soft
- Slow enough to feel premium
- Not flashy
- Not game-like
- Not cyberpunk

Default duration:

```text
250ms–420ms
```

Use consistent easing.

### 6.6 Icons

Use one icon family only.

Recommended:

```text
Lucide Icons
```

Do not mix:

- Emoji
- Random SVG
- Different icon styles

Icon style:

- Outline
- 2px stroke
- Rounded
- Low-saturation colors
- Consistent size

---

## 7. Cursor Rules

Custom artistic cursor caused visibility issues.

Default rule:

```text
Use system cursor.
```

Do not add artistic cursor unless explicitly requested later.

If settings include cursor options, default to system cursor.

---

## 8. Hero Rules

### 8.1 Hero Direction

Hero should use cinematic image-first design.

Default structure:

```text
Image layer
Dark overlay
Left gradient
Bottom fade
Text layer
Buttons
```

Hero must not be:

- Pale empty page
- Gray-green background
- White top + black hard cut
- Cloud / paper plane as main visual

### 8.2 Hero Background Source

Priority:

1. User-uploaded Home Hero cover
2. Latest Journey cover
3. Dark premium gradient fallback

If using image:

```text
object-fit: cover
dark overlay
left gradient
bottom gradient
```

### 8.3 Hero Text Readability

Text must always be readable.

Required structure:

```css
.hero-copy {
  position: absolute;
  left: clamp(24px, 5vw, 72px);
  bottom: clamp(96px, 16vh, 180px);
  max-width: 720px;
  z-index: 5;
}
```

Title:

```css
font-size: clamp(72px, 10vw, 150px);
font-weight: 800;
color: #fff;
text-shadow: 0 8px 32px rgba(0,0,0,.48);
```

Body:

```css
font-size: 18px;
line-height: 1.8;
color: rgba(255,255,255,.86);
```

No title should be blocked by image.

### 8.4 Hero CMS

Home Hero must support editing:

- Title
- Subtitle
- Body
- Button label
- Button URL
- Background image
- Background type
- Overlay strength
- Blur
- Focal position
- Visibility
- Order
- Layout

Do not hardcode titles like “慢慢翻阅.”

---

## 9. Gallery Rules

Gallery should feel like Apple Photos / Google Photos.

Default layout:

```text
Justified / Auto layout
```

Rules:

- Keep image aspect ratio
- Fill row width
- No huge empty gaps
- No awkward half-width lone images
- Mobile: one column or elegant adaptive layout
- Desktop: justified rows or masonry

Supported ratios:

```text
Original
1:1
3:2
4:3
16:9
9:16
21:9
Free Crop
```

Gallery must support future large collections.

---

## 10. Detail Viewer Rules

Detail viewer currently works better on desktop. Preserve it.

Must include:

- Back to Journey
- Previous
- Next
- Close
- Keyboard arrow support
- Mobile swipe support
- Skeleton loading
- Missing image fallback

Never show blank detail page.

If index invalid:

```text
图片不存在，已返回图库
```

---

## 11. Studio Rules

### 11.1 Studio Feeling

Studio should feel like:

```text
Digital creative studio
```

not:

```text
Admin debug panel
```

Use Studio terms where possible:

```text
工作台
媒体
仓库
恢复
设置
首页
旅行
```

### 11.2 Welcome Header

Do not use the user’s real name.

Use brand names:

```text
多美
Color
Duomei
```

Examples:

```text
欢迎回来，多美。
欢迎回来，Color。
Good Evening, Color.
今天也继续记录旅程吧。
新的故事，从这里开始。
```

### 11.3 Admin Entry

Public site must show visible admin entry.

Default:

```text
编
```

It must be configurable:

```json
"adminEntryLabel": "编"
```

Do not hide admin behind long press or secret click.

### 11.4 Login Dialog

Login dialog should be simple:

```text
ID
密码
登录
```

Support Enter key.

Do not show unnecessary explanations.

### 11.5 Studio State

When admin clicks:

```text
浏览网站
```

and then:

```text
返回后台
```

the Studio must restore:

- previous panel
- scroll position
- editing mode
- active tab

Use sessionStorage:

```text
lastStudioPanel
lastStudioScroll
lastStudioMode
```

---

## 12. Publish Rules

### 12.1 Publish States

Publish state machine:

```text
Draft
Publishing
Commit Success
Waiting Pages
Pages Ready
Published
Failed
```

Do not confuse these states.

If commit succeeds but Pages JSON is delayed, do not show red failure.

Show:

```text
已提交成功，正在等待线上数据同步
```

### 12.2 Do Not Misreport Pages Delay

If post-publish JSON read fails due to:

- Empty response
- HTML response
- 404
- GitHub Pages delay
- Cache delay
- Invalid JSON temporarily

do not mark publish as failed if commit succeeded.

Poll Pages JSON:

```text
10 times
3 seconds interval
```

If still not ready:

```text
已提交成功，但暂时无法确认线上 JSON。请稍后刷新页面。
```

### 12.3 Error Messages

Never show raw:

```text
Unexpected end of JSON input
Failed to fetch
```

to normal users.

Instead show:

```text
阶段
原因
建议操作
重试
```

### 12.4 Pending Photos

After publish:

- if commit success: pending photos become “waiting sync”
- if Pages ready: pending photos must become 0
- do not keep “15 张图片等待发布” after publish success

---

## 13. Search Rules

Search input must be readable.

Search must actually work.

Search scope:

- Journey title
- Place
- Country
- Date
- Year
- Category
- Tags
- Body
- Gallery caption

Search behavior:

- 300ms debounce
- no page reload
- no refetch
- empty query restores all
- no result state
- highlight matched text

Input `桂林` must return 桂林.

---

## 14. Language Rules

Chinese mode must be fully Chinese.

Do not mix English labels in Chinese UI.

Translate at least:

```text
View Site → 浏览网站
Back to Studio → 返回后台
Enter Editor → 进入编辑
Exit Editor → 退出编辑
Journey → 旅行
Media → 媒体
Repository → 仓库
Recovery → 恢复
Settings → 设置
Health → 健康
Health Score → 健康评分
Gallery → 图库
Gallery Layout → 图片布局
Auto Layout → 自动布局
Masonry → 瀑布流
Justified → 两端对齐
Fixed Grid → 固定网格
Draft → 草稿
Publish → 发布
Pending Photos → 待发布图片
Days Since First Publish → 首次发布至今
Storage → 存储
Images → 图片
Backup → 备份
Restore → 恢复
Preview → 预览
Save → 保存
Cancel → 取消
Back → 返回
Retry → 重试
Done → 完成
```

If English / Japanese are not fully implemented, mark them as:

```text
开发中
```

or hide them temporarily.

---

## 15. Crop Rules

Free crop must be real.

Support:

- Drag four corners
- Drag edges
- Move crop box
- Pinch zoom
- Rotate
- Reset
- Apply crop
- Previous / Next for batch edit
- Apply to all

Batch upload must not force crop for every image.

Default batch upload:

```text
Auto compress → Auto import → Edit later
```

---

## 16. Toast / Notification Rules

Toast timing:

```text
Normal: 5s
Important: 12s
Error: manual close only
```

Add notification history:

- upload
- compress
- publish
- restore
- save
- errors

Keep last 30 notifications.

Location: bottom right.

---

## 17. Recovery Rules

Do not create a Recovery every 30 seconds.

Auto-save only updates draft.

Create Recovery only when:

- Journey modified
- Image modified
- Home modified
- JSON imported
- Publish
- Manual backup
- Content deleted

Merge repeated edits.

Do not produce identical recovery points.

---

## 18. Home Sections Rules

Home sections must be editable in Studio.

Each section supports:

- Edit
- Delete
- Hide
- Show
- Move Up
- Move Down
- Title
- Subtitle
- Body
- Button
- URL
- Layout
- Style

“Add section” must be clear:

```text
添加标题区块
添加文字区块
添加图片区块
```

Do not use vague “添加区块.”

---

## 19. Media Manager Rules

Each image should show:

- Thumbnail
- Journey
- Usage: Cover / Gallery / Home
- Size
- Dimensions
- Upload time
- Synced state
- Published state
- Reference count

Support:

- Replace
- Delete
- View references
- Batch delete
- Batch download

---

## 20. Known P0 Bugs to Fix

These are known user-reported issues:

1. Bottom toolbar corrupted text.
2. Admin entry too hard to find.
3. Login should support Enter.
4. Pending photos still shown after publish.
5. Home settings not fully Chinese.
6. Studio text too small / too light.
7. Glass style inconsistent.
8. View Site → Back to Studio loses previous panel.
9. Crop modal dropdown text unreadable.
10. Image rotation slow.
11. Add section label unclear.
12. Section cannot be deleted inside Studio.
13. Fonts look bad.
14. Language selector should be available in public footer.
15. Editing floating buttons too dark.
16. Batch upload forces crop one by one.
17. Batch crop has no previous / next.
18. Toast disappears too fast.
19. No notification history.
20. `游 / 景 / 想 / 文` all open same page.
21. Adding new content can still publish fail.
22. Search text invisible.
23. Search not working.
24. Homepage hero visual can look bad.
25. Buttons can be invisible on background.
26. Publish success can be misreported as failure.
27. `&nbsp;` can appear as literal text.
28. Detail page must not open blank.

---

## 21. Future Roadmap

Do not implement unless explicitly requested.

### V6 — Design System

- Stabilize frontend visual system
- Hero / Gallery / Detail unification
- Better image-first homepage

### V7 — Museum

- Classbook / 青春博物馆
- Daily quote
- Artwork archive
- OCR data
- Author index

### V8 — Community

- Likes
- Comments
- Google login
- D1 database

### V9 — AI Companion

Keyword:

```text
约定1
```

Meaning:

Design the long-term AI companion / AI 留言墙 / AI 旅伴 feature.

The AI should feel like a travel companion who knows the user’s journeys, photos, memories and style.

---

## 22. AI Collaboration Rule

For Codex / Claude / GPT:

Always follow:

```text
Read this file first.
Follow the product guide.
Implement only the current sprint.
Do not redesign outside the sprint.
Do not modify Worker/auth/publish API unless explicitly allowed.
```

If a new AI joins the project, this file is the starting point.

---

## 23. Current Development Style

The assistant acts as:

- Product Manager
- UI Director
- UX Reviewer
- Technical reviewer

Codex acts as:

- Frontend engineer
- Implementation agent
- Bug fixer

User tests on:

- Windows desktop
- iPhone Safari
- GitHub Pages

Every sprint must be tested on desktop and mobile.

---

## 24. Project Memory / Agreements

### Agreement 1 — 约定1

When user says:

```text
约定1
```

It means:

Design or continue the AI Companion / AI 留言墙 / AI 旅伴 feature.

This feature should:

- Read Journey
- Analyze photos
- Generate warm comments
- Give photography feedback
- Remember past journeys
- Feel like a long-term travel companion

---

## 25. Current Priority

Current priority is not adding new modules.

Current priority is:

```text
Stabilize UX
Fix visual problems
Fix publish state
Fix search
Fix navigation
Make frontend beautiful and readable
```

Only after V5.x stabilization is complete should the project move to Museum / Notes / Community.
