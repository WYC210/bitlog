pub mod builder;
mod mysql;
mod postgresql;
mod schema;
mod sqllite;

use crate::common::error::{CustomErrorInto, CustomResult};
use crate::config;
use async_trait::async_trait;
use std::{collections::HashMap, sync::Arc};

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum DatabaseType {
    PostgreSQL,
    MySQL,
    SQLite,
}

impl std::fmt::Display for DatabaseType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DatabaseType::PostgreSQL => write!(f, "postgresql"),
            DatabaseType::MySQL => write!(f, "mysql"),
            DatabaseType::SQLite => write!(f, "sqlite"),
        }
    }
}

#[async_trait]
pub trait DatabaseTrait: Send + Sync {
    async fn connect(database: &config::SqlConfig, db: bool) -> CustomResult<Self>
    where
        Self: Sized;
    async fn execute_query<'a>(
        &'a self,
        builder: &builder::QueryBuilder,
    ) -> CustomResult<Vec<HashMap<String, serde_json::Value>>>;
    async fn initialization(database: config::SqlConfig) -> CustomResult<()>
    where
        Self: Sized;
    async fn close(&self) -> CustomResult<()>;
}

#[derive(Clone)]
pub struct Database {
    pub db: Arc<Box<dyn DatabaseTrait>>,
    pub prefix: Arc<String>,
    pub db_type: Arc<DatabaseType>,
}

impl Database {
    pub fn get_db(&self) -> &Box<dyn DatabaseTrait> {
        &self.db
    }

    pub fn get_prefix(&self) -> &str {
        &self.prefix
    }

    pub fn table_name(&self, name: &str) -> String {
        format!("{}{}", self.prefix, name)
    }

    pub fn get_type(&self) -> DatabaseType {
        *self.db_type.clone()
    }

    pub async fn link(database: &config::SqlConfig) -> CustomResult<Self> {
        let db: Box<dyn DatabaseTrait> = match database.db_type.to_lowercase().as_str() {
            "postgresql" => Box::new(postgresql::Postgresql::connect(database, true).await?),
            "mysql" => Box::new(mysql::Mysql::connect(database, true).await?),
            "sqllite" => Box::new(sqllite::Sqlite::connect(database, true).await?),
            _ => return Err("unknown database type".into_custom_error()),
        };

        Ok(Self {
            db: Arc::new(db),
            prefix: Arc::new(database.db_prefix.clone()),
            db_type: Arc::new(match database.db_type.to_lowercase().as_str() {
                "postgresql" => DatabaseType::PostgreSQL,
                "mysql" => DatabaseType::MySQL,
                "sqllite" => DatabaseType::SQLite,
                _ => return Err("unknown database type".into_custom_error()),
            }),
        })
    }

    pub async fn initial_setup(database: config::SqlConfig) -> CustomResult<()> {
        match database.db_type.to_lowercase().as_str() {
            "postgresql" => postgresql::Postgresql::initialization(database).await?,
            "mysql" => mysql::Mysql::initialization(database).await?,
            "sqllite" => sqllite::Sqlite::initialization(database).await?,
            _ => return Err("unknown database type".into_custom_error()),
        };
        Ok(())
    }
}
