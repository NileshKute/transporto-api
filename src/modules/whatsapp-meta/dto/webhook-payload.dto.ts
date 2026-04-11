/** Meta Cloud API webhook payload shapes (partial, for typing helpers). */
export type MetaWebhookPayload = {
  object?: string;
  entry?: MetaWebhookEntry[];
};

export type MetaWebhookEntry = {
  id?: string;
  changes?: MetaWebhookChange[];
};

export type MetaWebhookChange = {
  field?: string;
  value?: MetaWebhookChangeValue;
};

export type MetaWebhookChangeValue = {
  messaging_product?: string;
  metadata?: { phone_number_id?: string; display_phone_number?: string };
  contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
  messages?: MetaInboundMessage[];
  statuses?: MetaStatusUpdate[];
};

export type MetaInboundMessage = {
  from?: string;
  id?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  image?: { id?: string; mime_type?: string; sha256?: string };
  document?: { id?: string; mime_type?: string; sha256?: string; filename?: string };
  audio?: { id?: string; mime_type?: string };
  video?: { id?: string; mime_type?: string };
  location?: { latitude?: number; longitude?: number };
  interactive?: unknown;
};

export type MetaStatusUpdate = {
  id?: string;
  status?: string;
  timestamp?: string;
  errors?: Array<{ code?: number; title?: string }>;
};
