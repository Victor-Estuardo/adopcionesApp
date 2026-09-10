// Número de contacto de Meraki para coordinar donaciones (mismo usado en mi-cuenta/solicitudes)
const MERAKI_WHATSAPP_NUMBER = "50243895664";

// Arma el link de WhatsApp para que un donante coordine una donación en efectivo o en especie
export function buildDonationWhatsAppUrl(tipo: "efectivo" | "especie") {
  const message = encodeURIComponent(
    `¡Hola! 👋 Estoy interesado en donar ${tipo} a Meraki. ¿Me ayudan a coordinar cómo hacerlo? 🐾`,
  );
  return `https://wa.me/${MERAKI_WHATSAPP_NUMBER}?text=${message}`;
}

// Arma el link de WhatsApp para que administración contacte al donante sobre su donación
export function buildDonorWhatsAppUrl(phone: string, donorName?: string | null) {
  const digits = phone.replace(/\D/g, "");
  const withCountryCode = digits.startsWith("502") ? digits : `502${digits}`;
  const message = encodeURIComponent(
    `Hola${donorName ? ` ${donorName}` : ""}, te escribimos de Meraki respecto a tu donación.`,
  );
  return `https://wa.me/${withCountryCode}?text=${message}`;
}
