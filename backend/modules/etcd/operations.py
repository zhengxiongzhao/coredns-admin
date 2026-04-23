from typing import List, Optional, Dict, Any
from datetime import datetime
from .client import EtcdClient
from .exceptions import EtcdOperationError

class EtcdOperations:
    """ETCD操作封装，提供高阶操作接口"""
    
    def __init__(self, client: EtcdClient):
        self.client = client
        
    def get_all_domains(self, custom_base_path: Optional[str] = None) -> List[Dict[str, Any]]:
        """获取所有域名"""
        return self.client.get_domains(custom_base_path)
        
    def get_domain_records(self, domain: str, custom_base_path: Optional[str] = None) -> List[Dict[str, Any]]:
        """获取指定域名的所有DNS记录"""
        return self.client.get_dns_records(custom_base_path, filter_domain=domain)
        
    def create_domain_record(self, domain: str, name: str, record_type: str, content: str,
                           ttl: int = 60, priority: int = 100, 
                           custom_base_path: Optional[str] = None) -> Dict[str, Any]:
        """创建域名记录"""
        return self.client.create_dns_record(
            domain=domain,
            name=name,
            record_type=record_type,
            content=content,
            ttl=ttl,
            priority=priority,
            custom_base_path=custom_base_path
        )
        
    def update_domain_record(self, key: str, domain: str, name: str, record_type: str, 
                           content: str, ttl: int = 60, priority: int = 100) -> Dict[str, Any]:
        """更新域名记录"""
        return self.client.update_dns_record(
            key=key,
            domain=domain,
            name=name,
            record_type=record_type,
            content=content,
            ttl=ttl,
            priority=priority
        )
        
    def delete_domain_record(self, key: str) -> bool:
        """删除域名记录"""
        return self.client.delete_dns_record(key)
        
    def delete_domain_records(self, domain: str, custom_base_path: Optional[str] = None) -> int:
        """删除指定域名的所有记录"""
        effective_base_path = custom_base_path or self.client.base_path
        
        # 构建域名前缀
        domain_parts = domain.strip('.').split('.')
        domain_parts.reverse()
        prefix = f"{effective_base_path}/{'/'.join(domain_parts)}"
        
        return self.client.delete_dns_records_by_prefix(prefix)
        
    def validate_dns_record(self, name: str, record_type: str, content: str, ttl: int) -> List[str]:
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
        
    def check_dns_record_conflicts(self, records: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
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
        
    def get_health_status(self) -> Dict[str, Any]:
        """获取ETCD健康状态"""
        try:
            is_healthy = self.client.health_check()
            return {
                'status': 'healthy' if is_healthy else 'unhealthy',
                'host': self.client.host,
                'port': self.client.port,
                'base_path': self.client.base_path,
                'last_check': datetime.utcnow().isoformat()
            }
        except Exception as e:
            return {
                'status': 'error',
                'host': self.client.host,
                'port': self.client.port,
                'base_path': self.client.base_path,
                'error': str(e),
                'last_check': datetime.utcnow().isoformat()
            }