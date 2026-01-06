import { useState, useEffect, useRef } from "react";

// Helper to get fullscreen element with browser prefix support
const getFullscreenElement = () => {
  return (
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).mozFullScreenElement ||
    (document as any).msFullscreenElement
  );
};

// Helper to exit fullscreen with browser prefix support
const exitFullscreen = () => {
  if (document.exitFullscreen) {
    return document.exitFullscreen();
  } else if ((document as any).webkitExitFullscreen) {
    return (document as any).webkitExitFullscreen();
  } else if ((document as any).mozCancelFullScreen) {
    return (document as any).mozCancelFullScreen();
  } else if ((document as any).msExitFullscreen) {
    return (document as any).msExitFullscreen();
  }
  return Promise.resolve();
};

// Helper to request fullscreen with browser prefix support
const requestFullscreen = (element: HTMLElement) => {
  if (element.requestFullscreen) {
    return element.requestFullscreen();
  } else if ((element as any).webkitRequestFullscreen) {
    return (element as any).webkitRequestFullscreen();
  } else if ((element as any).mozRequestFullScreen) {
    return (element as any).mozRequestFullScreen();
  } else if ((element as any).msRequestFullscreen) {
    return (element as any).msRequestFullscreen();
  }
  return Promise.reject(new Error('Fullscreen API not supported'));
};

export const useMapFullscreen = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    const fullscreenElement = getFullscreenElement();
    const container = mapContainerRef.current;

    if (!container) {
      console.error('Map container ref is not available');
      return;
    }

    // If already in fullscreen and it's our container, exit
    if (fullscreenElement === container) {
      exitFullscreen().catch((err) => {
        console.error('Error attempting to exit fullscreen:', err);
      });
    } 
    // If not in fullscreen or different element is in fullscreen, enter fullscreen
    else {
      requestFullscreen(container).catch((err) => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreenElement = getFullscreenElement();
      const isMapFullscreen = fullscreenElement === mapContainerRef.current;
      setIsFullscreen(isMapFullscreen);
    };

    // Listen to all fullscreen change events with browser prefixes
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  return {
    isFullscreen,
    mapContainerRef,
    toggleFullscreen
  };
};
