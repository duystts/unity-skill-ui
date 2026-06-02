'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type LangCode = 'vi' | 'en'

// ── Translation strings ───────────────────────────────────────────────────────
const STRINGS = {
  // ── Navigation ──────────────────────────────────────────────────────────────
  'nav.workspace':          { vi: 'Không gian làm việc', en: 'Workspace' },
  'nav.menu':               { vi: 'Menu',                en: 'Menu' },
  'nav.projects':           { vi: 'Dự án',               en: 'Projects' },
  'nav.mytickets':          { vi: 'Ticket của tôi',      en: 'My tickets' },
  'nav.workload':           { vi: 'Khối lượng',           en: 'Workload' },
  'nav.teamhealth':         { vi: 'Sức khỏe nhóm',       en: 'Team health' },
  'nav.blocked':            { vi: 'Quyết định bị chặn',  en: 'Blocked decisions' },
  'nav.skillprofile':       { vi: 'Hồ sơ kỹ năng',       en: 'Skill profile' },
  'nav.members':            { vi: 'Thành viên',           en: 'Members' },
  // ── Topbar / UserMenu ───────────────────────────────────────────────────────
  'topbar.allworkspaces':   { vi: 'Tất cả workspace',    en: 'All workspaces' },
  'topbar.skillprofile':    { vi: 'Hồ sơ kỹ năng',       en: 'Skill profile' },
  'topbar.switchworkspace': { vi: 'Đổi workspace',        en: 'Switch workspace' },
  'topbar.accountsettings': { vi: 'Cài đặt tài khoản',   en: 'Account settings' },
  'topbar.keyboardshortcuts':{ vi: 'Phím tắt',            en: 'Keyboard shortcuts' },
  'topbar.logout':          { vi: 'Đăng xuất',            en: 'Log out' },
  'topbar.switchws':        { vi: 'Đổi workspace',        en: 'Switch workspace' },
  // ── Notifications ───────────────────────────────────────────────────────────
  'notif.title':            { vi: 'Thông báo',             en: 'Notifications' },
  'notif.markallread':      { vi: 'Đánh dấu đã đọc',      en: 'Mark all read' },
  'notif.empty':            { vi: 'Chưa có thông báo',    en: 'No notifications yet' },
  // ── Workspace select ────────────────────────────────────────────────────────
  'ws.welcome':             { vi: 'Chào mừng trở lại',    en: 'Welcome back' },
  'ws.choosetitle':         { vi: 'Chọn workspace',       en: 'Choose a workspace' },
  'ws.createnew':           { vi: 'Tạo workspace mới',    en: 'Create a new workspace' },
  'ws.createsub':           { vi: 'Bắt đầu cho nhóm hoặc dự án mới', en: 'Start fresh for a new team or project' },
  'ws.switchws':            { vi: 'Đổi workspace',        en: 'Switch workspace' },
  // ── Settings ────────────────────────────────────────────────────────────────
  'settings.title':         { vi: 'Cài đặt',              en: 'Settings' },
  'settings.profile':       { vi: 'Hồ sơ',                en: 'Profile' },
  'settings.notifications': { vi: 'Thông báo',             en: 'Notifications' },
  'settings.appearance':    { vi: 'Giao diện',             en: 'Appearance' },
  'settings.security':      { vi: 'Bảo mật',               en: 'Security' },
  'settings.save':          { vi: 'Lưu thay đổi',          en: 'Save changes' },
  'settings.cancel':        { vi: 'Hủy',                   en: 'Cancel' },
  // ── Profile tab ─────────────────────────────────────────────────────────────
  'profile.title':          { vi: 'Hồ sơ',                 en: 'Profile' },
  'profile.sub':            { vi: 'Thông tin này hiển thị trên hồ sơ công khai.', en: 'This information appears on your public portfolio.' },
  'profile.changephoto':    { vi: 'Đổi ảnh',               en: 'Change photo' },
  'profile.removephoto':    { vi: 'Xóa',                   en: 'Remove' },
  'profile.displayName':    { vi: 'Tên hiển thị',          en: 'Display Name' },
  'profile.email':          { vi: 'Email',                  en: 'Email' },
  'profile.jobtitle':       { vi: 'Chức danh',             en: 'Title' },
  'profile.timezone':       { vi: 'Múi giờ',               en: 'Timezone' },
  'profile.bio':            { vi: 'Giới thiệu',            en: 'Bio' },
  'profile.bioPlaceholder': { vi: 'Giới thiệu ngắn về bạn…', en: 'A short bio about you…' },
  // ── Notifications tab ───────────────────────────────────────────────────────
  'notif.settings.title':   { vi: 'Thông báo',             en: 'Notifications' },
  'notif.settings.sub':     { vi: 'Chọn nội dung bạn muốn được thông báo.', en: 'Choose what you want to be notified about.' },
  'notif.ticketassigned':   { vi: 'Ticket được giao cho tôi', en: 'Ticket assigned to me' },
  'notif.ticketassigned.sub':{ vi: 'Khi ai đó giao ticket cho bạn', en: 'When someone assigns a ticket to you' },
  'notif.achievement':      { vi: 'Đạt thành tựu mới',    en: 'Achievement earned' },
  'notif.achievement.sub':  { vi: 'Khi bạn mở khóa thành tựu kỹ năng mới', en: 'When you unlock a new skill achievement' },
  'notif.evidence':         { vi: 'Bằng chứng kỹ năng mới', en: 'Skill evidence pending' },
  'notif.evidence.sub':     { vi: 'Khi AI tạo bằng chứng mới cần xem xét', en: 'When AI generates new evidence to review' },
  'notif.inviteaccepted':   { vi: 'Lời mời được chấp nhận', en: 'Workspace invite accepted' },
  'notif.inviteaccepted.sub':{ vi: 'Khi ai đó tham gia workspace của bạn', en: 'When someone joins your workspace' },
  // ── Appearance tab ──────────────────────────────────────────────────────────
  'appearance.title':       { vi: 'Giao diện',             en: 'Appearance' },
  'appearance.sub':         { vi: 'Tùy chỉnh giao diện unity_skill cho bạn.', en: 'Customize how unity_skill looks for you.' },
  'lang.label':             { vi: 'Ngôn ngữ',              en: 'Language' },
  'lang.sub':               { vi: 'Chọn ngôn ngữ hiển thị ưa thích.', en: 'Select your preferred display language.' },
  // ── Security tab ────────────────────────────────────────────────────────────
  'security.changepwd':     { vi: 'Đổi mật khẩu',         en: 'Change password' },
  'security.setpwd':        { vi: 'Đặt mật khẩu',         en: 'Set a password' },
  'security.currentpwd':    { vi: 'Mật khẩu hiện tại',    en: 'Current password' },
  'security.newpwd':        { vi: 'Mật khẩu mới',         en: 'New password' },
  'security.confirmpwd':    { vi: 'Xác nhận mật khẩu',    en: 'Confirm new password' },
  'security.updatepwd':     { vi: 'Cập nhật mật khẩu',    en: 'Update password' },
  'security.connectedacc':  { vi: 'Tài khoản liên kết',   en: 'Connected accounts' },
  'security.connectedsub':  { vi: 'Các phương thức đăng nhập được liên kết với tài khoản của bạn.', en: 'Login methods linked to your account.' },
  'security.connected':     { vi: 'Đã kết nối',            en: 'Connected' },
  'security.notconnected':  { vi: 'Chưa kết nối',          en: 'Not connected' },
  'security.dangerzone':    { vi: 'Vùng nguy hiểm',        en: 'Danger zone' },
  'security.deleteacc':     { vi: 'Xóa tài khoản',         en: 'Delete account' },
  'security.deleteacc.sub': { vi: 'Xóa vĩnh viễn tài khoản và toàn bộ dữ liệu. Không thể hoàn tác.', en: 'Permanently delete your account and all data. This cannot be undone.' },
  'security.deleteacc.btn': { vi: 'Xóa tài khoản…',       en: 'Delete account…' },
  // ── Kanban / Projects ───────────────────────────────────────────────────────
  'kanban.board':           { vi: 'Bảng Kanban',           en: 'Kanban Board' },
  'kanban.addticket':       { vi: '+ Thêm ticket',         en: '+ Add ticket' },
  'kanban.chat':            { vi: 'Chat',                  en: 'Chat' },
  'kanban.meetings':        { vi: 'Cuộc họp',              en: 'Meetings' },
  'kanban.settings':        { vi: 'Cài đặt',               en: 'Settings' },
  'kanban.live':            { vi: 'trực tiếp',             en: 'live' },
  'kanban.openstages':      { vi: 'Chưa có giai đoạn nào', en: 'No stages configured yet' },
  'kanban.claim':           { vi: 'Nhận việc',             en: 'Claim' },
  // ── Projects page ──────────────────────────────────────────────────────────
  'projects.title':         { vi: 'Dự án',                 en: 'Projects' },
  'projects.new':           { vi: '+ Dự án mới',           en: '+ New Project' },
  'projects.active':        { vi: 'Đang hoạt động',        en: 'Active' },
  'projects.archived':      { vi: 'Đã lưu trữ',            en: 'Archived' },
  'projects.empty':         { vi: 'Chưa có dự án nào',     en: 'No active projects yet' },
  'projects.noarchived':    { vi: 'Không có dự án lưu trữ', en: 'No archived projects' },
  'projects.restore':       { vi: 'Khôi phục',             en: 'Restore' },
  // ── My Tickets ──────────────────────────────────────────────────────────────
  'tickets.title':          { vi: 'Ticket của tôi',        en: 'My tickets' },
  'tickets.assigned':       { vi: 'được giao',             en: 'assigned' },
  'tickets.all':            { vi: 'Tất cả',                en: 'All' },
  'tickets.todo':           { vi: 'Cần làm',               en: 'To Do' },
  'tickets.inprogress':     { vi: 'Đang làm',              en: 'In Progress' },
  'tickets.done':           { vi: 'Hoàn thành',            en: 'Done' },
  'tickets.filter':         { vi: 'Lọc',                   en: 'Filter' },
  'tickets.empty':          { vi: 'Không có ticket nào',   en: 'No tickets found' },
  // ── Workload ────────────────────────────────────────────────────────────────
  'workload.title':         { vi: 'Khối lượng công việc',  en: 'Workload' },
  'workload.balanced':      { vi: 'Cân bằng',              en: 'Balanced' },
  'workload.overloaded':    { vi: 'Quá tải',               en: 'Overloaded' },
  'workload.rebalance':     { vi: 'Cân bằng lại',          en: 'Rebalance' },
  'workload.teamcapacity':  { vi: 'Năng lực nhóm',         en: 'Team capacity' },
  'workload.opentickets':   { vi: 'Ticket đang mở',        en: 'Open tickets' },
  'workload.members':       { vi: 'Thành viên',            en: 'Members' },
  'workload.open':          { vi: 'đang mở',               en: 'open' },
  // ── Team Health ─────────────────────────────────────────────────────────────
  'health.title':           { vi: 'Sức khỏe nhóm',         en: 'Team health' },
  'health.healthy':         { vi: 'Khỏe mạnh',             en: 'Healthy' },
  'health.thissprint':      { vi: 'Sprint này',             en: 'This sprint' },
  'health.velocity':        { vi: 'Tốc độ',                en: 'Velocity' },
  'health.cycletime':       { vi: 'Chu kỳ',                en: 'Cycle time' },
  'health.reviewlatency':   { vi: 'Độ trễ review',         en: 'Review latency' },
  'health.blocked':         { vi: 'Bị chặn',               en: 'Blocked' },
  'health.throughput':      { vi: 'Thông lượng',           en: 'Throughput' },
  'health.ticketsclosed':   { vi: 'tickets đóng',          en: 'tickets closed' },
  'health.last8weeks':      { vi: '8 tuần qua',            en: 'last 8 weeks' },
  'health.signals':         { vi: 'Tín hiệu',              en: 'Signals' },
  // ── Blocked Decisions ───────────────────────────────────────────────────────
  'blocked.title':          { vi: 'Quyết định bị chặn',   en: 'Blocked decisions' },
  'blocked.awaiting':       { vi: 'đang chờ',              en: 'awaiting input' },
  'blocked.waitingon':      { vi: 'chờ từ',                en: 'waiting on' },
  'blocked.nudge':          { vi: 'Nhắc nhở',              en: 'Nudge' },
  'blocked.resolve':        { vi: 'Giải quyết',            en: 'Resolve' },
  // ── Members ─────────────────────────────────────────────────────────────────
  'members.title':          { vi: 'Thành viên',            en: 'Members' },
  'members.people':         { vi: 'người',                 en: 'people' },
  'members.invite':         { vi: 'Mời',                   en: 'Invite' },
  'members.online':         { vi: 'online',                en: 'online' },
  'members.open':           { vi: 'đang mở',               en: 'open' },
  'members.load':           { vi: 'tải',                   en: 'load' },
  // ── Skill Profile ───────────────────────────────────────────────────────────
  'skillprofile.back':      { vi: '← quay lại',           en: '← back' },
  'skillprofile.live':      { vi: 'trực tiếp',             en: 'live' },
  'skillprofile.synced':    { vi: 'đã đồng bộ',           en: 'synced' },
  'skillprofile.publicportfolio': { vi: 'Hồ sơ công khai', en: 'Public portfolio' },
  'skillprofile.ticketsclosed':   { vi: 'tickets đã đóng',  en: 'tickets closed' },
  'skillprofile.avgclosetime':    { vi: 'thời gian đóng trung bình', en: 'avg close time' },
  'skillprofile.currentstreak':   { vi: 'chuỗi hiện tại',  en: 'current streak' },
  'skillprofile.achievements':    { vi: 'thành tựu',        en: 'achievements' },
  'skillprofile.pinnedprojects':  { vi: 'Dự án đóng góp',  en: 'Project Contributions' },
  'skillprofile.skilltags':       { vi: 'Nhãn kỹ năng',    en: 'Skill Tags' },
  'skillprofile.unlockedbytags':  { vi: 'Mở khóa bởi thành tựu · hiện trên hồ sơ công khai', en: 'Unlocked by tag-based achievements · shown on your public portfolio' },
  'skillprofile.pendingreview':   { vi: 'Chờ xem xét',     en: 'Pending Review' },
  'skillprofile.waiting':         { vi: 'đang chờ',         en: 'waiting' },
  'skillprofile.approve':         { vi: 'Duyệt',            en: 'Approve' },
  'skillprofile.reject':          { vi: 'Từ chối',          en: 'Reject' },
  'skillprofile.noactivity':      { vi: 'Chưa có hoạt động', en: 'No activity yet' },
  'skillprofile.noactivity.sub':  { vi: 'Được giao ticket và kết nối GitHub để bắt đầu xây dựng hồ sơ', en: 'Get assigned to tickets and connect GitHub to start building your profile' },
  // ── Workspace select ────────────────────────────────────────────────────────
  'ws.belongs':             { vi: 'Bạn có',                en: 'You belong to' },
  'ws.workspaces':          { vi: 'workspace',             en: 'workspaces' },
  'ws.pickone':             { vi: 'Chọn một để tiếp tục.', en: 'Pick one to jump back in.' },
  // ── Common ──────────────────────────────────────────────────────────────────
  'common.save':            { vi: 'Lưu',                   en: 'Save' },
  'common.cancel':          { vi: 'Hủy',                   en: 'Cancel' },
  'common.edit':            { vi: 'Chỉnh sửa',             en: 'Edit' },
  'common.delete':          { vi: 'Xóa',                   en: 'Delete' },
  'common.confirm':         { vi: 'Xác nhận',              en: 'Confirm' },
  'common.close':           { vi: 'Đóng',                  en: 'Close' },
  'common.back':            { vi: 'Quay lại',              en: 'Back' },
  'common.loading':         { vi: 'Đang tải…',             en: 'Loading…' },
  'common.members':         { vi: 'thành viên',            en: 'members' },
  'common.invite':          { vi: 'Mời',                   en: 'Invite' },
  'common.newproject':      { vi: '+ Dự án mới',           en: '+ New Project' },
  'common.online':          { vi: 'online',                en: 'online' },
  'common.offline':         { vi: 'offline',               en: 'offline' },
} satisfies Record<string, { vi: string; en: string }>

export type TranslationKey = keyof typeof STRINGS

// ── Context ───────────────────────────────────────────────────────────────────
interface I18nCtx { lang: LangCode; setLang: (l: LangCode) => void; t: (key: TranslationKey) => string }
const I18nContext = createContext<I18nCtx>({ lang: 'vi', setLang: () => {}, t: (k) => k })

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangCode>('vi')

  useEffect(() => {
    const saved = (localStorage.getItem('unity_lang') as LangCode) ?? 'vi'
    setLangState(saved)
    document.documentElement.lang = saved
  }, [])

  const setLang = (l: LangCode) => {
    setLangState(l)
    localStorage.setItem('unity_lang', l)
    document.documentElement.lang = l
  }

  const t = (key: TranslationKey): string => STRINGS[key]?.[lang] ?? key

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>
}

export const useLang = () => useContext(I18nContext)
