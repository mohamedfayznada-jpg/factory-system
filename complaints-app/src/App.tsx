import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { ArrowRight, Bell, CheckCircle2, ChevronLeft, CircleHelp, ClipboardList, FileText, LockKeyhole, LogIn, MessageCircle, Plus, Search, ShieldCheck, UserRound, X } from 'lucide-react';
import { supabase, supabaseConfigured } from './lib/supabase';

type Employee = { id: string; sap_no: string; full_name: string; department?: string | null; section?: string | null; job_title?: string | null; shift?: string | null };
type Complaint = { id: string; subject: string; body: string; status: 'new' | 'in_review' | 'answered' | 'closed'; created_at: string; replies?: { body: string; created_at: string }[] };
const statusLabel: Record<Complaint['status'], string> = { new: 'جديدة', in_review: 'قيد المراجعة', answered: 'تم الرد', closed: 'مغلقة' };

export default function App() {
  const [sap, setSap] = useState('');
  const [portalToken, setPortalToken] = useState('');
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [showHistoryConfirm, setShowHistoryConfirm] = useState(false);
  const [historyVerified, setHistoryVerified] = useState(false);
  const [hireDate, setHireDate] = useState('');
  const [view, setView] = useState<'home' | 'employee' | 'admin'>('home');
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminSap, setAdminSap] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [allComplaints, setAllComplaints] = useState<(Complaint & { employee?: Employee })[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newBody, setNewBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const filtered = useMemo(() => allComplaints.filter(c => {
    const matchesSearch = !search || [c.subject, c.body, c.employee?.full_name, c.employee?.sap_no].some(v => (v ?? '').toLowerCase().includes(search.toLowerCase()));
    return matchesSearch && (statusFilter === 'all' || c.status === statusFilter);
  }), [allComplaints, search, statusFilter]);

  async function findEmployee() {
    setError(''); setNotice('');
    if (!/^\d{3,12}$/.test(sap.trim())) { setError('اكتب رقم SAP صحيحًا.'); return; }
    if (!supabase || !supabaseConfigured) { setError('التطبيق مربوط بواجهة Supabase، لكن إعدادات المشروع لم تُضف بعد.'); return; }
    setBusy(true);
    try {
      const { data: login, error: loginError } = await supabase.rpc('portal_login', { p_login_id: sap.trim(), p_password: '' });
      if (loginError) throw loginError;
      if (!login?.authorized || login?.role !== 'employee') throw new Error('رقم SAP غير صحيح أو غير مسجل.');
      setPortalToken(login.token);
      const { data, error: rpcError } = await supabase.rpc('employee_portal_lookup', { p_sap_no: sap.trim(), p_token: login.token });
      if (rpcError) throw rpcError;
      if (!data?.employee) throw new Error('لم يتم العثور على العامل. راجع رقم SAP مع شؤون العاملين.');
      setEmployee(data.employee as Employee);
      setComplaints([]);
      setShowHistoryConfirm(false); setHistoryVerified(false); setHireDate('');
      setView('employee');
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر تحميل البيانات.'); }
    finally { setBusy(false); }
  }

  async function loadHistoricalComplaints() {
    setError(''); setNotice('');
    if (!hireDate) { setError('اكتب تاريخ تعيينك أولًا.'); return; }
    if (!supabase || !employee) { setError('تعذر الاتصال بقاعدة البيانات.'); return; }
    setBusy(true);
    try {
      const { data, error: historyError } = await supabase.rpc('employee_historical_complaints', {
        p_sap_no: employee.sap_no, p_token: portalToken, p_hire_date: hireDate
      });
      if (historyError) throw historyError;
      setComplaints((data ?? []) as Complaint[]);
      setHistoryVerified(true);
      setShowHistoryConfirm(false);
      setNotice('تم التأكد من تاريخ التعيين. يمكنك الآن مشاهدة شكاواك السابقة.');
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر التحقق من تاريخ التعيين.'); }
    finally { setBusy(false); }
  }

  async function submitComplaint() {
    setError(''); setNotice('');
    if (!newSubject.trim() || !newBody.trim()) { setError('اكتب عنوان الشكوى وتفاصيلها.'); return; }
    if (!supabase || !employee) { setError('يلزم إعداد قاعدة البيانات والتحقق من هوية العامل أولًا.'); return; }
    setBusy(true);
    try {
      const { data, error: insertError } = await supabase.rpc('employee_submit_complaint', { p_sap_no: employee.sap_no, p_token: portalToken, p_subject: newSubject.trim(), p_body: newBody.trim() });
      if (insertError) throw insertError;
      setComplaints(prev => [data as Complaint, ...prev]);
      setNewSubject(''); setNewBody(''); setNotice('تم إرسال الشكوى بنجاح.');
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر إرسال الشكوى.'); }
    finally { setBusy(false); }
  }

  async function adminLogin() {
    setError(''); setNotice('');
    if (!supabase || !adminSap.trim() || !adminPassword) { setError('أدخل رقم SAP وكلمة المرور بعد إعداد Supabase.'); return; }
    setBusy(true);
    try {
      const { data, error: authError } = await supabase.rpc('portal_login', { p_login_id: adminSap.trim(), p_password: adminPassword });
      if (authError) throw authError;
      if (!data?.authorized || data?.role !== 'admin') throw new Error('بيانات دخول المسؤول غير صحيحة.');
      setPortalToken(data.token);
      setAdminAuthed(true); setView('admin'); setAdminOpen(false);
      await loadAdminComplaints(data.token);
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر تسجيل الدخول.'); }
    finally { setBusy(false); }
  }

  async function loadAdminComplaints(token = portalToken) {
    if (!supabase) return;
    const { data, error: loadError } = await supabase.rpc('admin_list_complaints', { p_token: token });
    if (loadError) { setError(loadError.message); return; }
    setAllComplaints((data ?? []) as (Complaint & { employee?: Employee })[]);
  }

  async function importEmployees() {
    setError(''); setNotice(''); setImportProgress('');
    if (!supabase || !adminAuthed || !portalToken) { setError('سجّل دخولك كمسؤول أولًا.'); return; }
    if (!importFile) { setError('اختر ملف Excel أولًا.'); return; }
    setBusy(true);
    try {
      const buffer = await importFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const sheet = workbook.Sheets['المصنع'] || workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error('الملف لا يحتوي على ورقة بيانات.');
      const matrix = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '', raw: false });
      const headerIndex = matrix.findIndex(row => row.some((v: any) => String(v).includes('رقم الساب')));
      if (headerIndex < 0) throw new Error('لم أجد عمود رقم الساب في الملف.');
      const headers = matrix[headerIndex].map((v: any) => String(v ?? '').trim());
      const normalizeHeader = (v: any) => String(v ?? '').replace(/[ـ\u0640\sًٌٍَُِّْ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').toLowerCase();
      const normalizedHeaders = headers.map(normalizeHeader);
      const col = (...parts: string[]) => normalizedHeaders.findIndex((h: string) => parts.some(p => h.includes(normalizeHeader(p))));
      // Prefer header matching, with known workbook column positions as a safe fallback.
      const sapIdx = col('رقم الساب', 'رقمSAP', 'SAP');
      const nameIdx = col('الاسم', 'الإسم', 'اسم العامل', 'اسم الموظف');
      const deptIdx = col('الإدارة'), sectionIdx = col('القسم'), jobIdx = col('الوظيفه', 'الوظيفة'), shiftIdx = col('الورديه', 'الوردية'), hireIdx = col('تاريخ التعيين');
      const resolvedSapIdx = sapIdx >= 0 ? sapIdx : 1;
      const resolvedNameIdx = nameIdx >= 0 ? nameIdx : 2;
      if (!headers[resolvedSapIdx] || !headers[resolvedNameIdx]) throw new Error('لم أستطع تحديد عمودي SAP والاسم. تأكد من اختيار ورقة المصنع.');

      const asText = (v: any) => v instanceof Date ? v.toISOString().slice(0,10) : String(v ?? '').trim();
      const asISODate = (v: any) => {
        if (v instanceof Date) return v.toISOString().slice(0,10);
        const s = String(v ?? '').trim();
        if (!s) return '';
        if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
          const [y,m,d] = s.split('-'); return y + '-' + m.padStart(2,'0') + '-' + d.padStart(2,'0');
        }
        const m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
        if (m) return m[3] + '-' + m[2].padStart(2,'0') + '-' + m[1].padStart(2,'0');
        return s;
      };
      const rows = matrix.slice(headerIndex + 1).map((r: any[], i: number) => ({
        sap_no: asText(r[resolvedSapIdx]).replace(/\.0$/, ''),
        full_name: asText(r[resolvedNameIdx]),
        department: deptIdx >= 0 ? asText(r[deptIdx]) : '',
        section: sectionIdx >= 0 ? asText(r[sectionIdx]) : '',
        job_title: jobIdx >= 0 ? asText(r[jobIdx]) : '',
        shift: shiftIdx >= 0 ? asText(r[shiftIdx]) : '',
        hire_date: hireIdx >= 0 ? asISODate(r[hireIdx]) : '',
        source_row: headerIndex + i + 2
      })).filter((r: any) => r.sap_no && r.full_name);
      const unique = new Map<string, any>();
      for (const row of rows) unique.set(row.sap_no, row);
      const data = [...unique.values()];
      if (!data.length) throw new Error('لم أجد سجلات موظفين صالحة للاستيراد.');
      let processed = 0;
      for (let i = 0; i < data.length; i += 100) {
        const batch = data.slice(i, i + 100);
        const { data: result, error: rpcError } = await supabase.rpc('admin_import_employees', { p_token: portalToken, p_rows: batch });
        if (rpcError) throw new Error('فشل رفع الدفعة ' + (Math.floor(i / 100) + 1) + ': ' + rpcError.message);
        processed += Number(result?.processed ?? batch.length);
        setImportProgress('تمت معالجة ' + processed + ' من ' + data.length + ' سجلًا…');
      }
      setNotice('اكتمل الاستيراد: ' + processed + ' سجلًا.'); setImportProgress('اكتمل الاستيراد: ' + processed + ' سجلًا.'); setImportFile(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر استيراد الملف.'); }
    finally { setBusy(false); }
  }

  async function sendReply(id: string) {
    const body = replyDrafts[id]?.trim();
    if (!body || !supabase) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const { error: replyError } = await supabase.rpc('admin_reply_to_complaint', { p_token: portalToken, p_complaint_id: id, p_reply: body });
      if (replyError) throw replyError;
      setReplyDrafts(prev => ({ ...prev, [id]: '' }));
      setNotice('تم حفظ الرد.'); await loadAdminComplaints();
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر حفظ الرد.'); }
    finally { setBusy(false); }
  }

  async function changeStatus(id: string, status: Complaint['status']) {
    if (!supabase) return;
    setBusy(true); setError('');
    try {
      const { error: statusError } = await supabase.rpc('admin_update_complaint_status', { p_token: portalToken, p_complaint_id: id, p_status: status });
      if (statusError) throw statusError;
      await loadAdminComplaints(); setNotice('تم تحديث حالة الشكوى.');
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر تحديث الحالة.'); }
    finally { setBusy(false); }
  }

  const goHome = () => { setView('home'); setEmployee(null); setAdminAuthed(false); setError(''); setNotice(''); };

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand-mark"><MessageCircle size={24} strokeWidth={2.4}/></div>
      <div className="brand-copy"><strong>شكاوى العاملين</strong><span>صوتك مسموع • وحقك محفوظ</span></div>
      <button className="icon-button" aria-label="معلومات" onClick={() => setNotice('نظام داخلي لتقديم الشكاوى ومتابعة الردود.') }><CircleHelp size={21}/></button>
    </header>

    <main className="main-content">
      {view === 'home' && <>
        <section className="hero-card">
          <div className="hero-top"><span className="eyebrow">EMPLOYEE CARE</span><span className="hero-icon"><ClipboardList size={26}/></span></div>
          <h1>رأيك يفرق.<br/><em>وشكواك تهمنا.</em></h1>
          <p>قدّم شكواك وتابع الرد عليها بكل سهولة وخصوصية.</p>
          <div className="hero-stripe"><span/><span/><span/></div>
        </section>
        <section className="panel login-panel">
          <div className="section-heading"><div className="heading-icon"><UserRound size={20}/></div><div><h2>دخول العامل</h2><p>اكتب رقم SAP لعرض بياناتك</p></div></div>
          <label htmlFor="sap">رقم SAP</label>
          <div className="input-wrap"><UserRound size={18}/><input id="sap" inputMode="numeric" autoComplete="off" value={sap} onChange={e => setSap(e.target.value.replace(/\D/g,''))} onKeyDown={e => e.key === 'Enter' && findEmployee()} placeholder="مثال: 123456"/></div>
          <button className="primary-button" disabled={busy} onClick={findEmployee}>{busy ? 'جارٍ التحقق…' : 'عرض بياناتي'}<ChevronLeft size={19}/></button>
          <button className="admin-link" onClick={() => {setAdminOpen(true); setError('');}}> <ShieldCheck size={17}/> دخول المسؤول</button>
        </section>
        <div className="privacy-note"><LockKeyhole size={17}/><span>بيانات العامل وشكاواه مخصصة له فقط، وفق صلاحيات النظام.</span></div>
      </>}

      {view === 'employee' && employee && <section className="stack">
        <button className="back-link" onClick={goHome}><ArrowRight size={18}/> رجوع</button>
        <section className="panel profile-card">
          <div className="profile-avatar"><UserRound size={27}/></div><div className="profile-main"><span className="eyebrow">بيانات العامل</span><h1>{employee.full_name}</h1><p>رقم SAP: <b>{employee.sap_no}</b></p></div>
          <CheckCircle2 className="verified" size={22}/>
          <div className="profile-details">
            <div><span>الإدارة</span><b>{employee.department || '—'}</b></div>
            <div><span>القسم</span><b>{employee.section || '—'}</b></div>
            <div><span>الوظيفة</span><b>{employee.job_title || '—'}</b></div>
            <div><span>الوردية</span><b>{employee.shift || '—'}</b></div>
          </div>
        </section>
        <section className="panel">
          <div className="section-heading"><div className="heading-icon coral"><Plus size={20}/></div><div><h2>تقديم شكوى جديدة</h2><p>اكتب التفاصيل بوضوح حتى نقدر نساعدك</p></div></div>
          <label htmlFor="subject">عنوان الشكوى</label><input id="subject" value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="ملخص قصير للشكوى"/>
          <label htmlFor="body">تفاصيل الشكوى</label><textarea id="body" rows={4} value={newBody} onChange={e => setNewBody(e.target.value)} placeholder="اكتب شكواك هنا…"/>
          <button className="primary-button" disabled={busy} onClick={submitComplaint}>{busy ? 'جارٍ الإرسال…' : 'إرسال الشكوى'}<ChevronLeft size={19}/></button>
        </section>
        <section className="panel">
          <div className="section-heading"><div className="heading-icon gold"><FileText size={20}/></div><div><h2>شكاواي السابقة</h2><p>{historyVerified ? `${complaints.length} شكوى مسجلة` : 'تأكيد إضافي قبل عرض الشكاوى'}</p></div></div>
          {!historyVerified ? <>
            <div className="privacy-note"><LockKeyhole size={17}/><span>لحماية خصوصيتك، أكّد تاريخ تعيينك قبل عرض الشكاوى السابقة.</span></div>
            {!showHistoryConfirm ? <button className="primary-button" onClick={() => {setShowHistoryConfirm(true); setHireDate('');}}>عرض شكاواي السابقة<ChevronLeft size={19}/></button> : <>
              <label htmlFor="hire-date">تاريخ التعيين</label>
              <input id="hire-date" type="date" value={hireDate} onChange={e => setHireDate(e.target.value)} max={new Date().toISOString().slice(0,10)} />
              <button className="primary-button" disabled={busy || !hireDate} onClick={loadHistoricalComplaints}>{busy ? 'جارٍ التحقق…' : 'تأكيد ومشاهدة الشكاوى'}<ShieldCheck size={18}/></button>
              <button className="admin-link" onClick={() => setShowHistoryConfirm(false)}>إلغاء</button>
            </>}
          </> : <>
            {complaints.length === 0 ? <div className="empty-state"><ClipboardList size={28}/><b>مفيش شكاوى سابقة</b><span>أي شكوى تقدمها هتظهر هنا لمتابعة حالتها.</span></div> : <div className="complaint-list">{complaints.map(c => <article className="complaint-card" key={c.id}><div className="complaint-top"><span className={'status status-' + c.status}>{statusLabel[c.status]}</span><time>{new Date(c.created_at).toLocaleDateString('ar-EG')}</time></div><h3>{c.subject}</h3><p>{c.body}</p>{c.replies?.map((r,i) => <div className="reply-box" key={i}><b><MessageCircle size={15}/> رد المسؤول</b><p>{r.body}</p><small>{new Date(r.created_at).toLocaleDateString('ar-EG')}</small></div>)}</article>)}</div>}
          </>}
        </section>
      </section>}

      {view === 'admin' && adminAuthed && <section className="stack">
        <div className="admin-title"><div><span className="eyebrow">ADMIN CONTROL</span><h1>إدارة الشكاوى</h1><p>متابعة الشكاوى والردود</p></div><button className="icon-button" onClick={goHome}><X size={20}/></button></div>
        <section className="panel">
          <div className="section-heading"><div className="heading-icon gold"><FileText size={20}/></div><div><h2>استيراد بيانات العاملين</h2><p>رفع ملف Excel وتحديث سجلات العاملين حسب رقم SAP</p></div></div>
          <label htmlFor="employee-import">ملف Excel (.xlsx / .xls / .csv)</label>
          <input id="employee-import" type="file" accept=".xlsx,.xls,.csv" onChange={e=>setImportFile(e.target.files?.[0] ?? null)} />
          <p className="privacy-note"><LockKeyhole size={17}/><span>تُقرأ البيانات داخل المتصفح وتُرفع على دفعات. السجلات ذات رقم SAP الموجود تُحدّث بدلًا من تكرارها.</span></p>
          <button className="primary-button" disabled={busy || !importFile} onClick={importEmployees}>{busy ? 'جارٍ الاستيراد…' : 'استيراد ملف العاملين'}<ArrowRight size={18}/></button>
          {importProgress && <p>{importProgress}</p>}
        </section>
        <div className="stats-row"><div><span>إجمالي الشكاوى</span><b>{allComplaints.length}</b></div><div><span>جديدة</span><b>{allComplaints.filter(c=>c.status==='new').length}</b></div><div><span>قيد المراجعة</span><b>{allComplaints.filter(c=>c.status==='in_review').length}</b></div></div>
        <div className="filter-row"><div className="input-wrap search-wrap"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="بحث بالاسم أو SAP أو الشكوى"/></div><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">كل الحالات</option><option value="new">جديدة</option><option value="in_review">قيد المراجعة</option><option value="answered">تم الرد</option><option value="closed">مغلقة</option></select></div>
        {filtered.length === 0 ? <div className="empty-state panel"><ClipboardList size={28}/><b>لا توجد شكاوى مطابقة</b></div> : filtered.map(c=><article className="panel admin-complaint" key={c.id}><div className="complaint-top"><span className={'status status-' + c.status}>{statusLabel[c.status]}</span><time>{new Date(c.created_at).toLocaleString('ar-EG')}</time></div><h3>{c.subject}</h3><p>{c.body}</p><div className="worker-chip"><UserRound size={16}/><b>{c.employee?.full_name || 'عامل'}</b><span>SAP: {c.employee?.sap_no || '—'}</span></div><label>حالة الشكوى</label><select value={c.status} onChange={e=>changeStatus(c.id,e.target.value as Complaint['status'])}><option value="new">جديدة</option><option value="in_review">قيد المراجعة</option><option value="answered">تم الرد</option><option value="closed">مغلقة</option></select><label>الرد على الشكوى</label><textarea rows={3} value={replyDrafts[c.id] ?? ''} onChange={e=>setReplyDrafts(prev=>({...prev,[c.id]:e.target.value}))} placeholder="اكتب الرد هنا…"/><button className="primary-button" disabled={busy || !replyDrafts[c.id]?.trim()} onClick={()=>sendReply(c.id)}>حفظ الرد<ChevronLeft size={19}/></button></article>)}
      </section>}
    </main>

    <footer className="footer"><span className="footer-dot"/><span>بوابة شكاوى العاملين</span><span className="footer-divider">•</span><span>بخصوصية ومسؤولية</span></footer>

    {notice && <div className="toast success-toast"><CheckCircle2 size={18}/><span>{notice}</span><button onClick={()=>setNotice('')}><X size={16}/></button></div>}
    {error && <div className="toast error-toast"><Bell size={18}/><span>{error}</span><button onClick={()=>setError('')}><X size={16}/></button></div>}

    {adminOpen && <div className="modal-backdrop" onClick={()=>setAdminOpen(false)}><section className="modal panel" onClick={e=>e.stopPropagation()}><button className="modal-close icon-button" onClick={()=>setAdminOpen(false)}><X size={20}/></button><div className="modal-icon"><ShieldCheck size={25}/></div><span className="eyebrow">AUTHORIZED ACCESS</span><h2>دخول المسؤول</h2><p>هذه المنطقة مخصصة للمسؤول المعتمد فقط.</p><label htmlFor="admin-sap">رقم SAP للمسؤول</label><input id="admin-sap" value={adminSap} onChange={e=>setAdminSap(e.target.value.replace(/\D/g,''))} inputMode="numeric" placeholder="رقم SAP"/><label htmlFor="admin-password">كلمة المرور</label><input id="admin-password" type="password" value={adminPassword} onChange={e=>setAdminPassword(e.target.value)} placeholder="كلمة المرور" onKeyDown={e=>e.key==='Enter'&&adminLogin()}/><button className="primary-button" disabled={busy} onClick={adminLogin}>{busy?'جارٍ التحقق…':'تسجيل الدخول'}<LogIn size={18}/></button></section></div>}
  </div>;
}