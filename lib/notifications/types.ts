// Notification channel abstraction — same idea as the payment-provider
// abstraction: business logic calls dispatch(), never a specific
// provider's SDK, so adding SMS/WhatsApp later doesn't touch the
// order-flow code that triggers notifications.

export type NotificationInput = {
  to: string; // email address — used by the email channel
  toPhone?: string; // E.164 phone number — used by SMS/WhatsApp channels
  subject: string;
  text: string;
};

export interface NotificationChannel {
  name: string;
  isConfigured(): boolean;
  send(input: NotificationInput): Promise<void>;
}
