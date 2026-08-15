<template>
  <q-layout view="hHh LpR fFf" class="dashboard-shell">
    <q-header class="dashboard-header text-dark">
      <q-toolbar class="q-px-md q-px-lg-lg">
        <q-btn flat round dense icon="menu" class="lt-md" @click="drawer = !drawer" />
        <div class="lt-md q-ml-sm"><BrandLogo /></div>
        <div class="gt-sm page-kicker">{{ activeItem?.label || 'Visão geral' }}</div>
        <q-space />
        <q-btn round flat icon="notifications_none">
          <q-badge v-if="notification" color="negative" floating rounded />
          <q-tooltip>Notificações em tempo real</q-tooltip>
        </q-btn>
        <q-avatar size="38px" color="dark" text-color="white" class="q-ml-sm">
          <img v-if="auth.user?.avatar" :src="auth.user.avatar">
          <span v-else>{{ initials }}</span>
          <q-menu>
            <q-list style="min-width: 180px">
              <q-item><q-item-section><q-item-label>{{ auth.user?.name }}</q-item-label><q-item-label caption>{{ roleLabel }}</q-item-label><q-badge v-if="auth.user?.role === 'BARBER' && billingPlanName" class="q-mt-xs self-start" rounded color="lime-5" text-color="dark" :label="billingPlanName" /></q-item-section></q-item>
              <q-separator />
              <q-item clickable v-close-popup @click="logout"><q-item-section avatar><q-icon name="logout" /></q-item-section><q-item-section>Sair</q-item-section></q-item>
            </q-list>
          </q-menu>
        </q-avatar>
      </q-toolbar>
    </q-header>

    <q-drawer v-model="drawer" :width="264" show-if-above class="dashboard-drawer">
      <div class="drawer-content column no-wrap">
        <div class="q-pa-lg"><BrandLogo light /></div>
        <div class="q-px-md q-mt-md col">
          <div class="drawer-section-label">MENU PRINCIPAL</div>
          <q-list class="nav-list">
            <q-item v-for="item in menu" :key="item.to" :to="item.to" exact clickable v-ripple>
              <q-item-section avatar><q-icon :name="item.icon" /></q-item-section>
              <q-item-section>{{ item.label }}</q-item-section>
              <q-item-section v-if="item.badge" side><q-badge rounded color="lime-5" text-color="dark" :label="item.badge" /></q-item-section>
            </q-item>
          </q-list>
        </div>
        <div class="drawer-user q-ma-md q-pa-md">
          <div class="row items-center no-wrap">
            <q-avatar color="lime-5" text-color="dark" size="38px"><img v-if="auth.user?.avatar" :src="auth.user.avatar"><span v-else>{{ initials }}</span></q-avatar>
            <div class="q-ml-sm ellipsis"><div class="text-weight-medium ellipsis">{{ auth.user?.name }}</div><div class="text-caption text-grey-5">{{ roleLabel }}</div><q-badge v-if="auth.user?.role === 'BARBER' && billingPlanName" class="q-mt-xs" rounded color="lime-5" text-color="dark" :label="billingPlanName" /></div>
          </div>
        </div>
      </div>
    </q-drawer>

    <q-page-container>
      <div v-if="billingAlert" class="billing-alert-wrap">
        <q-banner rounded :class="['billing-alert', `billing-alert--${billingAlert.type}`]">
          <template #avatar><q-icon :name="billingAlert.icon" size="28px" /></template>
          <div class="billing-alert__content"><b>{{ billingAlert.title }}</b><span>{{ billingAlert.message }}</span></div>
          <template #action><q-btn to="/barber/financeiro" rounded unelevated no-caps :color="billingAlert.type === 'expired' ? 'negative' : 'dark'" label="Ir para o financeiro" icon-right="arrow_forward" /></template>
        </q-banner>
      </div>
      <router-view />
    </q-page-container>

    <q-footer class="mobile-nav lt-md text-dark">
      <q-tabs dense no-caps active-color="dark" indicator-color="transparent">
        <q-route-tab v-for="item in menu.slice(0, 4)" :key="item.to" :to="item.to" :icon="item.icon" :label="item.short || item.label" exact />
      </q-tabs>
    </q-footer>
  </q-layout>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { io } from 'socket.io-client'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
import BrandLogo from 'components/BrandLogo.vue'
import { useAuthStore } from 'stores/auth-store'

const drawer = ref(false)
const notification = ref(false)
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const $q = useQuasar()
const billing = ref(null)
let socket

