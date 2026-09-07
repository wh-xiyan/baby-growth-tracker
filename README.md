# 宝宝成长录

## 项目介绍

“宝宝成长录”是一款仅供家庭成员使用的宝宝成长记录小程序，用于持续保存宝宝从婴幼儿时期到成年阶段的重要生活片段。家人可以记录日常照护信息，例如喝奶、辅食、睡眠、健康和疫苗接种，也可以记录成长里程碑、入园入学、学习、兴趣爱好、旅游以及其他值得回忆的经历。

小程序支持家庭成员管理，不同成员通过自己的微信身份加入家庭并记录照顾宝宝时完成的事项，系统会保留每条记录的操作人。家庭还可以上传宝宝成长过程中的照片和视频，并将媒体资料关联到具体的成长记录或阶段，形成按时间积累的家庭成长档案。

本项目定位为私密、长期、可扩展的个人家庭工具，优先保证数据归属清晰、家庭成员权限明确、记录方便和资料可持续保存。暂不加入社交、公开发布、陌生人访问或复杂 AI 功能。

底部导航为四项，建议采用：

```text
首页 | 成长 | 相册 | 我的
```

- **首页**：宝宝概览、今日记录、待接种提醒、快捷新增记录
- **成长**：成长时间线、记录筛选、疫苗计划与接种记录
- **相册**：照片和视频上传、浏览、预览、按阶段筛选
- **我的**：家庭成员、宝宝资料、家庭设置、数据导出、隐私设置

这样把“疫苗”归入成长档案，把“家庭”归入个人与设置，主导航更适合长期高频使用。

## 一、确定的技术架构

```text
前端
  Taro 4.2.1
  React 18
  TypeScript
  Sass
  Webpack 5
  NutUI React Taro
  Zustand
  dayjs

后端
  微信云开发 CloudBase
  云数据库
  云存储
  Node.js + TypeScript 云函数
  定时触发器
  订阅消息
```

当前项目已由 `react-NutUI` 模板创建，使用 Taro React 架构。

## 二、当前项目开发前的调整

当前项目已生成基础 Taro 结构，但仍处于模板状态。开始业务开发前应完成：

1. 将 [project.config.json](/Users/wanghuidepingguodiannao/Workspace/project/baby-growth-tracker/project.config.json) 的 `touristappid` 改为真实 AppID。
2. 创建微信云开发环境，记录开发与生产环境的 `envId`。
3. 固定依赖版本，尤其是所有 `@tarojs/*` 保持 `4.2.1` 一致。
4. 将 NutUI 版本从范围版本固定为已真机验证的具体版本。
5. 增加 `zustand` 和 `dayjs`。
6. 删除或修正 [config/index.ts](/Users/wanghuidepingguodiannao/Workspace/project/baby-growth-tracker/config/index.ts) 中未使用的 `vite-plugin-imp` 引入。
7. 第一阶段移除支付宝、百度、字节、QQ 等多端构建依赖，只保留微信平台依赖。
8. 增加 `.env.development` 和 `.env.production`，存放云环境 ID 等非业务配置。
9. 用 `pnpm build:weapp` 构建后，将 `dist/` 导入微信开发者工具。
10. 确认微信开发者工具已开通并绑定云开发环境。

## 三、目录规划

```text
src/
  app.ts
  app.config.ts
  app.scss

  pages/
    onboarding/       # 首次创建家庭和宝宝
    home/             # 底部：首页
    growth/           # 底部：成长时间线与筛选
    record-edit/      # 新增、编辑成长记录
    record-detail/    # 记录详情
    vaccine/          # 从成长页进入
    media/            # 底部：相册
    family/           # 从我的页面进入
    child-profile/    # 宝宝资料
    settings/         # 底部：我的

  components/
    BabySelector/
    QuickRecord/
    RecordCard/
    TimelineItem/
    RecordForm/
    VaccineCard/
    MediaPicker/
    EmptyState/

  services/
    cloud.ts
    auth.ts
    family.ts
    child.ts
    record.ts
    vaccine.ts
    media.ts

  stores/
    session.ts
    family.ts
    child.ts

  types/
  constants/
  utils/

cloud/
  functions/
    login/
    createFamily/
    joinFamily/
    listFamilyMembers/
    createChild/
    updateChild/
    createRecord/
    listRecords/
    updateRecord/
    deleteRecord/
    createVaccine/
    listVaccines/
    updateVaccine/
    createMediaAsset/
    listMediaAssets/
    deleteMediaAsset/
    sendVaccineReminders/
  shared/
```

## 四、页面与功能

