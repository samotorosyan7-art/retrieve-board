import type { Activity, Client, Member, PriorityId, Project, StatusId, Task } from './types';

// Seed data — shown until Supabase responds, and used as a fallback if it can't be reached.
export const SEED_TEAM: Member[] = [
  {id:"mh",name:"Michael Hovhannesyan",init:"MH",role:"Senior Partner",   color:"#1B4F72",rate:0,isAdmin:true, isBilling:true, img:"https://wp.retrieve.am/wp-content/uploads/2019/02/Maykl-scaled.jpg",           email:"michael@retrieve.am"},
  {id:"fh",name:"Feliks Hovakimyan",   init:"FH",role:"Managing Partner", color:"#C8A951",rate:0,isAdmin:true, isBilling:true, img:"https://wp.retrieve.am/wp-content/uploads/2019/02/Feliks-Hovakimyan-scaled.jpg", email:"feliks@retrieve.am"},
  {id:"vs",name:"Vache Simonyan",      init:"VS",role:"Partner",           color:"#2E6DA4",rate:0,isAdmin:false,isBilling:false,img:"https://wp.retrieve.am/wp-content/uploads/2019/02/Vache-Simonyan-scaled.jpg",    email:"vache@retrieve.am"},
  {id:"ln",name:"Lia Nikoghosyan",     init:"LN",role:"Senior Associate",  color:"#3498DB",rate:0,isAdmin:false,isBilling:false,img:"",email:"lia@retrieve.am"},
  {id:"md",name:"Mariam Dovlatyan",    init:"MD",role:"Senior Associate",  color:"#5BA3D9",rate:0,isAdmin:false,isBilling:false,img:"",email:"mariam@retrieve.am"},
  {id:"lp",name:"Larisa Petrosyan",    init:"LP",role:"Associate",         color:"#2980B9",rate:0,isAdmin:false,isBilling:false,img:"",email:"larisa@retrieve.am"},
  {id:"ap",name:"Anahit Petrosyan",    init:"AP",role:"Associate",         color:"#7FB3D3",rate:0,isAdmin:false,isBilling:false,img:"",email:"anahit@retrieve.am"},
  {id:"mn",name:"Meline Nadaryan",     init:"MN",role:"Associate",         color:"#2874A6",rate:0,isAdmin:false,isBilling:false,img:"",email:"meline@retrieve.am"},
  {id:"pk",name:"Papin Karapetyan",    init:"PK",role:"Associate",         color:"#5499C7",rate:0,isAdmin:false,isBilling:false,img:"",email:"papin@retrieve.am"},
];
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

export const MATTER_TYPES = ["General Corporate","Work Permit","Banking","Contracts","Legal Advice"];
export const PRIORITIES: { id: PriorityId; label: string; col: string; bg: string }[] = [
  {id:"high",  label:"High",  col:"#F87171",bg:"rgba(248,113,113,0.12)"},
  {id:"medium",label:"Med",   col:"#FB923C",bg:"rgba(251,146,60,0.12)"},
  {id:"low",   label:"Low",   col:"#4ADE80",bg:"rgba(74,222,128,0.12)"},
];