const menus = {
  BARBER: [
    { label: 'Visão geral', short: 'Início', icon: 'space_dashboard', to: '/barber' },
    { label: 'Meu calendário', short: 'Agenda', icon: 'calendar_month', to: '/barber/calendario' },
    { label: 'Clientes', short: 'Clientes', icon: 'groups', to: '/barber/clientes' },
    { label: 'Meu site', short: 'Meu site', icon: 'web', to: '/barber/meu-site' },
    { label: 'Bot assistente', short: 'Bot', icon: 'smart_toy', to: '/barber/bot' },
    { label: 'Financeiro', short: 'Plano', icon: 'account_balance_wallet', to: '/barber/financeiro' },
    { label: 'Configurações', icon: 'tune', to: '/barber/configuracoes' }
  ],
  ADMIN: [
    { label: 'Visão geral', short: 'Início', icon: 'space_dashboard', to: '/adm' },
    { label: 'Usuários', short: 'Usuários', icon: 'group', to: '/adm/users' },
    { label: 'Barbearias', short: 'Barbearias', icon: 'storefront', to: '/adm/profiles' },
    { label: 'Agendamentos', short: 'Agenda', icon: 'event_note', to: '/adm/appointments' },
    { label: 'Interações do bot', icon: 'forum', to: '/adm/bot-logs' },
    { label: 'Financeiro', short: 'Financeiro', icon: 'payments', to: '/adm/financeiro' }
  ],
  USER: [
    { label: 'Meus agendamentos', short: 'Agenda', icon: 'event_available', to: '/user' },
    { label: 'Meu perfil', short: 'Perfil', icon: 'person_outline', to: '/user/perfil' },
    { label: 'Explorar', short: 'Explorar', icon: 'travel_explore', to: '/barbearia-premium' }
  ]
}
const billingRoot = computed(() => billing.value?.billing || billing.value || {})
const billingSubscription = computed(() => billingRoot.value.subscription || billingRoot.value.currentSubscription || {})
const billingPlan = computed(() => billingRoot.value.plan || billingRoot.value.currentPlan || billingSubscription.value.plan || {})
const billingPlanName = computed(() => billingPlan.value.name || billingPlan.value.label || '')
const billingDaysRemaining = computed(() => {
  const explicit = billingRoot.value.daysRemaining ?? billingSubscription.value.daysRemaining
  if (explicit !== undefined && explicit !== null) return Number(explicit)
  const expiresAt = billingSubscription.value.currentPeriodEnd || billingSubscription.value.expiresAt
  return expiresAt ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000) : null
})
const billingAlert = computed(() => {
  if (auth.user?.role !== 'BARBER' || !billing.value || billingPlan.value.isFree || Number(billingPlan.value.priceCents || 0) === 0) return null
  const status = String(billingSubscription.value.status || billingRoot.value.status || '').toUpperCase()
  const days = billingDaysRemaining.value
  if (['EXPIRED', 'SUSPENDED', 'CANCELED', 'CANCELLED'].includes(status) || (days !== null && days < 0)) {
    return { type: 'expired', icon: 'lock_clock', title: 'Seu plano está suspenso.', message: 'O pagamento mensal expirou. Seu site continua publicado, mas agendamentos e bot estão bloqueados até a renovação.' }
  }
  if (days !== null && days >= 0 && days <= 7) {
    const label = days === 0 ? 'hoje' : `em ${days} dia${days === 1 ? '' : 's'}`
    return { type: 'warning', icon: 'schedule', title: `Seu plano vence ${label}.`, message: 'Renove agora para manter agendamentos e atendimento pelo bot sem interrupções.' }
  }
  return null
})
const menu = computed(() => (menus[auth.user?.role] || []).map((item) => item.to === '/barber/financeiro' && billingPlanName.value ? { ...item, badge: billingPlanName.value } : item))
const activeItem = computed(() => menu.value.find((item) => item.to === route.path))
const initials = computed(() => auth.user?.name?.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'CM')
const roleLabel = computed(() => ({ ADMIN: 'Administrador', BARBER: 'Profissional', USER: 'Cliente' }[auth.user?.role]))

function logout () { auth.logout(); router.push('/') }
async function loadBilling () {
  if (auth.user?.role !== 'BARBER') return
  try { billing.value = (await api.get('/barber/billing')).data } catch { billing.value = null }
}
onMounted(() => {
  loadBilling()
  if (!auth.token) return
  socket = io(process.env.SOCKET_URL, { auth: { token: auth.token } })
  socket.on('appointment:changed', () => {
    notification.value = true
    $q.notify({ message: 'Sua agenda foi atualizada em tempo real.', color: 'dark', icon: 'event_available', position: 'top-right' })
  })
  socket.on('billing:changed', () => {
    loadBilling()
    notification.value = true
    $q.notify({ message: 'A situação do seu plano foi atualizada.', color: 'dark', icon: 'payments', position: 'top-right' })
  })
})
onBeforeUnmount(() => socket?.disconnect())
</script>

<style scoped>
.billing-alert-wrap { padding: 18px clamp(16px, 3vw, 38px) 0; background: #f5f5f0; }
.billing-alert { border: 1px solid transparent; box-shadow: 0 10px 30px rgba(17, 22, 19, .06); }
.billing-alert--warning { color: #3d3100; background: #fff6cf; border-color: #ead681; }
.billing-alert--expired { color: #6f1220; background: #fff0f1; border-color: #efb6bc; }
.billing-alert__content { display: flex; flex-direction: column; gap: 2px; }
.billing-alert__content b { font-size: 15px; }
.billing-alert__content span { font-size: 13px; opacity: .82; }
@media (max-width: 599px) {
  .billing-alert-wrap { padding: 10px 10px 0; }
  .billing-alert :deep(.q-banner__content) { min-width: 0; }
  .billing-alert :deep(.q-banner__actions) { padding-left: 48px; padding-top: 10px; width: 100%; justify-content: flex-start; }
}
</style>
