import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { readBrowserLocale } from "./locale";
import { enUS } from "./locales/en-US";
import { zhCN } from "./locales/zh-CN";

const initialLocale = readBrowserLocale();

if (typeof document !== "undefined") {
  document.documentElement.lang = initialLocale;
}

void i18n.use(initReactI18next).init({
  lng: initialLocale,
  fallbackLng: "en-US",
  interpolation: {
    escapeValue: false,
  },
  resources: {
    "en-US": enUS,
    "zh-CN": zhCN,
  },
});

export { i18n };