export const SEED_PROJECTS: Project[] = [
  {id:"p1", title:"Shell Armenia Tax Compliance Q2",  client:"Shell Armenia",         area:"Tax Law & Compliance",      status:"inprogress", priority:"high",  assignees:["fh","mh"],due:"2026-03-22",progress:60,created:"2026-03-01",notes:"Annual RA tax authority filing. Deadline approaching — extension under review.",
    timeLogs:[{who:"mh",hours:4.5,desc:"Tax strategy consultation",date:"2026-03-05",month:3},{who:"fh",hours:2,desc:"Client review call",date:"2026-03-10",month:3},{who:"mh",hours:3,desc:"Filing preparation",date:"2026-03-15",month:3}],
    files:[{name:"Shell_Q2_TaxReturn_Draft.pdf",size:"2.4 MB",drive:true},{name:"RA_Tax_Form_102.pdf",size:"340 KB",drive:true}]},
  {id:"p2", title:"WWF IP Litigation Defense",        client:"WWF Armenia",           area:"Intellectual Property",     status:"review", priority:"high",  assignees:["mh","vs"],due:"2026-03-25",progress:78,created:"2026-02-10",notes:"IP case near resolution. Final response brief under partner review.",
    timeLogs:[{who:"vs",hours:6,desc:"Draft response brief",date:"2026-03-01",month:3},{who:"mh",hours:3.5,desc:"Strategy review",date:"2026-03-08",month:3}],
    files:[{name:"WWF_IP_Brief_v3.docx",size:"890 KB",drive:true}]},
  {id:"p3", title:"REMAX Franchise Agreement",        client:"REMAX Armenia",         area:"Corporate & Business Law",  status:"inprogress", priority:"medium",assignees:["vs"],      due:"2026-04-05",progress:42,created:"2026-03-05",notes:"Franchise agreement review & RA Ministry of Justice registration.",
    timeLogs:[{who:"vs",hours:5,desc:"Agreement drafting",date:"2026-03-06",month:3}],
    files:[{name:"REMAX_Franchise_Draft.docx",size:"1.1 MB",drive:true}]},
  {id:"p4", title:"Qless Tech M&A Due Diligence",     client:"Qless",                 area:"M&A Advising",              status:"intake", priority:"high",  assignees:["fh","mh"],due:"2026-04-12",progress:10,created:"2026-03-12",notes:"Due diligence for acquisition target in Yerevan.",
    timeLogs:[{who:"ia",hours:3,desc:"Financial analysis",date:"2026-03-13",month:3},{who:"fh",hours:1.5,desc:"Initial scoping",date:"2026-03-12",month:3}],
    files:[]},
  {id:"p5", title:"BeeGraphy Trademark Registration", client:"BeeGraphy Corp",        area:"Intellectual Property",     status:"inprogress", priority:"medium",assignees:["lp"],      due:"2026-04-18",progress:55,created:"2026-03-08",notes:"Filed with RA IP Agency. Awaiting confirmation.",
    timeLogs:[{who:"lp",hours:4,desc:"Trademark application prep",date:"2026-03-09",month:3}],
    files:[{name:"BeeGraphy_Trademark_Filing.pdf",size:"560 KB",drive:true}]},
  {id:"p6", title:"Metexim Employment Dispute",       client:"Metexim Terminal",      area:"Employment Law",            status:"billing",priority:"low",   assignees:["vs"],      due:"2026-03-30",progress:95,created:"2026-02-01",notes:"Dispute resolved. Invoice pending client approval.",
    timeLogs:[{who:"ah",hours:8,desc:"Dispute mediation",date:"2026-02-15",month:2},{who:"ah",hours:2,desc:"Final documentation",date:"2026-03-01",month:3}],
    files:[{name:"Settlement_Agreement_Signed.pdf",size:"440 KB",drive:true}]},
  {id:"p7", title:"NoyMed Pharmaceutical Licensing",  client:"NoyMed",               area:"Health & Pharmaceuticals",  status:"inprogress", priority:"high",  assignees:["mh","vs"],due:"2026-04-08",progress:35,created:"2026-03-10",notes:"Licensing structure under RA Ministry of Health review.",
    timeLogs:[{who:"ia",hours:5,desc:"Licensing structure analysis",date:"2026-03-11",month:3},{who:"mh",hours:2,desc:"Ministry consultation",date:"2026-03-14",month:3}],
    files:[]},
  {id:"p8", title:"Quick Crypto Asset Classification",client:"Quick",                 area:"Cryptocurrency & Blockchain",status:"intake",priority:"medium",assignees:["ln","lp"],due:"2026-04-25",progress:8, created:"2026-03-13",notes:"Crypto asset classification under RA law framework.",
    timeLogs:[{who:"ln",hours:2,desc:"Initial research",date:"2026-03-13",month:3}],
    files:[]},
  {id:"p9", title:"Evolution Tech Work Permits ×5",   client:"Evolution Technologies",area:"Immigration & Residency",   status:"review", priority:"medium",assignees:["vs","ln"],due:"2026-04-02",progress:70,created:"2026-03-07",notes:"5 work permits. 3 approved, 2 in final review.",
    timeLogs:[{who:"vs",hours:6,desc:"Permit applications",date:"2026-03-08",month:3},{who:"ln",hours:3,desc:"Document compilation",date:"2026-03-10",month:3}],
    files:[{name:"Permits_1_2_3_Approved.pdf",size:"2.2 MB",drive:true}]},
  {id:"p10",title:"RAD Logo Trademark",               client:"RAD",                   area:"Intellectual Property",     status:"done",   priority:"low",   assignees:["lp"],      due:"2026-03-10",progress:100,created:"2026-02-05",notes:"Successfully filed. Case closed.",
    timeLogs:[{who:"lp",hours:5,desc:"Full trademark filing",date:"2026-02-20",month:2}],
    files:[{name:"RAD_Trademark_Certificate.pdf",size:"290 KB",drive:true}]},
  {id:"p11",title:"Startup Investment Structuring",   client:"Frfin Broker",          area:"Investment Law",            status:"intake", priority:"medium",assignees:["fh","ah"],due:"2026-04-30",progress:5, created:"2026-03-14",notes:"New investment vehicle under RA law.",
    timeLogs:[{who:"fh",hours:1,desc:"Initial consultation",date:"2026-03-14",month:3}],
    files:[]},
  {id:"p12",title:"WWF Armenia Employment Contracts", client:"WWF Armenia",           area:"Employment Law",            status:"inprogress", priority:"low",   assignees:["ln"],      due:"2026-05-01",progress:20,created:"2026-03-11",notes:"International staff contract compliance with RA Labour Code.",
    timeLogs:[{who:"ln",hours:2.5,desc:"Contract review",date:"2026-03-12",month:3}],
    files:[]},
];

