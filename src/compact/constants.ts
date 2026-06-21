/**
 * 上下文压缩阈值配置
 * 用于控制何时触发自动压缩
 */
export const THRESHOLDS = {
  /** 微压缩触发阈值 - 当上下文利用率达到 50% 时触发 */
  MICROCOMPACT_UTILIZATION: 0.50,
  /** 自动压缩触发阈值 - 当上下文利用率达到 85% 时触发 */
  AUTOCOMPACT_UTILIZATION: 0.85,
  /** 阻塞阈值 - 当上下文利用率达到 95% 时认为上下文已满 */
  BLOCKED_UTILIZATION: 0.95,
} as const

/** Snip 压缩阈值 */
export const SNIP_COMPACT_THRESHOLD = 0.70
/** Snip 压缩目标使用率 */
export const SNIP_TARGET_USAGE = 0.60
/** Snip 压缩最少移除消息数 */
export const SNIP_MIN_MESSAGES_TO_REMOVE = 6
/** Snip 压缩保留最近消息数 */
export const SNIP_KEEP_RECENT_MESSAGES = 12
/** Snip 压缩最少释放 token 数 */
export const SNIP_MIN_TOKENS_TO_FREE = 2_000

/** 上下文折叠触发阈值 */
export const CONTEXT_COLLAPSE_UTILIZATION = 0.75
/** 上下文折叠目标使用率 */
export const CONTEXT_COLLAPSE_TARGET_USAGE = 0.65
/** 上下文折叠保留最近消息数 */
export const CONTEXT_COLLAPSE_KEEP_RECENT_MESSAGES = 12
/** 上下文折叠最少保存 token 数 */
export const CONTEXT_COLLAPSE_MIN_TOKENS_TO_SAVE = 2_000
/** 上下文折叠每次最大跨度数 */
export const CONTEXT_COLLAPSE_MAX_SPANS_PER_PASS = 2
/** 上下文折叠最大失败次数 */
export const CONTEXT_COLLAPSE_MAX_FAILURES = 3

/**
 * 消息保留配置
 * 用于控制压缩时保留哪些消息
 */
export const RETENTION = {
  /** 保留最近的工具结果数量 */
  KEEP_RECENT_TOOL_RESULTS: 3,
  /** 最少保留消息数 */
  MIN_KEEP_MESSAGES: 6,
  /** 最少保留 token 数 */
  MIN_KEEP_TOKENS: 10_000,
  /** 最多保留 token 数 */
  MAX_KEEP_TOKENS: 40_000,
} as const

/**
 * 系统限制配置
 */
export const LIMITS = {
  /** 自动压缩最大失败次数 */
  MAX_AUTOCOMPACT_FAILURES: 3,
  /** 摘要最大输出 token 数 */
  SUMMARY_MAX_OUTPUT_TOKENS: 4_096,
  /** PTL 最大重试次数 */
  PTL_MAX_RETRIES: 2,
  /** 自动压缩最小有效输入 token 数 */
  MIN_EFFECTIVE_INPUT_FOR_AUTOCOMPACT: 20_000,
} as const
