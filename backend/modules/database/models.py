from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .connection import Base
from datetime import datetime

class EtcdInstance(Base):
    """ETCD实例模型"""
    __tablename__ = 'etcd_instances'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    host = Column(String(255), nullable=False)
    port = Column(Integer, default=2379, nullable=False)
    base_path = Column(String(255), default='/skydns', nullable=False)  # ETCD base path
    username = Column(String(100))
    password = Column(String(100))
    is_active = Column(Boolean, default=True, nullable=False)
    is_default = Column(Boolean, default=False, nullable=False)
    description = Column(Text)
    connection_status = Column(String(50), default='unknown')
    last_check_time = Column(DateTime)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    
    # 关系定义
    operation_logs = relationship("EtcdOperationLog", back_populates="instance", cascade="all, delete-orphan")
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'host': self.host,
            'port': self.port,
            'base_path': self.base_path,
            'username': self.username,
            'is_active': self.is_active,
            'is_default': self.is_default,
            'description': self.description,
            'connection_status': self.connection_status,
            'last_check_time': self.last_check_time.isoformat() if self.last_check_time else None,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

class EtcdOperationLog(Base):
    """ETCD操作日志模型"""
    __tablename__ = 'etcd_operations_log'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    instance_id = Column(Integer, ForeignKey('etcd_instances.id'), nullable=False)
    operation_type = Column(String(50), nullable=False)  # create/read/update/delete
    resource_type = Column(String(50), nullable=False)  # domain/dns_record
    resource_key = Column(String(500))
    base_path = Column(String(255))  # 记录操作时使用的base_path
    operation_result = Column(String(50))  # success/failed
    error_message = Column(Text)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    
    # 关系定义
    instance = relationship("EtcdInstance", back_populates="operation_logs")
    
    def to_dict(self):
        return {
            'id': self.id,
            'instance_id': self.instance_id,
            'operation_type': self.operation_type,
            'resource_type': self.resource_type,
            'resource_key': self.resource_key,
            'base_path': self.base_path,
            'operation_result': self.operation_result,
            'error_message': self.error_message,
            'created_at': self.created_at.isoformat()
        }