export const SEED_TASKS: Task[] = [
  {id:"t1", pid:"p1", title:"Submit RA Tax Form 102",          who:"fh",done:false,due:"2026-03-22",time:"10:00",priority:"high",  estHours:3,   notes:"File via RA e-gov portal.",     subtasks:[{id:"st1a",title:"Gather Q2 financials",done:true},{id:"st1b",title:"Validate with Iren",done:false}]},
  {id:"t2", pid:"p1", title:"Client debrief call with Shell",  who:"mh",done:true, due:"2026-03-18",time:"14:00",priority:"medium",estHours:1,   notes:"Confirm extension timeline.",   subtasks:[]},
  {id:"t3", pid:"p2", title:"Draft final response brief",      who:"vs",done:true, due:"2026-03-20",time:"09:00",priority:"high",  estHours:6,   notes:"Use v3 as base.",               subtasks:[{id:"st3a",title:"Research precedents",done:true},{id:"st3b",title:"Write argument section",done:true}]},
  {id:"t4", pid:"p2", title:"Partner sign-off & approval",     who:"mh",done:false,due:"2026-03-25",time:"11:00",priority:"high",  estHours:1,   notes:"Review Vache's brief.",         subtasks:[]},
  {id:"t5", pid:"p3", title:"Review franchise agreement docs", who:"vs",done:false,due:"2026-04-01",time:"",    priority:"medium",estHours:4,   notes:"Focus on exclusivity clauses.", subtasks:[{id:"st5a",title:"Check Ministry requirements",done:false},{id:"st5b",title:"Draft amendments",done:false}]},
  {id:"t6", pid:"p4", title:"Gather target financials",        who:"fh",done:true, due:"2026-03-28",time:"13:00",priority:"medium",estHours:3,   notes:"Request from Qless finance.",   subtasks:[]},
  {id:"t7", pid:"p4", title:"Legal due diligence memo",        who:"fh",done:false,due:"2026-04-10",time:"",    priority:"high",  estHours:8,   notes:"Full DD scope.",                subtasks:[{id:"st7a",title:"Corporate structure review",done:false},{id:"st7b",title:"IP assets review",done:false},{id:"st7c",title:"Liabilities check",done:false}]},
  {id:"t8", pid:"p7", title:"Health ministry submission",      who:"mh",done:false,due:"2026-04-06",time:"09:30",priority:"high",  estHours:2,   notes:"Attach license documents.",     subtasks:[]},
  {id:"t9", pid:"p9", title:"Submit permits 4 & 5",            who:"ln",done:false,due:"2026-04-02",time:"11:30",priority:"medium",estHours:2,   notes:"",                              subtasks:[{id:"st9a",title:"Verify passport copies",done:true},{id:"st9b",title:"Fill application forms",done:false}]},
  {id:"t10",pid:"p5", title:"Chase RA IP Agency confirmation", who:"lp",done:false,due:"2026-04-05",time:"10:00",priority:"low",   estHours:0.5, notes:"Follow up email sent Mar 12.",  subtasks:[]},
  {id:"t11",pid:"p8", title:"Research RA crypto regulations",  who:"ln",done:false,due:"2026-03-30",time:"",    priority:"medium",estHours:3,   notes:"Focus on CBofAM guidelines.",   subtasks:[]},
  {id:"t12",pid:"p11",title:"Draft investment structure memo", who:"fh",done:false,due:"2026-04-15",time:"",    priority:"medium",estHours:5,   notes:"Explore CJSC vs LLC options.",  subtasks:[]},
];

