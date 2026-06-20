// Blippr Premium Animation System Tokens & Framer Motion Variants

// Easing presets mapped from the CSS variables
export const EASE_MICRO = [0.4, 0, 0.2, 1];
export const EASE_MEDIUM_BACK = [0.34, 1.56, 0.64, 1];
export const EASE_MEDIUM_DECEL = [0.25, 1, 0.5, 1];
export const EASE_LAYOUT = [0.76, 0, 0.24, 1];

// Staggered Container Variant (Parent wrapper)
export const staggerContainer = (staggerChildren = 0.04, delayChildren = 0) => ({
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren,
      delayChildren
    }
  }
});

// Card Cascade Entry Variant (Children items)
export const fadeUpCascade = {
  hidden: { 
    opacity: 0, 
    y: 12 
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: EASE_MEDIUM_DECEL
    }
  }
};

// Button Micro-interactions (tactile scaling and press compression)
export const buttonPress = {
  hover: {
    scale: 1.02,
    transition: {
      duration: 0.15,
      ease: EASE_MICRO
    }
  },
  tap: {
    scale: 0.97,
    transition: {
      duration: 0.08,
      ease: 'easeOut'
    }
  }
};

// Dropdown Slide Variant
export const dropdownSlide = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: -8
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.25,
      ease: EASE_MEDIUM_BACK
    }
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: -4,
    transition: {
      duration: 0.12,
      ease: 'easeIn'
    }
  }
};

// Modal Backdrop Overlay
export const modalOverlay = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.2,
      ease: 'easeOut'
    }
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.15,
      ease: 'easeIn'
    }
  }
};

// Modal Card Drop-In
export const modalContent = {
  hidden: {
    opacity: 0,
    scale: 1.03,
    y: 10
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.25,
      ease: EASE_MEDIUM_DECEL
    }
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: 6,
    transition: {
      duration: 0.15,
      ease: 'easeIn'
    }
  }
};

// Status Toggle Pill momentum stretching (horizontal stretch)
export const toggleMomentum = (isActive) => ({
  x: isActive ? 20 : 0,
  scaleX: [1, 1.25, 1], // Stretches horizontally to simulate momentum
  transition: {
    duration: 0.25,
    ease: EASE_MICRO
  }
});

// Success Signifier Icon pop-in scale
export const successIconPop = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: [0, 1.15, 1],
    opacity: 1,
    transition: {
      duration: 0.35,
      ease: EASE_MEDIUM_BACK
    }
  }
};
