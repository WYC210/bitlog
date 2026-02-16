use super::{
    builder::{self, SafeValue},
    schema, DatabaseTrait,
};
use crate::common::error::{CustomErrorInto, CustomResult};
use crate::config;
use async_trait::async_trait;
use serde_json::Value;
use sqlx::{Column, Executor, Row, SqlitePool, TypeInfo};
use std::collections::HashMap;
use std::env;

#[derive(Clone)]
pub struct Sqlite {
    pool: SqlitePool,
}

#[async_trait]
impl DatabaseTrait for Sqlite {
    async fn connect(db_config: &config::SqlConfig, _db: bool) -> CustomResult<Self> {
        let db_file = env::current_dir()?
            .join("assets")
            .join("sqllite")
            .join(&db_config.db_name);

        if !db_file.exists() {
            return Err("SQLite数据库文件不存在".into_custom_error());
        }

        let path = db_file
            .to_str()
            .ok_or("无法获取SQLite路径".into_custom_error())?;
        let connection_str = format!("sqlite:///{}", path);

        let pool = tokio::time::timeout(
            std::time::Duration::from_secs(5),
            SqlitePool::connect(&connection_str),
        )
        .await
        .map_err(|_| "连接超时".into_custom_error())??;

        if let Err(e) = pool.acquire().await {
            pool.close().await;
            return Err(format!("数据库连接测试失败: {}", e).into_custom_error());
        }

        Ok(Sqlite { pool })
    }

    async fn execute_query<'a>(
        &'a self,
        builder: &builder::QueryBuilder,
    ) -> CustomResult<Vec<HashMap<String, Value>>> {
        let (query, values) = builder.build()?;

        let mut sqlx_query = sqlx::query(&query);

        for value in values {
            match value {
                SafeValue::Null => sqlx_query = sqlx_query.bind(None::<String>),
                SafeValue::Bool(b) => sqlx_query = sqlx_query.bind(b),
                SafeValue::Integer(i) => sqlx_query = sqlx_query.bind(i),
                SafeValue::Float(f) => sqlx_query = sqlx_query.bind(f),
                SafeValue::Text(s, _) => sqlx_query = sqlx_query.bind(s),
                SafeValue::DateTime(dt) => sqlx_query = sqlx_query.bind(dt.to_rfc3339()),
            }
        }

        let rows = sqlx_query.fetch_all(&self.pool).await?;

        Ok(rows
            .into_iter()
            .map(|row| {
                row.columns()
                    .iter()
                    .map(|col| {
                        let value = match col.type_info().name() {
                            "INTEGER" => Value::Number(
                                row.try_get::<i64, _>(col.name()).unwrap_or_default().into(),
                            ),
                            "REAL" => Value::Number(
                                serde_json::Number::from_f64(
                                    row.try_get::<f64, _>(col.name()).unwrap_or(0.0),
                                )
                                .unwrap_or_else(|| 0.into()),
                            ),
                            "BOOLEAN" => Value::Bool(row.try_get(col.name()).unwrap_or_default()),
                            _ => Value::String(row.try_get(col.name()).unwrap_or_default()),
                        };
                        (col.name().to_string(), value)
                    })
                    .collect()
            })
            .collect())
    }

    async fn initialization(db_config: config::SqlConfig) -> CustomResult<()> {
        let db_prefix = SafeValue::Text(
            format!("{}", db_config.db_prefix),
            builder::ValidationLevel::Strict,
        );

        let sqlite_dir = env::current_dir()?.join("assets").join("sqllite");
        std::fs::create_dir_all(&sqlite_dir)?;

        let db_file = sqlite_dir.join(&db_config.db_name);
        std::fs::File::create(&db_file)?;

        let grammar = schema::generate_schema(super::DatabaseType::SQLite, db_prefix)?;

        let pool = Self::connect(&db_config, false).await?.pool;

        pool.execute(grammar.as_str()).await?;
        pool.close().await;

        Ok(())
    }
    async fn close(&self) -> CustomResult<()> {
        self.pool.close().await;
        while !self.pool.is_closed() {
            tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
        }
        Ok(())
    }
}