export const SEED_ACTIVITY: Activity[] = [
  {who:"mh",text:"updated <b>WWF IP Brief</b> to v3",        time:"2h ago"},
  {who:"lp",text:"filed <b>BeeGraphy</b> trademark app",     time:"5h ago"},
  {who:"vs",text:"completed permits for <b>Evolution Tech</b>",time:"Yesterday"},
  {who:"ia",text:"logged 3h on <b>NoyMed Licensing</b>",     time:"Yesterday"},
  {who:"fh",text:"approved <b>Shell Q2</b> strategy",        time:"2 days ago"},
  {who:"ln",text:"uploaded permits 1–3 to <b>Google Drive</b>",time:"2 days ago"},
];

export const SEED_CLIENTS: Client[] = [
  {id:"c1", name:"Shell Armenia",          type:"Corporate",   contact:"Armen Mkrtchyan",    email:"armen.m@shell.am",         phone:"+374 10 123456", address:"5 Baghramyan Ave, Yerevan", taxId:"AM-00112233", notes:"Key account. Tax compliance & advisory retainer.", since:"2024-01-15", active:true},
  {id:"c2", name:"WWF Armenia",            type:"Non-Profit",  contact:"Narine Hovhannisyan", email:"n.hovhannisyan@wwf.am",   phone:"+374 11 234567", address:"10 Moskovyan St, Yerevan",  taxId:"AM-00223344", notes:"IP litigation and employment law work.", since:"2023-08-20", active:true},
  {id:"c3", name:"REMAX Armenia",          type:"Real Estate", contact:"Tigran Sargsyan",     email:"t.sargsyan@remax.am",     phone:"+374 93 345678", address:"23 Northern Ave, Yerevan",  taxId:"AM-00334455", notes:"Franchise agreements and property law.", since:"2024-06-01", active:true},
  {id:"c4", name:"Qless",                  type:"Technology",  contact:"David Petrosyan",     email:"david@qless.com",         phone:"+1 415 555 0101", address:"San Francisco, CA / Yerevan", taxId:"US-EIN-123", notes:"M&A due diligence — new client.", since:"2026-03-12", active:true},
  {id:"c5", name:"BeeGraphy Corp",         type:"Technology",  contact:"Aram Gevorgyan",      email:"aram@beegraphy.com",      phone:"+374 99 456789", address:"12 Tigranyan St, Yerevan",  taxId:"AM-00445566", notes:"IP, trademark registration.", since:"2025-09-10", active:true},
  {id:"c6", name:"Metexim Terminal",       type:"Logistics",   contact:"Sona Grigoryan",      email:"sona@metexim.am",         phone:"+374 77 567890", address:"Zvartnots Airport Area, Yerevan", taxId:"AM-00556677", notes:"Employment dispute resolved.", since:"2024-03-05", active:true},
  {id:"c7", name:"NoyMed",                 type:"Healthcare",  contact:"Lilit Abrahamyan",    email:"lilit@noymed.am",         phone:"+374 55 678901", address:"8 Komitas Ave, Yerevan",    taxId:"AM-00667788", notes:"Pharmaceutical licensing — ongoing.", since:"2025-11-22", active:true},
  {id:"c8", name:"Quick",                  type:"Technology",  contact:"Alex Manukyan",       email:"alex@quick.am",           phone:"+374 98 789012", address:"14 Abovyan St, Yerevan",    taxId:"AM-00778899", notes:"Crypto asset classification.", since:"2026-01-18", active:true},
  {id:"c9", name:"Evolution Technologies", type:"Technology",  contact:"Hrach Karapetyan",    email:"hr@evolution.am",         phone:"+374 41 890123", address:"1 Victory Bridge, Yerevan", taxId:"AM-00889900", notes:"Work permit processing for international staff.", since:"2024-07-30", active:true},
  {id:"c10",name:"RAD",                    type:"Design",      contact:"Narek Petrosyan",     email:"narek@rad.am",            phone:"+374 96 901234", address:"17 Sayat-Nova Ave, Yerevan",taxId:"AM-00990011", notes:"Trademark — completed.", since:"2024-02-14", active:false},
  {id:"c11",name:"Frfin Broker",           type:"Finance",     contact:"Marina Asatryan",     email:"marina@frfin.am",         phone:"+374 93 012345", address:"4 Republic Square, Yerevan",taxId:"AM-01100122", notes:"Investment structuring — new.", since:"2026-03-14", active:true},
  {id:"c12",name:"WWF Armenia (HR)",       type:"Non-Profit",  contact:"Naira Simonyan",      email:"n.simonyan@wwf.am",       phone:"+374 11 234568", address:"10 Moskovyan St, Yerevan",  taxId:"AM-00223344", notes:"Employment contracts.", since:"2026-03-11", active:true},
];

