const fs = require('fs');

let teacherDashboard = fs.readFileSync('src/components/TeacherDashboard.tsx', 'utf-8').replace(/\r\n/g, '\n');

// 1. Add Class icon imports
teacherDashboard = teacherDashboard.replace(/import { Plus, Users, /, "import { Plus, Users, Folder, Link, LogOut, ArrowLeft as ArrowLeftIcon, ");

// 2. Add class-related states
teacherDashboard = teacherDashboard.replace(
  /const \[activeTab, setActiveTab\] = useState<\'session\' \| \'records\'>\(\'session\'\);/,
  `const [classes, setClasses] = useState<any[]>([]);
  const [activeClass, setActiveClass] = useState<any | null>(null);
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [activeTab, setActiveTab] = useState<'session' | 'records'>('session');`
);

// 3. Update fetchSessions to use activeClass
teacherDashboard = teacherDashboard.replace(
  /\.eq\(\'teacher_id\', user\.id\)/g,
  `.eq('class_id', activeClass?.id || '00000000-0000-0000-0000-000000000000')`
);

// 4. Add fetchClasses effect
teacherDashboard = teacherDashboard.replace(
  /useEffect\(\(\) => {\n    const fetchSessions = async \(\) => {/g,
  `useEffect(() => {
    const fetchClasses = async () => {
      const { data: myClasses } = await supabase.from('classes').select('*').eq('created_by', user.id);
      const { data: coClasses } = await supabase.from('class_teachers').select('class_id, classes(*)').eq('teacher_id', user.id);
      const all: any[] = [...(myClasses || [])];
      if (coClasses) {
        coClasses.forEach((ct: any) => {
          if (ct.classes && !all.find(c => c.id === ct.classes.id)) all.push(ct.classes);
        });
      }
      setClasses(all);
    };
    fetchClasses();
  }, [user.id]);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { data, error } = await supabase.from('classes').insert({
       name: newClassName,
       join_code: code,
       created_by: user.id
    }).select().single();
    
    if (error) setError(error.message);
    else {
       setClasses(prev => [...prev, data]);
       setShowCreateClass(false);
       setNewClassName('');
       setSuccess('Class created successfully! Join code: ' + code);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!activeClass) return;
    const fetchSessions = async () => {`
);

// Subscribe conditionally based on activeClass
teacherDashboard = teacherDashboard.replace(
  /\.on\(\'postgres_changes\', { event: \'\*\', schema: \'public\', table: \'attendance_sessions\', filter: \`teacher_id=eq\.\$\{user\.id\}\` }/g,
  `.on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_sessions', filter: \`class_id=eq.\${activeClass?.id}\` }`
);

// Fix dependencies for realtime subscriptions (activeClass changed)
teacherDashboard = teacherDashboard.replace(
  /  \}, \[user\.id\]\);/g,
  `  }, [user.id, activeClass?.id]);`
);


// 5. Rewrite fetchAllStudentStats entirely
const newStatsFunction = `
  const fetchAllStudentStats = async () => {
    try {
      setLoading(true);
      if (!activeClass) return;

      const { data: enrollments, error: enrollError } = await supabase
        .from('class_enrollments')
        .select('student_id, users!student_id(id, name, student_profiles(enrollment_no, exam_roll_no))')
        .eq('class_id', activeClass.id);

      if (enrollError) throw enrollError;
      
      const enrolledStudents = (enrollments || []).map((e: any) => ({
        id: e.users?.id,
        name: e.users?.name,
        profile: e.users?.student_profiles?.[0]
      })).filter((s: any) => s.id);

      const { data: classSessions, error: sessionError } = await supabase
        .from('attendance_sessions')
        .select('id')
        .eq('class_id', activeClass.id);

      if (sessionError) throw sessionError;
      const sessionIds = (classSessions || []).map((s: any) => s.id);

      const { data: records, error: recordError } = await supabase
        .from('attendance_records')
        .select('student_id, session_id')
        .in('session_id', sessionIds.length > 0 ? sessionIds : ['00000000-0000-0000-0000-000000000000']);

      if (recordError) throw recordError;

      const stats: StudentStats[] = enrolledStudents.map((student: any) => {
        const studentRecords = (records || []).filter((r: any) => r.student_id === student.id);
        const attendedCount = studentRecords.length;
        const totalCount = sessionIds.length;
        return {
          id: student.id,
          name: student.name || 'Unknown',
          enrollment_no: student.profile?.enrollment_no || 'N/A',
          exam_roll_no: student.profile?.exam_roll_no,
          semester: student.profile?.semester,
          major_subject: student.profile?.major_subject,
          total_sessions: totalCount,
          attended_sessions: attendedCount,
          attendance_percentage: totalCount > 0 ? (attendedCount / totalCount) * 100 : 0
        };
      });

      setAllStudents(stats.sort((a: any, b: any) => b.attendance_percentage - a.attendance_percentage));
    } catch (err) {
      console.error('Error fetching student stats:', err);
    } finally {
      setLoading(false);
    }
  };
`;
teacherDashboard = teacherDashboard.replace(/  const fetchAllStudentStats = async \(\) => \{[\s\S]*?  \};\n/m, newStatsFunction);

// 6. Fix create session api payload
teacherDashboard = teacherDashboard.replace(
  /teacherId: user.id,\n\s*lat: pos.latitude,\n\s*lng: pos.longitude,\n\s*accuracy: pos.accuracy/g,
  `teacherId: user.id,\n          classId: activeClass?.id,\n          lat: pos.latitude,\n          lng: pos.longitude,\n          accuracy: pos.accuracy`
);

// 7. Inject Class List UI logic into the render tree
const uiWrapperStart = `
  if (!activeClass) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-900">
            <Folder className="w-6 h-6 text-indigo-600" />
            My Classes
          </h2>
          <button onClick={() => setShowCreateClass(true)} className="btn-gradient px-4 py-2 flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Create Class
          </button>
        </div>

        {showCreateClass && (
          <div className="glass-card p-6 border-indigo-100">
            <h3 className="font-bold mb-4">Create New Class</h3>
            <form onSubmit={handleCreateClass} className="flex gap-4">
              <input 
                type="text" 
                value={newClassName} 
                onChange={e => setNewClassName(e.target.value)} 
                placeholder="e.g. Physics 101 - Semester 1" 
                className="field-input flex-1" 
                required 
              />
              <button disabled={loading} type="submit" className="btn-gradient w-32">
                {loading ? <Loader2 className="animate-spin mx-auto"/> : 'Create'}
              </button>
              <button type="button" onClick={() => setShowCreateClass(false)} className="px-4 py-2 border rounded-xl hover:bg-slate-50">Cancel</button>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map(c => (
             <div key={c.id} onClick={() => setActiveClass(c)} className="glass-card p-6 cursor-pointer hover:border-indigo-300 transition-all hover:shadow-xl group">
               <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Folder className="w-6 h-6 text-indigo-600" />
               </div>
               <h3 className="text-lg font-bold text-slate-900 mb-2">{c.name}</h3>
               <div className="flex gap-2">
                 <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded">Code: {c.join_code}</span>
                 {c.created_by !== user.id && <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-1 rounded">Co-Teacher</span>}
               </div>
             </div>
          ))}
          {classes.length === 0 && !showCreateClass && (
             <div className="col-span-full py-12 text-center text-slate-500 italic">
               You haven't created any classes yet.
             </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between bg-white px-6 py-4 rounded-2xl shadow-sm border border-slate-100">
         <div className="flex items-center gap-4">
           <button onClick={() => setActiveClass(null)} className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-slate-600">
              <ArrowLeftIcon className="w-5 h-5" />
           </button>
           <div>
             <h2 className="text-xl font-bold text-slate-900">{activeClass.name}</h2>
             <p className="text-xs text-slate-500 font-mono tracking-wider">Class Code: {activeClass.join_code}</p>
           </div>
         </div>
      </div>
`;

// Replace `return (\n    <div className="space-y-8">` with the new wrapper
teacherDashboard = teacherDashboard.replace(/  return \(\n    <div className="space-y-8">/, uiWrapperStart);

fs.writeFileSync('src/components/TeacherDashboard.tsx', teacherDashboard);
console.log('TeacherDashboard.tsx patched successfully.');