| 页面 | 主要功能 |
|---|---|
| 首次设置 | 微信登录、创建家庭、创建宝宝档案 |
| 首页 | 宝宝年龄、今日记录、待办疫苗、最近动态、快捷记录 |
| 成长 | 时间线、按日期和类型筛选、记录详情入口、疫苗入口 |
| 新增记录 | 喝奶、辅食、睡眠、排便、健康、身高体重、里程碑、上学、备忘 |
| 疫苗 | 疫苗计划、接种日期、剂次、提醒、接种备注 |
| 相册 | 图片视频上传、按时间浏览、预览、关联成长记录 |
| 我的 | 当前成员、家庭入口、宝宝切换、资料、导出、隐私设置 |
| 家庭管理 | 邀请码、成员列表、角色和移除成员 |

首页和成长页都提供“新增记录”入口，不单独占用一个底部导航项。

## 五、数据模型

核心集合：

```text
users
families
family_members
children
growth_records
vaccines
media_assets
```

关键原则：

- 每条业务数据必须关联 `familyId` 与 `childId`
- 每条记录保存 `createdBy`，用于显示实际照顾者
- 成长记录使用统一模型，通过 `category` 区分类型
- 疫苗单独成表，方便按计划日期提醒
- 图片视频保存在云存储，数据库只保存 `fileId` 和关联关系
- 删除记录采用软删除，保留恢复和审计空间

记录类型：

```text
feeding       喝奶
solid_food    辅食
sleep         睡眠
diaper        排便
health        健康、就诊
vaccination   接种关联记录
milestone     成长里程碑
school        入园、入学、转学
note          普通备忘
```

建议索引：

```text
growth_records: familyId + childId + occurredAt
growth_records: familyId + category + occurredAt
vaccines: familyId + childId + plannedDate
media_assets: familyId + childId + createdAt
family_members: familyId + userId
```

## 六、权限设计

角色：

```text
owner   创建者，可管理家庭、成员和所有内容
adult   可查看、新增和编辑成长内容
viewer  仅查看
```

权限必须在云函数中校验：

- 云函数从可信 `openid` 获取当前用户
- 前端传入的 `familyId`、`userId` 不可直接信任
- 成员被移除后立即无权读取该家庭资料
- 云存储路径按 `familyId/childId` 隔离
- 不做公开分享、社区、排行榜或社交关系

## 七、云开发能力

云函数：

```text
login
createFamily
joinFamily
listFamilyMembers
createChild
updateChild
createRecord
updateRecord
deleteRecord
listRecords
createVaccine
updateVaccine
listVaccines
createMediaAsset
deleteMediaAsset
sendVaccineReminders
```

每个关键写入云函数统一完成：

```text
身份识别 → 家庭成员校验 → 角色校验 → 参数校验 → 写入数据 → 记录操作人
```

提醒策略：

- 页面内始终展示即将接种的疫苗
- 用户明确授权订阅消息后，才发送微信提醒
- 定时云函数每天检查未来若干天内的待接种疫苗
- MVP 先支持手动创建疫苗计划，不预装地区接种表

## 八、开发准备清单

### 账号和平台

- 真实小程序 AppID
- 微信开发者工具
- 云开发环境 ID
- 云数据库和云存储开通
- 云函数 Node.js 18 或 20 运行时
- 订阅消息模板和测试权限
- 开发、测试、生产环境规划

### 产品规则

- 是否允许一个用户属于多个家庭
- 是否支持多个宝宝
- 邀请码是否失效、是否限制次数
- 成员是否可编辑他人创建的记录
- 删除后是否支持恢复
- 视频单文件大小和时长限制
- 是否需要完整数据导出
- 是否需要补录过去数年的成长记录

### 工程规范

- 固定依赖版本，提交 `pnpm-lock.yaml`
- ESLint、Prettier、TypeScript 严格检查
- 云函数与前端共享枚举和类型
- 统一错误码、日志和空状态
- 环境变量不提交敏感信息
- 真机覆盖 iOS、Android、弱网、授权拒绝和上传失败场景


### 整体风格
「暖心成长日记」UI 风格
核心感受：温馨、轻盈、安心、易记录。
1. 品牌气质
关键词：
- 温馨：像家一样柔和
- 可爱：使用小幅插画和亲和图标
- 清晰：减少复杂控件和信息噪音
- 陪伴：强调“今天也值得被记录”
- 安心：突出隐私和数据安全
避免：
- 过度幼稚的卡通风
- 高饱和蓝色或粉色
- 大量渐变和装饰性卡片
- 复杂的后台管理风格
2. 色彩系统
用途	色值	说明
页面背景	#FFFAF5	暖白，作为全局底色
主品牌色	#E79576	按钮、重点操作
主品牌深色	#C96F59	按钮按下、重要强调
柔粉辅助色	#FFE4DA	女宝宝、纪念日、情感标签
天蓝辅助色	#DFF3F4	男宝宝、健康、成长数据
柔黄辅助色	#FFF0BF	提醒、里程碑、生日
深暖灰	#403B39	标题
正文灰	#665D58	正文
辅助灰	#A49B95	提示、日期、次要信息
分割线	#EEE4DF	输入框和列表分隔


