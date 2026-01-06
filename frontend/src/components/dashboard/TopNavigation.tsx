
import { Header } from "@/components/shared/Header";

interface TopNavigationProps {
  isDayMode: boolean;
  setIsDayMode: (dayMode: boolean) => void;
}

export const TopNavigation = ({ 
  isDayMode, 
  setIsDayMode
}: TopNavigationProps) => {
  return (
    <Header 
      isDayMode={isDayMode}
      setIsDayMode={setIsDayMode}
      showModeToggle={true}
    />
  );
};
