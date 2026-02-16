use super::builder::{Identifier, Operator, SafeValue, ValidationLevel, WhereClause};
use super::DatabaseType;
use crate::common::error::{CustomErrorInto, CustomResult};
use std::fmt::Display;

#[derive(Debug, Clone, PartialEq)]
pub enum FieldType {
    Integer(bool),
    BigInt,
    VarChar(usize),
    Text,
    Boolean,
    Timestamp,
}

#[derive(Debug, Clone)]
pub struct FieldConstraint {
    pub is_primary: bool,
    pub is_unique: bool,
    pub is_nullable: bool,
    pub default_value: Option<SafeValue>,
    pub check_constraint: Option<WhereClause>,
    pub foreign_key: Option<ForeignKey>,
}

#[derive(Debug, Clone)]
pub enum ForeignKeyAction {
    Cascade,
    Restrict,
    SetNull,
    NoAction,
    SetDefault,
}

#[derive(Debug, Clone)]
pub struct ForeignKey {
    pub ref_table: String,
    pub ref_column: String,
    pub on_delete: Option<ForeignKeyAction>,
    pub on_update: Option<ForeignKeyAction>,
}

impl Display for ForeignKeyAction {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let str = match self {
            ForeignKeyAction::Cascade => "CASCADE",
            ForeignKeyAction::Restrict => "RESTRICT",
            ForeignKeyAction::SetNull => "SET NULL",
            ForeignKeyAction::NoAction => "NO ACTION",
            ForeignKeyAction::SetDefault => "SET DEFAULT",
        }
        .to_string();
        write!(f, "{}", str)
    }
}

#[derive(Debug, Clone)]
pub struct Field {
    pub name: Identifier,
    pub field_type: FieldType,
    pub constraints: FieldConstraint,
}

#[derive(Debug, Clone)]
pub struct Table {
    pub name: Identifier,
    pub fields: Vec<Field>,
    pub indexes: Vec<Index>,
    pub primary_keys: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct Index {
    pub name: Identifier,
    pub fields: Vec<Identifier>,
    pub is_unique: bool,
}

impl FieldConstraint {
    pub fn new() -> Self {
        Self {
            is_primary: false,
            is_unique: false,
            is_nullable: true,
            default_value: None,
            check_constraint: None,
            foreign_key: None,
        }
    }

    pub fn primary(mut self) -> Self {
        self.is_primary = true;
        self.is_nullable = false;
        self
    }

    pub fn unique(mut self) -> Self {
        self.is_unique = true;
        self
    }

    pub fn not_null(mut self) -> Self {
        self.is_nullable = false;
        self
    }

    pub fn default(mut self, value: SafeValue) -> Self {
        self.default_value = Some(value);
        self
    }

    pub fn check(mut self, clause: WhereClause) -> Self {
        self.check_constraint = Some(clause);
        self
    }

    pub fn foreign_key(mut self, ref_table: String, ref_column: String) -> Self {
        self.foreign_key = Some(ForeignKey {
            ref_table,
            ref_column,
            on_delete: None,
            on_update: None,
        });
        self
    }

    pub fn on_delete(mut self, action: ForeignKeyAction) -> Self {
        if let Some(ref mut fk) = self.foreign_key {
            fk.on_delete = Some(action);
        }
        self
    }

    pub fn on_update(mut self, action: ForeignKeyAction) -> Self {
        if let Some(ref mut fk) = self.foreign_key {
            fk.on_update = Some(action);
        }
        self
    }
}

impl Field {
    pub fn new(
        name: &str,
        field_type: FieldType,
        constraints: FieldConstraint,
    ) -> CustomResult<Self> {
        Ok(Self {
            name: Identifier::new(name.to_string())?,
            field_type,
            constraints,
        })
    }

