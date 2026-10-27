import { useState, useEffect } from 'react';

export type ScreenType = 'mobile' | 'tablet' | 'desktop';
export type ViewMode = 'table' | 'cards';

export function useScreenType(defaultOverride?: ViewMode) {
  const getScreenType = (): ScreenType => {
    if (typeof window === 'undefined') return 'desktop';
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  };

  const [screenType, setScreenType] = useState<ScreenType>(getScreenType);
  const [manualViewMode, setManualViewMode] = useState<ViewMode | null>(defaultOverride || null);

  useEffect(() => {
    const handleResize = () => {
      setScreenType(getScreenType());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Default to cards on mobile and tablet, table on desktop (unless user manually toggles)
  const isSmallScreen = screenType === 'mobile' || screenType === 'tablet';
  const effectiveViewMode: ViewMode = manualViewMode || (isSmallScreen ? 'cards' : 'table');

  return {
    screenType,
    isMobile: screenType === 'mobile',
    isTablet: screenType === 'tablet',
    isDesktop: screenType === 'desktop',
    isSmallScreen,
    viewMode: effectiveViewMode,
    setViewMode: setManualViewMode,
    isAuto: manualViewMode === null,
    resetToAuto: () => setManualViewMode(null),
  };
}
