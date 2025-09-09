import { ArrowUpIcon, ArrowDownIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PriceIndicatorProps {
  price: number;
  change: number;
  changePercent: number;
  showArrow?: boolean;
  showPercent?: boolean;
  className?: string;
  priceRef?: React.Ref<HTMLSpanElement>;
}

export function PriceIndicator({
  price,
  change,
  changePercent,
  showArrow = true,
  showPercent = true,
  className,
  priceRef
}: PriceIndicatorProps) {
  const isPositive = change >= 0;

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatChange = () => {
    const sign = change >= 0 ? '+' : '';
    const changeFormatted = formatPrice(Math.abs(change));
    const percentFormatted = Math.abs(changePercent).toFixed(2);

    if (showPercent) {
      return `${sign}${changeFormatted} (${sign}${percentFormatted}%)`;
    }
    return `${sign}${changeFormatted}`;
  };

  return (
    <div className={cn('flex items-center space-x-2', className)}>
      <span ref={priceRef} className='text-lg font-semibold'>
        ${formatPrice(price)}
      </span>
      <div
        className={cn(
          'flex items-center space-x-1 text-sm font-medium',
          isPositive ? 'text-green-600' : 'text-red-600'
        )}
      >
        {showArrow &&
          (isPositive ? (
            <ArrowUpIcon className='h-3 w-3' />
          ) : (
            <ArrowDownIcon className='h-3 w-3' />
          ))}
        <span>{formatChange()}</span>
      </div>
    </div>
  );
}
