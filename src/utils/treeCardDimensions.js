export const getTreeCardDimensions = (memberCount = 0, viewportWidth, forceMobile = false) => {
  const safeCount = Number.isFinite(memberCount) ? memberCount : 0;
  const width =
    typeof viewportWidth === "number"
      ? viewportWidth
      : typeof window !== "undefined"
      ? window.innerWidth
      : 1024;
  const isMobile = forceMobile || width <= 640;

  if (safeCount > 100) {
    return {
      width: isMobile ? 120 : 170,
      height: isMobile ? 125 : 165,
      fontSizeName: isMobile ? 12 : 14,
      fontSizeDetails: isMobile ? 10 : 11,
      fontSizeRelationship: isMobile ? 10 : 11,
      profileSize: isMobile ? 70 : 90,
      padding: "0px",
      margin: "2px",
    };
  }

  if (safeCount > 50) {
    return {
      width: isMobile ? 130 : 180,
      height: isMobile ? 135 : 175,
      fontSizeName: isMobile ? 13 : 15,
      fontSizeDetails: isMobile ? 11 : 12,
      fontSizeRelationship: isMobile ? 11 : 12,
      profileSize: isMobile ? 75 : 95,
      padding: "0px",
      margin: "3px",
    };
  }

  return {
    width: isMobile ? 140 : 190,
    height: isMobile ? 145 : 185,
    fontSizeName: isMobile ? 12 : 14,
    fontSizeDetails: isMobile ? 12 : 13,
    fontSizeRelationship: isMobile ? 12 : 14,
    profileSize: isMobile ? 80 : 100,
    padding: "0px",
    margin: isMobile ? "3px" : "5px",
  };
};
