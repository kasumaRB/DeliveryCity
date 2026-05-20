import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'blue' | 'green' | 'red' | 'yellow';
  text?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'blue',
  text,
  className = ''
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  const colorClasses = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    red: 'text-red-600',
    yellow: 'text-yellow-600'
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div
        className={`animate-spin rounded-full border-2 border-gray-200 border-t-current ${sizeClasses[size]} ${colorClasses[color]}`}
      >
        <span className="sr-only">Carregando...</span>
      </div>
      {text && (
        <p className="mt-2 text-sm text-gray-600 animate-pulse">{text}</p>
      )}
    </div>
  );
};

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  children: React.ReactNode;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isLoading,
  message = 'Carregando...',
  children
}) => {
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <LoadingSpinner size="lg" text={message} />
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

interface SkeletonProps {
  width?: string;
  height?: string;
  className?: string;
  rows?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1rem',
  className = '',
  rows = 1
}) => {
  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className={`animate-pulse bg-gray-300 rounded ${className}`}
          style={{ width, height }}
        />
      ))}
    </>
  );
};

interface LoadingCardProps {
  isLoading: boolean;
  children: React.ReactNode;
}

export const LoadingCard: React.FC<LoadingCardProps> = ({
  isLoading,
  children
}) => {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="space-y-3">
          <Skeleton height="2rem" className="mb-4" />
          <Skeleton height="1.5rem" width="80%" />
          <Skeleton height="1.5rem" width="60%" />
          <Skeleton height="1.5rem" width="90%" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
};