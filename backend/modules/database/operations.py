from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional, Dict, Any
from datetime import datetime
from .models import EtcdInstance, EtcdOperationLog

class DatabaseOperations:
    """数据库操作封装，支持libsql"""
    
    def __init__(self, db_connection):
        self.db = db_connection
        
    def create_etcd_instance(self, instance_data: Dict[str, Any]) -> EtcdInstance:
        """创建ETCD实例"""
        with self.db.get_session() as session:
            # 检查名称是否已存在
            existing = session.query(EtcdInstance).filter_by(name=instance_data['name']).first()
            if existing:
                raise ValueError(f"ETCD instance with name '{instance_data['name']}' already exists")
                
            # 如果设置is_default=True，先取消其他实例的默认设置
            if instance_data.get('is_default'):
                session.query(EtcdInstance).update({'is_default': False})
                
            instance = EtcdInstance(**instance_data)
            session.add(instance)
            session.commit()
            session.refresh(instance)
            return instance
            
    def get_etcd_instances(self, active_only: bool = False) -> List[EtcdInstance]:
        """获取所有ETCD实例"""
        with self.db.get_session() as session:
            query = session.query(EtcdInstance)
            if active_only:
                query = query.filter_by(is_active=True)
            return query.order_by(EtcdInstance.name).all()
            
    def get_etcd_instance(self, instance_id: int) -> Optional[EtcdInstance]:
        """获取指定ETCD实例"""
        with self.db.get_session() as session:
            return session.query(EtcdInstance).filter_by(id=instance_id).first()
            
    def get_etcd_instance_by_name(self, name: str) -> Optional[EtcdInstance]:
        """通过名称获取ETCD实例"""
        with self.db.get_session() as session:
            return session.query(EtcdInstance).filter_by(name=name).first()
            
    def get_default_etcd_instance(self) -> Optional[EtcdInstance]:
        """获取默认ETCD实例"""
        with self.db.get_session() as session:
            return session.query(EtcdInstance).filter_by(is_default=True, is_active=True).first()
            
    def update_etcd_instance(self, instance_id: int, update_data: Dict[str, Any]) -> Optional[EtcdInstance]:
        """更新ETCD实例"""
        with self.db.get_session() as session:
            instance = session.query(EtcdInstance).filter_by(id=instance_id).first()
            if instance:
                # 如果设置is_default=True，先取消其他实例的默认设置
                if update_data.get('is_default'):
                    session.query(EtcdInstance).update({'is_default': False})
                    
                for key, value in update_data.items():
                    if hasattr(instance, key):
                        setattr(instance, key, value)
                session.commit()
                session.refresh(instance)
            return instance
            
    def delete_etcd_instance(self, instance_id: int) -> bool:
        """删除ETCD实例"""
        with self.db.get_session() as session:
            instance = session.query(EtcdInstance).filter_by(id=instance_id).first()
            if instance:
                # 不能删除默认实例
                if instance.is_default:
                    raise ValueError("Cannot delete the default ETCD instance")
                session.delete(instance)
                session.commit()
                return True
            return False
            
    def set_default_instance(self, instance_id: int) -> bool:
        """设置默认ETCD实例"""
        with self.db.get_session() as session:
            # 先取消所有默认设置
            session.query(EtcdInstance).update({'is_default': False})
            
            # 设置新的默认实例
            instance = session.query(EtcdInstance).filter_by(id=instance_id).first()
            if instance:
                instance.is_default = True
                session.commit()
                return True
            return False
            
    def update_connection_status(self, instance_id: int, status: str, check_time: Optional[datetime] = None):
        """更新连接状态"""
        if check_time is None:
            check_time = datetime.utcnow()
            
        with self.db.get_session() as session:
            instance = session.query(EtcdInstance).filter_by(id=instance_id).first()
            if instance:
                instance.connection_status = status
                instance.last_check_time = check_time
                session.commit()
                
    def log_operation(self, instance_id: int, operation_type: str, resource_type: str,
                     resource_key: Optional[str] = None, base_path: Optional[str] = None,
                     operation_result: str = 'success', error_message: Optional[str] = None):
        """记录操作日志"""
        with self.db.get_session() as session:
            log = EtcdOperationLog(
                instance_id=instance_id,
                operation_type=operation_type,
                resource_type=resource_type,
                resource_key=resource_key,
                base_path=base_path,
                operation_result=operation_result,
                error_message=error_message
            )
            session.add(log)
            session.commit()
            
    def get_operation_logs(self, instance_id: Optional[int] = None, limit: int = 100) -> List[EtcdOperationLog]:
        """获取操作日志"""
        with self.db.get_session() as session:
            query = session.query(EtcdOperationLog)
            if instance_id:
                query = query.filter_by(instance_id=instance_id)
            return query.order_by(desc(EtcdOperationLog.created_at)).limit(limit).all()
            
    def get_instance_stats(self) -> Dict[str, Any]:
        """获取实例统计信息"""
        with self.db.get_session() as session:
            total = session.query(EtcdInstance).count()
            active = session.query(EtcdInstance).filter_by(is_active=True).count()
            inactive = session.query(EtcdInstance).filter_by(is_active=False).count()
            connected = session.query(EtcdInstance).filter_by(connection_status='connected').count()
            disconnected = session.query(EtcdInstance).filter_by(connection_status='disconnected').count()
            
            return {
                'total': total,
                'active': active,
                'inactive': inactive,
                'connected': connected,
                'disconnected': disconnected
            }