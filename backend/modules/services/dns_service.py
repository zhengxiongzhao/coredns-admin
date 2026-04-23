import re
import ipaddress
from typing import List, Optional, Dict, Any
from datetime import datetime
from ..database import DatabaseOperations
from ..etcd import EtcdConnectionPool, EtcdOperations
from ..etcd.exceptions import EtcdConnectionError, EtcdOperationError, EtcdRecordExistsError

class DnsService:
    """DNS记录管理服务，支持base_path"""
    
    def __init__(self, db_operations: DatabaseOperations, connection_pool: EtcdConnectionPool):
        self.db_operations = db_operations
        self.connection_pool = connection_pool
        
    def get_dns_records(self, instance_id: int, filter_domain: Optional[str] = None, 
                       custom_base_path: Optional[str] = None) -> List[Dict[str, Any]]:
        """获取DNS记录，支持自定义base_path和域名过滤"""
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
            # 获取所有DNS记录
            records = client.get_dns_records(effective_base_path, filter_domain)
            
            # 检测记录冲突
            conflicts = self._check_dns_record_conflicts(records)
            for record in records:
                record_key = record.get('key')
                if record_key in conflicts:
                    conflict_info = conflicts[record_key]
                    record.update({
                        'has_conflict': conflict_info['has_conflict'],
                        'conflict_type': conflict_info['conflict_type'],
                        'conflict_message': conflict_info['message'],
                        'conflict_details': conflict_info['details']
                    })
                else:
                    record.update({
                        'has_conflict': False,
                        'conflict_type': 'none',
                        'conflict_message': '',
                        'conflict_details': ''
                    })
            
            # 记录操作日志
            self.db_operations.log_operation(
                instance_id=instance_id,
                operation_type='read',
                resource_type='dns_record',
                resource_key=f"domain:{filter_domain}" if filter_domain else "all_records",
                base_path=effective_base_path,
                operation_result='success'
            )
            
            return records
            
        except Exception as e:
            # 记录操作日志
            self.db_operations.log_operation(
                instance_id=instance_id,
                operation_type='read',
                resource_type='dns_record',
                resource_key=f"domain:{filter_domain}" if filter_domain else "all_records",
                base_path=effective_base_path,
                operation_result='failed',
                error_message=str(e)
            )
            raise EtcdOperationError(f"Failed to get DNS records: {str(e)}")
            
    def create_dns_record(self, instance_id: int, record_data: Dict[str, Any]) -> Dict[str, Any]:
        """创建DNS记录，支持base_path"""
        # 获取ETCD实例配置
        instance = self.db_operations.get_etcd_instance(instance_id)
        if not instance:
            raise ValueError(f"ETCD instance {instance_id} not found")
            
        if not instance.is_active:
            raise ValueError(f"ETCD instance {instance_id} is not active")
            
        # 验证必需字段
        required_fields = ['domain', 'name', 'type', 'content']
        for field in required_fields:
            if field not in record_data:
                raise ValueError(f"Missing required field: {field}")
                
        domain = record_data['domain']
        name = record_data['name']
        record_type = record_data['type']
        content = record_data['content']
        ttl = record_data.get('ttl', 60)
        priority = record_data.get('priority', 100)
        
        # 验证DNS记录
        validation_errors = self._validate_dns_record(name, record_type, content, ttl)
        if validation_errors:
            raise ValueError("; ".join(validation_errors))
            
        # 获取ETCD连接
        client = self.connection_pool.get_connection(instance_id, {
            'host': instance.host,
            'port': instance.port,
            'base_path': instance.base_path,
            'username': instance.username,
            'password': instance.password
        })
        
        # 使用自定义base_path或实例的base_path
        effective_base_path = record_data.get('base_path') or instance.base_path
        
        try:
            # 创建DNS记录
            etcd_ops = EtcdOperations(client)
            result = etcd_ops.create_domain_record(
                domain=domain,
                name=name,
                record_type=record_type,
                content=content,
                ttl=ttl,
                priority=priority,
                custom_base_path=effective_base_path
            )
            
            # 记录操作日志
            self.db_operations.log_operation(
                instance_id=instance_id,
                operation_type='create',
                resource_type='dns_record',
                resource_key=result['key'],
                base_path=effective_base_path,
                operation_result='success'
            )
            
            return result
            
        except EtcdRecordExistsError:
            # 记录已存在，重新抛出异常
            raise
        except Exception as e:
            # 记录操作日志
            self.db_operations.log_operation(
                instance_id=instance_id,
                operation_type='create',
                resource_type='dns_record',
                resource_key=f"{domain}:{name}:{record_type}",
                base_path=effective_base_path,
                operation_result='failed',
                error_message=str(e)
            )
            raise EtcdOperationError(f"Failed to create DNS record: {str(e)}")
            
    def update_dns_record(self, instance_id: int, record_data: Dict[str, Any]) -> Dict[str, Any]:
        """更新DNS记录"""
        # 获取ETCD实例配置
        instance = self.db_operations.get_etcd_instance(instance_id)
        if not instance:
            raise ValueError(f"ETCD instance {instance_id} not found")
            
        if not instance.is_active:
            raise ValueError(f"ETCD instance {instance_id} is not active")
            
        # 验证必需字段
        required_fields = ['key', 'domain', 'name', 'type', 'content']
        for field in required_fields:
            if field not in record_data:
                raise ValueError(f"Missing required field: {field}")
                
        key = record_data['key']
        domain = record_data['domain']
        name = record_data['name']
        record_type = record_data['type']
        content = record_data['content']
        ttl = record_data.get('ttl', 60)
        priority = record_data.get('priority', 100)
        
        # 验证DNS记录
        validation_errors = self._validate_dns_record(name, record_type, content, ttl)
        if validation_errors:
            raise ValueError("; ".join(validation_errors))
            
        # 获取ETCD连接
        client = self.connection_pool.get_connection(instance_id, {
            'host': instance.host,
            'port': instance.port,
            'base_path': instance.base_path,
            'username': instance.username,
            'password': instance.password
        })
        
        try:
            # 更新DNS记录
            result = client.update_dns_record(
                key=key,
                domain=domain,
                name=name,
                record_type=record_type,
                content=content,
                ttl=ttl,
                priority=priority
            )
            
            # 记录操作日志
            self.db_operations.log_operation(
                instance_id=instance_id,
                operation_type='update',
                resource_type='dns_record',
                resource_key=key,
                base_path=instance.base_path,
                operation_result='success'
            )
            
            return result
            
        except Exception as e:
            # 记录操作日志
            self.db_operations.log_operation(
                instance_id=instance_id,
                operation_type='update',
                resource_type='dns_record',
                resource_key=key,
                base_path=instance.base_path,
                operation_result='failed',
                error_message=str(e)
            )
            raise EtcdOperationError(f"Failed to update DNS record: {str(e)}")
            
    def delete_dns_record(self, instance_id: int, key: str) -> bool:
        """删除DNS记录"""
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
        
        try:
            # 删除DNS记录
            success = client.delete_dns_record(key)
            
            if success:
                # 记录操作日志
                self.db_operations.log_operation(
                    instance_id=instance_id,
                    operation_type='delete',
                    resource_type='dns_record',
                    resource_key=key,
                    base_path=instance.base_path,
                    operation_result='success'
                )
            else:
                # 记录操作日志
                self.db_operations.log_operation(
                    instance_id=instance_id,
                    operation_type='delete',
                    resource_type='dns_record',
                    resource_key=key,
                    base_path=instance.base_path,
                    operation_result='failed',
                    error_message="Record not found or already deleted"
                )
                
            return success
            
        except Exception as e:
            # 记录操作日志
            self.db_operations.log_operation(
                instance_id=instance_id,
                operation_type='delete',
                resource_type='dns_record',
                resource_key=key,
                base_path=instance.base_path,
                operation_result='failed',
                error_message=str(e)
            )
            raise EtcdOperationError(f"Failed to delete DNS record: {str(e)}")
            
    def delete_dns_records_by_domain(self, instance_id: int, domain: str, 
                                   custom_base_path: Optional[str] = None) -> int:
        """删除指定域名的所有DNS记录"""
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
            # 删除域名下的所有记录
            deleted_count = client.delete_domain_records(domain, effective_base_path)
            
            # 记录操作日志
            self.db_operations.log_operation(
                instance_id=instance_id,
                operation_type='delete',
                resource_type='dns_record',
                resource_key=f"domain:{domain}",
                base_path=effective_base_path,
                operation_result='success'
            )
            
            return deleted_count
            
        except Exception as e:
            # 记录操作日志
            self.db_operations.log_operation(
                instance_id=instance_id,
                operation_type='delete',
                resource_type='dns_record',
                resource_key=f"domain:{domain}",
                base_path=effective_base_path,
                operation_result='failed',
                error_message=str(e)
            )
            raise EtcdOperationError(f"Failed to delete DNS records by domain: {str(e)}")
            
    def validate_dns_record_batch(self, records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """批量验证DNS记录"""
        validated_records = []
        errors = []
        
        for i, record in enumerate(records):
            try:
                # 验证必需字段
                required_fields = ['domain', 'name', 'type', 'content']
                for field in required_fields:
                    if field not in record:
                        raise ValueError(f"Missing required field: {field}")
                        
                # 验证DNS记录
                validation_errors = self._validate_dns_record(
                    record['name'], 
                    record['type'], 
                    record['content'], 
                    record.get('ttl', 60)
                )
                
                if validation_errors:
                    errors.append({
                        "index": i,
                        "record": record,
                        "errors": validation_errors
                    })
                else:
                    validated_records.append(record)
                    
            except Exception as e:
                errors.append({
                    "index": i,
                    "record": record,
                    "errors": [str(e)]
                })
                
        return {
            "validated_records": validated_records,
            "errors": errors,
            "total": len(records),
            "valid": len(validated_records),
            "invalid": len(errors)
        }
        
    def create_dns_records_batch(self, instance_id: int, records: List[Dict[str, Any]]) -> Dict[str, Any]:
        """批量创建DNS记录"""
        # 验证记录
        validation_result = self.validate_dns_record_batch(records)
        
        if not validation_result['validated_records']:
            return {
                "message": "No valid records to create",
                "created": [],
                "failed": validation_result['errors']
            }
            
        created_records = []
        failed_records = []
        
        for i, record in enumerate(validation_result['validated_records']):
            try:
                result = self.create_dns_record(instance_id, record)
                created_records.append({
                    "index": i,
                    "record": record,
                    "result": result
                })
            except Exception as e:
                failed_records.append({
                    "index": i,
                    "record": record,
                    "error": str(e)
                })
                
        return {
            "message": f"Created {len(created_records)} records, {len(failed_records)} failed",
            "created": created_records,
            "failed": failed_records,
            "total": len(records),
            "success_count": len(created_records),
            "failure_count": len(failed_records)
        }
        
    def _validate_dns_record(self, name: str, record_type: str, content: str, ttl: int) -> List[str]:
        """验证DNS记录的有效性"""
        errors = []
        
        if not name or not isinstance(name, str):
            errors.append("Invalid name")
        
        # 支持更多记录类型
        valid_record_types = ["A", "CNAME", "TXT", "MX", "SRV", "AAAA", "NS", "PTR", "SOA"]
        if record_type.upper() not in valid_record_types:
            errors.append(f"Invalid record type. Valid types are: {', '.join(valid_record_types)}")
        
        # 根据记录类型进行内容验证
        if record_type.upper() == "A":
            # IPv4地址验证
            ip_pattern = r"^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$"
            if not re.match(ip_pattern, content):
                errors.append("Invalid IPv4 address format")
        elif record_type.upper() == "AAAA":
            # IPv6地址验证
            try:
                ipaddress.IPv6Address(content)
            except ipaddress.AddressValueError:
                errors.append("Invalid IPv6 address format")
        elif record_type.upper() in ["CNAME", "NS", "PTR"]:
            # 域名格式验证 (RFC 1035)
            domain_pattern = r"^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*\.?$"
            if not re.match(domain_pattern, content):
                errors.append(f"Invalid {record_type} domain format")
        elif record_type.upper() == "MX":
            # MX记录格式: priority domain
            mx_pattern = r"^\d+\s+[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*\.?$"
            if not re.match(mx_pattern, content):
                errors.append("Invalid MX record format. Expected: priority domain")
        elif record_type.upper() == "SRV":
            # SRV记录格式: priority weight port target
            srv_pattern = r"^\d+\s+\d+\s+\d+\s+[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*\.?$"
            if not re.match(srv_pattern, content):
                errors.append("Invalid SRV record format. Expected: priority weight port target")
        elif record_type.upper() == "SOA":
            # SOA记录格式: ns responsible ttl refresh retry expire minttl
            soa_parts = content.split()
            if len(soa_parts) < 7:
                errors.append("Invalid SOA record format. Expected: ns responsible ttl refresh retry expire minttl")
            else:
                # 验证域名部分
                domain_pattern = r"^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*\.?$"
                if not re.match(domain_pattern, soa_parts[0]) or not re.match(domain_pattern, soa_parts[1]):
                    errors.append("Invalid domain in SOA record")
                
                # 验证数值部分
                try:
                    for i in range(2, 7):
                        int(soa_parts[i])
                except (ValueError, IndexError):
                    errors.append("Invalid numeric values in SOA record")
        
        # TTL验证
        try:
            ttl_int = int(ttl)
            if ttl_int <= 0:
                errors.append("TTL must be a positive integer")
        except (ValueError, TypeError):
            errors.append("TTL must be a number")
        
        return errors
        
    def _check_dns_record_conflicts(self, records: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """检测DNS记录冲突"""
        conflicts = {}
        
        # 获取所有记录的键路径
        all_keys = []
        key_to_record = {}
        
        for record in records:
            key = record.get('key', '')
            if key:
                all_keys.append(key)
                key_to_record[key] = record
        
        # 对每个记录检查是否存在子记录
        for record in records:
            current_key = record.get('key', '')
            current_key_parts = current_key.split('/')
            
            # 检查是否有其他记录是当前记录的子记录
            has_sub_records = False
            sub_record_count = 0
            sub_record_keys = []
            
            for other_key in all_keys:
                if other_key == current_key:
                    continue
                
                other_key_parts = other_key.split('/')
                
                # 如果其他记录的路径更长，且以当前记录的路径开头，则是子记录
                if (len(other_key_parts) > len(current_key_parts) and
                    other_key_parts[:len(current_key_parts)] == current_key_parts):
                    has_sub_records = True
                    sub_record_count += 1
                    sub_record_keys.append(other_key)
            
            # 如果有子记录，当前记录有冲突
            if has_sub_records:
                conflicts[current_key] = {
                    'has_conflict': True,
                    'conflict_type': 'root_with_sub',
                    'message': '此记录不会被CoreDNS解析，因为存在同名的子记录',
                    'details': f'CoreDNS会优先解析 {sub_record_count} 条子记录，而忽略这条根记录',
                    'sub_record_keys': sub_record_keys
                }
            else:
                conflicts[current_key] = {
                    'has_conflict': False,
                    'conflict_type': 'none',
                    'message': '',
                    'details': '',
                    'sub_record_keys': []
                }
        
        return conflicts
        
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