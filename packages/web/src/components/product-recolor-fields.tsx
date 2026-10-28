"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";

export function ProductRecolorFields({
  allComponents,
  instructions,
  onAllComponentsChange,
  onInstructionsChange,
}: {
  allComponents: boolean;
  instructions: string;
  onAllComponentsChange: (value: boolean) => void;
  onInstructionsChange: (value: string) => void;
}) {
  const t = useTranslations("Generate");
  const id = useId();
  return (
    <div className="space-y-3">
      <label className="flex items-start gap-3 text-sm" htmlFor={`${id}-all`}>
        <input
          id={`${id}-all`}
          type="checkbox"
          checked={allComponents}
          onChange={(event) => onAllComponentsChange(event.target.checked)}
          className="mt-1"
        />
        <span>
          <span className="font-medium">{t("recolorAllComponents")}</span>
          <span className="block text-xs mt-1" style={{ color: "var(--gs-text-muted)" }}>
            {t("recolorAllComponentsHint")}
          </span>
        </span>
      </label>
      <div>
        <label htmlFor={`${id}-notes`} className="block text-sm font-medium mb-1.5">
          {t("recolorInstructions")}
        </label>
        <textarea
          id={`${id}-notes`}
          rows={3}
          maxLength={2000}
          value={instructions}
          onChange={(event) => onInstructionsChange(event.target.value)}
          placeholder={t("recolorInstructionsPlaceholder")}
          className="gs-input block w-full px-3 py-2 text-sm resize-y"
        />
        <p className="text-xs mt-1.5" style={{ color: "var(--gs-text-muted)" }}>
          {t("recolorInstructionsHint")}
        </p>
      </div>
    </div>
  );
}
