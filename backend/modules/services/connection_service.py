from typing import Optional, Dict, Any
from datetime import datetime
from ..database import DatabaseOperations
from ..etcd import EtcdConnectionPool, EtcdClient, EtcdOperations
from ..etcd.exceptions import EtcdConnectionError

class ConnectionService:
    """连接调度服务，管理ETCD实例连接"""
    
    def __init__(self, db_operations: DatabaseOperations, connection_pool: EtcdConnectionPool):
        self.db_operations = db_operations
        self.connection_pool = connection_pool
        
    def get_current_instance(self) -> Optional[Dict[str, Any]]:
        """获取当前使用的ETCD实例"""
        # 首先尝试获取默认实例
        default_instance = self.db_operations.get_default_etcd_instance()
        if default_instance and default_instance.is_active:
            return default_instance.to_dict()
            
        # 如果没有默认实例，获取第一个活跃的实例
        active_instances = self.db_operations.get_etcd_instances(active_only=True)
        if active_instances:
            return active_instances[0].to_dict()
            
        return None
        
    def get_instance_connection(self, instance_id: Optional[int] = None) -> EtcdClient:
        """获取指定实例的连接，如果未指定则使用当前实例"""
        if instance_id is None:
            # 获取当前实例
            current_instance = self.get_current_instance()
            if not current_instance:
                raise EtcdConnectionError("No active ETCD instance available")
            instance_id = current_instance['id']
            
        # 获取实例配置
        instance = self.db_operations.get_etcd_instance(instance_id)
        if not instance:
            raise ValueError(f"ETCD instance {instance_id} not found")
            
        if not instance.is_active:
            raise ValueError(f"ETCD instance {instance_id} is not active")
            
        # 从连接池获取连接
        return self.connection_pool.get_connection(instance_id, {
            'host': instance.host,
            'port': instance.port,
            'base_path': instance.base_path,
            'username': instance.username,
            'password': instance.password
        })
        
    def get_instance_operations(self, instance_id: Optional[int] = None) -> EtcdOperations:
        """获取指定实例的操作接口，如果未指定则使用当前实例"""
        client = self.get_instance_connection(instance_id)
        return EtcdOperations(client)
        
    def test_instance_connection(self, instance_id: int) -> Dict[str, Any]:
        """测试指定实例的连接"""
        instance = self.db_operations.get_etcd_instance(instance_id)
        if not instance:
            raise ValueError(f"ETCD instance {instance_id} not found")
            
        try:
            # 获取连接
            client = self.get_instance_connection(instance_id)
            
            # 测试连接
            is_healthy = client.health_check()
            status = 'connected' if is_healthy else 'disconnected'
            
            # 更新连接状态
            self.db_operations.update_connection_status(instance_id, status, datetime.utcnow())
            
            return {
                "instance_id": instance_id,
                "status": status,
                "host": instance.host,
                "port": instance.port,
                "base_path": instance.base_path,
                "last_check_time": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            # 更新连接状态
            self.db_operations.update_connection_status(instance_id, 'error', datetime.utcnow())
            
            raise EtcdConnectionError(f"Failed to connect to ETCD instance {instance_id}: {str(e)}")
            
    def get_instance_health_status(self, instance_id: int) -> Dict[str, Any]:
        """获取实例的健康状态"""
        instance = self.db_operations.get_etcd_instance(instance_id)
        if not instance:
            raise ValueError(f"ETCD instance {instance_id} not found")
            
        try:
            # 获取连接
            client = self.get_instance_connection(instance_id)
            
            # 获取健康状态
            health_status = client.health_check()
            
            return {
                "instance_id": instance_id,
                "name": instance.name,
                "host": instance.host,
                "port": instance.port,
                "base_path": instance.base_path,
                "status": "healthy" if health_status else "unhealthy",
                "connection_status": instance.connection_status,
                "last_check_time": instance.last_check_time.isoformat() if instance.last_check_time else None,
                "checked_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            return {
                "instance_id": instance_id,
                "name": instance.name,
                "host": instance.host,
                "port": instance.port,
                "base_path": instance.base_path,
                "status": "error",
                "connection_status": "error",
                "error": str(e),
                "last_check_time": instance.last_check_time.isoformat() if instance.last_check_time else None,
                "checked_at": datetime.utcnow().isoformat()
            }
            
    def get_all_instances_health_status(self) -> Dict[str, Any]:
        """获取所有实例的健康状态"""
        instances = self.db_operations.get_etcd_instances()
        health_statuses = []
        
        for instance in instances:
            try:
                status = self.get_instance_health_status(instance.id)
                health_statuses.append(status)
            except Exception as e:
                health_statuses.append({
                    "instance_id": instance.id,
                    "name": instance.name,
                    "host": instance.host,
                    "port": instance.port,
                    "base_path": instance.base_path,
                    "status": "error",
                    "connection_status": "error",
                    "error": str(e),
                    "last_check_time": instance.last_check_time.isoformat() if instance.last_check_time else None,
                    "checked_at": datetime.utcnow().isoformat()
                })
                
        # 统计信息
        total = len(health_statuses)
        healthy = sum(1 for status in health_statuses if status['status'] == 'healthy')
        unhealthy = sum(1 for status in health_statuses if status['status'] == 'unhealthy')
        errors = sum(1 for status in health_statuses if status['status'] == 'error')
        
        return {
            "instances": health_statuses,
            "statistics": {
                "total": total,
                "healthy": healthy,
                "unhealthy": unhealthy,
                "error": errors
            },
            "checked_at": datetime.utcnow().isoformat()
        }
        
    def check_connection_pool_status(self) -> Dict[str, Any]:
        """检查连接池状态"""
        return self.connection_pool.get_connection_stats()
        
    def health_check_all_instances(self) -> Dict[int, bool]:
        """检查所有实例的健康状态"""
        return self.connection_pool.health_check_all()
        
    def switch_to_instance(self, instance_id: int) -> bool:
        """切换到指定实例（设置为默认实例）"""
        instance = self.db_operations.get_etcd_instance(instance_id)
        if not instance:
            raise ValueError(f"ETCD instance {instance_id} not found")
            
        if not instance.is_active:
            raise ValueError(f"ETCD instance {instance_id} is not active")
            
        # 测试连接
        try:
            self.test_instance_connection(instance_id)
        except Exception as e:
            raise EtcdConnectionError(f"Cannot switch to unhealthy instance {instance_id}: {str(e)}")
            
        # 设置为默认实例
        return self.db_operations.set_default_instance(instance_id)
        
    def get_instance_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """通过名称获取实例"""
        instance = self.db_operations.get_etcd_instance_by_name(name)
        if instance:
            return instance.to_dict()
        return None
        
    def close_all_connections(self):
        """关闭所有连接"""
        self.connection_pool.close_all_connections()
        
    def etcd_key_to_domain(self, key: str, base_path: str = '/skydns') -> str:
        """将 Etcd 的键转换回域名，同时处理_record_XX后缀和多级子域名"""
        path_without_base = key[len(base_path):].strip('/')
        parts = path_without_base.split('/')
        
        # 检查最后一部分是否是_record_XX格式
        if len(parts) > 1:
            last_part = parts[-1]
            if last_part.startswith('_record_'):
                try:
                    # 验证格式：_record_后面是两位数字
                    sequence_num = int(last_part.replace('_record_', ''))
                    if 1 <= sequence_num <= 99:  # 限制序列号范围
                        # 如果是，则在反转之前将其移除
                        parts = parts[:-1]
                except ValueError:
                    pass  # 如果不是有效的序列号格式，保持原样
        
        # 反转所有部分以重建域名
        parts.reverse()
        full_domain = '.'.join(parts)
        
        return full_domain
        
    def domain_to_etcd_key(self, domain: str, base_path: str = '/skydns') -> str:
        """将域名转换为 Etcd 的键格式，支持多级子域名"""
        # 移除首尾的点号并分割
        parts = domain.strip('.').split('.')
        parts.reverse()
        return f"{base_path}/{'/'.join(parts)}"
        
    def extract_second_level_domain(self, fqdn: str) -> str:
        """提取第二级域名（最后两级）"""
        parts = fqdn.strip('.').split('.')
        if len(parts) >= 2:
            return '.'.join(parts[-2:])  # 取最后两级
        return fqdn