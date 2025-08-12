// Cache Management
export { CacheManager, cacheManager, CacheOptions, CacheMetrics } from '../cache/CacheManager'
export { CachedRepository, CacheConfig } from '../cache/CachedRepository'
export { CachedUserRepository, cachedUserRepository } from '../cache/implementations/CachedUserRepository'
export { CachedCardRepository, cachedCardRepository } from '../cache/implementations/CachedCardRepository'

// Query Optimization
export { QueryOptimizer, queryOptimizer, BatchOperation, QueryPlan } from './QueryOptimizer'

// Connection Pool Management
export {
  ConnectionPoolManager,
  connectionPoolManager,
  PoolConfig,
  PoolMetrics,
  ConnectionHealth
} from './ConnectionPoolManager'

// Performance Monitoring
export {
  PerformanceMonitor,
  performanceMonitor,
  PerformanceMetric,
  PerformanceThresholds,
  PerformanceStats,
  PerformanceAlert
} from '../monitoring/PerformanceMonitor'

// Pagination
export {
  CursorPagination,
  cursorPagination,
  CursorPaginationOptions,
  CursorPaginationResult,
  CursorEncoder,
  Base64CursorEncoder
} from '../pagination/CursorPagination'

export { PaginatedRepository } from '../pagination/PaginatedRepository'