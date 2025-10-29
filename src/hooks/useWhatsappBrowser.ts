import { useEffect, useState } from "react";

export const useWhatsappBrowser = () => {
  const [isWhatsapp, setIsWhatsapp] = useState(false);

  useEffect(() => {
    try {
      const ua = navigator.userAgent || (navigator as any).vendor || "";
      setIsWhatsapp(/WhatsApp/i.test(ua));
    } catch {
      setIsWhatsapp(false);
    }
  }, []);

  return isWhatsapp;
};
