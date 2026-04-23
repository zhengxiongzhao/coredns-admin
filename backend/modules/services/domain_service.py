from typing import List, Optional, Dict, Any
import json
import re
from datetime import datetime
from ..database import DatabaseOperations
from ..etcd import EtcdConnectionPool, EtcdOperations
from ..etcd.exceptions import EtcdConnectionError, EtcdOperationError

class DomainService:
    """域名管理服务，支持base_path"""
    
    def __init__(self, db_operations: DatabaseOperations, connection_pool: EtcdConnectionPool):
        self.db_operations = db_operations
        self.connection_pool = connection_pool
        
    def get_domains(self, instance_id: int, custom_base_path: Optional[str] = None, 
                   show_virtual: bool = False) -> List[Dict[str, Any]]:
        """获取域名，支持自定义base_path"""
        # 获取ETCD实例配置
        instance = self.db_operations.get_etcd_instance(instance_id)
        if not instance:
            raise ValueError(f"ETCD instance {instance_id} not found")
            
        if not instance.is_active:
            raise ValueError(f"ETCD instance {instance_id} is not active")
            
        # 获取ETCD连接
        client = self.connection_pool.get_connection(instance_id, {
            'host': instance.host,
            'port': instance.port,
            'base_path': instance.base_path,
            'username': instance.username,
            'password': instance.password
        })
        
        # 使用自定义base_path或实例的base_path
        effective_base_path = custom_base_path or instance.base_path
        
        try:
            # 获取所有域名
            domains = client.get_domains(effective_base_path)
            
            # 记录操作日志
            self.db_operations.log_operation(
                instance_id=instance_id,
                operation_type='read',
                resource_type='domain',
                base_path=effective_base_path,
                operation_result='success'
            )
            
            return domains
            
        except Exception as e:
            # 记录操作日志
            self.db_operations.log_operation(
                instance_id=instance_id,
                operation_type='read',
                resource_type='domain',
                base_path=effective_base_path,
                operation_result='failed',
                error_message=str(e)
            )
            raise EtcdOperationError(f"Failed to get domains: {str(e)}")
            
    def create_domain(self, instance_id: int, domain_data: Dict[str, Any]) -> Dict[str, Any]:
        """创建域名，使用实例的base_path"""
        # 获取ETCD实例配置
        instance = self.db_operations.get_etcd_instance(instance_id)
        if not instance:
            raise ValueError(f"ETCD instance {instance_id} not found")
            
        if not instance.is_active:
            raise ValueError(f"ETCD instance {instance_id} is not active")
            
        # 验证必需字段
        if 'domain' not in domain_data:
            raise ValueError("Domain name is required")
            
        domain_name = domain_data['domain']
        
        # 验证域名格式
        self._validate_domain_name(domain_name)
        
        # 获取ETCD连接
        client = self.connection_pool.get_connection(instance_id, {
            'host': instance.host,
            'port': instance.port,
            'base_path': instance.base_path,
            'username': instance.username,
            'password': instance.password
        })
        
        # 使用实例的base_path创建域名
        effective_base_path = domain_data.get('base_path') or instance.base_path
        
        try:
            # 创建域名的根目录（空记录）
            key = self._build_domain_key(domain_name, effective_base_path)
            value = {"created": datetime.utcnow().timestamp()}
            
            # 检查域名是否已存在
            existing_value, _ = client.client.get(key)
            if existing_value:
                raise ValueError(f"Domain '{domain_name}' already exists")
                
            # 创建域名记录
            client.client.put(key, json.dumps(value))
            
            # 记录操作日志
            self.db_operations.log_operation(
                instance_id=instance_id,
                operation_type='create',
                resource_type='domain',
                resource_key=key,
                base_path=effective_base_path,
                operation_result='success'
            )
            
            return {
                "message": "Domain created successfully",
                "domain": domain_name,
                "base_path": effective_base_path,
                "key": key
            }
            
        except ValueError:
            raise
        except Exception as e:
            # 记录操作日志
            self.db_operations.log_operation(
                instance_id=instance_id,
                operation_type='create',
                resource_type='domain',
                resource_key=key if 'key' in locals() else None,
                base_path=effective_base_path,
                operation_result='failed',
                error_message=str(e)
            )
            raise EtcdOperationError(f"Failed to create domain: {str(e)}")
            
    def delete_domain(self, instance_id: int, domain: str, custom_base_path: Optional[str] = None) -> Dict[str, Any]:
        """删除域名及其所有记录"""
        # 获取ETCD实例配置
        instance = self.db_operations.get_etcd_instance(instance_id)
        if not instance:
            raise ValueError(f"ETCD instance {instance_id} not found")
            
        if not instance.is_active:
            raise ValueError(f"ETCD instance {instance_id} is not active")
            
        # 验证域名格式
        self._validate_domain_name(domain)
        
        # 获取ETCD连接
        client = self.connection_pool.get_connection(instance_id, {
            'host': instance.host,
            'port': instance.port,
            'base_path': instance.base_path,
            'username': instance.username,
            'password': instance.password
        })
        
        # 使用自定义base_path或实例的base_path
        effective_base_path = custom_base_path or instance.base_path
        
        try:
            # 构建域名前缀
            domain_parts = domain.strip('.').split('.')
            domain_parts.reverse()
            prefix = f"{effective_base_path}/{'/'.join(domain_parts)}"
            
            # 获取该域名下的所有记录
            records = list(client.client.get_prefix(prefix))
            if not records:
                raise ValueError(f"Domain '{domain}' not found")
                
            # 删除所有记录
            deleted_count = 0
            for _, metadata in records:
                if client.client.delete(metadata.key):
                    deleted_count += 1
                    
            # 记录操作日志
            self.db_operations.log_operation(
                instance_id=instance_id,
                operation_type='delete',
                resource_type='domain',
                resource_key=prefix,
                base_path=effective_base_path,
                operation_result='success'
            )
            
            return {
                "message": f"Domain and {deleted_count} records deleted successfully",
                "domain": domain,
                "deleted_count": deleted_count
            }
            
        except Exception as e:
            # 记录操作日志
            self.db_operations.log_operation(
                instance_id=instance_id,
                operation_type='delete',
                resource_type='domain',
                resource_key=prefix if 'prefix' in locals() else None,
                base_path=effective_base_path,
                operation_result='failed',
                error_message=str(e)
            )
            raise EtcdOperationError(f"Failed to delete domain: {str(e)}")
            
    def mark_domain(self, instance_id: int, domain: str, mark: bool = True, 
                   custom_base_path: Optional[str] = None) -> Dict[str, Any]:
        """标记/取消标记域名为Domain"""
        # 获取ETCD实例配置
        instance = self.db_operations.get_etcd_instance(instance_id)
        if not instance:
            raise ValueError(f"ETCD instance {instance_id} not found")
            
        if not instance.is_active:
            raise ValueError(f"ETCD instance {instance_id} is not active")
            
        # 验证域名格式
        self._validate_domain_name(domain)
        
        # 获取ETCD连接
        client = self.connection_pool.get_connection(instance_id, {
            'host': instance.host,
            'port': instance.port,
            'base_path': instance.base_path,
            'username': instance.username,
            'password': instance.password
        })
        
        # 使用自定义base_path或实例的base_path
        effective_base_path = custom_base_path or instance.base_path
        
        try:
            if mark:
                # 创建标记记录
                return self._create_domain_mark(instance_id, domain, effective_base_path, client)
            else:
                # 取消标记
                return self._remove_domain_mark(instance_id, domain, effective_base_path, client)
                
        except Exception as e:
            raise EtcdOperationError(f"Failed to mark domain: {str(e)}")
            
    def _create_domain_mark(self, instance_id: int, domain: str, base_path: str, client) -> Dict[str, Any]:
        """创建域名标记"""
        try:
            # 构建标记键
            domain_parts = domain.strip('.').split('.')
            domain_parts.reverse()
            relative_path = '/'.join(domain_parts)
            mark_key = f"/coredns-admin/domain-marks/{base_path.strip('/')}/{relative_path}"
            
            # 构建标记值
            mark_value = {
                "is_marked_as_domain": True,
                "marked_at": datetime.utcnow().timestamp(),
                "domain": domain,
                "space": base_path,
                "path": mark_key,
                "domain_level": len(domain_parts),
                "parent_domains": ['.'.join(domain_parts[i:]) for i in range(1, len(domain_parts))]
            }
            
            # 创建标记
            client.client.put(mark_key, json.dumps(mark_value))
            
            # 记录操作日志
            self.db_operations.log_operation(
                instance_id=instance_id,
                operation_type='create',
                resource_type='domain_mark',
                resource_key=mark_key,
                base_path=base_path,
                operation_result='success'
            )
            
            return {
                "message": "Domain marked successfully",
                "domain": domain,
                "base_path": base_path,
                "mark_key": mark_key
            }
            
        except Exception as e:
            # 记录操作日志
            self.db_operations.log_operation(
                instance_id=instance_id,
                operation_type='create',
                resource_type='domain_mark',
                resource_key=mark_key if 'mark_key' in locals() else None,
                base_path=base_path,
                operation_result='failed',
                error_message=str(e)
            )
            raise
            
    def _remove_domain_mark(self, instance_id: int, domain: str, base_path: str, client) -> Dict[str, Any]:
        """移除域名标记"""
        try:
            # 构建标记键
            domain_parts = domain.strip('.').split('.')
            domain_parts.reverse()
            relative_path = '/'.join(domain_parts)
            mark_key = f"/coredns-admin/domain-marks/{base_path.strip('/')}/{relative_path}"
            
            # 删除标记
            is_deleted = client.client.delete(mark_key)
            
            if not is_deleted:
                raise ValueError("Domain mark not found")
                
            # 记录操作日志
            self.db_operations.log_operation(
                instance_id=instance_id,
                operation_type='delete',
                resource_type='domain_mark',
                resource_key=mark_key,
                base_path=base_path,
                operation_result='success'
            )
            
            return {
                "message": "Domain unmarked successfully",
                "domain": domain,
                "base_path": base_path
            }
            
        except Exception as e:
            # 记录操作日志
            self.db_operations.log_operation(
                instance_id=instance_id,
                operation_type='delete',
                resource_type='domain_mark',
                resource_key=mark_key if 'mark_key' in locals() else None,
                base_path=base_path,
                operation_result='failed',
                error_message=str(e)
            )
            raise
            
    def _validate_domain_name(self, domain: str):
        """验证域名格式"""
        if not domain or not isinstance(domain, str):
            raise ValueError("Invalid domain name")
            
        # 域名总长度不能超过253个字符
        if len(domain) > 253:
            raise ValueError("Domain name too long (max 253 characters)")
        
        # 每个标签长度不能超过63个字符
        if any(len(label) > 63 for label in domain.split('.')):
            raise ValueError("Domain label too long (max 63 characters per label)")
        
        # 验证域名格式 (RFC 1035标准)
        domain_pattern = r"^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$"
        if not re.match(domain_pattern, domain):
            raise ValueError("Invalid domain format (RFC 1035)")
            
    def _build_domain_key(self, domain: str, base_path: str) -> str:
        """构建域名ETCD键"""
        domain_parts = domain.strip('.').split('.')
        domain_parts.reverse()
        return f"{base_path}/{'/'.join(domain_parts)}"