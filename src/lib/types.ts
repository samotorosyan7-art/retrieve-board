export type StatusId = 'intake' | 'inprogress' | 'backlog' | 'review' | 'done' | 'billing' | 'archive';
export type PriorityId = 'high' | 'medium' | 'low';

export interface Member {
  id: string;
  name: string;
  init: string;
  role: string;
  color: string;
  rate: number;
  isAdmin: boolean;
  /** "Administration" access level (migration 016): sees tasks assigned to Administration; members don't. */
  isAdministration: boolean;
  img: string;
  email: string;
}

export interface TimeLog {
  who: string;
  hours: number;
  desc: string;
  date: string;
  month: number;
  /** Shown on invoices. Entries logged before migration 009 have no flag and count as billable. */
  billable?: boolean;
  /** Admins untick a billable entry to leave it off the client's invoice. Missing → on the invoice. */
  inInvoice?: boolean;
}

export interface MatterFile {
  name: string;
  size: string;
  drive?: boolean;
}

export interface Project {
  id: string;
  title: string;
  client: string;
  area: string;
  status: StatusId;
  priority: PriorityId;
  progress: number;
  assignees: string[];
  due: string;
  /** Optional time of day for `due`, 'HH:MM' (migration 011). */
  dueTime?: string;
  created: string;
  notes: string;
  timeLogs: TimeLog[];
  files: MatterFile[];
  matterType?: string;
  isPrivate?: boolean;
  createdBy?: string;
  /** Member who reviews the task in "Supervisor Review" (migration 007). */
  supervisor?: string;
}

export interface Client {
  id: string;
  name: string;
  type: string;
  contact: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;
  notes: string;
  since: string;
}

export interface Activity {
  who: string;
  /** May contain <b> tags — always render through sanitizeActivity(). */
  text: string;
  time: string;
}

export interface TaskComment {
  id: string;
  projectId: string;
  who: string;
  text: string;
  time: string;
}

/** A file in the attachments bucket (migration 013). `name` is the original file name. */
export interface Attachment {
  path: string;
  name: string;
  size: number;
  mime: string;
}

export interface TaskFile extends Attachment {
  id: string;
  projectId: string;
  who: string;
  time: string;
}

export interface ChatMessage {
  id: string | number;
  room: string;
  who: string;
  text: string;
  time: string;
  attachment?: Attachment;
  /** Deleted by its sender (migration 014): shown as a placeholder, text and file gone. */
  deleted?: boolean;
}

export interface Credential {
  teamId: string;
  emailHash: string;
  passHash: string;
}

export type Currency = 'USD' | 'EUR' | 'AMD';

/** Firm profile + billing configuration (Settings), stored in firm_settings (migration 006). */
/** One of the firm's bank accounts (Settings → Billing Config); chosen per invoice. */
export interface BankAccount {
  id: string;
  label: string;   // e.g. "Ameriabank · AMD"
  details: string; // bank name, IBAN, SWIFT… as printed on the invoice
}

export interface FirmSettings {
  /** Company (trading) name. */
  name: string;
  /** Registered legal name, printed on invoices when set. */
  legalName: string;
  website: string;
  address: string;
  phone: string;
  email: string;
  tin: string;
  /** @deprecated single bank text from before multiple accounts — moved into `banks` on load. */
  bank?: string;
  banks: BankAccount[];
  billingEmail: string;
  vatRate: number;      // percent
  paymentTerms: string;
  fxAMD: number;        // 1 USD → AMD
  fxEUR: number;        // 1 USD → EUR
}
export type SyncState = 'hidden' | 'syncing' | 'ok' | 'error';

/** An invoice emailed from Billing & Invoices (migration 015), kept exactly as sent. */
export interface SentInvoice {
  id: string;
  invNum: string;
  client: string;
  kind: 'time' | 'amount';
  currency: Currency;
  total: number;
  doc: import('./invoice').InvoiceDoc;
  firm: FirmSettings;
  /** Each email, oldest first. */
  sends: { to: string; at: string; by: string }[];
  createdBy?: string;
  time: string;
}

