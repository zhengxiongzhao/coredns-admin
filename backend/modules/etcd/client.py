import etcd3
import json
import re
import ipaddress
from typing import Optional, Dict, Any, List
from datetime import datetime
from .exceptions import EtcdConnectionError, EtcdOperationError, EtcdRecordExistsError

class EtcdClient:
    """ETCD客户端封装，支持base_path配置"""
    
    def __init__(self, host: str, port: int, base_path: str = '/skydns', 
                 username: Optional[str] = None, password: Optional[str] = None):
        self.host = host
        self.port = port
        self.base_path = base_path
        self.username = username
        self.password = password
        self.client: Optional[etcd3.client] = None
        self._connect()
        
    def _connect(self):
        """建立ETCD连接"""
        try:
            if self.username and self.password:
                self.client = etcd3.client(
                    host=self.host,
                    port=self.port,
                    user=self.username,
                    password=self.password
                )
            else:
                self.client = etcd3.client(host=self.host, port=self.port)
        except Exception as e:
            raise EtcdConnectionError(f"Failed to connect to ETCD at {self.host}:{self.port}: {str(e)}")
            
    def get_domains(self, custom_base_path: Optional[str] = None) -> List[Dict[str, Any]]:
        """获取所有域名，支持自定义base_path"""
        effective_base_path = custom_base_path or self.base_path
        
        try:
            records = []
            etcd_records = self.client.get_prefix(effective_base_path)
            
            for value, metadata in etcd_records:
                try:
                    key_str = metadata.key.decode('utf-8')
                    value_str = value.decode('utf-8')
                    
                    # 提取域名信息
                    domain_info = self._extract_domain_info(key_str, value_str, effective_base_path)
                    if domain_info:
                        records.append(domain_info)
                except (UnicodeDecodeError, json.JSONDecodeError):
                    continue
                    
            return records
        except Exception as e:
            raise EtcdOperationError(f"Failed to get domains from {effective_base_path}: {str(e)}")
            
    def get_dns_records(self, custom_base_path: Optional[str] = None, filter_domain: Optional[str] = None) -> List[Dict[str, Any]]:
        """获取所有DNS记录，支持自定义base_path和域名过滤"""
        effective_base_path = custom_base_path or self.base_path
        
        try:
            records = []
            etcd_records = self.client.get_prefix(effective_base_path)
            
            for value, metadata in etcd_records:
                try:
                    key_str = metadata.key.decode('utf-8')
                    value_str = value.decode('utf-8')
                    
                    # 提取DNS记录信息
                    record_info = self._extract_dns_record_info(key_str, value_str, effective_base_path, filter_domain)
                    if record_info:
                        records.append(record_info)
                except (UnicodeDecodeError, json.JSONDecodeError):
                    continue
                    
            return records
        except Exception as e:
            raise EtcdOperationError(f"Failed to get DNS records from {effective_base_path}: {str(e)}")
            
    def create_dns_record(self, domain: str, name: str, record_type: str, content: str, 
                         ttl: int = 60, priority: int = 100, 
                         custom_base_path: Optional[str] = None) -> Dict[str, Any]:
        """创建DNS记录，支持自定义base_path"""
        effective_base_path = custom_base_path or self.base_path
        
        try:
            # 构建ETCD键
            key = self._build_etcd_key(domain, name, effective_base_path)
            
            # 构建ETCD值
            value = self._build_etcd_value(record_type, content, ttl, priority)
            
            # 检查记录是否已存在
            existing_value, _ = self.client.get(key)
            if existing_value:
                # 检查是否是完全相同的记录
                try:
                    if json.loads(existing_value.decode('utf-8')) == value:
                        raise EtcdRecordExistsError("An identical record already exists")
                except (json.JSONDecodeError, UnicodeDecodeError):
                    pass
                    
                # 记录已存在但内容不同，创建序列号记录
                return self._create_sequential_record(key, value, domain, name, record_type, content, ttl, effective_base_path)
                
            # 创建根记录
            self.client.put(key, json.dumps(value))
            
            return {
                "key": key,
                "domain": domain,
                "name": name,
                "type": record_type,
                "content": content,
                "ttl": ttl,
                "priority": priority,
                "base_path": effective_base_path,
                "is_multiple_record": False,
                "is_root_record": True
            }
        except Exception as e:
            raise EtcdOperationError(f"Failed to create DNS record: {str(e)}")
            
    def update_dns_record(self, key: str, domain: str, name: str, record_type: str, content: str, 
                         ttl: int = 60, priority: int = 100) -> Dict[str, Any]:
        """更新DNS记录"""
        try:
            # 构建新的ETCD值
            value = self._build_etcd_value(record_type, content, ttl, priority)
            
            # 更新记录
            self.client.put(key, json.dumps(value))
            
            return {
                "key": key,
                "domain": domain,
                "name": name,
                "type": record_type,
                "content": content,
                "ttl": ttl,
                "priority": priority
            }
        except Exception as e:
            raise EtcdOperationError(f"Failed to update DNS record: {str(e)}")
            
    def delete_dns_record(self, key: str) -> bool:
        """删除DNS记录"""
        try:
            return self.client.delete(key)
        except Exception as e:
            raise EtcdOperationError(f"Failed to delete DNS record: {str(e)}")
            
    def delete_dns_records_by_prefix(self, prefix: str) -> int:
        """删除指定前缀的所有DNS记录"""
        try:
            records = list(self.client.get_prefix(prefix))
            deleted_count = 0
            
            for _, metadata in records:
                if self.client.delete(metadata.key):
                    deleted_count += 1
                    
            return deleted_count
        except Exception as e:
            raise EtcdOperationError(f"Failed to delete DNS records by prefix: {str(e)}")
            
    def _build_etcd_key(self, domain: str, name: str, base_path: str) -> str:
        """构建ETCD键，使用指定的base_path"""
        if name == "@":
            fqdn = domain
        else:
            fqdn = f"{name}.{domain}"
            
        # 域名到ETCD键的转换（反转域名部分）
        parts = fqdn.strip('.').split('.')
        parts.reverse()
        return f"{base_path}/{'/'.join(parts)}"
        
    def _build_etcd_value(self, record_type: str, content: str, ttl: int, priority: int) -> Dict[str, Any]:
        """构建ETCD值"""
        value_data = {"ttl": int(ttl)}
        
        record_type = record_type.upper()
        
        if record_type in ["A", "AAAA", "CNAME", "MX", "NS", "PTR"]:
            value_data["host"] = content
        elif record_type == "TXT":
            value_data["text"] = content
        elif record_type == "SRV":
            # SRV记录格式: priority weight port target
            parts = content.split()
            if len(parts) >= 4:
                value_data["priority"] = int(parts[0])
                value_data["weight"] = int(parts[1])
                value_data["port"] = int(parts[2])
                value_data["target"] = parts[3]
        elif record_type == "SOA":
            # SOA记录格式: ns responsible ttl refresh retry expire minttl
            parts = content.split()
            if len(parts) >= 7:
                value_data["ns"] = parts[0]
                value_data["responsible"] = parts[1]
                value_data["ttl"] = int(parts[2])
                value_data["refresh"] = int(parts[3])
                value_data["retry"] = int(parts[4])
                value_data["expire"] = int(parts[5])
                value_data["minttl"] = int(parts[6])
                
        # 对于MX和SRV记录，添加优先级
        if record_type in ["MX", "SRV"]:
            value_data["priority"] = int(priority)
            
        return value_data
        
    def _create_sequential_record(self, base_key: str, value: Dict[str, Any], domain: str, name: str, 
                                 record_type: str, content: str, ttl: int, base_path: str) -> Dict[str, Any]:
        """创建序列号记录（用于支持同名多条记录）"""
        try:
            # 获取当前最大序列号
            max_sequence = self._get_max_record_sequence(base_key)
            new_sequence = max_sequence + 1
            sequence_suffix = f"_record_{new_sequence:02d}"
            
            # 构建带序列号后缀的键
            key_with_suffix = f"{base_key}/{sequence_suffix}"
            
            # 创建带序列号的记录
            self.client.put(key_with_suffix, json.dumps(value))
            
            return {
                "key": key_with_suffix,
                "domain": domain,
                "name": name,
                "type": record_type,
                "content": content,
                "ttl": ttl,
                "base_path": base_path,
                "is_multiple_record": True,
                "is_root_record": False,
                "sequence_number": new_sequence
            }
        except Exception as e:
            raise EtcdOperationError(f"Failed to create sequential record: {str(e)}")
            
    def _get_max_record_sequence(self, base_key: str) -> int:
        """获取指定基础键下的最大记录序列号"""
        try:
            existing_records = list(self.client.get_prefix(base_key))
            max_sequence = 0
            
            for value, metadata in existing_records:
                key_str = metadata.key.decode('utf-8')
                key_parts = key_str.split('/')
                
                if len(key_parts) > 1:
                    last_part = key_parts[-1]
                    # 检查是否是_record_XX格式
                    if last_part.startswith('_record_'):
                        try:
                            sequence = int(last_part.replace('_record_', ''))
                            max_sequence = max(max_sequence, sequence)
                        except ValueError:
                            continue
                            
            return max_sequence
        except Exception as e:
            raise EtcdOperationError(f"Failed to get max record sequence: {str(e)}")
            
    def _extract_domain_info(self, key_str: str, value_str: str, base_path: str) -> Optional[Dict[str, Any]]:
        """从ETCD键值中提取域名信息"""
        try:
            # 确保key以base_path开头
            if not key_str.startswith(base_path):
                return None
                
            # 解析值数据
            value_data = json.loads(value_str)
            
            # 跳过虚拟记录
            if value_data.get('virtual'):
                return None
                
            # 提取域名
            domain = self._etcd_key_to_domain(key_str, base_path)
            
            # 提取第二级域名
            second_level_domain = self._extract_second_level_domain(domain)
            
            return {
                "domain": second_level_domain,
                "full_domain": domain,
                "key": key_str,
                "base_path": base_path,
                "record_count": 1,
                "is_virtual": False
            }
        except (json.JSONDecodeError, UnicodeDecodeError):
            return None
            
    def _extract_dns_record_info(self, key_str: str, value_str: str, base_path: str, filter_domain: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """从ETCD键值中提取DNS记录信息"""
        try:
            # 确保key以base_path开头
            if not key_str.startswith(base_path):
                return None
                
            # 解析值数据
            value_data = json.loads(value_str)
            
            # 跳过虚拟记录
            if value_data.get('virtual'):
                return None
                
            # 提取域名和记录名称
            full_domain = self._etcd_key_to_domain(key_str, base_path)
            
            # 如果有过滤域名，检查是否匹配
            if filter_domain and full_domain != filter_domain and not full_domain.endswith('.' + filter_domain):
                return None
                
            # 提取记录名称
            record_name = self._extract_record_name(full_domain, filter_domain)
            
            # 确定记录类型和内容
            record_type, content = self._extract_record_type_and_content(value_data)
            
            if not record_type or not content:
                return None
                
            # 检查是否为多条记录
            is_multiple_record, is_root_record, record_group = self._check_multiple_records(key_str)
            
            return {
                "key": key_str,
                "name": record_name,
                "type": record_type,
                "content": content,
                "ttl": value_data.get("ttl", 60),
                "priority": value_data.get("priority", 100),
                "domain": filter_domain or self._extract_second_level_domain(full_domain),
                "base_path": base_path,
                "is_multiple_record": is_multiple_record,
                "is_root_record": is_root_record,
                "record_group": record_group
            }
        except (json.JSONDecodeError, UnicodeDecodeError):
            return None
            
    def _etcd_key_to_domain(self, key_str: str, base_path: str) -> str:
        """将ETCD键转换回域名"""
        path_without_base = key_str[len(base_path):].strip('/')
        parts = path_without_base.split('/')
        
        # 检查最后一部分是否是_record_XX格式
        if len(parts) > 1:
            last_part = parts[-1]
            if last_part.startswith('_record_'):
                try:
                    sequence_num = int(last_part.replace('_record_', ''))
                    if 1 <= sequence_num <= 99:
                        parts = parts[:-1]
                except ValueError:
                    pass
                    
        parts.reverse()
        return '.'.join(parts)
        
    def _extract_second_level_domain(self, fqdn: str) -> str:
        """提取第二级域名"""
        parts = fqdn.strip('.').split('.')
        if len(parts) >= 2:
            return '.'.join(parts[-2:])
        return fqdn
        
    def _extract_record_name(self, full_domain: str, filter_domain: Optional[str]) -> str:
        """提取记录名称"""
        if filter_domain:
            if full_domain == filter_domain:
                return "@"
            elif full_domain.endswith('.' + filter_domain):
                return full_domain[:-len('.' + filter_domain)]
            else:
                return full_domain.replace('.' + filter_domain, "")
        else:
            second_level = self._extract_second_level_domain(full_domain)
            if full_domain == second_level:
                return "@"
            elif full_domain.endswith('.' + second_level):
                return full_domain[:-len('.' + second_level)]
            else:
                return full_domain.replace('.' + second_level, "")
                
    def _extract_record_type_and_content(self, value_data: Dict[str, Any]) -> tuple:
        """从值数据中提取记录类型和内容"""
        if "host" in value_data:
            host_value = value_data["host"]
            
            # IPv4地址判断
            ip_pattern = r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$"
            if re.match(ip_pattern, host_value):
                return "A", host_value
            else:
                # IPv6地址判断
                try:
                    ipaddress.IPv6Address(host_value)
                    return "AAAA", host_value
                except ipaddress.AddressValueError:
                    # 域名判断
                    if host_value.endswith('.') or '.' in host_value:
                        return "CNAME", host_value
                    elif value_data.get("priority") is not None:
                        return "MX", host_value
                    else:
                        return "CNAME", host_value
        elif "text" in value_data:
            return "TXT", value_data["text"]
        elif "priority" in value_data and "target" in value_data:
            # SRV记录
            priority = value_data.get("priority", 0)
            weight = value_data.get("weight", 0)
            port = value_data.get("port", 0)
            target = value_data.get("target", "")
            return "SRV", f"{priority} {weight} {port} {target}"
        elif "ns" in value_data and "responsible" in value_data:
            # SOA记录
            ns = value_data.get("ns", "")
            responsible = value_data.get("responsible", "")
            ttl = value_data.get("ttl", 60)
            refresh = value_data.get("refresh", 0)
            retry = value_data.get("retry", 0)
            expire = value_data.get("expire", 0)
            minttl = value_data.get("minttl", 60)
            return "SOA", f"{ns} {responsible} {ttl} {refresh} {retry} {expire} {minttl}"
            
        return None, None
        
    def _check_multiple_records(self, key_str: str) -> tuple:
        """检查是否为多条记录"""
        key_parts = key_str.split('/')
        
        if len(key_parts) > 1:
            last_part = key_parts[-1]
            if last_part.startswith('_record_'):
                try:
                    sequence = int(last_part.replace('_record_', ''))
                    if 1 <= sequence <= 99:
                        # 构建记录组标识（去掉序列号后缀的key）
                        group_key = '/'.join(key_parts[:-1])
                        return True, False, group_key
                except ValueError:
                    pass
                    
        # 可能是根记录
        group_key = key_str
        return False, True, group_key
        
    def get_prefix(self, prefix: str):
        """获取指定前缀的所有键值对"""
        try:
            if self.client:
                return self.client.get_prefix(prefix)
            return []
        except Exception as e:
            raise EtcdOperationError(f"Failed to get prefix {prefix}: {str(e)}")
            
    def get(self, key: str):
        """获取指定键的值"""
        try:
            if self.client:
                return self.client.get(key)
            return None, None
        except Exception as e:
            raise EtcdOperationError(f"Failed to get key {key}: {str(e)}")
            
    def put(self, key: str, value: str):
        """设置指定键的值"""
        try:
            if self.client:
                return self.client.put(key, value)
            return None
        except Exception as e:
            raise EtcdOperationError(f"Failed to put key {key}: {str(e)}")
            
    def delete(self, key: str) -> bool:
        """删除指定键"""
        try:
            if self.client:
                return self.client.delete(key)
            return False
        except Exception as e:
            raise EtcdOperationError(f"Failed to delete key {key}: {str(e)}")
            
    def health_check(self) -> bool:
        """健康检查"""
        try:
            if self.client:
                # 尝试执行一个简单的操作来检查连接
                self.client.get("/health_check")
                return True
            return False
        except Exception:
            return False