export const CLIENT_TYPES = ["Corporate","Technology","Non-Profit","Healthcare","Finance","Real Estate","Logistics","Design","Legal","Other"];

export const CHAT_ROOMS: { id: string; name: string; icon: string; desc: string; billingOnly?: boolean }[] = [
  {id:'general',  name:'General',          icon:'🏢', desc:'Firm-wide announcements'},
  {id:'matters',  name:'Matters',          icon:'⚖️', desc:'Case discussion'},
  {id:'billing',  name:'Billing',          icon:'₾',  desc:'Invoices & financials', billingOnly:true},
  {id:'admin',    name:'Admin & Ops',      icon:'⚙',  desc:'Internal office topics'},
  {id:'random',   name:'Random',           icon:'☕', desc:'Off-topic'},
];

export const PAGE_LABELS: Record<string, string> = {
  dashboard:'Dashboard', kanban:'Kanban Board', list:'All Matters', calendar:'Calendar',
  team:'Team Workload', tasks:'My Tasks', clients:'Clients', chat:'Team Chat',
  billing:'Billing & Invoices', settings:'Settings & Access',
};

export const DEFAULT_FX = { USD: 1, EUR: 0.92, AMD: 390 }; // approximate rates — updated in Settings
export const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', AMD: '֏' };

export const LOGO_SRC = '/logo.jpg';
