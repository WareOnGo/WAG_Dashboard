import { createContext, useContext, useState } from 'react';

const MobileToolsContext = createContext(null);

/**
 * Holds the open/closed state of the in-app header tools (PPT Generator, Itinerary).
 *
 * These tools render inside MobileHeader (which also owns their data + generation
 * logic, shared with the desktop header), but on mobile they are now triggered from
 * the navigation drawer (MobileNavigation). Lifting just the open-state here lets the
 * sibling drawer open a tool without duplicating any of the tool logic.
 */
export const MobileToolsProvider = ({ children }) => {
  const [pptOpen, setPptOpen] = useState(false);
  const [itineraryOpen, setItineraryOpen] = useState(false);

  return (
    <MobileToolsContext.Provider value={{ pptOpen, setPptOpen, itineraryOpen, setItineraryOpen }}>
      {children}
    </MobileToolsContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useMobileTools = () => {
  const ctx = useContext(MobileToolsContext);
  if (!ctx) {
    throw new Error('useMobileTools must be used within a MobileToolsProvider');
  }
  return ctx;
};

export default MobileToolsContext;