    fn field_type_sql(&self, db_type: DatabaseType) -> CustomResult<String> {
        Ok(match &self.field_type {
            FieldType::Integer(auto_increment) => {
                if *auto_increment && self.constraints.is_primary {
                    match db_type {
                        DatabaseType::MySQL => "INT AUTO_INCREMENT".to_string(),
                        DatabaseType::PostgreSQL => {
                            "INTEGER GENERATED ALWAYS AS IDENTITY".to_string()
                        }
                        DatabaseType::SQLite => "INTEGER".to_string(),
                    }
                } else {
                    match db_type {
                        DatabaseType::MySQL => "INT".to_string(),
                        _ => "INTEGER".to_string(),
                    }
                }
            }
            FieldType::BigInt => "BIGINT".to_string(),
            FieldType::VarChar(size) => format!("VARCHAR({})", size),
            FieldType::Text => "TEXT".to_string(),
            FieldType::Boolean => match db_type {
                DatabaseType::PostgreSQL => "BOOLEAN".to_string(),
                DatabaseType::MySQL => "BOOLEAN".to_string(),
                DatabaseType::SQLite => "INTEGER".to_string(),
            },
            FieldType::Timestamp => match db_type {
                DatabaseType::PostgreSQL => "TIMESTAMP WITH TIME ZONE".to_string(),
                DatabaseType::MySQL => "TIMESTAMP".to_string(),
                DatabaseType::SQLite => "TEXT".to_string(),
            },
        })
    }

    fn build_check_constraint(check: &WhereClause) -> CustomResult<String> {
        match check {
            WhereClause::Condition(condition) => {
                let field_name = condition.field.as_str();
                match condition.operator {
                    Operator::In => {
                        if let Some(SafeValue::Text(values, _)) = &condition.value {
                            Ok(format!("{} IN {}", field_name, values))
                        } else {
                            Err("Invalid IN clause value".into_custom_error())
                        }
                    }
                    Operator::IsNull => Ok(format!("{} IS NULL", field_name)),
                    Operator::Eq
                    | Operator::Ne
                    | Operator::Gt
                    | Operator::Lt
                    | Operator::Gte
                    | Operator::Lte => {
                        if let Some(value) = &condition.value {
                            Ok(format!(
                                "{} {} {}",
                                field_name,
                                condition.operator.as_str(),
                                value.to_string()?
                            ))
                        } else {
                            Err("Missing value for comparison".into_custom_error())
                        }
                    }
                    _ => Err("Unsupported operator for CHECK constraint".into_custom_error()),
                }
            }
            WhereClause::And(conditions) => {
                let conditions: CustomResult<Vec<String>> = conditions
                    .iter()
                    .map(|c| Self::build_check_constraint(c))
                    .collect();
                Ok(format!("({})", conditions?.join(" AND ")))
            }
            WhereClause::Or(conditions) => {
                let conditions: CustomResult<Vec<String>> = conditions
                    .iter()
                    .map(|c| Self::build_check_constraint(c))
                    .collect();
                Ok(format!("({})", conditions?.join(" OR ")))
            }
            WhereClause::Not(condition) => {
                let inner_condition = WhereClause::Condition(condition.clone());
                Ok(format!(
                    "NOT ({})",
                    Self::build_check_constraint(&inner_condition)?
                ))
            }
        }
    }

    pub fn to_sql(&self, db_type: DatabaseType) -> CustomResult<String> {
        let mut sql = format!("{} {}", self.name.as_str(), self.field_type_sql(db_type)?);

        if !self.constraints.is_nullable {
            sql.push_str(" NOT NULL");
        }
        if self.constraints.is_unique {
            sql.push_str(" UNIQUE");
        }
        if self.constraints.is_primary && db_type == DatabaseType::SQLite {
            match &self.field_type {
                FieldType::Integer(true) => {
                    sql.push_str(" PRIMARY KEY AUTOINCREMENT");
                }
                _ => {}
            }
        } else if self.constraints.is_primary {
            match (db_type, &self.field_type) {
                (DatabaseType::MySQL, FieldType::Integer(true)) => {
                    sql.push_str(" PRIMARY KEY AUTO_INCREMENT");
                }
                (DatabaseType::PostgreSQL, FieldType::Integer(true)) => {
                    sql.push_str(" PRIMARY KEY GENERATED ALWAYS AS IDENTITY");
                }
                _ => sql.push_str(" PRIMARY KEY"),
            }
        }
        if let Some(default) = &self.constraints.default_value {
            sql.push_str(&format!(" DEFAULT {}", default.to_string()?));
        }
        if let Some(check) = &self.constraints.check_constraint {
            let check_sql = Self::build_check_constraint(check)?;
            sql.push_str(&format!(" CHECK ({})", check_sql));
        }
        if let Some(fk) = &self.constraints.foreign_key {
            sql.push_str(&format!(" REFERENCES {}({})", fk.ref_table, fk.ref_column));

            if let Some(on_delete) = &fk.on_delete {
                sql.push_str(&format!(" ON DELETE {}", on_delete.to_string()));
            }

            if let Some(on_update) = &fk.on_update {
                sql.push_str(&format!(" ON UPDATE {}", on_update.to_string()));
            }
        }

        Ok(sql)
    }
}

impl Table {
    pub fn new(name: &str) -> CustomResult<Self> {
        Ok(Self {
            name: Identifier::new(name.to_string())?,
            fields: Vec::new(),
            indexes: Vec::new(),
            primary_keys: Vec::new(),
        })
    }

