import type { ChatMessage, ProviderUsage } from './types.js'

export function isEmptyAssistantResponse(content: string): boolean {
  return content.trim().length === 0
}

export function isProgressMessage(content: string): boolean {
  return content.trim().startsWith('<progress>')
}

export function isFinalMessage(content: string): boolean {
  return content.trim().startsWith('<final>')
}

export function extractMessageKind(
  content: string,
): 'final' | 'progress' | undefined {
  if (isFinalMessage(content)) return 'final'
  if (isProgressMessage(content)) return 'progress'
  return undefined
}

export function addProviderUsage<T extends ChatMessage>(
  message: T,
  usage: ProviderUsage | undefined,
): T {
  if (!usage) return message
  if (
    message.role === 'assistant' ||
    message.role === 'assistant_progress' ||
    message.role === 'assistant_tool_call'
  ) {
    return { ...message, providerUsage: usage } as T
  }
  return message
}

export function parseAssistantText(content: string): {
  content: string
  kind?: 'final' | 'progress'
} {
  const trimmed = content.trim()
  if (!trimmed) {
    return { content: '' }
  }

  const markers: Array<{
    prefix: string
    kind: 'final' | 'progress'
  }> = [
    { prefix: '<final>', kind: 'final' },
    { prefix: '[FINAL]', kind: 'final' },
    { prefix: '<progress>', kind: 'progress' },
    { prefix: '[PROGRESS]', kind: 'progress' },
  ]

  for (const marker of markers) {
    if (trimmed.startsWith(marker.prefix)) {
      const rawContent = trimmed.slice(marker.prefix.length).trim()
      const closingTag =
        marker.kind === 'progress'
          ? /<\/progress>/gi
          : /<\/final>/gi
      return {
        content: rawContent.replace(closingTag, '').trim(),
        kind: marker.kind,
      }
    }
  }

  return { content: trimmed }
}
