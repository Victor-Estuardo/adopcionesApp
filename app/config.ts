export const config = {
  mailerSendKey: process.env.MAILER_SEND_KEY || "",
  resendApiKey: process.env.RESEND_KEY || "",
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || "",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || "",
  // URL canónica del sitio para enlaces absolutos (Open Graph, compartir). Sin "/" final.
  siteUrl: (process.env.SITE_URL || "").replace(/\/+$/, ""),
};
