import { useEffect, useState } from 'react';

export function useProximity() {
  const [isNear, setIsNear] = useState(false);

  useEffect(() => {
    let proximitySensor = null;
    let hasProximitySensor = false;

    // 1. Try native W3C Proximity Sensor API
    if ('ProximitySensor' in window) {
      try {
        // frequency: 5Hz is plenty for detecting ear proximity
        proximitySensor = new ProximitySensor({ frequency: 5 });
        
        const handleReading = () => {
          const near = proximitySensor.near || (proximitySensor.distance && proximitySensor.distance < 5);
          setIsNear(!!near);
        };
        
        proximitySensor.addEventListener('reading', handleReading);
        proximitySensor.start();
        hasProximitySensor = true;
      } catch (err) {
        console.warn('W3C ProximitySensor creation failed, falling back to orientation:', err);
      }
    }

    // 2. Device Orientation fallback
    const handleOrientation = (event) => {
      // If native proximity sensor is active and working, let it take precedence
      if (hasProximitySensor) return;

      const { beta, gamma } = event; // beta is front-back tilt [-180, 180], gamma is left-right tilt [-90, 90]
      if (beta === null || gamma === null) return;

      // When the user raises the phone portrait-style to their ear/face:
      // - The phone is upright (beta is close to vertical, i.e., between 70° and 110°)
      // - The screen is flat against the ear/cheek (gamma is close to 0°, i.e., between -20° and 20°)
      const isPortraitVertical = Math.abs(beta) > 70 && Math.abs(beta) < 110;
      const isFlatAgainstEar = Math.abs(gamma) < 20;

      setIsNear(isPortraitVertical && isFlatAgainstEar);
    };

    window.addEventListener('deviceorientation', handleOrientation);

    return () => {
      if (proximitySensor) {
        try {
          proximitySensor.stop();
        } catch (e) {}
      }
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, []);

  return isNear;
}
