import React, { useState, useEffect } from 'react';
import Card from '../components/Card';
import { Check, Trash2, Plus } from 'lucide-react';
import { supabase } from '../supabase';

export default function ToDoList() {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    const local = localStorage.getItem('edtech_teacher_todos');
    let initialTasks = local ? JSON.parse(local) : [
      { id: 1, text: 'Grade Physics midterms', completed: false },
      { id: 2, text: 'Prepare presentation for Math 10-A', completed: true },
      { id: 3, text: 'Upload assignment 4', completed: false },
      { id: 4, text: 'Meeting with Principal', completed: false }
    ];

    try {
      const { data, error } = await supabase.from('todos').select('*').order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        initialTasks = data.map(t => ({ id: t.id, text: t.task || t.text, completed: !!t.completed }));
      }
    } catch (e) {}

    setTasks(initialTasks);
    setLoading(false);
  };

  const saveTasks = (updatedTasks) => {
    setTasks(updatedTasks);
    localStorage.setItem('edtech_teacher_todos', JSON.stringify(updatedTasks));
  };

  const toggleTask = async (id) => {
    const updated = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    saveTasks(updated);

    const target = updated.find(t => t.id === id);
    if (target && typeof id === 'string') {
      try {
        await supabase.from('todos').update({ completed: target.completed }).eq('id', id);
      } catch (e) {}
    }
  };

  const addTask = async (e) => {
    e.preventDefault();
    if (newTask.trim()) {
      const taskObj = { id: 'todo_' + Date.now(), text: newTask.trim(), completed: false };
      const updated = [taskObj, ...tasks];
      saveTasks(updated);
      setNewTask('');

      try {
        await supabase.from('todos').insert([{ text: taskObj.text, completed: false, created_at: new Date().toISOString() }]);
      } catch (e) {}
    }
  };

  const deleteTask = async (id) => {
    const updated = tasks.filter(t => t.id !== id);
    saveTasks(updated);

    if (typeof id === 'string') {
      try {
        await supabase.from('todos').delete().eq('id', id);
      } catch (e) {}
    }
  };

  return (
    <div className="view-container animate-fade-in">
      <div className="view-header">
        <h1>To Do List</h1>
        <p>Manage your daily tasks and priorities with cloud persistence.</p>
      </div>

      <Card style={{ maxWidth: '600px' }}>
        <form onSubmit={addTask} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <input 
            type="text" 
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Add a new task..." 
            style={{ flex: 1, padding: '10px 15px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--panel-border)', color: 'white' }}
          />
          <button type="submit" className="btn btn-primary"><Plus size={18} /> Add</button>
        </form>

        {loading ? (
          <div style={{ color: '#94a3b8', padding: '20px 0', textContent: 'center' }}>Loading tasks...</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {tasks.map(task => (
              <li key={task.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 0', borderBottom: '1px solid var(--panel-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer' }} onClick={() => toggleTask(task.id)}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '4px', border: `2px solid ${task.completed ? 'var(--accent-cyan)' : 'var(--text-secondary)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: task.completed ? 'var(--accent-cyan)' : 'transparent' }}>
                    {task.completed && <Check size={14} color="#000" />}
                  </div>
                  <span style={{ textDecoration: task.completed ? 'line-through' : 'none', color: task.completed ? 'var(--text-secondary)' : 'var(--text-primary)' }}>{task.text}</span>
                </div>
                <button className="btn btn-ghost" style={{ padding: '5px' }} onClick={() => deleteTask(task.id)}><Trash2 size={16} color="var(--text-secondary)"/></button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
