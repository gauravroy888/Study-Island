import React, { useState, useEffect } from 'react';
import Card from '../components/Card';
import { Users, BookOpen, X, Check, Search, Palette, UserPlus, Trash2, Edit2, Tv, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

export default function Classes() {
  const navigate = useNavigate();
  const [activeModal, setActiveModal] = useState(null); // 'roster' | 'manageGroups' | null
  const [selectedClass, setSelectedClass] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [rosterTab, setRosterTab] = useState('students');
  const [classGroups, setClassGroups] = useState([]);
  
  // Group creation state
  const [groupName, setGroupName] = useState('');
  const [groupColor, setGroupColor] = useState('#FF6B6B');
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [currentUser, setCurrentUser] = useState({ email: 'teacher@edtech.edu', name: 'Teacher' });
  const [dbStudents, setDbStudents] = useState([]);

  useEffect(() => {
    const userStr = localStorage.getItem('edtech_user');
    if (userStr) {
      try { setCurrentUser(JSON.parse(userStr)); } catch (e) {}
    }
    
    // Fetch real students from DB
    supabase.from('profiles').select('*').eq('role', 'student').then(({data}) => {
      if (data) setDbStudents(data);
    });
  }, []);

  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#D4A5A5', '#9B59B6', '#F39C12'];

  const [classes, setClasses] = useState([]);

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    const { data, error } = await supabase.from('classes').select('*').order('created_at', { ascending: true });
    if (data) {
      setClasses(data);
    }
  };

  const filteredStudents = dbStudents.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fetchGroups = async (className) => {
    const { data } = await supabase.from('conversations').select('*').eq('type', 'group').eq('class_name', className);
    if (data) setClassGroups(data);
  };

  const openModal = (modalType, cls) => {
    setSelectedClass(cls);
    setEditingGroup(null);
    if (modalType === 'manageGroups') {
      setGroupName('');
      setSelectedStudents([]);
      setGroupColor(colors[0]);
      setIsCreating(false);
    }
    setActiveModal(modalType);
    setGroupName('');
    setSearchQuery('');
    setShowSuccess(false);
    setRosterTab('students');
    
    if (modalType === 'roster') {
      fetchGroups(cls.name);
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setSelectedClass(null);
  };

  const toggleStudentSelection = (email) => {
    if (selectedStudents.includes(email)) {
      setSelectedStudents(selectedStudents.filter(e => e !== email));
    } else {
      setSelectedStudents([...selectedStudents, email]);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedStudents.length === 0) return;
    
    setIsCreating(true);
    try {
      // Add teacher to participants
      const participants = [...selectedStudents, currentUser.email];
      
      const newGroup = {
        name: `${groupColor}|${groupName}`,
        type: 'group',
        class_name: selectedClass.name,
        participants: participants,
        lastMessage: 'Group created'
      };
      
      if (editingGroup) {
        const { error } = await supabase.from('conversations').update(newGroup).eq('id', editingGroup.id);
        if (error) {
          console.error("Supabase update error:", error);
          throw error;
        }
      } else {
        const { error } = await supabase.from('conversations').insert([newGroup]);
        if (error) {
          console.error("Supabase insert error:", error);
          throw error;
        }
      }
      
      setShowSuccess(true);
      setTimeout(() => {
        closeModal();
      }, 1500);
    } catch (err) {
      console.error("Error saving group:", err);
      alert("Error saving group: " + (err.message || "Please check your connection and try again."));
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditGroup = (group) => {
    const hasColor = group.name && group.name.includes('|');
    const bgColor = hasColor ? group.name.split('|')[0] : colors[0];
    const displayName = hasColor ? group.name.split('|')[1] : group.name;
    
    setEditingGroup(group);
    setGroupName(displayName);
    setGroupColor(bgColor);
    setSelectedStudents(group.participants.filter(email => email !== currentUser.email));
    setActiveModal('manageGroups');
  };

  const handleDeleteGroup = async (groupId) => {
    if (window.confirm("Are you sure you want to delete this group?")) {
      const { error } = await supabase.from('conversations').delete().eq('id', groupId);
      if (error) {
        alert("Error deleting group: " + error.message);
      } else {
        fetchGroups(selectedClass.name);
      }
    }
  };

  return (
    <div className="view-container animate-fade-in" style={{ position: 'relative' }}>
      <div className="view-header">
        <h1>Assigned Classes</h1>
        <p>Manage your subjects, student rosters, and class groups.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        {classes.map(cls => (
          <Card key={cls.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--accent-cyan)' }}>{cls.name}</h3>
                <p style={{ margin: '5px 0 0 0', fontSize: '14px' }}>{cls.subject}</p>
              </div>
              <div style={{ padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                <BookOpen size={20} color="var(--accent-blue)" />
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '20px', marginTop: '20px', paddingTop: '15px', borderTop: '1px solid var(--panel-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={16} color="var(--text-secondary)" />
                <span style={{ fontSize: '14px' }}>{cls.students} Students</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Avg:</span>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--accent-gold)' }}>{cls.performance}</span>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '20px' }}>
              <button 
                onClick={() => navigate(`/smartboard?class=${encodeURIComponent(cls.name)}&subject=${encodeURIComponent(cls.subject || 'All')}`)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, var(--brand-primary, #00F0FF), var(--brand-secondary, #3B82F6))',
                  border: 'none',
                  color: '#000',
                  fontWeight: '800',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 0 15px var(--brand-glow, rgba(0, 240, 255, 0.3))'
                }}
              >
                <Tv size={16} /> Teach on Smartboard <ArrowUpRight size={14} />
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-ghost" onClick={() => openModal('roster', cls)} style={{ flex: 1, padding: '8px 12px', fontSize: '13px' }}>View Roster</button>
                <button className="btn btn-primary" onClick={() => openModal('manageGroups', cls)} style={{ flex: 1, padding: '8px 12px', fontSize: '13px' }}>Manage Groups</button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Roster Modal */}
      {activeModal === 'roster' && selectedClass && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="animate-scale-in" style={{ background: '#1a1f2b', borderRadius: '16px', width: '100%', maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--panel-border)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '20px 25px', borderBottom: '1px solid var(--panel-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, color: '#fff' }}>Student Roster</h2>
                <p style={{ margin: '5px 0 0 0', color: 'var(--text-secondary)', fontSize: '14px' }}>{selectedClass.name} - {selectedClass.subject}</p>
              </div>
              <button onClick={closeModal} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '15px 25px', borderBottom: '1px solid var(--panel-border)' }}>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                <button 
                  onClick={() => setRosterTab('students')}
                  style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', background: rosterTab === 'students' ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.05)', color: rosterTab === 'students' ? '#000' : '#fff', cursor: 'pointer', fontWeight: 'bold' }}>
                  Students
                </button>
                <button 
                  onClick={() => setRosterTab('groups')}
                  style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', background: rosterTab === 'groups' ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.05)', color: rosterTab === 'groups' ? '#000' : '#fff', cursor: 'pointer', fontWeight: 'bold' }}>
                  Groups
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '10px 15px', border: '1px solid var(--panel-border)' }}>
                <Search size={18} color="var(--text-secondary)" style={{ marginRight: '10px' }} />
                <input 
                  type="text" 
                  placeholder={rosterTab === 'students' ? "Search students by name or email..." : "Search groups by name..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: '#fff', flex: 1, outline: 'none' }}
                />
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 25px 25px 25px' }}>
              {rosterTab === 'students' ? (
                filteredStudents.length > 0 ? filteredStudents.map(student => (
                  <div key={student.id} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s', borderRadius: '8px' }}>
                    <img src={student.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=User'} alt={student.name} style={{ width: '45px', height: '45px', borderRadius: '50%', background: '#fff' }} />
                    <div>
                      <h4 style={{ margin: 0, color: '#fff', fontSize: '15px' }}>{student.name}</h4>
                      <p style={{ margin: '2px 0 0 0', color: 'var(--text-secondary)', fontSize: '13px' }}>{student.email}</p>
                    </div>
                  </div>
                )) : (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                    No students found matching your search.
                  </div>
                )
              ) : (
                classGroups.filter(g => (g.name || '').toLowerCase().includes(searchQuery.toLowerCase())).length > 0 ? 
                  classGroups.filter(g => (g.name || '').toLowerCase().includes(searchQuery.toLowerCase())).map(group => {
                  const hasColor = group.name && group.name.includes('|');
                  const bgColor = hasColor ? group.name.split('|')[0] : 'var(--accent-purple)';
                  const displayName = hasColor ? group.name.split('|')[1] : group.name;
                  return (
                  <div key={group.id} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s', borderRadius: '8px' }}>
                    <div style={{ width: '45px', height: '45px', borderRadius: '50%', background: bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Users size={20} color="#000" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: 0, color: '#fff', fontSize: '15px' }}>{displayName}</h4>
                      <p style={{ margin: '2px 0 0 0', color: 'var(--text-secondary)', fontSize: '13px' }}>{group.participants?.length || 0} Members</p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button 
                        onClick={() => handleEditGroup(group)}
                        style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDeleteGroup(group.id)}
                        style={{ background: 'rgba(255,107,107,0.2)', border: 'none', color: '#FF6B6B', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                        Delete
                      </button>
                    </div>
                  </div>
                  );
                }) : (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                    No groups found for this class.
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manage Groups Modal */}
      {activeModal === 'manageGroups' && selectedClass && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="animate-scale-in" style={{ background: '#1a1f2b', borderRadius: '16px', width: '100%', maxWidth: '1100px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--panel-border)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '20px 25px', borderBottom: '1px solid var(--panel-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, color: '#fff' }}>Manage Learning Groups</h2>
                <p style={{ margin: '5px 0 0 0', color: 'var(--text-secondary)', fontSize: '14px' }}>Create and manage groups for {selectedClass.name}.</p>
              </div>
              <button onClick={closeModal} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              
              {/* Left Column: Existing Groups */}
              <div style={{ width: '280px', borderRight: '1px solid var(--panel-border)', padding: '20px', display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.2)', overflowY: 'auto' }}>
                <button 
                  onClick={() => { setEditingGroup(null); setGroupName(''); setSelectedStudents([]); setGroupColor(colors[0]); }}
                  style={{ width: '100%', background: !editingGroup ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.1)', color: !editingGroup ? '#000' : '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', marginBottom: '20px', transition: 'all 0.2s' }}
                >
                  <UserPlus size={16} /> New Group
                </button>
                
                <h3 style={{ margin: '0 0 15px 0', color: 'var(--text-secondary)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>Existing Groups</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {classGroups.length > 0 ? classGroups.map(group => {
                    const hasColor = group.name && group.name.includes('|');
                    const bgColor = hasColor ? group.name.split('|')[0] : colors[0];
                    const displayName = hasColor ? group.name.split('|')[1] : group.name;
                    const isEditing = editingGroup?.id === group.id;
                    
                    return (
                      <div 
                        key={group.id} 
                        onClick={() => handleEditGroup(group)}
                        style={{ 
                          background: isEditing ? `${bgColor}15` : 'rgba(255,255,255,0.03)', 
                          border: `1px solid ${isEditing ? bgColor : 'transparent'}`, 
                          padding: '15px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s',
                          display: 'flex', flexDirection: 'column', gap: '10px'
                        }}
                        className="hover-lift"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: bgColor }}></div>
                          <span style={{ color: isEditing ? '#fff' : 'var(--text-secondary)', fontWeight: isEditing ? 'bold' : 'normal', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{group.participants.length} Members</span>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group.id); }}
                            style={{ background: 'transparent', border: 'none', color: '#ff4444', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
                            title="Delete Group"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  }) : (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                      No groups created yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Middle Column: Group Details */}
              <div style={{ width: '320px', borderRight: '1px solid var(--panel-border)', padding: '25px', display: 'flex', flexDirection: 'column', gap: '25px', background: 'rgba(0,0,0,0.1)' }}>
                <div>
                  <h3 style={{ margin: '0 0 20px 0', color: '#fff', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Edit2 size={16} color="var(--accent-cyan)" />
                    {editingGroup ? 'Edit Group' : 'Group Details'}
                  </h3>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '8px', fontSize: '14px' }}>Group Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Science Project Team A"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--panel-border)', color: '#fff', padding: '12px 15px', borderRadius: '8px', outline: 'none' }}
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '12px', fontSize: '14px' }}>Color Code</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    {colors.map(color => (
                      <button
                        key={color}
                        onClick={() => setGroupColor(color)}
                        style={{
                          width: '36px', height: '36px', borderRadius: '50%', background: color,
                          border: groupColor === color ? '3px solid #fff' : '3px solid transparent',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: groupColor === color ? `0 0 10px ${color}` : 'none',
                          transition: 'all 0.2s'
                        }}
                      >
                        {groupColor === color && <Check size={16} color="#000" />}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '8px', marginTop: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Selected Students</span>
                    <span style={{ color: '#fff', fontWeight: 'bold' }}>{selectedStudents.length}</span>
                  </div>
                  <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(selectedStudents.length / Math.max(1, dbStudents.length)) * 100}%`, background: groupColor, transition: 'all 0.3s' }}></div>
                  </div>
                </div>
                
                {showSuccess ? (
                  <button style={{ background: '#25D366', color: '#000', border: 'none', padding: '15px', borderRadius: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <Check size={18} /> {editingGroup ? 'Group Updated!' : 'Group Created!'}
                  </button>
                ) : (
                  <button 
                    onClick={handleCreateGroup}
                    disabled={!groupName.trim() || selectedStudents.length === 0 || isCreating}
                    style={{ 
                      background: !groupName.trim() || selectedStudents.length === 0 ? 'rgba(255,255,255,0.1)' : 'var(--accent-cyan)', 
                      color: !groupName.trim() || selectedStudents.length === 0 ? 'var(--text-secondary)' : '#000', 
                      border: 'none', padding: '15px', borderRadius: '8px', fontWeight: 'bold', cursor: !groupName.trim() || selectedStudents.length === 0 ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.3s'
                    }}
                  >
                    <Check size={18} />
                    {isCreating ? 'Saving...' : (editingGroup ? 'Save Changes' : 'Create Group')}
                  </button>
                )}
              </div>
              
              {/* Right Column: Student Selection */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--panel-bg)' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid var(--panel-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '10px 15px', border: '1px solid var(--panel-border)' }}>
                    <Search size={18} color="var(--text-secondary)" style={{ marginRight: '10px' }} />
                    <input 
                      type="text" 
                      placeholder="Search students to add..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ background: 'transparent', border: 'none', color: '#fff', flex: 1, outline: 'none' }}
                    />
                  </div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '10px 20px 20px 20px' }}>
                  {filteredStudents.length > 0 ? filteredStudents.map(student => {
                    const isSelected = selectedStudents.includes(student.email);
                    return (
                      <div 
                        key={student.id} 
                        onClick={() => toggleStudentSelection(student.email)}
                        style={{ 
                          display: 'flex', alignItems: 'center', gap: '15px', padding: '12px 15px', 
                          border: `1px solid ${isSelected ? groupColor : 'rgba(255,255,255,0.05)'}`, 
                          background: isSelected ? `${groupColor}15` : 'transparent',
                          marginBottom: '10px', transition: 'all 0.2s', borderRadius: '8px', cursor: 'pointer' 
                        }}
                      >
                        <div style={{ 
                          width: '24px', height: '24px', borderRadius: '4px', border: `2px solid ${isSelected ? groupColor : 'var(--text-secondary)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', background: isSelected ? groupColor : 'transparent'
                        }}>
                          {isSelected && <Check size={14} color="#000" strokeWidth={3} />}
                        </div>
                        <img src={student.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=User'} alt={student.name} style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#fff' }} />
                        <div>
                          <h4 style={{ margin: 0, color: '#fff', fontSize: '15px' }}>{student.name}</h4>
                          <p style={{ margin: '2px 0 0 0', color: 'var(--text-secondary)', fontSize: '13px' }}>{student.email}</p>
                        </div>
                      </div>
                    );
                  }) : (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                      No students found matching your search.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
