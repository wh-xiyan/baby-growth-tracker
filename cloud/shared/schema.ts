export interface FieldDefinition {
  name: string
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array'
  required?: boolean
  description: string
}

export interface CollectionSchema {
  fields: FieldDefinition[]
  indexes: Array<{ fields: Record<string, 1 | -1>; unique?: boolean; name: string }>
}

export const schemas: Record<string, CollectionSchema> = {
  users: {
    fields: [
      { name: 'openid', type: 'string', required: true, description: '微信 OPENID，唯一' },
      { name: 'nickname', type: 'string', description: '用户昵称' },
      { name: 'avatarUrl', type: 'string', description: '头像地址' },
      { name: 'createdAt', type: 'date', required: true, description: '创建时间' },
      { name: 'updatedAt', type: 'date', required: true, description: '更新时间' },
    ],
    indexes: [{ name: 'idx_openid_unique', fields: { openid: 1 }, unique: true }],
  },
  families: {
    fields: [
      { name: 'name', type: 'string', required: true, description: '家庭名称' },
      { name: 'ownerId', type: 'string', required: true, description: '家庭所有者用户 ID' },
      { name: 'inviteCode', type: 'string', required: true, description: '家庭邀请码，唯一' },
      { name: 'inviteCodeExpiresAt', type: 'date', description: '邀请码过期时间' },
      { name: 'createdAt', type: 'date', required: true, description: '创建时间' },
      { name: 'updatedAt', type: 'date', required: true, description: '更新时间' },
    ],
    indexes: [
      { name: 'idx_invite_code_unique', fields: { inviteCode: 1 }, unique: true },
      { name: 'idx_owner', fields: { ownerId: 1 } },
    ],
  },
  family_members: {
    fields: [
      { name: 'familyId', type: 'string', required: true, description: '家庭 ID' },
      { name: 'userId', type: 'string', required: true, description: '用户 ID' },
      { name: 'role', type: 'string', required: true, description: 'owner、adult 或 viewer' },
      { name: 'displayName', type: 'string', required: true, description: '家庭内显示名称' },
      { name: 'status', type: 'string', required: true, description: 'active 或 removed' },
      { name: 'joinedAt', type: 'date', required: true, description: '加入时间' },
      { name: 'updatedAt', type: 'date', description: '更新时间' },
    ],
    indexes: [
      { name: 'idx_family_user', fields: { familyId: 1, userId: 1 }, unique: true },
      { name: 'idx_user_status', fields: { userId: 1, status: 1 } },
      { name: 'idx_family_status', fields: { familyId: 1, status: 1 } },
    ],
  },
  children: {
    fields: [
      { name: 'familyId', type: 'string', required: true, description: '家庭 ID' },
      { name: 'name', type: 'string', required: true, description: '宝宝姓名或昵称' },
      { name: 'gender', type: 'string', description: 'male、female 或 unknown' },
      { name: 'birthday', type: 'date', required: true, description: '出生日期' },
      { name: 'avatarFileId', type: 'string', description: '云存储头像文件 ID' },
      { name: 'createdAt', type: 'date', required: true, description: '创建时间' },
      { name: 'updatedAt', type: 'date', required: true, description: '更新时间' },
    ],
    indexes: [{ name: 'idx_family_created', fields: { familyId: 1, createdAt: -1 } }],
  },
  growth_records: {
    fields: [
      { name: 'familyId', type: 'string', required: true, description: '家庭 ID' },
      { name: 'childId', type: 'string', required: true, description: '宝宝 ID' },
      { name: 'category', type: 'string', required: true, description: '成长记录分类' },
      { name: 'title', type: 'string', required: true, description: '记录标题' },
      { name: 'occurredAt', type: 'date', required: true, description: '发生时间' },
      { name: 'content', type: 'string', description: '记录内容' },
      {
        name: 'metrics',
        type: 'object',
        description:
          '按分类保存结构化字段：喂养方式、左右侧、时长、奶量、辅食名称、睡眠起止、身高和体重等',
      },
      { name: 'mediaFileIds', type: 'array', description: '关联媒体文件 ID' },
      { name: 'createdBy', type: 'string', required: true, description: '创建人用户 ID' },
      { name: 'createdAt', type: 'date', required: true, description: '创建时间' },
      { name: 'updatedAt', type: 'date', required: true, description: '更新时间' },
      { name: 'deletedAt', type: 'date', description: '软删除时间' },
    ],
    indexes: [
      { name: 'idx_child_occurred', fields: { familyId: 1, childId: 1, occurredAt: -1 } },
      { name: 'idx_category_occurred', fields: { familyId: 1, category: 1, occurredAt: -1 } },
    ],
  },
  vaccines: {
    fields: [
      { name: 'familyId', type: 'string', required: true, description: '家庭 ID' },
      { name: 'childId', type: 'string', required: true, description: '宝宝 ID' },
      { name: 'name', type: 'string', required: true, description: '疫苗名称' },
      { name: 'catalogId', type: 'string', description: '疫苗目录 ID' },
      { name: 'seriesId', type: 'string', description: '疫苗接种系列 ID' },
      { name: 'totalDoses', type: 'number', description: '系列总针数' },
      { name: 'doseNumber', type: 'number', required: true, description: '剂次' },
      { name: 'paymentType', type: 'string', description: 'free 或 self_paid' },
      { name: 'selfPaidVaccineNote', type: 'string', description: '自费疫苗说明' },
      { name: 'plannedDate', type: 'date', required: true, description: '计划接种时间' },
      { name: 'completedDate', type: 'date', description: '实际接种时间' },
      {
        name: 'status',
        type: 'string',
        required: true,
        description: 'planned、completed 或 skipped',
      },
      { name: 'reminderEnabled', type: 'boolean', required: true, description: '是否开启提醒' },
      { name: 'reminderDaysBefore', type: 'number', description: '提前提醒天数' },
      { name: 'completedBy', type: 'string', description: '完成接种的用户 ID' },
      { name: 'createdBy', type: 'string', description: '创建计划的用户 ID' },
      { name: 'institution', type: 'string', description: '接种机构' },
      { name: 'note', type: 'string', description: '备注' },
      { name: 'completedNote', type: 'string', description: '完成接种备注' },
      { name: 'reminderSentAt', type: 'date', description: '最近一次提醒发送时间' },
      { name: 'createdAt', type: 'date', required: true, description: '创建时间' },
      { name: 'updatedAt', type: 'date', required: true, description: '更新时间' },
    ],
    indexes: [
      { name: 'idx_child_planned', fields: { familyId: 1, childId: 1, plannedDate: 1 } },
      {
        name: 'idx_home_todo',
        fields: { familyId: 1, childId: 1, status: 1, plannedDate: 1 },
      },
      { name: 'idx_reminder_planned', fields: { reminderEnabled: 1, status: 1, plannedDate: 1 } },
      {
        name: 'idx_child_catalog_dose_unique',
        fields: { familyId: 1, childId: 1, catalogId: 1, doseNumber: 1 },
        unique: true,
      },
      { name: 'idx_series_dose', fields: { seriesId: 1, doseNumber: 1 } },
    ],
  },
  vaccine_series: {
    fields: [
      { name: 'familyId', type: 'string', required: true, description: '家庭 ID' },
      { name: 'childId', type: 'string', required: true, description: '宝宝 ID' },
      { name: 'catalogId', type: 'string', required: true, description: '疫苗目录 ID' },
      { name: 'vaccineName', type: 'string', required: true, description: '疫苗名称快照' },
      { name: 'totalDoses', type: 'number', required: true, description: '系列总针数' },
      { name: 'createdBy', type: 'string', required: true, description: '创建人用户 ID' },
      { name: 'createdAt', type: 'date', required: true, description: '创建时间' },
      { name: 'updatedAt', type: 'date', required: true, description: '更新时间' },
    ],
    indexes: [
      {
        name: 'idx_child_catalog_unique',
        fields: { familyId: 1, childId: 1, catalogId: 1 },
        unique: true,
      },
      { name: 'idx_child_updated', fields: { familyId: 1, childId: 1, updatedAt: -1 } },
      { name: 'idx_catalog_created', fields: { catalogId: 1, createdAt: -1 } },
    ],
  },
  vaccine_catalog: {
    fields: [
      { name: 'name', type: 'string', required: true, description: '疫苗标准名称' },
      { name: 'category', type: 'string', required: true, description: 'national 或 optional' },
      { name: 'aliases', type: 'array', description: '检索别名' },
      { name: 'description', type: 'string', description: '目录说明' },
      { name: 'active', type: 'boolean', required: true, description: '是否可选择' },
      { name: 'sortOrder', type: 'number', required: true, description: '展示排序' },
      { name: 'defaultDoses', type: 'number', description: '默认总针数' },
      { name: 'minDoses', type: 'number', description: '最少针数' },
      { name: 'maxDoses', type: 'number', description: '最多针数' },
      { name: 'doseIntervals', type: 'array', description: '各针次与前一针最小间隔天数' },
      { name: 'ageRule', type: 'object', description: '接种年龄规则说明' },
      { name: 'updatedAt', type: 'date', description: '更新时间' },
    ],
    indexes: [
      { name: 'idx_active_sort', fields: { active: 1, sortOrder: 1 } },
      { name: 'idx_category_sort', fields: { category: 1, sortOrder: 1 } },
    ],
  },
  media_assets: {
    fields: [
      { name: 'familyId', type: 'string', required: true, description: '家庭 ID' },
      { name: 'childId', type: 'string', required: true, description: '宝宝 ID' },
      { name: 'fileId', type: 'string', required: true, description: '云存储文件 ID' },
      { name: 'fileType', type: 'string', required: true, description: 'image 或 video' },
      { name: 'recordId', type: 'string', description: '关联成长记录 ID' },
      { name: 'size', type: 'number', description: '文件大小，单位字节' },
      { name: 'duration', type: 'number', description: '视频时长，单位秒' },
      { name: 'takenAt', type: 'date', description: '拍摄时间' },
      { name: 'caption', type: 'string', description: '媒体说明' },
      { name: 'uploadedBy', type: 'string', required: true, description: '上传人用户 ID' },
      { name: 'createdAt', type: 'date', required: true, description: '创建时间' },
      { name: 'deletedAt', type: 'date', description: '软删除时间' },
    ],
    indexes: [
      { name: 'idx_child_created', fields: { familyId: 1, childId: 1, createdAt: -1 } },
      { name: 'idx_record_created', fields: { recordId: 1, createdAt: -1 } },
    ],
  },
}
