'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function Dashboard() {
  const [tasks, setTasks] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskStatus, setTaskStatus] = useState('pending');
  const [expAmount, setExpAmount] = useState('');
  const [expDesc, setExpDesc] = useState('');
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const { data: tData } = await supabase.from('tasks').select('*').order('id', { ascending: false });
    const { data: eData } = await supabase.from('expenses').select('*').order('id', { ascending: false });
    if (tData) setTasks(tData);
    if (eData) setExpenses(eData);
  }

  async function addTask(e) {
    e.preventDefault();
    if (!taskTitle) return;
    await supabase.from('tasks').insert([{ title: taskTitle, status: taskStatus, task_date: today }]);
    setTaskTitle('');
    fetchData();
  }

  async function toggleDone(id, currentStatus) {
    await supabase.from('tasks').update({ status: currentStatus === 'done' ? 'pending' : 'done' }).eq('id', id);
    fetchData();
  }

  async function addExpense(e) {
    e.preventDefault();
    if (!expAmount || !expDesc) return;
    await supabase.from('expenses').insert([{ amount: Number(expAmount), description: expDesc, expense_date: today }]);
    setExpAmount('');
    setExpDesc('');
    fetchData();
  }

  const todayTasks = tasks.filter(t => t.task_date === today && t.status !== 'draft');
  const draftTasks = tasks.filter(t => t.status === 'draft');
  const totalExpenseToday = expenses
    .filter(e => e.expense_date === today)
    .reduce((acc, curr) => acc + Number(curr.amount), 0);

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold">Daily Workspace</h1>
          <p className="text-sm text-slate-500">Tanggal: {today}</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase font-semibold text-slate-400">Pengeluaran Hari Ini</p>
          <p className="text-xl font-bold text-red-600">Rp {totalExpenseToday.toLocaleString('id-ID')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Tugas Hari Ini */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="font-semibold text-lg flex justify-between items-center">
            Tugas Hari Ini
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{todayTasks.length}</span>
          </h2>
          <form onSubmit={addTask} className="flex gap-2">
            <input
              type="text"
              placeholder="Tugas baru..."
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              className="border p-2 rounded text-sm w-full outline-none focus:border-blue-500"
            />
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm font-medium">Add</button>
          </form>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {todayTasks.length === 0 ? (
              <p className="text-sm text-slate-400 italic">Belum ada tugas hari ini.</p>
            ) : (
              todayTasks.map(t => (
                <div
                  key={t.id}
                  onClick={() => toggleDone(t.id, t.status)}
                  className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded border cursor-pointer transition"
                >
                  <input
                    type="checkbox"
                    checked={t.status === 'done'}
                    onChange={() => {}}
                    className="cursor-pointer"
                  />
                  <span className={`text-sm ${t.status === 'done' ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                    {t.title}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Draft Rencana */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="font-semibold text-lg flex justify-between items-center">
            Draft Rencana
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{draftTasks.length}</span>
          </h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {draftTasks.length === 0 ? (
              <p className="text-sm text-slate-400 italic">Belum ada draft ide/rencana.</p>
            ) : (
              draftTasks.map(d => (
                <div key={d.id} className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900 font-medium">
                  {d.title}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Catat Pengeluaran */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="font-semibold text-lg">Catat Pengeluaran</h2>
          <form onSubmit={addExpense} className="space-y-2">
            <input
              type="number"
              placeholder="Nominal"
              value={expAmount}
              onChange={(e) => setExpAmount(e.target.value)}
              className="border p-2 rounded text-sm w-full outline-none focus:border-green-500"
            />
            <input
              type="text"
              placeholder="Keterangan"
              value={expDesc}
              onChange={(e) => setExpDesc(e.target.value)}
              className="border p-2 rounded text-sm w-full outline-none focus:border-green-500"
            />
            <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white p-2 rounded text-sm font-medium">
              Simpan
            </button>
          </form>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {expenses.length === 0 ? (
              <p className="text-sm text-slate-400 italic">Belum ada pengeluaran hari ini.</p>
            ) : (
              expenses.map(e => (
                <div key={e.id} className="flex justify-between items-center border-b pb-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{e.description}</p>
                    <span className="text-xs text-slate-400">{e.expense_date}</span>
                  </div>
                  <span className="font-semibold text-red-600">Rp {Number(e.amount).toLocaleString('id-ID')}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
