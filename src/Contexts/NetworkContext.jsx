import React, { createContext, useContext, useEffect, useState } from 'react';
import { Network } from '@capacitor/network';

const NetworkContext = createContext({
  isOnline: true,
  isOffline: false,
  connectionType: 'unknown',
  isReady: false,
});

export const useNetwork = () => useContext(NetworkContext);

export const NetworkProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [connectionType, setConnectionType] = useState('unknown');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let unsubscribe = null;

    const initNetwork = async () => {
      try {
        // Get initial network status
        const status = await Network.getStatus();
        setIsOnline(status.connected);
        setConnectionType(status.connectionType || 'unknown');
      } catch (error) {
        console.warn('Network plugin not available, assuming online:', error);
        setIsOnline(true);
      } finally {
        setIsReady(true);
      }

      // Listen for network changes
      try {
        const listener = await Network.addListener('networkStatusChange', (status) => {
          setIsOnline(status.connected);
          setConnectionType(status.connectionType || 'unknown');
        });
        unsubscribe = listener;
      } catch (error) {
        console.warn('Failed to add network listener:', error);
      }
    };

    initNetwork();

    // Cleanup listener on unmount
    return () => {
      if (unsubscribe && typeof unsubscribe.remove === 'function') {
        unsubscribe.remove();
      }
    };
  }, []);

  const value = {
    isOnline,
    isOffline: !isOnline,
    connectionType,
    isReady,
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
};

export default NetworkContext;
