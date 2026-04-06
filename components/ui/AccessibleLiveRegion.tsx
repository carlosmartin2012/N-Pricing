import React, { useEffect, useState } from 'react';

interface Props {
  message: string;
  politeness?: 'polite' | 'assertive';
}

export const AccessibleLiveRegion: React.FC<Props> = ({ message, politeness = 'polite' }) => {
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    // Clear and re-set to force screen reader to announce
    setAnnouncement('');
    const timer = setTimeout(() => setAnnouncement(message), 100);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      className="sr-only"
    >
      {announcement}
    </div>
  );
};
