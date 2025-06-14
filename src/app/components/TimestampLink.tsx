import React from "react";

interface TimestampLinkProps {
  timestamp: string;
  onClick?: (timestamp: string) => void;
}

export const TimestampLink: React.FC<TimestampLinkProps> = ({
  timestamp,
  onClick,
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onClick) {
      onClick(timestamp);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="text-blue-600 hover:text-blue-800 underline inline-block cursor-pointer bg-transparent border-none p-0 font-inherit"
    >
      [{timestamp}]
    </button>
  );
};

export const parseMessageWithTimestamps = (
  content: string,
  onTimestampClick?: (timestamp: string) => void
): React.ReactNode[] => {
  const parts = content.split(/(\[\d{2}:\d{2}\])/g);

  return parts.map((part, index) => {
    const timestampMatch = part.match(/\[(\d{2}:\d{2})\]/);
    if (timestampMatch) {
      return (
        <TimestampLink
          key={index}
          timestamp={timestampMatch[1]}
          onClick={onTimestampClick}
        />
      );
    }
    return <span key={index}>{part}</span>;
  });
};
