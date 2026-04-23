class EtcdConnectionError(Exception):
    """ETCD连接错误"""
    pass

class EtcdOperationError(Exception):
    """ETCD操作错误"""
    pass

class EtcdRecordExistsError(Exception):
    """ETCD记录已存在错误"""
    pass

class EtcdRecordNotFoundError(Exception):
    """ETCD记录不存在错误"""
    pass

class EtcdValidationError(Exception):
    """ETCD数据验证错误"""
    pass