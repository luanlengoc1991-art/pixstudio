import { translationAtom } from "@/atoms/translations-atom";
import { useAtomValue } from "jotai";
import React from "react";

type TabsProps = {
  selectedTab: number;
  setSelectedTab: (tab: number) => void;
};

const Tabs = ({ selectedTab, setSelectedTab }: TabsProps) => {
  const t = useAtomValue(translationAtom);

  const labels = [t("TABS.UPSCALE"), t("SETTINGS.TITLE")];

  return (
    <div className="tabs-boxed tabs mx-auto mb-2">
      {labels.map((label, index) => (
        <a
          key={label}
          className={`tab ${selectedTab === index && "tab-active"}`}
          onClick={() => {
            setSelectedTab(index);
          }}
        >
          {label}
        </a>
      ))}
    </div>
  );
};

export default Tabs;