    pub fn add_field(&mut self, field: Field) -> &mut Self {
        if field.constraints.is_primary {
            self.primary_keys.push(field.name.as_str().to_string());
        }
        self.fields.push(field);
        self
    }

    pub fn add_index(&mut self, index: Index) -> &mut Self {
        self.indexes.push(index);
        self
    }

    pub fn to_sql(&self, db_type: DatabaseType) -> CustomResult<String> {
        let mut fields_sql: CustomResult<Vec<String>> =
            self.fields.iter().map(|f| f.to_sql(db_type)).collect();
        let fields_sql = fields_sql?;

        let mut sql = String::new();
        
        match db_type {
            DatabaseType::SQLite => {
                if self.primary_keys.len() > 1 {
                    sql = format!(
                        "CREATE TABLE {} (\n    {},\n    CONSTRAINT pk_{} PRIMARY KEY ({}))",
                        self.name.as_str(),
                        fields_sql.join(",\n    "),
                        self.name.as_str(),
                        self.primary_keys.join(", ")
                    );
                } else {
                    sql = format!(
                        "CREATE TABLE {} (\n    {}\n)",
                        self.name.as_str(),
                        fields_sql.join(",\n    ")
                    );
                }
            }
            _ => {
                if self.primary_keys.len() > 1 {
                    sql = format!(
                        "CREATE TABLE {} (\n    {},\n    PRIMARY KEY ({}))",
                        self.name.as_str(),
                        fields_sql.join(",\n    "),
                        self.primary_keys.join(", ")
                    );
                } else {
                    sql = format!(
                        "CREATE TABLE {} (\n    {}\n)",
                        self.name.as_str(),
                        fields_sql.join(",\n    ")
                    );
                }
            }
        }

        sql.push(';');

        // 添加索引
        for index in &self.indexes {
            sql.push_str(&format!(
                "\n\n{}",
                index.to_sql(self.name.as_str(), db_type)?
            ));
        }

        Ok(sql)
    }
}

impl Index {
    pub fn new(name: &str, fields: Vec<String>, is_unique: bool) -> CustomResult<Self> {
        Ok(Self {
            name: Identifier::new(name.to_string())?,
            fields: fields
                .into_iter()
                .map(|f| Identifier::new(f))
                .collect::<CustomResult<Vec<_>>>()?,
            is_unique,
        })
    }

    fn to_sql(&self, table_name: &str, _db_type: DatabaseType) -> CustomResult<String> {
        let unique = if self.is_unique { "UNIQUE " } else { "" };
        Ok(format!(
            "CREATE {}INDEX {} ON {} ({});",
            unique,
            self.name.as_str(),
            table_name,
            self.fields
                .iter()
                .map(|f| f.as_str())
                .collect::<Vec<_>>()
                .join(", ")
        ))
    }
}

// Schema构建器
#[derive(Debug, Default)]
pub struct SchemaBuilder {
    tables: Vec<Table>,
}

impl SchemaBuilder {
    pub fn new() -> Self {
        Self { tables: Vec::new() }
    }

    pub fn add_table(&mut self, table: Table) -> CustomResult<&mut Self> {
        self.tables.push(table);
        Ok(self)
    }

