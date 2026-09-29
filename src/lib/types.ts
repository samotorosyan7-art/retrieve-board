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
  isBilling: boolean;
  isAdmin_assistant?: boolean;
  img: string;
  email: string;
}

export interface TimeLog {
  who: string;
  hours: number;
  desc: string;
  date: string;
  month: number;
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
  created: string;
  notes: string;
  timeLogs: TimeLog[];
  files: MatterFile[];
  matterType?: string;
  isPrivate?: boolean;
  createdBy?: string;
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
  active: boolean;
}

export interface Activity {
  who: string;
  /** May contain <b> tags — always render through sanitizeActivity(). */
  text: string;
  time: string;
}

export interface ChatMessage {
  id: string | number;
  room: string;
  who: string;
  text: string;
  time: string;
}

export interface Credential {
  teamId: string;
  emailHash: string;
  passHash: string;
}

export type Currency = 'USD' | 'EUR' | 'AMD';
export type SyncState = 'hidden' | 'syncing' | 'ok' | 'error';
