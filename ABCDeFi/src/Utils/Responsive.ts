import React from 'react';

// Responsive design utilities for mobile-first approach

export const breakpoints = {
  mobile: '0px',
  tablet: '768px',
  desktop: '1024px',
  wide: '1280px',
};

export const isMobile = () => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
};

export const isTablet = () => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth >= 768 && window.innerWidth < 1024;
};

export const isDesktop = () => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth >= 1024;
};

export const isTouchDevice = () => {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

// CSS utility classes for responsive design
export const responsiveClasses = {
  // Container utilities
  container: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8',
  containerMobile: 'px-4',
  
  // Grid utilities
  gridMobile: 'grid-cols-1',
  gridTablet: 'grid-cols-2',
  gridDesktop: 'grid-cols-3',
  
  // Text sizes
  textMobile: 'text-sm',
  textTablet: 'text-base',
  textDesktop: 'text-lg',
  
  // Spacing
  paddingMobile: 'p-4',
  paddingTablet: 'p-6',
  paddingDesktop: 'p-8',
  
  // Gap utilities
  gapMobile: 'gap-2',
  gapTablet: 'gap-4',
  gapDesktop: 'gap-6',
};

// Mobile-specific optimizations
export const mobileOptimizations = {
  // Touch-friendly tap targets (minimum 44x44px)
  touchTarget: 'min-w-[44px] min-h-[44px]',
  
  // Prevent text selection on mobile for better UX
  noSelect: 'select-none',
  
  // Smooth scrolling for mobile
  smoothScroll: 'scroll-smooth',
  
  // Hide scrollbar but keep functionality
  noScrollbar: 'no-scrollbar',
  
  // Safe area for notched devices
  safeArea: 'pb-safe',
  
  // Optimized images for mobile
  lazyLoad: 'lazy',
};

// Animation utilities for mobile
export const mobileAnimations = {
  // Subtle animations for better performance
  fadeIn: 'animate-in fade-in duration-200',
  slideUp: 'animate-in slide-in-from-bottom-5 duration-300',
  slideDown: 'animate-in slide-in-from-top-5 duration-300',
  scaleIn: 'animate-in zoom-in-95 duration-200',
  
  // Button press effect
  pressEffect: 'active:scale-95 transition-transform duration-150',
};

// Font scaling for mobile
export const fontScaling = {
  mobile: {
    xs: 'text-[10px]',
    sm: 'text-[12px]',
    base: 'text-[14px]',
    lg: 'text-[16px]',
    xl: 'text-[18px]',
    '2xl': 'text-[20px]',
    '3xl': 'text-[24px]',
  },
  desktop: {
    xs: 'text-xs',
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
    '2xl': 'text-2xl',
    '3xl': 'text-3xl',
  },
};

// Responsive hooks
export const useResponsive = () => {
  const [isMobileView, setIsMobileView] = React.useState(false);
  const [isTabletView, setIsTabletView] = React.useState(false);
  const [isDesktopView, setIsDesktopView] = React.useState(false);

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 768);
      setIsTabletView(window.innerWidth >= 768 && window.innerWidth < 1024);
      setIsDesktopView(window.innerWidth >= 1024);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    isMobile: isMobileView,
    isTablet: isTabletView,
    isDesktop: isDesktopView,
    isTouch: isTouchDevice(),
  };
};