全局建议采用“暖白 + 多彩小面积点缀”，不要让所有页面都被粉色或橙色占满。
3. 字体与排版
使用微信系统字体：
-apple-system,
BlinkMacSystemFont,
"PingFang SC",
"Microsoft YaHei",
sans-serif
字号层级：
- 页面标题：24-28px，粗体
- 模块标题：18-20px，半粗
- 正文：14-15px
- 辅助说明：11-13px
- 数据数字：24-32px，适度加粗
排版原则：
- 标题短而有情绪
- 正文控制在 1-2 行
- 页面内最多使用 3 个主要字号
- 重点数据用数字突出，说明文字降低对比度
4. 圆角与容器
统一圆角：
- 页面大卡片：20-24px
- 普通卡片：14-16px
- 输入框：10-12px
- 按钮：12-14px
- 标签和状态胶囊：20px
阴影建议：
0 8px 24px rgba(188, 135, 108, 0.10)
页面不使用“卡片套卡片”。大区域使用留白和分组线，卡片只承载真正独立的内容。
5. 图标与插画
图标风格：
- 线性图标为主
- 线条圆润
- 颜色跟随模块主题
- 图标尺寸 18-22px
推荐图标语义：
- 家庭：小屋
- 宝宝：爱心、脚印、头像
- 成长：星星、尺子、嫩芽
- 记录：相机、笔记
- 疫苗：盾牌、医疗十字
- 我的：圆形头像、用户轮廓
插画风格：
- 扁平、低细节
- 暖色块面
- 轻微手绘感
- 场景优先于复杂人物
- 重点使用房子、云朵、太阳、月亮、玩具、成长树等元素
6. 页面统一结构
首页
顶部：
- 家庭名称
- 宝宝头像或昵称
- 一句动态陪伴文案
主体：
- 宝宝成长概览
- 今日记录入口
- 最近成长记录
- 待办提醒
主按钮：
记录今天
成长页
采用时间轴和数据模块：
- 月龄/年龄
- 身高体重
- 里程碑
- 成长曲线
- “第一次”记录
数据页面使用天蓝、柔黄作为辅助色，避免完全医疗化。
相册页
采用大图网格：
- 3 列缩略图
- 圆角 10-12px
- 按月份分组
- 空状态使用插画和轻文案
空状态文案：
还没有照片，留住今天的小可爱吧
记录编辑页
优先快速输入：
- 记录类型采用图标按钮
- 内容输入框
- 图片上传
- 日期时间
- 保存按钮固定在底部
记录类型可包含：
- 日常
- 饮食
- 睡眠
- 健康
- 第一次
- 亲子时光
我的 / 家庭页
采用清晰列表，不使用复杂仪表盘：
- 宝宝档案
- 家庭成员
- 数据导出
- 提醒设置
- 隐私与安全
- 关于宝宝成长录
7. 交互反馈
按钮状态：
- 默认：品牌珊瑚色
- 按下：颜色加深
- 禁用：低饱和灰粉
- 加载：按钮内显示 loading
- 成功：轻量 Toast 或底部反馈
空状态：
- 插画 + 一句温柔文案
- 提供明确的下一步按钮
错误状态：
- 使用浅红或珊瑚色提示
- 文案直接说明如何处理
- 避免只显示“操作失败”
8. 动效建议
动效要轻、短、自然：
- 页面进入：淡入 + 轻微上移
- 卡片出现：分组依次淡入
- 选择性别：背景色和勾选状态快速切换
- 创建成功：轻微缩放或星星反馈
- 加载态：奶瓶、摇篮或小房子轻微摆动
动画时长建议 180-300ms，避免持续闪烁和复杂转场。
9. 文案风格
整体使用“陪伴式”文案：
推荐：
- 记录每一个值得记住的今天
- 今天也有新的小进步
- 把成长的瞬间留给未来
- 还没有记录，先写下宝宝今天的小事吧
- 这段时光，值得被好好收藏
避免：
- 提交数据
- 新增数据
- 操作成功
- 暂无数据
10. 统一组件规范
建议建立这些基础组件：
- PageHeader
- FamilySwitcher
- BabyAvatar
- SectionCard
- RecordTypeSelector
- EmptyState
- StatusTag
- PrimaryButton
- BottomActionBar
- LoadingIllustration
- ConfirmSheet
这样首次设置页的视觉语言就能自然延续到首页、成长、相册、家庭和设置页面。
最终整体效果应当像一本轻盈、温暖、可以每天打开的家庭成长日记，而不是传统的健康管理工具。
