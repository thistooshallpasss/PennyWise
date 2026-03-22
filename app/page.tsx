"use client";

import { useEffect, useState, useRef } from "react";
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";
import { Wallet, CreditCard, Download, Upload, LayoutDashboard, LineChart as ChartIcon, Bell, Calendar as CalendarIcon, Save, Tag, ListTodo } from "lucide-react";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ef4444', '#f59e0b', '#10b981', '#6366f1'];
const MONTHS = [{ v: 1, l: 'Jan' }, { v: 2, l: 'Feb' }, { v: 3, l: 'Mar' }, { v: 4, l: 'Apr' }, { v: 5, l: 'May' }, { v: 6, l: 'Jun' }, { v: 7, l: 'Jul' }, { v: 8, l: 'Aug' }, { v: 9, l: 'Sep' }, { v: 10, l: 'Oct' }, { v: 11, l: 'Nov' }, { v: 12, l: 'Dec' }];
const YEARS = [2025, 2026, 2027];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [pendingUploads, setPendingUploads] = useState<any[] | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 'weekly' | 'monthly' | 'yearly' toggle for Pie Charts
  const [pieTimeframe, setPieTimeframe] = useState('weekly');

  const fetchData = () => {
    setLoading(true);
    fetch(`process.env.NEXT_PUBLIC_API_URL/api/analytics/dashboard?month=${selectedMonth}&year=${selectedYear}`)
      .then(res => res.json()).then(data => { setData(data); setLoading(false); });
    fetch("process.env.NEXT_PUBLIC_API_URL/api/tags").then(res => res.json()).then(d => setAvailableTags(d));
  };

  useEffect(() => { fetchData(); }, [selectedMonth, selectedYear]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const formData = new FormData();
    formData.append("file", e.target.files[0]);
    alert("Parsing file... Please wait.");
    try {
      const res = await fetch("process.env.NEXT_PUBLIC_API_URL/api/upload", { method: "POST", body: formData });
      const result = await res.json();
      if (res.ok) {
        setPendingUploads(result.data); // Uploaded data goes straight to Staging Area
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else alert("Upload failed: " + result.error);
    } catch (err) { alert("Error parsing file."); }
  };

  const handleBulkSubmit = async () => {
    try {
      const res = await fetch("process.env.NEXT_PUBLIC_API_URL/api/transactions/bulk", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transactions: pendingUploads })
      });
      if (res.ok) {
        alert("Data successfully saved to database!");
        setPendingUploads(null);
        fetchData();
      }
    } catch (err) { alert("Failed to save to DB"); }
  };

  const handlePendingTagChange = (index: number, tagId: string) => {
    const updated = [...pendingUploads!];
    updated[index].tag_id = tagId;
    setPendingUploads(updated);
  };

  const handleExport = () => window.open(`process.env.NEXT_PUBLIC_API_URL/api/export`);

  if (loading && !data) return <div className="min-h-screen flex items-center justify-center font-bold text-xl">Loading PennyWise Insights... 🚀</div>;

  // 👇 YEH NAYI LINE ADD KARO 👇
  if (data?.error) return <div className="min-h-screen flex items-center justify-center font-bold text-xl text-red-500">Backend Error: {data.error}</div>;


  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const firstDayOffset = new Date(selectedYear, selectedMonth - 1, 1).getDay();
  const blanks = Array.from({ length: firstDayOffset }, (_, i) => i);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const currentPieData = data?.pie_charts?.[pieTimeframe] || [];

  return (
    <div className="min-h-screen flex bg-gray-50 font-sans text-gray-800">

      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r shadow-sm hidden md:block fixed h-full z-10">
        <div className="p-6 border-b">
          <h1 className="text-2xl font-extrabold text-gray-900">PennyWise 💰</h1>
        </div>
        <nav className="p-4 space-y-2">
          <button onClick={() => { setActiveTab('overview'); window.scrollTo(0, 0); }} className={`w-full flex items-center space-x-3 p-3 rounded-lg font-medium transition ${activeTab === 'overview' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'}`}>
            <LayoutDashboard size={20} /> <span>Overview & Calendar</span>
          </button>
          <button onClick={() => { setActiveTab('analytics'); window.scrollTo(0, 0); }} className={`w-full flex items-center space-x-3 p-3 rounded-lg font-medium transition ${activeTab === 'analytics' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'}`}>
            <ChartIcon size={20} /> <span>Deep Analytics</span>
          </button>
        </nav>
      </aside>

      <main className="flex-1 md:ml-64 p-8 flex flex-col space-y-8">

        {/* HEADER */}
        <header className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border">
          <div className="flex space-x-3 bg-gray-50 p-2 rounded-lg border">
            <CalendarIcon size={18} className="text-gray-500 mt-1" />
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="bg-transparent font-bold outline-none cursor-pointer">
              {MONTHS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
            </select>
            <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="bg-transparent font-bold outline-none cursor-pointer">
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex items-center space-x-3">
            <button onClick={handleExport} className="flex items-center bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-900 font-medium transition">
              <Download size={18} className="mr-2" /> Export
            </button>
            <input type="file" accept="application/pdf" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium shadow-sm transition">
              <Upload size={18} className="mr-2" /> Upload Bank PDF
            </button>
          </div>
        </header>

        {/* 🚀 TOP LEVEL: STAGING AREA (Appears only when file is uploaded) */}
        {pendingUploads && (
          <div className="bg-white p-8 rounded-2xl shadow-xl border border-blue-200 w-full animate-in slide-in-from-top-4">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <div>
                <h2 className="text-3xl font-extrabold text-blue-700 flex items-center"><Tag className="mr-3" /> Review & Tag New Transactions</h2>
                <p className="text-gray-500 mt-1">Transactions are sorted latest first. Empty tags will become 'Undefined'.</p>
              </div>
              <button onClick={handleBulkSubmit} className="flex items-center bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 font-bold shadow-lg transition transform hover:scale-105">
                <Save size={20} className="mr-2" /> Submit to Database
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto rounded-lg border">
              <table className="w-full text-left">
                <thead className="bg-gray-100 sticky top-0 shadow-sm">
                  <tr>
                    <th className="p-4 font-semibold">Date</th>
                    <th className="p-4 font-semibold">Remarks</th>
                    <th className="p-4 font-semibold">Amount</th>
                    <th className="p-4 font-semibold">Assign Category</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingUploads.map((txn, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="p-4 text-sm whitespace-nowrap">{txn.date}</td>
                      <td className="p-4 text-sm text-gray-600 truncate max-w-sm">{txn.remarks}</td>
                      <td className="p-4 font-bold text-red-500">₹{txn.amount}</td>
                      <td className="p-4">
                        <select onChange={(e) => handlePendingTagChange(idx, e.target.value)} className="border p-2 rounded-lg text-sm outline-none bg-white cursor-pointer shadow-sm">
                          <option value="">Leave empty (Undefined)</option>
                          {availableTags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- VIEW 1: OVERVIEW --- */}
        {activeTab === 'overview' && data && (
          <div className="flex flex-col space-y-8 w-full animate-in fade-in duration-300">

            {/* HIGHLIGHTS */}
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border flex items-center space-x-6">
                <div className="p-5 bg-red-100 text-red-600 rounded-2xl"><Wallet size={36} /></div>
                <div>
                  <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Total Expense</p>
                  <h2 className="text-4xl font-extrabold text-gray-900 mt-1">₹{data.crux.total}</h2>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border flex items-center space-x-6">
                <div className="p-5 bg-blue-100 text-blue-600 rounded-2xl"><CreditCard size={36} /></div>
                <div>
                  <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Transactions</p>
                  <h2 className="text-4xl font-extrabold text-gray-900 mt-1">{data.crux.txns} Swipes</h2>
                </div>
              </div>
            </div>

            {/* EXPENSE CALENDAR */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border">
              <h3 className="text-2xl font-bold mb-6 flex items-center"><CalendarIcon className="mr-3 text-blue-500" /> Daily Expense Calendar</h3>
              <div className="grid grid-cols-7 gap-3 text-center mb-3 font-bold text-gray-400 text-sm tracking-widest uppercase">
                <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
              </div>
              <div className="grid grid-cols-7 gap-3">
                {blanks.map(b => <div key={`blank-${b}`} className="p-6 rounded-xl bg-gray-50 border border-dashed"></div>)}
                {days.map(day => {
                  const spent = data.calendar[day] || 0;
                  return (
                    <div key={day} className={`p-4 rounded-xl border flex flex-col items-center justify-center transition-all ${spent > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                      <span className="text-lg font-bold text-gray-700">{day}</span>
                      <span className={`text-sm mt-1 font-bold ${spent > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {spent > 0 ? `₹${spent}` : '₹0'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* FULL 30 POINTS NEWS FEED (NO SCROLLBAR) */}
            <div className="bg-gray-900 text-white p-8 rounded-2xl shadow-lg border border-gray-800">
              <h3 className="text-2xl font-bold flex items-center mb-6 text-yellow-400 border-b border-gray-700 pb-4">
                <Bell size={24} className="mr-3" /> Financial Insights & News (Top 30)
              </h3>
              <div className="space-y-3">
                {data.news.map((n: string, i: number) => (
                  <div key={i} className="flex text-sm bg-gray-800 p-4 rounded-xl border border-gray-700 hover:bg-gray-700 transition">
                    <span className="font-bold text-gray-400 w-8 flex-shrink-0">{i + 1}.</span>
                    <p className="font-medium tracking-wide">{n}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* PREVIEW LIST (GROUPED BY DAY/CATEGORY - LATEST FIRST) */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border">
              <h3 className="text-2xl font-bold mb-6 flex items-center"><ListTodo className="mr-3 text-purple-500" /> Recent Tagged Expenses</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="p-4 font-bold text-gray-600">Date</th>
                      <th className="p-4 font-bold text-gray-600">Category</th>
                      <th className="p-4 font-bold text-gray-600">Transactions Count</th>
                      <th className="p-4 font-bold text-gray-600 text-right">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.preview_list.map((item: any, idx: number) => (
                      <tr key={idx} className="border-b hover:bg-gray-50 transition">
                        <td className="p-4 text-sm font-semibold text-gray-700">{item.date}</td>
                        <td className="p-4 text-sm text-gray-600"><span className="bg-gray-200 px-3 py-1 rounded-full">{item.category}</span></td>
                        <td className="p-4 text-sm font-bold text-gray-500">{item.frequency}</td>
                        <td className="p-4 font-extrabold text-red-500 text-right">₹{item.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* --- VIEW 2: DEEP ANALYTICS (6 PIE CHARTS) --- */}
        {activeTab === 'analytics' && data && (
          <div className="flex flex-col space-y-8 w-full animate-in fade-in duration-300">
            <div className="bg-white p-8 rounded-2xl shadow-sm border">
              <div className="flex justify-between items-center mb-8 border-b pb-4">
                <h3 className="text-2xl font-bold">🍕 Categorical Breakdown</h3>

                {/* TOGGLE FOR PIE CHARTS */}
                <div className="flex bg-gray-100 p-1 rounded-lg">
                  {['weekly', 'monthly', 'yearly'].map(t => (
                    <button
                      key={t} onClick={() => setPieTimeframe(t)}
                      className={`px-6 py-2 rounded-md font-bold capitalize transition ${pieTimeframe === t ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

                {/* Chart 1: AMOUNT vs TAG */}
                <div className="flex flex-col items-center">
                  <h4 className="font-bold text-lg text-gray-700 mb-4 uppercase tracking-widest">{pieTimeframe} Amount vs Tag</h4>
                  <div className="w-full h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={currentPieData} dataKey="total_amount" nameKey="name" cx="50%" cy="50%" outerRadius={110} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                          {currentPieData.map((entry: any, index: number) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <RechartsTooltip formatter={(value: number) => `₹${value}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 2: FREQUENCY vs TAG */}
                <div className="flex flex-col items-center">
                  <h4 className="font-bold text-lg text-gray-700 mb-4 uppercase tracking-widest">{pieTimeframe} Frequency vs Tag</h4>
                  <div className="w-full h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={currentPieData} dataKey="frequency" nameKey="name" cx="50%" cy="50%" outerRadius={110} label={({ name, value }) => `${name} (${value})`}>
                          {currentPieData.map((entry: any, index: number) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <RechartsTooltip formatter={(value: number) => `${value} Swipes`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}