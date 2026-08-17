const publicMeta = { public: true }

const routes = [
  {
    path: '/',
    component: () => import('layouts/PublicLayout.vue'),
    children: [
      { path: '', component: () => import('pages/LandingPage.vue'), meta: publicMeta },
      { path: 'login', component: () => import('pages/AuthPage.vue'), meta: publicMeta },
      { path: 'cadastro', component: () => import('pages/AuthPage.vue'), meta: publicMeta },
      { path: 'esqueci-senha', component: () => import('pages/ForgotPasswordPage.vue'), meta: publicMeta },
      { path: 'redefinir-senha/:token', component: () => import('pages/ResetPasswordPage.vue'), meta: publicMeta },
      { path: 'agendamento/:token', component: () => import('pages/public/AppointmentActionPage.vue'), meta: publicMeta },
      { path: 'financeiro/:token', component: () => import('pages/public/PublicFinancePage.vue'), meta: publicMeta }
    ]
  },
  {
    path: '/barber',
    component: () => import('layouts/DashboardLayout.vue'),
    meta: { roles: ['BARBER'] },
    children: [
      { path: '', component: () => import('pages/barber/BarberDashboard.vue') },
      { path: 'calendario', component: () => import('pages/barber/CalendarPage.vue') },
      { path: 'clientes', component: () => import('pages/barber/CustomersPage.vue') },
      { path: 'meu-site', component: () => import('pages/barber/SiteBuilderPage.vue') },
      { path: 'bot', component: () => import('pages/barber/BotPage.vue') },
      { path: 'financeiro', component: () => import('pages/barber/FinancePage.vue') },
      { path: 'configuracoes', component: () => import('pages/barber/SettingsPage.vue') }
    ]
  },
  {
    path: '/adm',
    component: () => import('layouts/DashboardLayout.vue'),
    meta: { roles: ['ADMIN'] },
    children: [
      { path: '', component: () => import('pages/admin/AdminDashboard.vue') },
      { path: 'financeiro', component: () => import('pages/admin/AdminFinancePage.vue') },
      { path: 'notifyflow', component: () => import('pages/admin/AdminNotifyFlowPage.vue') },
      { path: ':resource', component: () => import('pages/admin/AdminDataPage.vue') }
    ]
  },
  {
    path: '/user',
    component: () => import('layouts/DashboardLayout.vue'),
    meta: { roles: ['USER'] },
    children: [
      { path: '', component: () => import('pages/user/UserAppointments.vue') },
      { path: 'perfil', component: () => import('pages/user/UserProfile.vue') }
    ]
  },
  {
    path: '/:slug',
    component: () => import('layouts/BarberPublicLayout.vue'),
    children: [
      { path: '', component: () => import('pages/public/PublicBarberPage.vue'), meta: publicMeta },
      { path: 'agendar', component: () => import('pages/public/BookingPage.vue'), meta: publicMeta }
    ]
  },
  { path: '/:catchAll(.*)*', component: () => import('pages/ErrorNotFound.vue'), meta: publicMeta }
]

export default routes
