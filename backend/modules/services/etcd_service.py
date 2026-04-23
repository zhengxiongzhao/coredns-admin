import re
from typing import List, Optional, Dict, Any
from datetime import datetime
from ..database import DatabaseOperations
from ..etcd import EtcdConnectionPool, EtcdClient
from ..etcd.exceptions import EtcdConnectionError

class EtcdInstanceService:
    """ETCD实例管理服务"""
    
    def __init__(self, db_operations: DatabaseOperations, connection_pool: EtcdConnectionPool):
        self.db_operations = db_operations
        self.connection_pool = connection_pool
        
    def create_instance(self, instance_data: Dict[str, Any]) -> Dict[str, Any]:
        """创建ETCD实例"""
        # 验证必需字段
        required_fields = ['name', 'host', 'port']
        for field in required_fields:
            if field not in instance_data:
                raise ValueError(f"Missing required field: {field}")
                
        # 验证数据格式
        self._validate_instance_data(instance_data)
        
        # 跳过连接测试，保存后由列表查询时检查状态
        # self._test_connection(instance_data)
        
        # 保存到数据库
        instance = self.db_operations.create_etcd_instance(instance_data)
        
        # 记录操作日志
        self.db_operations.log_operation(
            instance_id=instance.id,
            operation_type='create',
            resource_type='etcd_instance',
            resource_key=f"etcd_instance:{instance.id}",
            operation_result='success'
        )
        
        return {
            "id": instance.id,
            "name": instance.name,
            "host": instance.host,
            "port": instance.port,
            "base_path": instance.base_path,
            "is_active": instance.is_active,
            "is_default": instance.is_default,
            "description": instance.description,
            "connection_status": "connected"
        }
        
    def get_all_instances(self, include_inactive: bool = False) -> List[Dict[str, Any]]:
        """获取所有ETCD实例"""
        instances = self.db_operations.get_etcd_instances(active_only=not include_inactive)
        result = []
        
        for instance in instances:
            # 检查连接状态
            is_healthy = False
            if instance.is_active:
                try:
                    client = self.connection_pool.get_connection(instance.id, {
                        'host': instance.host,
                        'port': instance.port,
                        'base_path': instance.base_path,
                        'username': instance.username,
                        'password': instance.password
                    })
                    is_healthy = client.health_check()
                    
                    # 更新数据库中的连接状态
                    status = 'connected' if is_healthy else 'disconnected'
                    self.db_operations.update_connection_status(instance.id, status, datetime.utcnow())
                except Exception:
                    is_healthy = False
                    self.db_operations.update_connection_status(instance.id, 'disconnected', datetime.utcnow())
                    
            # Get domain and record counts
            domain_count = 0
            record_count = 0
            if is_healthy:
                try:
                    domains = client.get_domains(instance.base_path)
                    domain_count = len(domains)
                    record_count = sum(d.get('record_count', 0) for d in domains)
                except Exception:
                    pass
            
            result.append({
                "id": instance.id,
                "name": instance.name,
                "host": instance.host,
                "port": instance.port,
                "base_path": instance.base_path,
                "is_active": instance.is_active,
                "is_default": instance.is_default,
                "connection_status": 'connected' if is_healthy else 'disconnected',
                "description": instance.description,
                "domain_count": domain_count,
                "record_count": record_count,
                "last_check_time": instance.last_check_time.isoformat() if instance.last_check_time else None,
                "created_at": instance.created_at.isoformat(),
                "updated_at": instance.updated_at.isoformat()
            })
            
        return result
        
    def get_instance(self, instance_id: int) -> Optional[Dict[str, Any]]:
        """获取指定ETCD实例"""
        instance = self.db_operations.get_etcd_instance(instance_id)
        if not instance:
            return None
            
        # 检查连接状态
        is_healthy = False
        if instance.is_active:
            try:
                client = self.connection_pool.get_connection(instance.id, {
                    'host': instance.host,
                    'port': instance.port,
                    'base_path': instance.base_path,
                    'username': instance.username,
                    'password': instance.password
                })
                is_healthy = client.health_check()
            except Exception:
                is_healthy = False
                
        # Get domain and record counts
        domain_count = 0
        record_count = 0
        if is_healthy:
            try:
                domains = client.get_domains(instance.base_path)
                domain_count = len(domains)
                record_count = sum(d.get('record_count', 0) for d in domains)
            except Exception:
                pass

        return {
            "id": instance.id,
            "name": instance.name,
            "host": instance.host,
            "port": instance.port,
            "base_path": instance.base_path,
            "username": instance.username,
            "is_active": instance.is_active,
            "is_default": instance.is_default,
            "connection_status": 'connected' if is_healthy else 'disconnected',
            "description": instance.description,
            "domain_count": domain_count,
            "record_count": record_count,
            "last_check_time": instance.last_check_time.isoformat() if instance.last_check_time else None,
            "created_at": instance.created_at.isoformat(),
            "updated_at": instance.updated_at.isoformat()
        }
        
    def update_instance(self, instance_id: int, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """更新ETCD实例"""
        # 获取现有实例
        existing_instance = self.db_operations.get_etcd_instance(instance_id)
        if not existing_instance:
            return None
            
        # 验证更新数据
        self._validate_instance_data(update_data, is_update=True)
        
            # 跳过连接测试，保存后由列表查询时检查状态
            # self._test_connection(test_config)
            
        # 更新数据库
        instance = self.db_operations.update_etcd_instance(instance_id, update_data)
        if not instance:
            return None
            
        # 记录操作日志
        self.db_operations.log_operation(
            instance_id=instance.id,
            operation_type='update',
            resource_type='etcd_instance',
            resource_key=f"etcd_instance:{instance.id}",
            operation_result='success'
        )
        
        return self.get_instance(instance_id)
        
    def delete_instance(self, instance_id: int) -> bool:
        """删除ETCD实例"""
        instance = self.db_operations.get_etcd_instance(instance_id)
        if not instance:
            return False
            
        # 不能删除默认实例
        if instance.is_default:
            raise ValueError("Cannot delete the default ETCD instance")
            
        # 删除数据库记录
        success = self.db_operations.delete_etcd_instance(instance_id)
        
        if success:
            # 移除连接池中的连接
            self.connection_pool.remove_connection(instance_id)
            
            # 记录操作日志
            self.db_operations.log_operation(
                instance_id=instance_id,
                operation_type='delete',
                resource_type='etcd_instance',
                resource_key=f"etcd_instance:{instance_id}",
                operation_result='success'
            )
            
        return success
        
    def test_connection(self, instance_id: int) -> Dict[str, Any]:
        """测试ETCD实例连接"""
        instance = self.db_operations.get_etcd_instance(instance_id)
        if not instance:
            raise ValueError(f"ETCD instance {instance_id} not found")
            
        try:
            # 创建临时连接进行测试
            from ..etcd.client import EtcdClient
            test_client = EtcdClient(
                host=instance.host,
                port=instance.port,
                base_path=instance.base_path,
                username=instance.username,
                password=instance.password
            )
            
            is_healthy = test_client.health_check()
            status = 'connected' if is_healthy else 'disconnected'
            
            # 更新数据库中的连接状态
            self.db_operations.update_connection_status(instance_id, status, datetime.utcnow())
            
            # 记录操作日志
            self.db_operations.log_operation(
                instance_id=instance_id,
                operation_type='test_connection',
                resource_type='etcd_instance',
                resource_key=f"etcd_instance:{instance_id}",
                operation_result='success' if is_healthy else 'failed'
            )
            
            return {
                "instance_id": instance_id,
                "status": status,
                "host": instance.host,
                "port": instance.port,
                "base_path": instance.base_path,
                "last_check_time": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            # 更新数据库中的连接状态
            self.db_operations.update_connection_status(instance_id, 'error', datetime.utcnow())
            
            # 记录操作日志
            self.db_operations.log_operation(
                instance_id=instance_id,
                operation_type='test_connection',
                resource_type='etcd_instance',
                resource_key=f"etcd_instance:{instance_id}",
                operation_result='failed',
                error_message=str(e)
            )
            
            raise EtcdConnectionError(f"Failed to connect to ETCD instance: {str(e)}")
            
    def test_connection_with_params(self, host: str, port: int, username: str = '', password: str = '', base_path: str = '/skydns') -> Dict[str, Any]:
        """使用参数测试ETCD连接（不需要实例ID）"""
        try:
            # 创建临时连接进行测试
            from ..etcd.client import EtcdClient
            test_client = EtcdClient(
                host=host,
                port=port,
                base_path=base_path,
                username=username,
                password=password
            )
            
            is_healthy = test_client.health_check()
            status = 'connected' if is_healthy else 'disconnected'
            
            return {
                "status": status,
                "host": host,
                "port": port,
                "base_path": base_path,
                "test_time": datetime.utcnow().isoformat(),
                "message": "Connection test successful" if is_healthy else "Connection test failed"
            }
            
        except Exception as e:
            return {
                "status": "error",
                "host": host,
                "port": port,
                "base_path": base_path,
                "test_time": datetime.utcnow().isoformat(),
                "message": f"Connection test failed: {str(e)}"
            }
            
    def set_default_instance(self, instance_id: int) -> bool:
        """设置默认ETCD实例"""
        instance = self.db_operations.get_etcd_instance(instance_id)
        if not instance:
            return False
            
        if not instance.is_active:
            raise ValueError("Cannot set inactive instance as default")
            
        success = self.db_operations.set_default_instance(instance_id)
        
        if success:
            # 记录操作日志
            self.db_operations.log_operation(
                instance_id=instance_id,
                operation_type='set_default',
                resource_type='etcd_instance',
                resource_key=f"etcd_instance:{instance_id}",
                operation_result='success'
            )
            
        return success
        
    def get_instance_stats(self) -> Dict[str, Any]:
        """获取实例统计信息"""
        return self.db_operations.get_instance_stats()
        
    def health_check_all(self) -> Dict[int, bool]:
        """检查所有实例的健康状态"""
        return self.connection_pool.health_check_all()
        
    def _validate_instance_data(self, instance_data: Dict[str, Any], is_update: bool = False):
        """验证ETCD实例数据"""
        # 验证名称格式
        if 'name' in instance_data:
            name = instance_data['name']
            if not name or len(name) < 3 or len(name) > 100:
                raise ValueError("Instance name must be between 3 and 100 characters")
            if not re.match(r'^[a-zA-Z0-9_-]+$', name):
                raise ValueError("Instance name can only contain letters, numbers, hyphens, and underscores")
                
        # 验证主机地址
        if 'host' in instance_data:
            host = instance_data['host']
            if not host or len(host) > 255:
                raise ValueError("Host must be between 1 and 255 characters")
                
        # 验证端口
        if 'port' in instance_data:
            port = instance_data['port']
            if not isinstance(port, int) or port < 1 or port > 65535:
                raise ValueError("Port must be an integer between 1 and 65535")
                
        # 验证base_path
        if 'base_path' in instance_data:
            base_path = instance_data['base_path']
            if not base_path.startswith('/'):
                raise ValueError("Base path must start with '/'")
            if not re.match(r'^/[a-zA-Z0-9/_-]*$', base_path):
                raise ValueError("Base path can only contain letters, numbers, hyphens, underscores, and forward slashes")
                
    def _test_connection(self, instance_config: Dict[str, Any]):
        """测试ETCD连接"""
        try:
            # 创建临时连接进行测试
            from ..etcd.client import EtcdClient
            test_client = EtcdClient(
                host=instance_config['host'],
                port=instance_config['port'],
                base_path=instance_config.get('base_path', '/skydns'),
                username=instance_config.get('username'),
                password=instance_config.get('password')
            )
            
            if not test_client.health_check():
                raise EtcdConnectionError("ETCD health check failed")
                
        except Exception as e:
            raise EtcdConnectionError(f"Failed to connect to ETCD: {str(e)}")