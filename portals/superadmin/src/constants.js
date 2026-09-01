// ── Platform-wide constants ──
// Kept here so they can be imported by any view/component
// without circular deps.

export const SUPABASE_CONFIG = {
  url: 'https://qmyrxvtbzlbnvzxypnus.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFteXJ4dnRiemxibnZ6eHlwbnVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MjA4OTcsImV4cCI6MjA5NTM5Njg5N30.ABvW_oBzXC2Ffxm5ToLh6t4WmdKPdtg9SyfeAE76iJo',
};

export const INITIAL_USERS = [
  { id: "usr-super", name: "Urvashi Nath", email: "urvashinath0409@gmail.com", role: "SUPER_ADMIN", status: "Active", institution_id: null, org: "—", joined: "2026-08-01" },
  { id: "usr-immersion", name: "Immersion Labs", email: "immersionlabsindia@gmail.com", role: "ADMIN", status: "Active", institution_id: "inst-dps-001", org: "Delhi Public School", joined: "2026-05-20" },
  { id: "c2d7ceb4-e62b-49d2-a1fe-2057dc35b61a", name: "Harsh", email: "aimodelnewplay@gmail.com", role: "ADMIN", status: "Active", institution_id: "inst-dps-001", org: "Delhi Public School", joined: "2026-05-27" },
  { id: "d8e2b42f-63b7-47fa-be5d-4d0ac31ce00f", name: "Harsh", email: "rathorehps@gmail.com", role: "TEACHER", status: "Active", institution_id: "inst-dps-001", org: "Delhi Public School", joined: "2026-05-27" },
  { id: "03befb93-e2c8-4c67-bf4b-f03a78e93850", name: "Gaurav", email: "gauravroy476@gmail.com", role: "TEACHER", status: "Active", institution_id: "inst-dps-001", org: "Delhi Public School", joined: "2026-07-03" },
  { id: "a44b5ea7-3f4a-4d05-aa3f-9c21e25406a5", name: "Harsh", email: "hps.sunghrathore@gmail.com", role: "STUDENT", status: "Active", institution_id: "inst-dps-001", org: "Delhi Public School", joined: "2026-05-27" },
  { id: "usr-thorroy", name: "GAURAV Roy", email: "thorroy888@gmail.com", role: "STUDENT", status: "Active", institution_id: "inst-dps-001", org: "Delhi Public School", joined: "2026-05-27" },
  { id: "usr-saurav", name: "Saurav Roy", email: "sauravroy469@gmail.com", role: "STUDENT", status: "Active", institution_id: "inst-dps-001", org: "Delhi Public School", joined: "2026-06-15" },
];

export const DPS_INSTITUTION = {
  id: "inst-dps-001",
  name: "Delhi Public School",
  domain: "dps.edu.in",
  plan: "Enterprise",
  storageUsed: "148 GB",
  storageLimit: "500 GB",
  twoFactor: true,
};

export const INITIAL_ORGS = [DPS_INSTITUTION];

export const DEFAULT_CLASSES = [
  { id: '93a25032-cf02-45ca-86d8-84284cb63270', name: 'Class 1st', subject: 'English, Hindi, Mathematics, EVS, Art Education, Physical Education', teachers: [], studentEmails: [] },
  { id: 'ef43bc32-9eee-4d1d-bc66-e0998278734f', name: 'Class 2nd', subject: 'English, Hindi, Mathematics, EVS, Art Education, Physical Education', teachers: [], studentEmails: [] },
  { id: '5871fa86-0d15-4bf5-ba0a-538502d53bba', name: 'Class 3rd', subject: 'English, Hindi, Mathematics, EVS, Art Education, Physical Education', teachers: [], studentEmails: [] },
  { id: '6b5359ae-d96d-4e0c-a301-e10b0813a976', name: 'Class 4th', subject: 'English, Hindi, Mathematics, EVS, Art Education, Physical Education', teachers: [], studentEmails: [] },
  { id: 'b8d7655f-a36c-4184-9ddd-b20ffbfad065', name: 'Class 5th', subject: 'English, Hindi, Mathematics, EVS, Art Education, Physical Education', teachers: [], studentEmails: [] },
  {
    id: '7aa68b4d-a78f-4e32-bb10-63af15fe6c5c',
    name: 'Class 6th',
    subject: 'Science, History, Geography, Physical Education, Arts, English, Mathematics, Music',
    teachers: [
      { email: 'gauravroy476@gmail.com', subject: 'Science', isClassTeacher: true },
      { email: 'rathorehps@gmail.com', subject: 'Mathematics', isClassTeacher: false },
    ],
    studentEmails: ['thorroy888@gmail.com', 'hps.sunghrathore@gmail.com', 'sauravroy469@gmail.com'],
  },
  { id: '463877e9-acab-49d6-9c9f-d73f69f3f453', name: 'Class 7th', subject: 'English, Hindi, Mathematics, Science, Social Science, Sanskrit', teachers: [], studentEmails: [] },
  { id: '2ae591ff-9162-498e-b13f-52fb4642af57', name: 'Class 8th', subject: 'English, Hindi, Mathematics, Science, Social Science, Sanskrit', teachers: [], studentEmails: [] },
  { id: 'e7e126ca-f91c-41e1-88c8-0d9cf6054f1a', name: 'Class 9th', subject: 'English, Hindi / Sanskrit, Mathematics, Science, Social Science, IT', teachers: [], studentEmails: [] },
  { id: '3430c239-166d-4952-b883-faaa0fcdae49', name: 'Class 10th', subject: 'English, Hindi / Sanskrit, Mathematics, Science, Social Science, IT', teachers: [], studentEmails: [] },
];
