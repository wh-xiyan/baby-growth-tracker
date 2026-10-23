# 家庭关联实施与部署说明

日期：2026-10-22。对应 family-association-prd.md 与 prototypes/family/index.html。

## 已实现

- 游客个人宝宝基础档案创建、更正；游客首页不再强制创建家庭，不查询家庭业务数据。
- 我的家庭入口，家庭概览、个人/家庭宝宝、邀请验证与分享、加入申请、申请进度与取消。
- 爸爸/妈妈默认管理员，祖辈/照护者普通成员，其他家人只读；创建者独立于亲属身份。
- 展示称谓立即修改；实际身份审批后更改，同时释放旧身份名额、按新身份计算角色。创建者直接确认；旧账号首次补选保留原角色。
- 唯一家庭、唯一亲属身份、唯一待处理申请；事务内账号锁、确定性身份占位、并发版本及操作回执。
- 创建者专属管理员管理与创建者转让；普通管理员仅审批/管理普通和只读。
- 普通成员新增及修改/删除本人业务记录，管理员管理全部。照护详情补齐编辑/删除入口，保留原分类与结构化字段。
- 疫苗计划归创建者管理；普通成员可对家庭计划记录本人接种事件，独立保存事件作者，编辑/删除本人接种事件。投影继续兼容原疫苗列表/首页，后续已接种时禁止删除前序事件。
- 退出/移除后用户归属和身份名额释放，家庭宝宝、历史业务与媒体保留；创建者先转让才能退出。
- 首页、成长、照护列表/详情、疫苗、相册、我的展示身份入口。重新进入页面同步权限，关闭原生媒体预览仍保留页面状态。
- 原有单家庭账号兼容，首次事务获取用户归属锁；多旧家庭账号可逐个选择旧家庭，转让/退出到只保留一个家庭。期间禁止业务写入。
- 本地演示使用同一纯领域规则，保存在本机；本地邀请码无法跨设备使用，没有自动伪造其他家人或审批。

## 代码位置

- src/domain/family.ts：无平台依赖的事务领域操作，供小程序演示与云端打包复用。
- src/services/family.ts：家庭调用、会话刷新、本地数据库、幂等重试；permissions.ts统一客户端入口保护。
- src/pages/family/：Taro原生组件构建的家庭工作区，内部视图导航。
- src/pages/onboarding/：个人宝宝建档。
- cloud/shared/family.ts：身份认证、有限邀请预览、会话、事务端口。
- cloud/functions/familyAction/：家庭读写动作统一入口。
- cloud/functions/manageVaccineCompletion/：接种事件更新/删除。

## 云端部署

本次只准备代码、构建产物及本地检查，不自动上传真实云函数、不改真实数据库。

1. 备份现有家庭、成员、宝宝、疫苗数据，审查旧用户多家庭、旧身份重复及作者字段缺失情况。
2. 在同一云环境新建以下集合（空集合也需要创建）：family_identity_slots、family_invitations、family_requests、family_audit_logs、family_operations、vaccine_completion_events。
3. 根据 cloud/shared/schema.ts 创建新增索引；重点包括：
   - family_identity_slots: familyId + relationshipCode 唯一；familyId + _id 查询。
   - family_members: userId + status + _id；familyId + status + _id。
   - children: createdBy + scope + _id；familyId + _id。
   - family_requests: userId + _id；familyId + status + _id。
   - family_invitations: familyId + status + _id。
4. 所有家庭、用户、申请、身份、业务数据库集合禁止客户端直接读写；云函数通过 getWXContext 获取身份。云存储使用私有访问规则并验证现有媒体预览路径；不能保留公开读写规则。
5. pnpm cloud:build 后从 cloud/dist/functions/ 上传全部函数并安装依赖。本次公共权限工具影响所有依赖函数，不能只上传 familyAction。
6. 新增 familyAction、manageVaccineCompletion；更新 login、createFamily、joinFamily、createChild、updateChild、completeVaccine、updateVaccine、deleteVaccine、deleteMediaAsset 及所有打包引用共享权限的函数。建议同批上传全部函数。
7. 将 pnpm build:weapp 生成的根目录 dist/ 导入微信开发者工具。前后端同批发布，旧前端 createFamily/joinFamily 参数不能继续直连旧授权逻辑。

schema.ts 是声明清单，不会自动建集合或索引。

## 数据兼容与隐私

旧 children.familyId 有值而无scope仍按家庭宝宝读取。新个人档案必须有scope=personal、createdBy且familyId为空。旧成员没有亲属身份时从家庭页补选，不推断爸爸/妈妈，不主动降权。新家庭保留不可用于加入的RESERVED邀请码字段，以兼容原有唯一索引；有效邀请只走family_invitations。

邀请使用96位随机令牌，数据库文档ID为SHA256摘要；原文仅生成时返回一次，不写入邀请或操作回执。默认7天、10次成功提交申请；审批重新校验有效性和身份名额。操作回执不储存邀请原文；响应丢失时需重新生成邀请。

旧账号如果已经手工写入relationshipCode但没有身份占位，需先核对并回填family_identity_slots；有冲突时人工确认，不覆盖已有成员或自动删数据。

退出后不会删除作者历史，也不会把家庭宝宝复制到个人空间。缓存清除不等于撤回已下载文件或已经签发的临时地址；新请求必须鉴权，存储本身保持私有。

身份申请在待处理期间不占位；审批竞争失败保持原状态，申请人可取消并重选。失效邀请对应的待审批申请需取消后重新提交，审批时会明确拒绝失效邀请。

疫苗接种事件按计划ID保存当前有效事件及版本，保留疫苗投影兼容旧页面；旧已完成疫苗通过completedBy判断作者，缺失作者时仅管理员可更正。接种日期变更校验前后已完成剂次顺序。

## 检查与人工验收

自动检查：pnpm lint、pnpm format:check、pnpm exec tsc --noEmit --skipLibCheck、pnpm cloud:typecheck、pnpm cloud:build、pnpm build:weapp。

上述检查已通过，微信构建产物位于根目录 dist/，云函数构建产物位于 cloud/dist/functions/。自动回归的19项家庭领域检查、云函数入口集成检查与14项成长回归均通过；集成检查使用模拟数据库事务，不代替真实云环境验收。

回归命令：

- node tests/family.cjs：19项家庭领域场景，含失败事务回滚、单家庭、身份名额、申请角色、称谓与权限、归入宝宝、退出转让。
- node tests/family-cloud.cjs：调用真实云函数入口，模拟事务SDK；验证并发创建、幂等、邀请摘要、游客隔离、角色伪造及接种事件独立作者/权限/版本。
- node tests/growth.cjs：原有14项成长、媒体删除与预览返回回归。

当前没有可调用的微信开发者工具或浏览器控制工具，以下尚需真实环境验证：

1. 两个微信账号通过邀请分享、审批加入，并发申请同身份；普通管理员不得审批管理员。
2. 普通、只读、管理员角色在照护/成长/疫苗记录上的查看、上传、编辑、删除矩阵。
3. 正在编辑或上传时降权/移除，服务端拒绝写入；返回家庭页看到更新后的身份。
4. 创建者更换亲属身份、转让后退出、普通成员退出，原家庭数据保留。
5. 旧单家庭身份补选、多家庭整理、旧接种作者缺失的管理员修复。
6. 视频/图片全屏关闭不刷新表单；邀请码分享、原生Picker、页面滚动与加载错误展示。
7. 真云事务、索引、私有存储规则以及跨设备会话刷新。
