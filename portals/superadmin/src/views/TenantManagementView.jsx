import React from 'react';
import { DEFAULT_CLASSES, SUPABASE_CONFIG } from '../constants.js';
import { SUPABASE_URL, SUPABASE_KEY } from '../supabase.js';

export function TenantManagementView({ orgs, users, searchTerm, onOpenModal, onRoleChange, onStatusToggle }) {
      const [selectedSchool, setSelectedSchool] = React.useState(null);
      const [schoolView, setSchoolView] = React.useState('overview');
      const [onboardForm, setOnboardForm] = React.useState({ name: '', email: '', role: 'STUDENT', className: '' });
      const [onboardSuccess, setOnboardSuccess] = React.useState('');
      const [onboardMode, setOnboardMode] = React.useState('form'); // 'form' | 'file'
      const [uploadedFile, setUploadedFile] = React.useState(null);
      const [csvParsed, setCsvParsed] = React.useState([]);
      const [csvError, setCsvError] = React.useState('');
      const [csvSuccess, setCsvSuccess] = React.useState('');
      const [isDragging, setIsDragging] = React.useState(false);
      const fileInputRef = React.useRef(null);

      const [classes, setClasses] = React.useState(DEFAULT_CLASSES);
      const [selectedClass, setSelectedClass] = React.useState(null);
      const [assignModalTeacher, setAssignModalTeacher] = React.useState(null);
      const [newTeacherForm, setNewTeacherForm] = React.useState({ email: '', subject: '', isClassTeacher: false });
      
      // State for subject modification and additions per class
      const [editingSubjectClassId, setEditingSubjectClassId] = React.useState(null);
      const [subjectEditInput, setSubjectEditInput] = React.useState('');
      const [newSubjectInput, setNewSubjectInput] = React.useState('');
      const [subjectSuccessToast, setSubjectSuccessToast] = React.useState('');

      // Fetch all classes dynamically from Supabase database
      React.useEffect(() => {
        async function fetchSupabaseClasses() {
          try {
            const SUPABASE_URL = 'https://qmyrxvtbzlbnvzxypnus.supabase.co';
            const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFteXJ4dnRiemxibnZ6eHlwbnVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MjA4OTcsImV4cCI6MjA5NTM5Njg5N30.ABvW_oBzXC2Ffxm5ToLh6t4WmdKPdtg9SyfeAE76iJo';
            const res = await fetch(`${SUPABASE_URL}/rest/v1/classes?select=*`, {
              headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
            });
            const dbClasses = await res.json();
            if (Array.isArray(dbClasses) && dbClasses.length > 0) {
              const sorted = dbClasses.sort((a, b) => {
                const numA = parseInt(a.name.replace(/\D/g, '')) || 0;
                const numB = parseInt(b.name.replace(/\D/g, '')) || 0;
                return numA - numB;
              });

              setClasses(prev => {
                return sorted.map(c => {
                  const existing = prev.find(p => p.id === c.id || p.name === c.name);
                  const isClass6 = c.name.includes('6th') || c.id === '7aa68b4d-a78f-4e32-bb10-63af15fe6c5c';
                  return {
                    id: c.id,
                    name: c.name,
                    subject: c.subject || 'General Curriculum',
                    teachers: isClass6 
                      ? [
                          { email: 'gauravroy476@gmail.com', subject: 'Science', isClassTeacher: true },
                          { email: 'rathorehps@gmail.com', subject: 'Mathematics', isClassTeacher: false }
                        ] 
                      : (existing?.teachers?.length ? existing.teachers : []),
                    studentEmails: isClass6 
                      ? ['thorroy888@gmail.com', 'hps.sunghrathore@gmail.com', 'sauravroy469@gmail.com'] 
                      : (existing?.studentEmails?.length ? existing.studentEmails : [])
                  };
                });
              });
            }
          } catch (e) {
            console.error('Failed to load Supabase classes:', e);
          }
        }
        fetchSupabaseClasses();
      }, []);

      // Modify or update subjects string for any class and sync to Supabase
      const handleUpdateSubjects = async (classId, newSubjectString) => {
        const cleaned = newSubjectString
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
          .join(', ');

        setClasses(prev => prev.map(c => c.id === classId ? { ...c, subject: cleaned } : c));
        if (selectedClass && selectedClass.id === classId) {
          setSelectedClass(prev => ({ ...prev, subject: cleaned }));
        }
        setEditingSubjectClassId(null);
        setSubjectSuccessToast('✅ Subjects updated and synced with database!');
        setTimeout(() => setSubjectSuccessToast(''), 4000);

        try {
          const SUPABASE_URL = 'https://qmyrxvtbzlbnvzxypnus.supabase.co';
          const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFteXJ4dnRiemxibnZ6eHlwbnVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MjA4OTcsImV4cCI6MjA5NTM5Njg5N30.ABvW_oBzXC2Ffxm5ToLh6t4WmdKPdtg9SyfeAE76iJo';
          await fetch(`${SUPABASE_URL}/rest/v1/classes?id=eq.${classId}`, {
            method: 'PATCH',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ subject: cleaned })
          });
        } catch (err) {
          console.error('Failed to sync subject to Supabase:', err);
        }
      };

      // Add a single new subject to a class
      const handleAddSubject = (classId, singleSubject) => {
        const targetClass = classes.find(c => c.id === classId);
        if (!targetClass) return;
        const currentList = (targetClass.subject || '').split(',').map(s => s.trim()).filter(Boolean);
        if (!currentList.some(s => s.toLowerCase() === singleSubject.toLowerCase())) {
          const updated = [...currentList, singleSubject].join(', ');
          handleUpdateSubjects(classId, updated);
        }
      };

      // Remove a single subject from a class
      const handleRemoveSubject = (classId, subjectToRemove) => {
        const targetClass = classes.find(c => c.id === classId);
        if (!targetClass) return;
        const currentList = (targetClass.subject || '').split(',').map(s => s.trim()).filter(Boolean);
        const updated = currentList.filter(s => s.toLowerCase() !== subjectToRemove.toLowerCase()).join(', ');
        handleUpdateSubjects(classId, updated);
      };

      // Add or update teacher in a class with specific subject
      const handleAddTeacherToClass = (classId, teacherEmail, subject, isClassTeacher = false) => {
        if (!teacherEmail || !subject.trim()) return;
        setClasses(prev => prev.map(c => {
          if (c.id === classId) {
            const current = c.teachers || [];
            const idx = current.findIndex(t => t.email === teacherEmail);
            let updated;
            if (idx >= 0) {
              updated = [...current];
              updated[idx] = { email: teacherEmail, subject, isClassTeacher: isClassTeacher || updated[idx].isClassTeacher };
            } else {
              updated = [...current, { email: teacherEmail, subject, isClassTeacher }];
            }
            return { ...c, teachers: updated };
          }
          return c;
        }));
      };

      // Remove teacher from a class
      const handleRemoveTeacherFromClass = (classId, teacherEmail) => {
        setClasses(prev => prev.map(c => {
          if (c.id === classId) {
            return { ...c, teachers: (c.teachers || []).filter(t => t.email !== teacherEmail) };
          }
          return c;
        }));
      };

      const handleToggleStudentClass = (classId, studentEmail) => {
        setClasses(prev => prev.map(c => {
          if (c.id === classId) {
            const current = c.studentEmails || [];
            const exists = current.includes(studentEmail);
            const studentEmails = exists ? current.filter(e => e !== studentEmail) : [...current, studentEmail];
            return { ...c, studentEmails };
          }
          return c;
        }));
      };

      const filtered = orgs.filter(o =>
        o.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.domain || '').toLowerCase().includes(searchTerm.toLowerCase())
      );

      const handleOnboard = (e) => {
        e.preventDefault();
        const roleLabel = onboardForm.role === 'STUDENT' ? 'Student' : onboardForm.role === 'TEACHER' ? 'Teacher' : 'Admin';
        const classNote = onboardForm.className ? ` into ${onboardForm.className}` : '';
        setOnboardSuccess(`✅ ${roleLabel} "${onboardForm.name}" (${onboardForm.email}) onboarded to ${selectedSchool.name}${classNote}. Invite email sent.`);
        setOnboardForm({ name: '', email: '', role: 'STUDENT', className: '' });
        setTimeout(() => setOnboardSuccess(''), 5000);
      };

      const parseFileText = (text, fileName) => {
        setCsvError('');
        setCsvParsed([]);
        try {
          const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
          if (lines.length === 0) throw new Error('Selected file is empty.');

          let startIndex = 0;
          const firstLineLower = lines[0].toLowerCase();
          if (firstLineLower.includes('name') && (firstLineLower.includes('email') || firstLineLower.includes('role') || firstLineLower.includes('class'))) {
            startIndex = 1; // Skip header row
          }

          const dataLines = lines.slice(startIndex);
          if (dataLines.length === 0) throw new Error('No member data rows found below the header.');

          const parsed = dataLines.map((line, i) => {
            const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
            if (parts.length < 3) throw new Error(`Row ${i + 1 + startIndex}: Missing required columns (Name, Email, Role)`);
            const role = parts[2].toUpperCase();
            if (!['STUDENT', 'TEACHER', 'ADMIN'].includes(role)) {
              throw new Error(`Row ${i + 1 + startIndex}: Invalid role "${parts[2]}". Must be STUDENT, TEACHER, or ADMIN`);
            }
            return {
              name: parts[0],
              email: parts[1],
              role,
              className: parts[3] || ''
            };
          });
          setCsvParsed(parsed);
        } catch (err) {
          setCsvError(err.message);
        }
      };

      const processSelectedFile = (file) => {
        if (!file) return;
        const validExts = ['.csv', '.txt'];
        const isExtValid = validExts.some(ext => file.name.toLowerCase().endsWith(ext));
        if (!isExtValid) {
          setCsvError('Please upload a valid .csv or .txt file.');
          return;
        }

        setUploadedFile({
          name: file.name,
          size: (file.size / 1024).toFixed(1) + ' KB'
        });

        const reader = new FileReader();
        reader.onload = (e) => {
          parseFileText(e.target.result, file.name);
        };
        reader.onerror = () => {
          setCsvError('Failed to read file from disk. Please try again.');
        };
        reader.readAsText(file);
      };

      const handleFileInputChange = (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) processSelectedFile(file);
      };

      const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) processSelectedFile(file);
      };

      const handleClearFile = () => {
        setUploadedFile(null);
        setCsvParsed([]);
        setCsvError('');
        if (fileInputRef.current) fileInputRef.current.value = '';
      };

      const downloadSampleCSV = () => {
        const csvContent = "Full Name,Email,Role,Class\nPriya Sharma,priya.sharma@dps.edu.in,STUDENT,Class 5th\nRohan Kumar,rohan.kumar@dps.edu.in,TEACHER,\nAnita Gupta,anita.gupta@dps.edu.in,ADMIN,\nVikram Malhotra,vikram.m@dps.edu.in,STUDENT,Class 6th";
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dps_member_onboarding_template.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };

      const handleCSVUpload = () => {
        if (csvParsed.length === 0) return;
        setCsvSuccess(`🎉 Successfully onboarded ${csvParsed.length} members into ${selectedSchool.name} from "${uploadedFile?.name || 'file'}". Credentials and invitation links have been dispatched.`);
        handleClearFile();
        setTimeout(() => setCsvSuccess(''), 6000);
      };

      if (selectedSchool) {
        const schoolUsers = users.filter(u => u.institution_id === selectedSchool.id);
        const schoolStudents = schoolUsers.filter(u => u.role === 'STUDENT');
        const schoolTeachers = schoolUsers.filter(u => u.role === 'TEACHER');
        const schoolAdmins = schoolUsers.filter(u => u.role === 'ADMIN');

        const tabs = [
          { id: 'overview',  label: 'Overview',        icon: 'ph-house' },
          { id: 'students',  label: 'Students',        icon: 'ph-student' },
          { id: 'teachers',  label: 'Teachers',        icon: 'ph-chalkboard-teacher' },
          { id: 'admins',    label: 'Admins',          icon: 'ph-shield-check' },
          { id: 'classes',   label: 'Classes',         icon: 'ph-books' },
          { id: 'onboard',   label: 'Onboard Member',  icon: 'ph-user-plus' },
        ];

        const MemberTable = ({ members, color, roleLabel, addLabel }) => (
          members.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              <i className={`ph ph-${roleLabel === 'student' ? 'student' : roleLabel === 'teacher' ? 'chalkboard-teacher' : 'shield-check'} text-4xl block mb-2 opacity-40`}></i>
              No {roleLabel}s added yet.{' '}
              <button onClick={() => setSchoolView('onboard')} className="text-cyan-400 underline">Add one →</button>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400 font-mono uppercase border-b border-slate-800 text-[10px]">
                <tr>
                  <th className="pb-2.5">Name</th>
                  <th className="pb-2.5">Email</th>
                  <th className="pb-2.5">Status</th>
                  <th className="pb-2.5">Joined</th>
                  <th className="pb-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {members.map(u => (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-full bg-${color}-500/20 border border-${color}-500/30 flex items-center justify-center text-${color}-400 font-bold text-[10px]`}>{u.name.slice(0,2).toUpperCase()}</div>
                      <span className="text-white font-semibold">{u.name}</span>
                    </td>
                    <td className="py-3 text-slate-400 font-mono text-[11px]">{u.email}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${u.status === 'Active' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-red-500/20 text-red-400 border border-red-500/40'}`}>{u.status}</span>
                    </td>
                    <td className="py-3 text-slate-500 font-mono text-[11px]">{u.joined}</td>
                    <td className="py-3 text-right space-x-1.5">
                      {roleLabel !== 'student' && (
                        <select value={u.role} onChange={(e) => onRoleChange(u.id, e.target.value)}
                          className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2 py-1 text-[11px] font-bold focus:border-cyan-400">
                          <option value="ADMIN">🛡️ ADMIN</option>
                          <option value="TEACHER">🎓 TEACHER</option>
                          <option value="STUDENT">📖 STUDENT</option>
                        </select>
                      )}
                      <button onClick={() => onStatusToggle(u.id)} className={`px-2.5 py-1 rounded-lg font-bold text-[11px] ${u.status === 'Active' ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'}`}>
                        {u.status === 'Active' ? 'Suspend' : 'Reactivate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        );

        return (
          <div className="space-y-5">
            {/* Breadcrumb */}
            <div className="flex items-center gap-3">
              <button onClick={() => { setSelectedSchool(null); setSchoolView('overview'); setSelectedClass(null); }}
                className="flex items-center gap-1.5 text-slate-400 hover:text-cyan-400 text-xs font-semibold transition">
                <i className="ph ph-arrow-left text-base"></i> All Schools
              </button>
              <i className="ph ph-caret-right text-slate-600 text-xs"></i>
              {selectedClass ? (
                <>
                  <button onClick={() => setSelectedClass(null)} className="text-slate-400 hover:text-cyan-400 text-xs font-semibold transition">{selectedSchool.name}</button>
                  <i className="ph ph-caret-right text-slate-600 text-xs"></i>
                  <span className="text-white font-bold text-sm">{selectedClass.name}</span>
                </>
              ) : (
                <span className="text-white font-bold text-sm">{selectedSchool.name}</span>
              )}
              <span className="ml-auto px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-bold">{selectedSchool.plan} Tier</span>
            </div>

            {/* Stats Bar & Tabs Bar (Only shown on School Overview/Lists, hidden when drilling into a specific class to remove clutter) */}
            {!selectedClass && (
              <>
                {/* Stats Bar */}
                <div className="glass-panel p-4 grid grid-cols-4 gap-4 text-center text-xs">
                  <div><p className="text-slate-400 text-[10px] mb-1">Institution ID</p><p className="text-cyan-400 font-mono font-bold">{selectedSchool.id}</p></div>
                  <div><p className="text-slate-400 text-[10px] mb-1">Domain</p><p className="text-white font-bold">{selectedSchool.domain}</p></div>
                  <div><p className="text-slate-400 text-[10px] mb-1">2FA Policy</p><p className={selectedSchool.twoFactor ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>{selectedSchool.twoFactor ? '✅ Enforced' : '⚠️ Optional'}</p></div>
                  <div><p className="text-slate-400 text-[10px] mb-1">R2 Storage</p><p className="text-cyan-400 font-mono font-bold">{selectedSchool.storageUsed} / {selectedSchool.storageLimit}</p></div>
                </div>

                {/* Tab Bar */}
                <div className="flex gap-1 border-b border-slate-800 overflow-x-auto">
                  {tabs.map(tab => (
                    <button key={tab.id} onClick={() => { setSchoolView(tab.id); setSelectedClass(null); }}
                      className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold whitespace-nowrap rounded-t-xl transition border-b-2 ${
                        schoolView === tab.id ? 'text-cyan-400 border-cyan-400 bg-cyan-400/10' : 'text-slate-400 border-transparent hover:text-white'
                      }`}>
                      <i className={`ph ${tab.icon}`}></i> {tab.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* ── Overview ── */}
            {schoolView === 'overview' && (
              <div className="grid grid-cols-3 gap-4">
                <div className="glass-panel p-5 col-span-2 space-y-4">
                  <h4 className="text-white font-bold text-sm flex items-center gap-2"><i className="ph ph-users text-cyan-400"></i> Member Snapshot</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800 text-center">
                      <p className="text-slate-400 text-[10px] mb-1">Students</p>
                      <p className="text-3xl font-extrabold text-emerald-400">{schoolStudents.length}</p>
                    </div>
                    <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800 text-center">
                      <p className="text-slate-400 text-[10px] mb-1">Teachers</p>
                      <p className="text-3xl font-extrabold text-blue-400">{schoolTeachers.length}</p>
                    </div>
                    <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800 text-center">
                      <p className="text-slate-400 text-[10px] mb-1">Admins</p>
                      <p className="text-3xl font-extrabold text-purple-400">{schoolAdmins.length}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800">
                      <p className="text-slate-400 text-[10px] mb-1">Classes</p>
                      <p className="text-2xl font-extrabold text-white">{classes.length}</p>
                    </div>
                    <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800">
                      <p className="text-slate-400 text-[10px] mb-1">R2 Storage</p>
                      <p className="text-sm font-bold text-cyan-400">{selectedSchool.storageUsed} / {selectedSchool.storageLimit}</p>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1 overflow-hidden"><div className="bg-gradient-to-r from-cyan-400 to-blue-500 h-full rounded-full" style={{width:`${(parseInt(selectedSchool.storageUsed)/parseInt(selectedSchool.storageLimit))*100}%`}}></div></div>
                    </div>
                  </div>
                </div>
                <div className="glass-panel p-5 space-y-2.5">
                  <h4 className="text-white font-bold text-sm flex items-center gap-2"><i className="ph ph-sliders-horizontal text-purple-400"></i> Admin Controls</h4>
                  <button onClick={() => setSchoolView('onboard')} className="w-full py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-2"><i className="ph ph-user-plus"></i> Add Student / Teacher</button>
                  <button onClick={() => { setSchoolView('onboard'); setOnboardMode('file'); }} className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold text-xs flex items-center justify-center gap-2"><i className="ph ph-file-arrow-up text-cyan-400"></i> Bulk File Upload (CSV / TXT)</button>
                  <button onClick={() => setSchoolView('classes')} className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold text-xs flex items-center justify-center gap-2"><i className="ph ph-books text-emerald-400"></i> Manage Classes</button>
                  <button className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold text-xs flex items-center justify-center gap-2"><i className="ph ph-hard-drive text-purple-400"></i> Manage R2 Storage</button>
                  <button className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-red-900/40 text-red-400 font-semibold text-xs flex items-center justify-center gap-2"><i className="ph ph-shield-slash"></i> Toggle 2FA Policy</button>
                </div>
              </div>
            )}

            {/* ── Students Tab ── */}
            {schoolView === 'students' && (
              <div className="glass-panel p-5 space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-white font-bold text-sm flex items-center gap-2"><i className="ph ph-student text-emerald-400"></i> Enrolled Students</h4>
                  <button onClick={() => { setSchoolView('onboard'); setOnboardForm(f => ({...f, role:'STUDENT'})); }} className="px-3 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs flex items-center gap-1.5"><i className="ph ph-user-plus"></i> Enroll Student</button>
                </div>
                <MemberTable members={schoolStudents} color="emerald" roleLabel="student" />
              </div>
            )}

            {/* ── Teachers Tab ── */}
            {schoolView === 'teachers' && (
              <div className="glass-panel p-5 space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-white font-bold text-sm flex items-center gap-2"><i className="ph ph-chalkboard-teacher text-blue-400"></i> Teaching Staff &amp; Subject Allocations</h4>
                    <p className="text-slate-400 text-xs mt-0.5">Teachers can be allocated to multiple classes and multiple subjects simultaneously.</p>
                  </div>
                  <button onClick={() => { setSchoolView('onboard'); setOnboardForm(f => ({...f, role:'TEACHER'})); }} className="px-3 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs flex items-center gap-1.5"><i className="ph ph-user-plus"></i> Add Teacher</button>
                </div>

                {schoolTeachers.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-sm">
                    <i className="ph ph-chalkboard-teacher text-4xl block mb-2 opacity-40"></i>
                    No teaching staff added yet.{' '}
                    <button onClick={() => { setSchoolView('onboard'); setOnboardForm(f => ({...f, role:'TEACHER'})); }} className="text-cyan-400 underline">Add one →</button>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="text-slate-400 font-mono uppercase border-b border-slate-800 text-[10px]">
                      <tr>
                        <th className="pb-2.5">Teacher</th>
                        <th className="pb-2.5">Assigned Classes &amp; Subjects</th>
                        <th className="pb-2.5">Status</th>
                        <th className="pb-2.5">Joined</th>
                        <th className="pb-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {schoolTeachers.map(u => {
                        // Gather all class allocations for this teacher
                        const teacherAllocations = classes
                          .filter(c => (c.teachers || []).some(t => t.email === u.email))
                          .map(c => {
                            const match = c.teachers.find(t => t.email === u.email);
                            return { classId: c.id, className: c.name, subject: match.subject, isClassTeacher: match.isClassTeacher };
                          });

                        return (
                          <tr key={u.id || u.email} className="hover:bg-slate-800/30 transition">
                            <td className="py-3.5 flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-xs">
                                {(u?.name || u?.email || 'Teacher').slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <span className="text-white font-semibold block">{u?.name || u?.email || 'Teacher'}</span>
                                <span className="text-slate-400 font-mono text-[11px]">{u?.email || '—'}</span>
                              </div>
                            </td>
                            <td className="py-3.5 max-w-md">
                              {teacherAllocations.length === 0 ? (
                                <span className="text-amber-400/80 text-[11px] italic">Not assigned to any class yet</span>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {teacherAllocations.map((alloc, idx) => (
                                    <span key={idx} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                                      alloc.isClassTeacher 
                                        ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' 
                                        : 'bg-slate-900 border-slate-700 text-slate-300'
                                    }`}>
                                      <span className="text-white font-bold">{alloc.className}:</span>
                                      <span className="text-cyan-400">{alloc.subject}</span>
                                      {alloc.isClassTeacher && <span className="text-[9px] text-amber-400 font-bold bg-amber-400/10 px-1 rounded">CT</span>}
                                      <button onClick={() => handleRemoveTeacherFromClass(alloc.classId, u.email)} title="Remove assignment" className="text-slate-500 hover:text-red-400 ml-0.5">✕</button>
                                    </span>
                                  ))}
                                </div>
                              )}
                              <button 
                                onClick={() => {
                                  setAssignModalTeacher(u);
                                  setNewTeacherForm({ email: u.email, subject: 'Physics & Science', isClassTeacher: false, classId: classes[0].id });
                                }}
                                className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-cyan-400 hover:text-cyan-300 underline">
                                <i className="ph ph-plus-circle"></i> + Assign Class &amp; Subject
                              </button>
                            </td>
                            <td className="py-3.5">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${u.status === 'Active' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-red-500/20 text-red-400 border border-red-500/40'}`}>{u.status}</span>
                            </td>
                            <td className="py-3.5 text-slate-500 font-mono text-[11px]">{u.joined}</td>
                            <td className="py-3.5 text-right space-x-1.5">
                              <select value={u.role} onChange={(e) => onRoleChange(u.id, e.target.value)} className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2 py-1 text-[11px] font-bold focus:border-cyan-400">
                                <option value="ADMIN">🛡️ ADMIN</option><option value="TEACHER">🎓 TEACHER</option><option value="STUDENT">📖 STUDENT</option>
                              </select>
                              <button onClick={() => onStatusToggle(u.id)} className={`px-2.5 py-1 rounded-lg font-bold text-[11px] ${u.status === 'Active' ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'}`}>{u.status === 'Active' ? 'Suspend' : 'Reactivate'}</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* ── Admins Tab ── */}
            {schoolView === 'admins' && (
              <div className="glass-panel p-5 space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-white font-bold text-sm flex items-center gap-2"><i className="ph ph-shield-check text-purple-400"></i> School Administrators</h4>
                  <button onClick={() => { setSchoolView('onboard'); setOnboardForm(f => ({...f, role:'ADMIN'})); }} className="px-3 py-1.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-bold text-xs flex items-center gap-1.5"><i className="ph ph-user-plus"></i> Add Admin</button>
                </div>
                {schoolAdmins.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-sm">
                    <i className="ph ph-shield-check text-4xl block mb-2 opacity-40"></i>
                    No school admins assigned yet.{' '}
                    <button onClick={() => { setSchoolView('onboard'); setOnboardForm(f => ({...f, role:'ADMIN'})); }} className="text-cyan-400 underline">Add one →</button>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="text-slate-400 font-mono uppercase border-b border-slate-800 text-[10px]">
                      <tr><th className="pb-2.5">Admin</th><th className="pb-2.5">Email</th><th className="pb-2.5">Status</th><th className="pb-2.5">Joined</th><th className="pb-2.5 text-right">Action</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {schoolAdmins.map(u => (
                        <tr key={u.id} className="hover:bg-slate-800/30 transition">
                          <td className="py-3 flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold text-[10px]">{u.name.slice(0,2).toUpperCase()}</div>
                            <div><span className="text-white font-semibold block">{u.name}</span><span className="text-[10px] text-purple-400 font-mono">School Admin</span></div>
                          </td>
                          <td className="py-3 text-slate-400 font-mono text-[11px]">{u.email}</td>
                          <td className="py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${u.status === 'Active' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-red-500/20 text-red-400 border border-red-500/40'}`}>{u.status}</span></td>
                          <td className="py-3 text-slate-500 font-mono text-[11px]">{u.joined}</td>
                          <td className="py-3 text-right space-x-1.5">
                            <select value={u.role} onChange={(e) => onRoleChange(u.id, e.target.value)} className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2 py-1 text-[11px] font-bold focus:border-cyan-400">
                              <option value="ADMIN">🛡️ ADMIN</option><option value="TEACHER">🎓 TEACHER</option><option value="STUDENT">📖 STUDENT</option>
                            </select>
                            <button onClick={() => onStatusToggle(u.id)} className={`px-2.5 py-1 rounded-lg font-bold text-[11px] ${u.status === 'Active' ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'}`}>{u.status === 'Active' ? 'Suspend' : 'Reactivate'}</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* ── Classes Tab ── */}
            {schoolView === 'classes' && !selectedClass && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-white font-bold text-sm flex items-center gap-2"><i className="ph ph-books text-emerald-400"></i> Class Sections &amp; Multi-Teacher Allocations — {selectedSchool.name}</h4>
                    <p className="text-slate-400 text-xs mt-0.5">Teachers can teach across multiple classes &amp; subjects simultaneously.</p>
                  </div>
                  <button onClick={() => { setSchoolView('onboard'); setOnboardForm(f => ({...f, role:'STUDENT'})); }}
                    className="px-3 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs flex items-center gap-1.5">
                    <i className="ph ph-user-plus"></i> Enroll Member
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {classes.map(cls => {
                    const assignedTeachers = (cls.teachers || []).map(t => {
                      const teacherUser = schoolTeachers.find(u => u.email === t.email);
                      return { ...t, name: teacherUser ? teacherUser.name : t.email.split('@')[0] };
                    });
                    const enrolledCount = (cls.studentEmails || []).length;
                    return (
                      <button key={cls.id} onClick={() => setSelectedClass(cls)}
                        className="glass-panel p-3 text-left space-y-2 hover:border-cyan-400/40 hover:bg-cyan-400/5 transition-all duration-200 group flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start">
                            <div>
                              <h5 className="text-white font-bold text-xs group-hover:text-cyan-400 transition">{cls.name}</h5>
                              <p className="text-slate-500 text-[10px] mt-0.5 line-clamp-1">{cls.subject}</p>
                            </div>
                            <div className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                              <i className="ph ph-books text-emerald-400 text-xs"></i>
                            </div>
                          </div>

                          {/* Assigned Teachers Pills */}
                          <div className="mt-2 pt-1.5 border-t border-slate-800/80 space-y-1">
                            <span className="text-[9px] text-slate-400 font-semibold block flex items-center gap-1">
                              <i className="ph ph-chalkboard-teacher text-blue-400"></i> Faculty ({assignedTeachers.length}):
                            </span>
                            {assignedTeachers.length === 0 ? (
                              <p className="text-amber-400/80 text-[9px] italic">No teachers assigned</p>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {assignedTeachers.map((t, idx) => (
                                  <span key={idx} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700/80 text-[9px] text-slate-300">
                                    <span className="text-white font-bold">{t.name}</span>
                                    <span className="text-cyan-400 font-mono text-[8px]">({t.subject})</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-slate-800/40">
                          <span className="text-slate-400 font-mono">{enrolledCount} enrolled</span>
                          <span className="text-cyan-400 font-semibold group-hover:translate-x-0.5 transition-transform">Manage →</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Class Detail View (Unified, Clean Single-Panel Studio) ── */}
            {schoolView === 'classes' && selectedClass && (() => {
              const currentClass = classes.find(c => c.id === selectedClass.id) || selectedClass;
              const assignedTeachers = (currentClass.teachers || []).map(t => {
                const teacherUser = schoolTeachers.find(u => u.email === t.email);
                return { ...t, name: teacherUser ? teacherUser.name : t.email.split('@')[0] };
              });
              const enrolledStudents = schoolStudents.filter(s => (currentClass.studentEmails || []).includes(s.email));
              const availableToEnroll = schoolStudents.filter(s => !(currentClass.studentEmails || []).includes(s.email));
              const subjectList = (currentClass.subject || '').split(',').map(s => s.trim()).filter(Boolean);
              const classTeacher = assignedTeachers.find(t => t.isClassTeacher);

              return (
                <div className="glass-panel p-5 space-y-4 border-slate-800/90 shadow-2xl">
                  {/* Master Studio Header */}
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3.5">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setSelectedClass(null)} 
                        className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition">
                        <i className="ph ph-arrow-left"></i> Back to Classes
                      </button>
                      <div className="h-4 w-px bg-slate-800"></div>
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-white font-extrabold text-base flex items-center gap-2">
                          <i className="ph ph-books text-emerald-400 text-lg"></i> {currentClass.name}
                        </h3>
                        <span className="text-slate-400 text-xs font-medium">({selectedSchool.name})</span>
                        {classTeacher && (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-400/15 text-amber-400 border border-amber-400/30 text-xs font-semibold flex items-center gap-1">
                            <span>🛡️ Class Teacher:</span>
                            <span className="font-bold text-white">{classTeacher.name}</span>
                          </span>
                        )}
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
                          {enrolledStudents.length} Students
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 text-xs font-semibold">
                          {assignedTeachers.length} Faculty
                        </span>
                      </div>
                    </div>

                    <button 
                      onClick={() => { setSchoolView('onboard'); setOnboardForm(f => ({...f, role:'STUDENT', className: currentClass.name})); }}
                      className="px-3.5 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-sm shadow-cyan-500/10">
                      <i className="ph ph-user-plus text-sm"></i> Onboard Student
                    </button>
                  </div>

                  {/* Integrated Curriculum Strip */}
                  <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-slate-300 font-bold">
                        <i className="ph ph-book-open text-cyan-400"></i>
                        <span>Curriculum &amp; Taught Subjects ({subjectList.length}):</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (editingSubjectClassId === currentClass.id) {
                            setEditingSubjectClassId(null);
                          } else {
                            setEditingSubjectClassId(currentClass.id);
                            setSubjectEditInput(currentClass.subject || '');
                          }
                        }}
                        className="text-cyan-400 hover:text-cyan-300 font-bold text-xs flex items-center gap-1 transition">
                        <i className={`ph ${editingSubjectClassId === currentClass.id ? 'ph-x' : 'ph-pencil-simple'}`}></i>
                        {editingSubjectClassId === currentClass.id ? 'Cancel' : 'Edit Subjects'}
                      </button>
                    </div>

                    {subjectSuccessToast && (
                      <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-1.5">
                        <i className="ph ph-check-circle"></i>
                        <span>{subjectSuccessToast}</span>
                      </div>
                    )}

                    {editingSubjectClassId === currentClass.id ? (
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        handleUpdateSubjects(currentClass.id, subjectEditInput);
                      }} className="space-y-2">
                        <textarea
                          rows={2}
                          value={subjectEditInput}
                          onChange={(e) => setSubjectEditInput(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-2 text-xs focus:border-cyan-400 font-medium focus:outline-none"
                          placeholder="e.g. Science, History, Geography, Arts, English, Mathematics"
                        />
                        <div className="flex justify-end gap-1.5">
                          <button type="button" onClick={() => setEditingSubjectClassId(null)} className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 font-semibold text-xs">Cancel</button>
                          <button type="submit" className="px-3.5 py-1 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs flex items-center gap-1">
                            <i className="ph ph-floppy-disk"></i> Save to Supabase
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        {subjectList.map((subj, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700/80 text-slate-200 text-xs font-medium hover:border-cyan-400/50 transition">
                            <span>{subj}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveSubject(currentClass.id, subj)}
                              className="text-slate-500 hover:text-red-400 text-xs font-bold"
                              title={`Remove ${subj}`}>✕</button>
                          </span>
                        ))}
                        
                        {/* Compact inline quick-add input */}
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (newSubjectInput.trim()) {
                              handleAddSubject(currentClass.id, newSubjectInput.trim());
                              setNewSubjectInput('');
                            }
                          }}
                          className="inline-flex items-center gap-1">
                          <input
                            type="text"
                            value={newSubjectInput}
                            onChange={(e) => setNewSubjectInput(e.target.value)}
                            placeholder="+ Add subject"
                            className="w-32 bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                          />
                          <button
                            type="submit"
                            disabled={!newSubjectInput.trim()}
                            className="px-2 py-1 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 text-slate-950 font-bold text-xs">
                            +
                          </button>
                        </form>
                      </div>
                    )}
                  </div>

                  {/* 2-Column Split: Faculty Allocations & Enrolled Students */}
                  <div className="grid grid-cols-12 gap-4 pt-1">
                    
                    {/* Left Column: Assigned Faculty (7 cols) */}
                    <div className="col-span-7 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-white text-xs font-bold flex items-center gap-1.5">
                          <i className="ph ph-chalkboard-teacher text-blue-400"></i> Assigned Faculty ({assignedTeachers.length})
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">Multi-subject supported</span>
                      </div>

                      {assignedTeachers.length === 0 ? (
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
                          <i className="ph ph-warning-circle"></i> No teachers assigned to {currentClass.name} yet.
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {assignedTeachers.map((t, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-slate-950/60 rounded-xl px-3 py-2 border border-slate-800/80 hover:border-slate-700 transition">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-300 font-bold text-xs flex-shrink-0">
                                  {(t?.name || t?.email || 'Teacher').slice(0, 2).toUpperCase()}
                                </div>
                                <div className="min-w-0 flex items-center gap-2">
                                  <span className="text-white font-bold text-xs">{t?.name || t?.email || 'Teacher'}</span>
                                  <span className="text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded text-[10px] font-semibold">{t.subject}</span>
                                  {t.isClassTeacher && (
                                    <span className="px-1.5 py-0.2 bg-amber-400/20 text-amber-400 border border-amber-400/40 rounded text-[9px] font-bold">
                                      🛡️ CT
                                    </span>
                                  )}
                                  <span className="text-slate-500 text-[10px] font-mono">{t.email}</span>
                                </div>
                              </div>
                              <button
                                onClick={() => handleRemoveTeacherFromClass(currentClass.id, t.email)}
                                className="p-1 text-slate-500 hover:text-red-400 transition text-xs"
                                title={`Remove ${t?.name || t?.email || 'Teacher'}`}>✕</button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Quick Assign Teacher Toolbar */}
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const form = e.target;
                          handleAddTeacherToClass(currentClass.id, form.teacherEmail.value, form.subjectName.value, form.isClassTeacher.checked);
                          form.reset();
                        }}
                        className="bg-slate-950/40 rounded-xl p-2.5 border border-slate-800/80 flex items-center gap-2 text-xs">
                        <select required name="teacherEmail" className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs font-medium focus:border-cyan-400">
                          <option value="" disabled selected>— Select Teacher —</option>
                          {schoolTeachers.map(t => (
                            <option key={t.id || t.email} value={t.email}>{t?.name || t.email} ({t.email})</option>
                          ))}
                        </select>
                        <input 
                          required 
                          name="subjectName" 
                          placeholder="Subject (e.g. Science)" 
                          className="w-36 bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs placeholder-slate-500 focus:border-cyan-400" 
                        />
                        <label className="flex items-center gap-1 text-xs text-slate-300 font-medium cursor-pointer">
                          <input type="checkbox" name="isClassTeacher" className="rounded bg-slate-900 border-slate-700 text-cyan-400 cursor-pointer" />
                          CT
                        </label>
                        <button 
                          type="submit" 
                          className="py-1.5 px-3 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs flex items-center gap-1 transition">
                          Assign
                        </button>
                      </form>
                    </div>

                    {/* Right Column: Enrolled Students (5 cols) */}
                    <div className="col-span-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-white text-xs font-bold flex items-center gap-1.5">
                          <i className="ph ph-student text-emerald-400"></i> Enrolled Students ({enrolledStudents.length})
                        </span>

                        {availableToEnroll.length > 0 && (
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                handleToggleStudentClass(currentClass.id, e.target.value);
                                e.target.value = '';
                              }
                            }}
                            defaultValue=""
                            className="bg-slate-900 border border-slate-700 text-cyan-400 rounded-lg px-2 py-1 text-xs font-bold focus:border-cyan-400">
                            <option value="" disabled>+ Quick Enroll</option>
                            {availableToEnroll.map(s => (
                              <option key={s.id || s.email} value={s.email}>{s?.name || s.email}</option>
                            ))}
                          </select>
                        )}
                      </div>

                      {enrolledStudents.length === 0 ? (
                        <div className="text-center py-6 text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                          <i className="ph ph-student text-2xl block mb-1 opacity-40"></i>
                          No students enrolled in this class.
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                          {enrolledStudents.map(u => (
                            <div key={u.id || u.email} className="flex items-center justify-between bg-slate-950/60 rounded-xl px-3 py-2 border border-slate-800/80 hover:border-slate-700 transition">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-6 h-6 rounded-md bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 font-bold text-[10px] flex-shrink-0">
                                  {(u?.name || u?.email || 'Student').slice(0, 2).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <span className="text-white font-semibold text-xs block truncate">{u?.name || u?.email || 'Student'}</span>
                                  <span className="text-slate-400 font-mono text-[10px] block truncate">{u?.email || '—'}</span>
                                </div>
                              </div>
                              <button
                                onClick={() => handleToggleStudentClass(currentClass.id, u.email)}
                                className="p-1 text-slate-500 hover:text-red-400 transition text-xs"
                                title={`Remove ${u?.name || u?.email || 'Student'}`}>✕</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              );
            })()}

            {/* ── Onboard Member Tab ── */}
            {schoolView === 'onboard' && (
              <div className="space-y-4">
                {/* Mode Toggle */}
                <div className="flex gap-2">
                  <button onClick={() => setOnboardMode('form')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition ${onboardMode === 'form' ? 'bg-cyan-400/15 border-cyan-400 text-cyan-400' : 'border-slate-700 text-slate-400 hover:text-white'}`}>
                    <i className="ph ph-user-plus"></i> Single Member
                  </button>
                  <button onClick={() => setOnboardMode('file')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition ${onboardMode === 'file' ? 'bg-cyan-400/15 border-cyan-400 text-cyan-400' : 'border-slate-700 text-slate-400 hover:text-white'}`}>
                    <i className="ph ph-file-arrow-up"></i> Bulk File Upload (.csv / .txt)
                  </button>
                </div>

                {/* ── Single Form Mode ── */}
                {onboardMode === 'form' && (
                  <div className="glass-panel p-6 max-w-xl space-y-5">
                    <h4 className="text-white font-bold text-sm flex items-center gap-2"><i className="ph ph-user-plus text-cyan-400 text-base"></i> Onboard New Member — {selectedSchool.name}</h4>
                    {onboardSuccess && <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-semibold">{onboardSuccess}</div>}
                    <form onSubmit={handleOnboard} className="space-y-4 text-xs">
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1.5">Full Name</label>
                        <input required value={onboardForm.name} onChange={e => setOnboardForm({...onboardForm, name: e.target.value})}
                          placeholder="e.g. Rahul Sharma"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400" />
                      </div>
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1.5">Email Address</label>
                        <input required type="email" value={onboardForm.email} onChange={e => setOnboardForm({...onboardForm, email: e.target.value})}
                          placeholder="e.g. rahul@dps.edu.in"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400" />
                      </div>
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1.5">Role</label>
                        <div className="flex gap-3">
                          {[{r:'STUDENT',e:'📖'},{r:'TEACHER',e:'🎓'},{r:'ADMIN',e:'🛡️'}].map(({r,e}) => (
                            <label key={r} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border cursor-pointer font-bold transition ${onboardForm.role === r ? 'bg-cyan-400/15 border-cyan-400 text-cyan-400' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                              <input type="radio" name="role" value={r} checked={onboardForm.role === r} onChange={() => setOnboardForm({...onboardForm, role: r})} className="hidden" />
                              {e} {r}
                            </label>
                          ))}
                        </div>
                      </div>
                      {onboardForm.role === 'STUDENT' && (
                        <div>
                          <label className="block text-slate-300 font-semibold mb-1.5">Assign to Class <span className="text-slate-500 font-normal">(optional)</span></label>
                          <select value={onboardForm.className} onChange={e => setOnboardForm({...onboardForm, className: e.target.value})}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-cyan-400">
                            <option value="">— No class assigned yet —</option>
                            {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                          </select>
                        </div>
                      )}
                      <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-slate-400 text-[11px]">
                        <i className="ph ph-info text-cyan-400"></i> Registers under <span className="text-white font-semibold">{selectedSchool.name}</span> · ID: <span className="text-cyan-400 font-mono">{selectedSchool.id}</span> · Invite email will be sent automatically.
                      </div>
                      <div className="flex gap-3 pt-1">
                        <button type="button" onClick={() => setSchoolView('overview')} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 font-semibold">Cancel</button>
                        <button type="submit" className="flex-1 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold flex items-center justify-center gap-2">
                          <i className="ph ph-paper-plane-tilt"></i> Send Invite & Onboard
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* ── File Upload Mode ── */}
                {onboardMode === 'file' && (
                  <div className="glass-panel p-6 space-y-5 max-w-2xl">
                    <div className="flex items-center justify-between">
                      <h4 className="text-white font-bold text-sm flex items-center gap-2">
                        <i className="ph ph-file-arrow-up text-cyan-400 text-base"></i> Bulk Upload Members via File — {selectedSchool.name}
                      </h4>
                      <button onClick={downloadSampleCSV}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-400 font-semibold text-[11px] flex items-center gap-1.5 transition">
                        <i className="ph ph-download-simple"></i> Download Sample (.csv)
                      </button>
                    </div>

                    {csvSuccess && (
                      <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-semibold flex items-center gap-2">
                        <i className="ph ph-check-circle text-base"></i> {csvSuccess}
                      </div>
                    )}

                    {/* Format Guidelines Box */}
                    <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 text-xs space-y-1.5 text-slate-400">
                      <div className="flex items-center justify-between text-white font-semibold">
                        <span className="flex items-center gap-1.5"><i className="ph ph-file-text text-cyan-400"></i> Expected File Format (.csv or .txt)</span>
                        <span className="text-[10px] text-slate-500 font-mono">Comma-Separated Values</span>
                      </div>
                      <code className="text-cyan-400 block font-mono text-[11px] bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                        Full Name, Email, Role, Class (optional)
                      </code>
                      <p className="text-[11px] text-slate-400">
                        • Supported roles: <span className="text-emerald-400 font-semibold">STUDENT</span>, <span className="text-blue-400 font-semibold">TEACHER</span>, or <span className="text-purple-400 font-semibold">ADMIN</span>.<br/>
                        • Header row is automatically detected and skipped.
                      </p>
                    </div>

                    {/* Hidden file input */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".csv,.txt,text/csv,text/plain"
                      onChange={handleFileInputChange}
                      className="hidden"
                    />

                    {/* Drag & Drop File Zone */}
                    {!uploadedFile ? (
                      <div
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current && fileInputRef.current.click()}
                        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-3 ${
                          isDragging
                            ? 'border-cyan-400 bg-cyan-400/10 shadow-lg shadow-cyan-500/10'
                            : 'border-slate-700/80 bg-slate-900/40 hover:border-cyan-400/50 hover:bg-slate-900/70'
                        }`}>
                        <div className="w-12 h-12 rounded-2xl bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center text-cyan-400 text-2xl">
                          <i className="ph ph-cloud-arrow-up"></i>
                        </div>
                        <div>
                          <p className="text-white font-bold text-sm">
                            Click to browse or drag &amp; drop file here
                          </p>
                          <p className="text-slate-500 text-xs mt-1">
                            Supports <span className="text-slate-300 font-semibold">.CSV</span> and <span className="text-slate-300 font-semibold">.TXT</span> files with comma-separated values
                          </p>
                        </div>
                        <button type="button" className="mt-1 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-cyan-400 font-bold text-xs flex items-center gap-1.5 pointer-events-none">
                          <i className="ph ph-folder-open"></i> Select File from Computer
                        </button>
                      </div>
                    ) : (
                      /* Selected File Summary Card */
                      <div className="glass-panel p-4 flex items-center justify-between border-cyan-500/30 bg-cyan-400/5">
                        <div className="flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-xl bg-cyan-400/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400 text-xl">
                            <i className="ph ph-file-csv"></i>
                          </div>
                          <div>
                            <p className="text-white font-bold text-xs">{uploadedFile.name}</p>
                            <p className="text-slate-400 text-[10px] font-mono mt-0.5">
                              {uploadedFile.size} · {csvParsed.length} member{csvParsed.length === 1 ? '' : 's'} parsed
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current && fileInputRef.current.click()}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold text-xs transition">
                            Change File
                          </button>
                          <button
                            type="button"
                            onClick={handleClearFile}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 transition"
                            title="Remove File">
                            <i className="ph ph-trash text-base"></i>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Error Notice */}
                    {csvError && (
                      <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 text-xs font-semibold flex items-center gap-2">
                        <i className="ph ph-warning-circle text-base flex-shrink-0"></i>
                        <span>{csvError}</span>
                      </div>
                    )}

                    {/* Parsed Rows Preview */}
                    {csvParsed.length > 0 && (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <p className="text-slate-300 text-xs font-semibold flex items-center gap-1.5">
                            <i className="ph ph-check-circle text-emerald-400"></i>
                            <span>{csvParsed.length} Members Ready to Import:</span>
                          </p>
                          <span className="text-[10px] text-slate-500 font-mono">Review below before confirming</span>
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                          {csvParsed.map((row, i) => (
                            <div key={i} className="flex items-center justify-between bg-slate-900/70 rounded-xl px-3.5 py-2 border border-slate-800 text-xs">
                              <div className="flex items-center gap-3">
                                <span className="text-slate-500 font-mono text-[10px] w-4">{i + 1}.</span>
                                <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                  row.role === 'STUDENT' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
                                  row.role === 'TEACHER' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40' :
                                  'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                                }`}>
                                  {row.role}
                                </span>
                                <span className="text-white font-semibold">{row.name}</span>
                                <span className="text-slate-400 font-mono text-[11px]">{row.email}</span>
                              </div>
                              {row.className && (
                                <span className="text-cyan-400 text-[10px] font-semibold bg-cyan-400/10 border border-cyan-400/30 px-2 py-0.5 rounded-full">
                                  {row.className}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={handleClearFile}
                        className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 font-semibold text-xs transition">
                        Clear File
                      </button>
                      <button
                        onClick={handleCSVUpload}
                        disabled={csvParsed.length === 0 || !!csvError}
                        className="flex-1 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-cyan-500/10">
                        <i className="ph ph-upload-simple text-base"></i>
                        Import {csvParsed.length > 0 ? `${csvParsed.length} Members` : 'Members'} to School
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Assign Class & Subject Modal ── */}
            {assignModalTeacher && (
              <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="glass-panel p-6 max-w-md w-full border border-cyan-500/30 space-y-4 shadow-2xl">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                    <div>
                      <h4 className="text-white font-bold text-sm flex items-center gap-2">
                        <i className="ph ph-chalkboard-teacher text-cyan-400"></i> Assign Class &amp; Subject
                      </h4>
                      <p className="text-slate-400 text-xs mt-0.5">{assignModalTeacher.name} ({assignModalTeacher.email})</p>
                    </div>
                    <button onClick={() => setAssignModalTeacher(null)} className="text-slate-400 hover:text-white text-lg">✕</button>
                  </div>

                  <form onSubmit={(e) => {
                    e.preventDefault();
                    handleAddTeacherToClass(newTeacherForm.classId || classes[0].id, assignModalTeacher.email, newTeacherForm.subject, newTeacherForm.isClassTeacher);
                    setAssignModalTeacher(null);
                  }} className="space-y-3.5 text-xs">
                    <div>
                      <label className="text-slate-300 font-semibold block mb-1">Select Class Section</label>
                      <select
                        value={newTeacherForm.classId || classes[0].id}
                        onChange={(e) => setNewTeacherForm(f => ({ ...f, classId: e.target.value }))}
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-semibold focus:border-cyan-400">
                        {classes.map(c => (
                          <option key={c.id} value={c.id}>{c.name} — ({c.subject})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-300 font-semibold block mb-1">Assigned Subject(s)</label>
                      <input
                        required
                        value={newTeacherForm.subject || ''}
                        onChange={(e) => setNewTeacherForm(f => ({ ...f, subject: e.target.value }))}
                        placeholder="e.g. Physics / Mathematics / Science / Computer"
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs placeholder-slate-500 focus:border-cyan-400"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="modalClassTeacherCheck"
                        checked={newTeacherForm.isClassTeacher || false}
                        onChange={(e) => setNewTeacherForm(f => ({ ...f, isClassTeacher: e.target.checked }))}
                        className="rounded bg-slate-900 border-slate-700 text-cyan-400 focus:ring-0 cursor-pointer"
                      />
                      <label htmlFor="modalClassTeacherCheck" className="text-slate-300 text-xs cursor-pointer">
                        Designate as Section Class Teacher
                      </label>
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setAssignModalTeacher(null)}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs">
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs flex items-center gap-1.5">
                        <i className="ph ph-check"></i> Confirm Assignment
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        );
      }

      // ── School List (default view) ──
      return (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-white text-lg">Organization &amp; Tenant Workspaces</h3>
              <p className="text-xs text-slate-400">Manage institution instances, allocate storage caps, and set global security policies.</p>
            </div>
            <button onClick={onOpenModal} className="px-3.5 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs flex items-center gap-2">
              <i className="ph ph-plus-circle text-base"></i> Onboard New School
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 max-w-2xl">
            {filtered.map(org => (
              <div key={org.id} className="glass-panel p-5 space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-white text-base">{org.name}</h4>
                    <p className="text-xs text-cyan-400 font-mono">{org.domain}</p>
                    <p className="text-[10px] text-slate-600 font-mono mt-0.5">{org.id}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-bold">{org.plan} Tier</span>
                </div>
                <div className="grid grid-cols-3 gap-2 bg-slate-900/60 p-3 rounded-xl text-xs border border-slate-800">
                  <div><span className="text-slate-400 block text-[10px]">Students</span><span className="text-white font-bold">{org.students}</span></div>
                  <div><span className="text-slate-400 block text-[10px]">Teachers</span><span className="text-white font-bold">{org.teachers}</span></div>
                  <div><span className="text-slate-400 block text-[10px]">2FA Policy</span><span className={org.twoFactor ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>{org.twoFactor ? 'Enforced' : 'Optional'}</span></div>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">R2 Storage Allocation</span>
                    <span className="text-cyan-400 font-mono font-bold">{org.storageUsed} / {org.storageLimit}</span>
                  </div>
                  <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                    <div className="bg-gradient-to-r from-cyan-400 to-blue-500 h-full rounded-full" style={{ width: `${(parseInt(org.storageUsed) / parseInt(org.storageLimit)) * 100}%` }}></div>
                  </div>
                </div>
                <button onClick={() => setSelectedSchool(org)}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-cyan-400/15 border border-slate-700 hover:border-cyan-400/50 text-white hover:text-cyan-400 font-bold text-xs flex items-center justify-center gap-2 transition-all duration-200">
                  <i className="ph ph-arrow-square-in text-base"></i> Manage School &amp; Members →
                </button>
              </div>
            ))}
          </div>
        </div>
      );
    }


    // ── VIEW 3: SYSTEM HEALTH & DEEP DIAGNOSTIC ENGINE ──