    pub fn build(&self, db_type: DatabaseType) -> CustomResult<String> {
        let mut sql = String::new();
        for table in &self.tables {
            sql.push_str(&table.to_sql(db_type)?);
            sql.push_str("\n\n");
        }
        Ok(sql)
    }
}

pub fn generate_schema(db_type: DatabaseType, db_prefix: SafeValue) -> CustomResult<String> {
    let db_prefix = db_prefix.to_string()?;
    let mut schema = SchemaBuilder::new();

    // 用户表
    let mut users_table = Table::new(&format!("{}users", db_prefix))?;
    users_table
        .add_field(Field::new(
            "username",
            FieldType::VarChar(100),
            FieldConstraint::new().primary(),
        )?)
        .add_field(Field::new(
            "avatar_url",
            FieldType::VarChar(255),
            FieldConstraint::new(),
        )?)
        .add_field(Field::new(
            "email",
            FieldType::VarChar(255),
            FieldConstraint::new().unique().not_null(),
        )?)
        .add_field(Field::new(
            "password_hash",
            FieldType::VarChar(255),
            FieldConstraint::new().not_null(),
        )?)
        .add_field(Field::new(
            "role",
            FieldType::VarChar(20),
            FieldConstraint::new().not_null(),
        )?)
        .add_field(Field::new(
            "created_at",
            FieldType::Timestamp,
            FieldConstraint::new().not_null().default(SafeValue::Text(
                "CURRENT_TIMESTAMP".to_string(),
                ValidationLevel::Strict,
            )),
        )?)
        .add_field(Field::new(
            "updated_at",
            FieldType::Timestamp,
            FieldConstraint::new().not_null().default(SafeValue::Text(
                "CURRENT_TIMESTAMP".to_string(),
                ValidationLevel::Strict,
            )),
        )?);

    schema.add_table(users_table)?;

    // 独立页面表

    let mut pages_table = Table::new(&format!("{}pages", db_prefix))?;
    pages_table
        .add_field(Field::new(
            "id",
            FieldType::Integer(true),
            FieldConstraint::new().primary(),
        )?)
        .add_field(Field::new(
            "title",
            FieldType::VarChar(255),
            FieldConstraint::new().not_null(),
        )?)
        .add_field(Field::new(
            "content",
            FieldType::Text,
            FieldConstraint::new().not_null(),
        )?)
        .add_field(Field::new(
            "is_editor",
            FieldType::Boolean,
            FieldConstraint::new()
                .not_null()
                .default(SafeValue::Bool(false)),
        )?)
        .add_field(Field::new(
            "draft_content",
            FieldType::Text,
            FieldConstraint::new(),
        )?)
        .add_field(Field::new(
            "template",
            FieldType::VarChar(50),
            FieldConstraint::new(),
        )?)
        .add_field(Field::new(
            "status",
            FieldType::VarChar(20),
            FieldConstraint::new().not_null(),
        )?);

    schema.add_table(pages_table)?;

    // 文章表
    let mut posts_table = Table::new(&format!("{}posts", db_prefix))?;
    posts_table
        .add_field(Field::new(
            "id",
            FieldType::Integer(true),
            FieldConstraint::new().primary(),
        )?)
        .add_field(Field::new(
            "author_name",
            FieldType::VarChar(100),
            FieldConstraint::new()
                .not_null()
                .foreign_key(format!("{}users", db_prefix), "username".to_string())
                .on_delete(ForeignKeyAction::Cascade)
                .on_update(ForeignKeyAction::Cascade),
        )?)
        .add_field(Field::new(
            "cover_image",
            FieldType::VarChar(255),
            FieldConstraint::new(),
        )?)
        .add_field(Field::new(
            "title",
            FieldType::VarChar(255),
            FieldConstraint::new(),
        )?)
        .add_field(Field::new(
            "content",
            FieldType::Text,
            FieldConstraint::new().not_null(),
        )?)
        .add_field(Field::new(
            "status",
            FieldType::VarChar(20),
            FieldConstraint::new().not_null(),
        )?)
        .add_field(Field::new(
            "is_editor",
            FieldType::Boolean,
            FieldConstraint::new()
                .not_null()
                .default(SafeValue::Bool(false)),
        )?)
        .add_field(Field::new(
            "draft_content",
            FieldType::Text,
            FieldConstraint::new(),
        )?)
        .add_field(Field::new(
            "created_at",
            FieldType::Timestamp,
            FieldConstraint::new().not_null().default(SafeValue::Text(
                "CURRENT_TIMESTAMP".to_string(),
                ValidationLevel::Strict,
            )),
        )?)
        .add_field(Field::new(
            "updated_at",
            FieldType::Timestamp,
            FieldConstraint::new().not_null().default(SafeValue::Text(
                "CURRENT_TIMESTAMP".to_string(),
                ValidationLevel::Strict,
            )),
        )?);

    schema.add_table(posts_table)?;

    // 资源库表
    let mut resources_table = Table::new(&format!("{}resources", db_prefix))?;
    resources_table
        .add_field(Field::new(
            "id",
            FieldType::Integer(true),
            FieldConstraint::new().primary(),
        )?)
        .add_field(Field::new(
            "author_id",
            FieldType::VarChar(100),
            FieldConstraint::new()
                .not_null()
                .foreign_key(format!("{}users", db_prefix), "username".to_string())
                .on_delete(ForeignKeyAction::Cascade)
                .on_update(ForeignKeyAction::Cascade),
        )?)
        .add_field(Field::new(
            "name",
            FieldType::VarChar(255),
            FieldConstraint::new().not_null(),
        )?)
        .add_field(Field::new(
            "size_bytes",
            FieldType::BigInt,
            FieldConstraint::new().not_null(),
        )?)
        .add_field(Field::new(
            "storage_path",
            FieldType::VarChar(255),
            FieldConstraint::new().not_null().unique(),
        )?)
        .add_field(Field::new(
            "mime_type",
            FieldType::VarChar(50),
            FieldConstraint::new().not_null(),
        )?)
        .add_field(Field::new(
            "category",
            FieldType::VarChar(50),
            FieldConstraint::new(),
        )?)
        .add_field(Field::new(
            "description",
            FieldType::VarChar(255),
            FieldConstraint::new(),
        )?)
        .add_field(Field::new(
            "created_at",
            FieldType::Timestamp,
            FieldConstraint::new().not_null().default(SafeValue::Text(
                "CURRENT_TIMESTAMP".to_string(),
                ValidationLevel::Strict,
            )),
        )?);

    schema.add_table(resources_table)?;

    // 自定义字段表
    let mut fields_table = Table::new(&format!("{}fields", db_prefix))?;
    fields_table
        .add_field(Field::new(
            "target_type",
            FieldType::VarChar(20),
            FieldConstraint::new().not_null().primary(),
        )?)
        .add_field(Field::new(
            "target_id",
            FieldType::Integer(false),
            FieldConstraint::new().not_null().primary(),
        )?)
        .add_field(Field::new(
            "field_type",
            FieldType::VarChar(50),
            FieldConstraint::new().not_null().primary(),
        )?)
        .add_field(Field::new(
            "field_key",
            FieldType::VarChar(50),
            FieldConstraint::new().not_null().primary(),
        )?)
        .add_field(Field::new(
            "field_value",
            FieldType::Text,
            FieldConstraint::new(),
        )?);

    fields_table.add_index(Index::new(
        "idx_fields_target",
        vec!["target_type".to_string(), "target_id".to_string()],
        false,
    )?);

    schema.add_table(fields_table)?;

    // 分类—标签 表
    let mut taxonomies_table = Table::new(&format!("{}taxonomies", db_prefix))?;
    taxonomies_table
        .add_field(Field::new(
            "name",
            FieldType::VarChar(50),
            FieldConstraint::new().primary(),
        )?)
        .add_field(Field::new(
            "slug",
            FieldType::VarChar(50),
            FieldConstraint::new().not_null().unique(),
        )?)
        .add_field(Field::new(
            "type",
            FieldType::VarChar(20),
            FieldConstraint::new().not_null(),
        )?)
        .add_field(Field::new(
            "parent_name",
            FieldType::VarChar(50),
            FieldConstraint::new()
                .foreign_key(format!("{}taxonomies", db_prefix), "name".to_string())
                .on_delete(ForeignKeyAction::SetNull)
                .on_update(ForeignKeyAction::Cascade),
        )?);

    schema.add_table(taxonomies_table)?;

    // 分类—标签_文章 关系表
    let mut post_taxonomies_table = Table::new(&format!("{}post_taxonomies", db_prefix))?;
    post_taxonomies_table
        .add_field(Field::new(
            "post_id",
            FieldType::Integer(false),
            FieldConstraint::new()
                .not_null()
                .foreign_key(format!("{}posts", db_prefix), "id".to_string())
                .on_delete(ForeignKeyAction::Cascade)
                .on_update(ForeignKeyAction::Cascade),
        )?)
        .add_field(Field::new(
            "taxonomy_name",
            FieldType::VarChar(50),
            FieldConstraint::new()
                .not_null()
                .foreign_key(format!("{}taxonomies", db_prefix), "name".to_string())
                .on_delete(ForeignKeyAction::Cascade)
                .on_update(ForeignKeyAction::Cascade),
        )?);

    post_taxonomies_table.add_index(Index::new(
        "pk_post_taxonomies",
        vec!["post_id".to_string(), "taxonomy_name".to_string()],
        true,
    )?);

    schema.add_table(post_taxonomies_table)?;

    schema.build(db_type)
}
