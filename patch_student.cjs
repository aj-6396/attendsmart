const fs = require('fs');

let studentDashboard = fs.readFileSync('src/components/StudentDashboard.tsx', 'utf-8').replace(/\r\n/g, '\n');

studentDashboard = studentDashboard.replace(/import { MapPin, /, "import { MapPin, Folder, Plus, ArrowLeft as ArrowLeftIcon, ");

studentDashboard = studentDashboard.replace(
  /const \[otp, setOtp\] = useState\(\'\'\);/,
  `const [classes, setClasses] = useState<any[]>([]);
  const [activeClass, setActiveClass] = useState<any | null>(null);
  const [showJoinClass, setShowJoinClass] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [otp, setOtp] = useState('');`
);

// Fetch enrolled classes
studentDashboard = studentDashboard.replace(
  /useEffect\(\(\) => {\n    const fetchHistory = async/,
  `useEffect(() => {
    const fetchClasses = async () => {
      const { data } = await supabase
        .from('class_enrollments')
        .select('class_id, classes(*)')
        .eq('student_id', user.id);
      if (data) {
        setClasses(data.map((d: any) => d.classes).filter(Boolean));
      }
    };
    fetchClasses();
  }, [user.id]);

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: targetClass } = await supabase.from('classes').select('*').eq('join_code', joinCode.toUpperCase()).single();
      if (!targetClass) throw new Error('Invalid class code');
      
      const { error } = await supabase.from('class_enrollments').insert({
        class_id: targetClass.id,
        student_id: user.id
      });
      if (error && error.code !== '23505') throw error; // ignore duplicate
      
      setClasses(prev => [...prev.filter(c => c.id !== targetClass.id), targetClass]);
      setShowJoinClass(false);
      setJoinCode('');
      setStatus({ type: 'success', message: 'Successfully joined ' + targetClass.name });
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeClass) return;
    const fetchHistory = async`
);

// Update fetchHistory to filter by activeClass
const oldFetchHistory = `        const { data: records, error: recordsError } = await supabase
          .from('attendance_records')
          .select(\`
            id,
            session_id,
            created_at,
            attendance_sessions!inner (
              teacher:users!teacher_id (
                name
              )
            )
          \`)
          .eq('student_id', user.id)
          .order('created_at', { ascending: false });

        if (recordsError) throw recordsError;

        // 2. Fetch total sessions available in the system
        // In a real app, this would be filtered by course/batch
        const { count, error: countError } = await supabase
          .from('attendance_sessions')
          .select('*', { count: 'exact', head: true });`;

const newFetchHistory = `        const { data: records, error: recordsError } = await supabase
          .from('attendance_records')
          .select(\`
            id,
            session_id,
            created_at,
            attendance_sessions!inner (
              class_id,
              teacher:users!teacher_id (
                name
              )
            )
          \`)
          .eq('student_id', user.id)
          .eq('attendance_sessions.class_id', activeClass.id)
          .order('created_at', { ascending: false });

        if (recordsError) throw recordsError;

        const { count, error: countError } = await supabase
          .from('attendance_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('class_id', activeClass.id);`;

studentDashboard = studentDashboard.replace(oldFetchHistory, newFetchHistory);

// Fix dependencies for useEffect
studentDashboard = studentDashboard.replace(
  /  \}, \[user\.id\]\);/g,
  `  }, [user.id, activeClass?.id]);`
);


// UI wrapper for classes list
const uiWrapperStart = `
  if (!activeClass) {
    return (
      <div className="space-y-6">
        <AnimatePresence>
          {status.type && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className={status.type === 'success' ? "alert alert--success" : "alert alert--error"}>
              <p className="text-sm font-medium">{status.message}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold flex items-center gap-2 text-[--color-text-primary]">
            <Folder className="w-6 h-6 text-[--color-primary]" />
            My Enrolled Classes
          </h2>
          <button onClick={() => setShowJoinClass(true)} className="btn-gradient px-4 py-2 flex items-center gap-2 w-auto h-10 text-sm">
            <Plus className="w-4 h-4" />
            Join Class
          </button>
        </div>

        {showJoinClass && (
          <div className="glass-card p-6">
            <h3 className="font-bold mb-4 text-[--color-text-primary]">Enter Class Code</h3>
            <form onSubmit={handleJoinClass} className="flex gap-4">
              <input 
                type="text" 
                value={joinCode} 
                onChange={e => setJoinCode(e.target.value.toUpperCase())} 
                placeholder="e.g. A1B2C3" 
                className="field-input flex-1 uppercase tracking-widest font-mono" 
                maxLength={6}
                required 
              />
              <button disabled={loading} type="submit" className="btn-gradient w-32 h-12">
                {loading ? <Loader2 className="animate-spin mx-auto w-5 h-5"/> : 'Join'}
              </button>
              <button type="button" onClick={() => setShowJoinClass(false)} className="px-4 py-2 border rounded-xl hover:bg-slate-50 text-[--color-text-secondary]">Cancel</button>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map(c => (
             <div key={c.id} onClick={() => setActiveClass(c)} className="glass-card p-6 cursor-pointer hover:border-[--color-primary]/50 transition-all hover:shadow-xl group">
               <div className="w-12 h-12 rounded-xl bg-[--color-primary]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Folder className="w-6 h-6 text-[--color-primary]" />
               </div>
               <h3 className="text-lg font-bold text-[--color-text-primary] mb-2">{c.name}</h3>
             </div>
          ))}
          {classes.length === 0 && !showJoinClass && (
             <div className="col-span-full py-12 text-center text-[--color-text-secondary] italic">
               You haven't joined any classes yet. Click 'Join Class' to enter a code.
             </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-3 mb-[-1rem]">
         <div className="flex items-center justify-between bg-white px-6 py-4 rounded-2xl shadow-sm border border-slate-100">
           <div className="flex items-center gap-4">
             <button onClick={() => { setActiveClass(null); setStatus({ type: null, message: '' }); }} className="p-2 hover:bg-slate-50 rounded-lg text-[--color-text-secondary] hover:text-[--color-primary]">
                <ArrowLeftIcon className="w-5 h-5" />
             </button>
             <div>
               <h2 className="text-xl font-bold text-[--color-text-primary]">{activeClass.name}</h2>
               <p className="text-xs text-[--color-text-secondary]">Class Dashboard</p>
             </div>
           </div>
         </div>
      </div>
`;

studentDashboard = studentDashboard.replace(/  return \(\n    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">/, uiWrapperStart);

fs.writeFileSync('src/components/StudentDashboard.tsx', studentDashboard);
console.log('StudentDashboard.tsx patched successfully.');
