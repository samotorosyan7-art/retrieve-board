import type { FirmSettings, PriorityId, StatusId } from './types';
import { Building2Icon, CoffeeIcon, ReceiptIcon, ScaleIcon, SettingsIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const AREAS: string[] = ["Corporate & Business Law","Tax Law & Compliance","Immigration & Residency","Intellectual Property","Real Estate & Construction","Banking & Finance","Arbitration & Litigation","Cryptocurrency & Blockchain","Employment Law","Accounting & Bookkeeping","Tax Advisory","M&A Advising","Competition Law","Energy Law","Investment Law","IT & Data Protection","Health & Pharmaceuticals","Retrieve Legal & Tax (Internal)"];
export const STATUSES: { id: StatusId; label: string; col: string; bg: string }[] = [
  {id:"intake",    label:"Intake",                  col:"#7C6FF7",bg:"rgba(124,111,247,0.12)"},
  {id:"inprogress",label:"In Progress",             col:"#E8A838",bg:"rgba(232,168,56,0.12)"},
  {id:"backlog",   label:"Client Input / Backlog",  col:"#64748B",bg:"rgba(100,116,139,0.12)"},
  {id:"review",    label:"Supervisor Review",       col:"#A78BFA",bg:"rgba(167,139,250,0.12)"},
  {id:"done",      label:"Completed",               col:"#34D399",bg:"rgba(52,211,153,0.12)"},
  {id:"billing",   label:"Billing",                 col:"#38BDF8",bg:"rgba(56,189,248,0.12)"},
  {id:"archive",   label:"Archive",                 col:"#94A3B8",bg:"rgba(148,163,184,0.12)"},
];

export const MATTER_TYPES = ["General Corporate","Work Permit","Banking","Contracts","Legal Advice","Project"];
export const PRIORITIES: { id: PriorityId; label: string; col: string; bg: string }[] = [
  {id:"high",  label:"High",  col:"#F87171",bg:"rgba(248,113,113,0.12)"},
  {id:"medium",label:"Medium",   col:"#FB923C",bg:"rgba(251,146,60,0.12)"},
  {id:"low",   label:"Low",   col:"#4ADE80",bg:"rgba(74,222,128,0.12)"},
];

export const CLIENT_TYPES = ["Corporate","Technology","Non-Profit","Healthcare","Finance","Real Estate","Logistics","Design","Legal","Other"];

export const CHAT_ROOMS: { id: string; name: string; icon: LucideIcon; desc: string; billingOnly?: boolean }[] = [
  {id:'general',  name:'General',          icon:Building2Icon, desc:'Firm-wide announcements'},
  {id:'matters',  name:'Cases',            icon:ScaleIcon, desc:'Case discussion'},
  {id:'billing',  name:'Billing',          icon:ReceiptIcon, desc:'Invoices & financials', billingOnly:true},
  {id:'admin',    name:'Admin & Ops',      icon:SettingsIcon, desc:'Internal office topics'},
  {id:'random',   name:'Random',           icon:CoffeeIcon, desc:'Off-topic'},
];

export const PAGE_LABELS: Record<string, string> = {
  dashboard:'Dashboard', kanban:'Kanban Board', list:'All Tasks', calendar:'Calendar',
  team:'Team Workload', logs:'Time Logs', tasks:'My Tasks', clients:'Clients', chat:'Team Chat',
  billing:'Billing & Invoices', settings:'Settings & Access',
};

export const DEFAULT_FX = { USD: 1, EUR: 0.92, AMD: 390 }; // approximate rates — updated in Settings

/** Used until firm_settings has loaded, and for any field it doesn't have yet. */
export const DEFAULT_FIRM: FirmSettings = {
  name: 'Retrieve Legal & Tax',
  website: 'retrieve.am',
  address: 'Baghramyan 41, Yerevan, Armenia',
  phone: '+374 41 777 332',
  email: 'info@retrieve.am',
  tin: 'AM 1234567',
  bank: 'Ameriabank OJSC · IBAN: AM12 3456 7890 1234 5678',
  billingEmail: 'billing@retrieve.am',
  vatRate: 20,
  paymentTerms: 'Net 30 days',
  fxAMD: DEFAULT_FX.AMD,
  fxEUR: DEFAULT_FX.EUR,
};

export const PAYMENT_TERMS = ['Net 30 days', 'Net 15 days', 'Due on receipt'];
export const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', AMD: '֏' };

export const LOGO_SRC = '/logo.jpg';
