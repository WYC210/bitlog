# 数据库字段设计（兼容 D1/Postgres/MySQL/SQLite）

## 设计原则
- 使用跨库通用类型（TEXT/INTEGER/BOOLEAN）
- 时间统一为 ISO8601 字符串（必要时可加 epoch 字段）
- JSON 统一存储为 TEXT（由应用层解析）
- 仅依赖公共 SQL 子集，复杂查询下沉到应用层
- 多前端共享同一内容库，不引入 tenant_id/namespace
- 可配置多个数据库条目作为备选/迁移，不做跨库同步
- 多库条目仅作切换，不做跨库写入

---

## 表结构

### 1) posts
| 字段 | 类型 | 约束/说明 |
|------|------|-----------|
| id | TEXT | 主键（UUID/ULID） |
| slug | TEXT | 唯一索引 |
| title | TEXT | 文章标题 |
| summary | TEXT | 摘要（可选） |
| content | TEXT | 正文（Markdown/HTML） |
| status | TEXT | draft/published |
| cover_asset_id | TEXT | 关联 assets.id（可选） |
| category_id | TEXT | 关联 categories.id（可选，单分类） |
| published_at | TEXT | 发布时间（ISO8601） |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

索引建议：
- UNIQUE(slug)
- INDEX(status, published_at)
- INDEX(category_id)

### 2) tags
| 字段 | 类型 | 约束/说明 |
|------|------|-----------|
| id | TEXT | 主键 |
| name | TEXT | 标签名 |
| slug | TEXT | 唯一索引 |
| created_at | TEXT | 创建时间 |

索引建议：
- UNIQUE(slug)

### 3) post_tags
| 字段 | 类型 | 约束/说明 |
|------|------|-----------|
| post_id | TEXT | 外键（posts.id） |
| tag_id | TEXT | 外键（tags.id） |

索引建议：
- PRIMARY KEY(post_id, tag_id)

### 4) categories
| 字段 | 类型 | 约束/说明 |
|------|------|-----------|
| id | TEXT | 主键 |
| name | TEXT | 分类名 |
| slug | TEXT | 唯一索引 |
| description | TEXT | 描述（可选） |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

索引建议：
- UNIQUE(slug)

### 5) pages
| 字段 | 类型 | 约束/说明 |
|------|------|-----------|
| id | TEXT | 主键 |
| slug | TEXT | 唯一索引 |
| title | TEXT | 页面标题 |
| content | TEXT | 正文 |
| status | TEXT | draft/published |
| order_index | INTEGER | 排序（可选） |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

索引建议：
- UNIQUE(slug)

### 6) assets
| 字段 | 类型 | 约束/说明 |
|------|------|-----------|
| id | TEXT | 主键 |
| provider | TEXT | r2/s3/oss 等 |
| bucket | TEXT | 存储桶/空间 |
| object_key | TEXT | 对象路径 |
| url | TEXT | 访问地址 |
| content_type | TEXT | MIME |
| size | INTEGER | 字节数 |
| checksum | TEXT | 可选（md5/sha256） |
| created_at | TEXT | 创建时间 |

索引建议：
- INDEX(provider, bucket)

### 7) settings
| 字段 | 类型 | 约束/说明 |
|------|------|-----------|
| key | TEXT | 主键 |
| value | TEXT | JSON/Text |
| updated_at | TEXT | 更新时间 |

用途示例：
- site_list（站点列表）
- default_site（默认站点）
- profile（当前 Profile）

### 8) site_nodes（可选，若不使用 settings JSON）
| 字段 | 类型 | 约束/说明 |
|------|------|-----------|
| id | TEXT | 主键 |
| name | TEXT | 站点名 |
| base_url | TEXT | 站点地址（唯一） |
| region | TEXT | 区域（可选） |
| priority | INTEGER | 优先级 |
| enabled | BOOLEAN | 是否启用 |
| updated_at | TEXT | 更新时间 |

索引建议：
- UNIQUE(base_url)

### 9) admin_accounts
| 字段 | 类型 | 约束/说明 |
|------|------|-----------|
| id | TEXT | 主键（建议固定为 admin） |
| display_name | TEXT | 显示名（可选） |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

### 10) admin_auth_providers
| 字段 | 类型 | 约束/说明 |
|------|------|-----------|
| id | TEXT | 主键 |
| admin_id | TEXT | 关联 admin_accounts.id |
| provider | TEXT | password/passkey/oauth/wechat/email 等 |
| provider_ref | TEXT | 外部标识（可选，如 openid） |
| secret | TEXT | 秘钥/口令哈希（可选，需加密存储） |
| config | TEXT | JSON/Text（可选，需加密存储） |
| enabled | BOOLEAN | 是否启用 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |
| last_used_at | TEXT | 最近使用时间（可选） |

索引建议：
- INDEX(admin_id, provider)

### 11) admin_mfa_providers
| 字段 | 类型 | 约束/说明 |
|------|------|-----------|
| id | TEXT | 主键 |
| admin_id | TEXT | 关联 admin_accounts.id |
| provider | TEXT | totp/wechat/email/sms 等 |
| provider_ref | TEXT | 外部标识（可选，如 openid） |
| secret | TEXT | 秘钥（可选，需加密存储） |
| config | TEXT | JSON/Text（可选，需加密存储） |
| enabled | BOOLEAN | 是否启用 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |
| last_used_at | TEXT | 最近使用时间（可选） |

索引建议：
- INDEX(admin_id, provider)

### 12) admin_sessions
| 字段 | 类型 | 约束/说明 |
|------|------|-----------|
| id | TEXT | 主键 |
| admin_id | TEXT | 关联 admin_accounts.id |
| token_hash | TEXT | 会话 token 哈希 |
| expires_at | TEXT | 过期时间 |
| revoked_at | TEXT | 失效时间（可选） |
| created_at | TEXT | 创建时间 |

索引建议：
- INDEX(token_hash)
- INDEX(expires_at)

---

## 兼容性与迁移建议
- D1/SQLite 不支持某些高级索引与 JSON 运算，建议在应用层处理
- 迁移脚本按 Profile 生成（D1/PG/SQLite/MySQL）
- 若需要全文搜索，可增加 search_index 表或外部索引服务
