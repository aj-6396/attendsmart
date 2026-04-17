
$teacherDashPath = "c:\Users\Dell\Desktop\classmark\attendsmart\src\components\TeacherDashboard.tsx"
$appPath = "c:\Users\Dell\Desktop\classmark\attendsmart\src\App.tsx"

# 1. Update TeacherDashboard.tsx Student List Buttons
$teacherContent = Get-Content $teacherDashPath -Raw
$oldButton = '<button onClick={() => setResettingUserId(student.id)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors">\s+<Key className="w-5 h-5" />\s+</button>'
$newButton = '<button onClick={() => handleResetDevice(student.id)} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors" title="Reset Device Link"><Smartphone className="w-5 h-5" /></button><button onClick={() => setResettingUserId(student.id)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors" title="Reset Password"><Key className="w-5 h-5" /></button>'
$teacherContent = $teacherContent -replace $oldButton, $newButton
Set-Content $teacherDashPath $teacherContent

# 2. Update App.tsx Login Error Message
$appContent = Get-Content $appPath -Raw
$oldError = "Login denied: Your account is registered to another device. Contact your teacher or admin to reset your device link."
$newError = 'Device Mismatch: Your account is locked to another device (likely the smartphone you used during registration). If you changed your phone, please ask your teacher to \"Reset Your Device Link\" during class.'
$appContent = $appContent.Replace($oldError, $newError)

# 3. Add App.tsx Registration Warning
$oldFormStart = '<form onSubmit={handleRegister} className="space-y-4">'
$newFormStart = "<form onSubmit={handleRegister} className=`"space-y-4`"><div className=`"bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-4 flex items-start gap-3`"><Smartphone className=`"w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5`" /><div><p className=`"text-[11px] font-bold text-amber-500 uppercase tracking-wider`">Device Binding Notice</p><p className=`"text-xs text-amber-200/70 mt-1 leading-relaxed`">For security, your account will be locked to the **first device you use to mark attendance**. Please register and log in using the smartphone you plan to carry to class.</p></div></div>"
$appContent = $appContent.Replace($oldFormStart, $newFormStart)

Set-Content $appPath $appContent
