import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import { persistLocale, type AppLocale } from "./locale";

export function LanguageSwitcher({
  className,
  variant = "outline",
  size = "sm",
}: {
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
}) {
  const { i18n, t } = useTranslation();
  const nextLocale: AppLocale = i18n.resolvedLanguage === "zh-CN" ? "en-US" : "zh-CN";

  async function switchLanguage(): Promise<void> {
    persistLocale(nextLocale);
    await i18n.changeLanguage(nextLocale);
    document.documentElement.lang = nextLocale;
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      aria-label={t("language.ariaLabel")}
      onClick={() => void switchLanguage()}
    >
      中/en
    </Button>
  );
}
