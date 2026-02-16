use super::{
    builder::{self, SafeValue},
    schema, DatabaseTrait,
};
use crate::common::error::{CustomErrorInto, CustomResult};
use crate::config;
use async_trait::async_trait;
use serde_json::Value;
use sqlx::{Column, Executor, PgPool, Row, TypeInfo};
use std::collections::HashMap;

#[derive(Clone)]
pub struct Postgresql {
    pool: PgPool,
}

#[async_trait]
impl DatabaseTrait for Postgresql {
    async fn connect(db_config: &config::SqlConfig, db: bool) -> CustomResult<Self> {
        let connection_str;
        if db {
            connection_str = format!(
                "postgres://{}:{}@{}:{}/{}",
                db_config.user,
                db_config.password,
                db_config.host,
                db_config.port,
                db_config.db_name
            );
        } else {
            connection_str = format!(
                "postgres://{}:{}@{}:{}",
                db_config.user, db_config.password, db_config.host, db_config.port
            );
        }

        let pool = tokio::time::timeout(
            std::time::Duration::from_secs(5),
            PgPool::connect(&connection_str),
        )
        .await
        .map_err(|_| "连接超时".into_custom_error())??;

        if let Err(e) = pool.acquire().await {
            pool.close().await;
            return Err(format!("数据库连接测试失败: {}", e).into_custom_error());
        }

        Ok(Postgresql { pool })
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
                            "INT4" | "INT8" => Value::Number(
                                row.try_get::<i64, _>(col.name()).unwrap_or_default().into(),
                            ),
                            "FLOAT4" | "FLOAT8" => Value::Number(
                                serde_json::Number::from_f64(
                                    row.try_get::<f64, _>(col.name()).unwrap_or(0.0),
                                )
                                .unwrap_or_else(|| 0.into()),
                            ),
                            "BOOL" => Value::Bool(row.try_get(col.name()).unwrap_or_default()),
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
        let grammar = schema::generate_schema(super::DatabaseType::PostgreSQL, db_prefix)?;

        let pool = Self::connect(&db_config, false).await?.pool;

        pool.execute(format!("CREATE DATABASE {}", db_config.db_name).as_str())
            .await?;

        let new_pool = Self::connect(&db_config, true).await?.pool;

        new_pool.execute(grammar.as_str()).await?;
        new_pool.close().await;

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
