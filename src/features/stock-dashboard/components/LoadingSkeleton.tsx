interface LoadingSkeletonProps {
  count?: number;
}

export function LoadingSkeleton({ count = 3 }: LoadingSkeletonProps) {
  return (
    <div className='space-y-2'>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className='flex items-center justify-between'>
          <div className='h-5 w-16 animate-pulse rounded bg-gray-200' />
          <div className='h-8 w-20 animate-pulse rounded bg-gray-200' />
        </div>
      ))}
    </div>
  );
}
