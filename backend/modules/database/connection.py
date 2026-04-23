from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
import sys
from pathlib import Path
from datetime import datetime

Base = declarative_base()


def _get_default_db_path() -> str:
    """获取默认数据库文件的绝对路径。
    PyInstaller 打包后使用用户数据目录（macOS 的 .app 包内只读），
    开发模式使用当前工作目录。
    """
    if getattr(sys, 'frozen', False):
        # PyInstaller 打包后，使用用户数据目录
        import platform
        system = platform.system()
        if system == 'Darwin':
            base_dir = Path.home() / 'Library' / 'Application Support' / 'com.coredns.admin'
        elif system == 'Windows':
            base_dir = Path(os.getenv('APPDATA', Path.home())) / 'CoreDNS Admin'
        else:
            base_dir = Path.home() / '.coredns-admin'
        base_dir.mkdir(parents=True, exist_ok=True)
    else:
        # 开发模式，使用当前工作目录
        base_dir = Path.cwd()
    
    db_path = base_dir / 'local.db'
    return f'sqlite:///{db_path}'

class DatabaseConnection:
    """数据库连接管理器，支持sqlite+libsql"""
    
    def __init__(self, database_url=None):
        # 支持多种数据库URL格式
        if not database_url:
            # 默认使用sqlite本地数据库（绝对路径）
            database_url = os.getenv('DATABASE_URL', _get_default_db_path())
            
        # 配置数据库引擎
        if database_url.startswith('sqlite+libsql://'):
            # libsql格式
            self.engine = create_engine(
                database_url,
                connect_args={'check_same_thread': False},
                echo=os.getenv('SQLALCHEMY_ECHO', 'false').lower() == 'true',
                pool_pre_ping=True,
                pool_recycle=3600
            )
        elif database_url.startswith('sqlite://'):
            # 标准sqlite格式
            self.engine = create_engine(
                database_url,
                connect_args={'check_same_thread': False},
                echo=os.getenv('SQLALCHEMY_ECHO', 'false').lower() == 'true',
                pool_pre_ping=True,
                pool_recycle=3600
            )
        else:
            # 其他数据库格式
            self.engine = create_engine(
                database_url,
                echo=os.getenv('SQLALCHEMY_ECHO', 'false').lower() == 'true',
                pool_pre_ping=True,
                pool_recycle=3600
            )
            
        self.SessionLocal = sessionmaker(
            autocommit=False, 
            autoflush=False, 
            bind=self.engine,
            expire_on_commit=False
        )
        
    def create_tables(self):
        """创建数据库表"""
        Base.metadata.create_all(bind=self.engine)
        
    def get_session(self):
        """获取数据库会话"""
        return self.SessionLocal()
        
    def test_connection(self):
        """测试数据库连接"""
        try:
            with self.get_session() as session:
                result = session.execute("SELECT 1")
                result.fetchone()
            return True
        except Exception as e:
            print(f"Database connection test failed: {e}")
            return False
            
    def get_engine(self):
        """获取数据库引擎"""
        return self.engine