'use client';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

interface TickerErrorModalProps {
  title: string;
  description: string;
  nextStep: string;
  isOpen: boolean;
  onClose: () => void;
}

export function TickerErrorModal({
  title,
  description,
  nextStep,
  isOpen,
  onClose
}: TickerErrorModalProps) {
  return (
    <Modal
      title={title}
      description={description}
      isOpen={isOpen}
      onClose={onClose}
    >
      <div className='space-y-4 pt-2'>
        <p className='text-muted-foreground text-sm'>{nextStep}</p>
        <div className='flex justify-end'>
          <Button type='button' onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
