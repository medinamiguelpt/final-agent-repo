/**
 * Barber-shop data-collection schema.
 *
 * Pushed to every registered agent via POST /api/elevenlabs/configure.
 * ElevenLabs runs the transcript through its LLM after every call and
 * populates these fields automatically in data_collection_results.
 *
 * The API accepts a dict keyed by identifier:
 *   { client_name: { type, description }, ... }
 */

export type DataCollectionDict = Record<string, { type: string; description: string }>;

export const BARBER_SCHEMA: DataCollectionDict = {
  client_name: {
    type: "string",
    description:
      "The client's first name as confirmed during the conversation. " +
      "Extract only the first name (not surname). " +
      "Return null if the name was never mentioned or confirmed.",
  },
  phone_number: {
    type: "string",
    description:
      "The client's phone number as spoken. Remove spaces and dashes — digits only. " +
      "Return null if not mentioned.",
  },
  service_type: {
    type: "string",
    description:
      "The exact hair or grooming service the client booked or requested. " +
      "Examples: 'Haircut', 'Fade', 'Beard Trim', 'Hot Towel Shave', 'Full Grooming Package', 'Head Shave'. " +
      "If multiple services were booked, list them all separated by ' + '. " +
      "Return null if no specific service was agreed upon.",
  },
  barber_name: {
    type: "string",
    description:
      "The first name of the barber the client specifically requested. " +
      "Return 'any' if the client expressed no preference. " +
      "Return null if barber preference was never discussed.",
  },
  appointment_date: {
    type: "string",
    description:
      "The confirmed appointment date in DD/MM/YYYY format. " +
      "If only a day-of-week was mentioned (e.g., 'Monday'), convert to the nearest upcoming date. " +
      "Return null if no date was confirmed.",
  },
  appointment_time: {
    type: "string",
    description:
      "The confirmed appointment time in HH:MM 24-hour format (e.g., '14:30'). " +
      "Return null if no specific time was confirmed.",
  },
  appointment_status: {
    type: "string",
    description:
      "The final outcome of the booking attempt. " +
      "Use exactly one of: " +
      "'confirmed' — appointment was successfully booked with a date and time; " +
      "'pending' — client needs to call back, or information was missing, or a callback was promised; " +
      "'not_booked' — call ended without any booking.",
  },
  price_quoted: {
    type: "number",
    description:
      "The price quoted to the client in euros as a plain number (e.g., 15 or 22.50). " +
      "Return null if no price was mentioned.",
  },
  duration_minutes: {
    type: "number",
    description:
      "The estimated appointment duration in minutes if mentioned (e.g., 30, 45, 60). " +
      "Return null if duration was not discussed.",
  },
  special_requests: {
    type: "string",
    description:
      "Any special requests, extra notes, or specific instructions from the client " +
      "(e.g., 'skin fade on sides', 'keep length on top', 'allergic to X'). " +
      "Return null if there were none.",
  },
  call_language: {
    type: "string",
    description:
      "ISO 639-1 code of the primary language used in the conversation " +
      "(e.g., 'el' for Greek, 'en' for English, 'es' for Spanish, 'pt' for Portuguese). " +
      "Always return a value — default to 'en' if uncertain.",
  },
  callback_requested: {
    type: "boolean",
    description:
      "true if the client asked for a callback or if the agent promised to call back. " +
      "false otherwise.",
  },
};
