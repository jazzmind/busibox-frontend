/**
 * Chat Skeleton Component
 *
 * Loading skeleton that matches the ChatContainer layout.
 * Used by loading.tsx and Suspense boundaries for instant page rendering
 * while data loads in the background.
 */

export function ChatSkeleton() {
  return (
    <div className="flex h-full bg-gray-50 dark:bg-gray-900 animate-pulse">
      {/* Conversations Sidebar Skeleton */}
      <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
          <div className="h-10 w-full bg-blue-100 dark:bg-blue-900/30 rounded-lg" />
        </div>

        {/* Conversation items */}
        <div className="flex-1 overflow-hidden p-2 space-y-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-2 p-3 rounded-lg"
            >
              <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="flex-1 space-y-1.5">
                <div
                  className="h-4 bg-gray-200 dark:bg-gray-700 rounded"
                  style={{ width: `${60 + Math.random() * 30}%` }}
                />
                <div className="h-3 w-20 bg-gray-100 dark:bg-gray-700/50 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area Skeleton */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-4 w-24 bg-gray-100 dark:bg-gray-700/50 rounded" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-9 w-24 bg-gray-100 dark:bg-gray-700 rounded-lg" />
              <div className="h-9 w-24 bg-gray-100 dark:bg-gray-700 rounded-lg" />
              <div className="h-9 w-20 bg-gray-100 dark:bg-gray-700 rounded-lg" />
            </div>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-hidden bg-white dark:bg-gray-800 p-6 space-y-6">
          {/* Sample message skeletons */}
          {/* User message */}
          <div className="flex gap-4 justify-end">
            <div className="max-w-md">
              <div className="rounded-lg px-4 py-3 bg-blue-100 dark:bg-blue-900/30 space-y-2">
                <div className="h-4 w-48 bg-blue-200 dark:bg-blue-800/50 rounded" />
              </div>
            </div>
          </div>

          {/* Assistant message */}
          <div className="flex gap-4 justify-start">
            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="max-w-xl">
              <div className="rounded-lg px-4 py-3 bg-gray-100 dark:bg-gray-700/50 space-y-2">
                <div className="h-4 w-full bg-gray-200 dark:bg-gray-600 rounded" />
                <div className="h-4 w-5/6 bg-gray-200 dark:bg-gray-600 rounded" />
                <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-600 rounded" />
              </div>
            </div>
          </div>

          {/* Another user message */}
          <div className="flex gap-4 justify-end">
            <div className="max-w-md">
              <div className="rounded-lg px-4 py-3 bg-blue-100 dark:bg-blue-900/30 space-y-2">
                <div className="h-4 w-36 bg-blue-200 dark:bg-blue-800/50 rounded" />
              </div>
            </div>
          </div>

          {/* Another assistant message */}
          <div className="flex gap-4 justify-start">
            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="max-w-xl">
              <div className="rounded-lg px-4 py-3 bg-gray-100 dark:bg-gray-700/50 space-y-2">
                <div className="h-4 w-full bg-gray-200 dark:bg-gray-600 rounded" />
                <div className="h-4 w-4/5 bg-gray-200 dark:bg-gray-600 rounded" />
              </div>
            </div>
          </div>
        </div>

        {/* Message Input skeleton */}
        <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="flex items-end gap-3">
            <div className="flex-1 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg" />
            <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
