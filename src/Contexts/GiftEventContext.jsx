import React, { createContext, useContext, useState, useMemo } from "react";

const GiftEventContext = createContext(null);

export const GiftEventProvider = ({ children }) => {
  const [selectedGiftEvent, setSelectedGiftEvent] = useState(null);

  const value = useMemo(
    () => ({ selectedGiftEvent, setSelectedGiftEvent }),
    [selectedGiftEvent]
  );

  return (
    <GiftEventContext.Provider value={value}>
      {children}
    </GiftEventContext.Provider>
  );
};

export const useGiftEvent = () => {
  const ctx = useContext(GiftEventContext);
  if (!ctx) {
    throw new Error("useGiftEvent must be used within a GiftEventProvider");
  }
  return ctx;
};
