<template>
  <q-page class="dashboard-page">
    <div class="page-intro"><div><div class="dashboard-title-meta"><span class="page-overline">{{ todayLabel }}</span><router-link to="/barber/financeiro" :class="['dashboard-plan-badge', billingTone]"><q-icon :name="billingIcon" /><span>{{ currentPlanName }}</span><small>{{ billingStatusLabel }}</small></router-link></div><h1>Bom dia, {{ firstName }}.</h1><p>Aqui está o ritmo da sua barbearia hoje.</p></div><q-btn to="/barber/calendario" rounded unelevated color="dark" no-caps label="Novo agendamento" icon="add" /></div>
    <div class="stats-grid"><StatCard label="Atendimentos hoje" :value="stats.todayCount || 0" hint="agenda em tempo real" icon="content_cut" positive /><StatCard label="Agendamentos no mês" :value="stats.monthCount || 0" hint="todos os canais" icon="event_available" positive /><StatCard label="Faturamento previsto" :value="money(stats.revenue)" hint="no mês atual" icon="payments" positive /><StatCard label="Conversas do bot" :value="stats.botInteractions || 0" hint="no mês atual" icon="forum" positive /></div>
    <div class="dashboard-grid">
      <section class="panel-card agenda-panel"><div class="panel-heading"><div><span>PRÓXIMOS HORÁRIOS</span><h3>Sua agenda de hoje</h3></div><q-btn to="/barber/calendario" flat rounded no-caps label="Ver calendário" icon-right="arrow_forward" /></div>
        <div v-if="appointments.length" class="next-list"><article v-for="(item, index) in appointments" :key="item._id"><div class="time-block"><b>{{ time(item.start) }}</b><small>{{ item.duration }} min</small></div><div class="timeline-mark" :class="`color-${index % 4}`" /><q-avatar color="grey-3" text-color="dark"><img v-if="item.user?.avatar" :src="item.user.avatar"><span v-else>{{ initials(item.user?.name || item.customerName) }}</span></q-avatar><div class="appointment-main"><b>{{ item.user?.name || item.customerName || 'Cliente' }}</b><small>{{ item.serviceName }}</small></div><q-badge :color="statusColor(item.status)" rounded :label="statusLabel(item.status)" /><q-btn class="appointment-action-trigger" flat round dense icon="more_horiz" aria-label="Ações do agendamento"><q-menu anchor="bottom right" self="top right" class="appointment-actions-menu"><q-list style="min-width: 220px"><q-item-label header>Ações do horário</q-item-label><q-item clickable v-close-popup @click="editAppointment(item)"><q-item-section avatar><q-icon name="visibility" /></q-item-section><q-item-section>Ver agendamento</q-item-section></q-item><q-item v-if="item.status !== 'COMPLETED'" clickable v-close-popup @click="updateStatus(item, 'COMPLETED')"><q-item-section avatar><q-icon name="task_alt" color="positive" /></q-item-section><q-item-section>Marcar como concluído</q-item-section></q-item><q-item v-if="item.status === 'PENDING'" clickable v-close-popup @click="updateStatus(item, 'CONFIRMED')"><q-item-section avatar><q-icon name="event_available" /></q-item-section><q-item-section>Confirmar horário</q-item-section></q-item><q-item v-if="item.status !== 'CANCELLED'" clickable v-close-popup @click="updateStatus(item, 'CANCELLED')"><q-item-section avatar><q-icon name="event_busy" color="warning" /></q-item-section><q-item-section>Cancelar agendamento</q-item-section></q-item><q-separator /><q-item clickable v-close-popup class="text-negative" @click="removeAppointment(item)"><q-item-section avatar><q-icon name="delete_outline" /></q-item-section><q-item-section>Excluir da agenda</q-item-section></q-item></q-list></q-menu></q-btn></article></div>
        <div v-else class="panel-empty"><q-icon name="event_available" /><h4>Agenda livre por enquanto</h4><p>Adicione um horário manual ou compartilhe seu site.</p></div>
      </section>
      <aside class="panel-card quick-panel"><div class="panel-heading"><div><span>ATALHOS</span><h3>Faça acontecer</h3></div></div><router-link to="/barber/meu-site"><span class="quick-icon lime"><q-icon name="web" /></span><div><b>Editar meu site</b><small>Atualize textos e imagens</small></div><q-icon name="chevron_right" /></router-link><router-link to="/barber/bot"><span class="quick-icon lavender"><q-icon name="smart_toy" /></span><div><b>Configurar o bot</b><small>Melhore o atendimento</small></div><q-icon name="chevron_right" /></router-link><router-link to="/barber/configuracoes"><span class="quick-icon sand"><q-icon name="schedule" /></span><div><b>Horários de funcionamento</b><small>Organize sua disponibilidade</small></div><q-icon name="chevron_right" /></router-link><div class="site-status"><span class="online-dot" /><div><b>Seu site está no ar</b><small>/barbearia-premium</small></div><q-icon name="open_in_new" /></div></aside>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { api } from 'boot/axios'
import { useAuthStore } from 'stores/auth-store'
import StatCard from 'components/StatCard.vue'
const auth = useAuthStore(); const stats = ref({}); const appointments = ref([]); const billing = ref({}); const $q = useQuasar(); const router = useRouter()
const firstName = computed(() => auth.user?.name?.split(' ')[0] || 'profissional')
const todayLabel = computed(() => new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).toUpperCase())
const billingRoot = computed(() => billing.value?.billing || billing.value?.summary || billing.value || {})
const subscription = computed(() => billingRoot.value.subscription || billingRoot.value.membership || {})
const currentPlan = computed(() => billingRoot.value.currentPlan || subscription.value.plan || billingRoot.value.plan || {})
const currentPlanName = computed(() => currentPlan.value.name || 'Plano gratuito')
const billingStatus = computed(() => String(subscription.value.status || billingRoot.value.status || currentPlan.value.status || 'FREE').toUpperCase())
const billingSuspended = computed(() => ['SUSPENDED', 'EXPIRED', 'PAST_DUE', 'OVERDUE', 'CANCELED', 'CANCELLED', 'INACTIVE'].includes(billingStatus.value))
const billingStatusLabel = computed(() => ({ ACTIVE: 'ativo', PAID: 'ativo', FREE: 'gratuito', PENDING: 'aguardando pagamento', PAST_DUE: 'pagamento pendente', OVERDUE: 'expirado', EXPIRED: 'expirado', SUSPENDED: 'suspenso', CANCELED: 'cancelado', CANCELLED: 'cancelado' }[billingStatus.value] || billingStatus.value.toLowerCase()))
const billingTone = computed(() => billingSuspended.value ? 'is-suspended' : ['ACTIVE', 'PAID'].includes(billingStatus.value) ? 'is-active' : 'is-free')
const billingIcon = computed(() => billingSuspended.value ? 'lock' : ['ACTIVE', 'PAID'].includes(billingStatus.value) ? 'verified' : 'stars')
const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const time = value => new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const initials = value => String(value || 'CL').split(' ').slice(0, 2).map(item => item[0]).join('').toUpperCase()
const statusLabel = status => ({ CONFIRMED: 'Confirmado', PENDING: 'Pendente', COMPLETED: 'Concluído', CANCELLED: 'Cancelado' }[status])
const statusColor = status => ({ CONFIRMED: 'positive', PENDING: 'warning', COMPLETED: 'blue-grey', CANCELLED: 'negative' }[status])
async function loadDashboard () { const { data } = await api.get('/barber/dashboard'); stats.value = data.stats; appointments.value = data.nextAppointments; if (data.billing) billing.value = data.billing; else loadBilling() }
async function loadBilling () {
  try { const response = await api.get('/barber/billing', { params: { limit: 1 } }); billing.value = response.data?.data || response.data }
  catch (error) {
    if (![404, 405].includes(error.response?.status)) return
    try { const response = await api.get('/barber/billing/summary'); billing.value = response.data?.data || response.data } catch { /* o dashboard continua funcional sem o financeiro */ }
  }
}
function editAppointment (item) { router.push({ path: '/barber/calendario', query: { appointment: item._id } }) }
async function updateStatus (item, status) {
  try { await api.patch(`/barber/appointments/${item._id}`, { status }); $q.notify({ type: 'positive', message: status === 'COMPLETED' ? 'Atendimento concluído.' : status === 'CANCELLED' ? 'Agendamento cancelado.' : 'Agendamento confirmado.' }); await loadDashboard() }
  catch (error) { $q.notify({ type: 'negative', message: error.response?.data?.message || 'Não foi possível atualizar.' }) }
}
function removeAppointment (item) {
  $q.dialog({ title: 'Excluir agendamento?', message: 'O horário será removido definitivamente da agenda.', cancel: true, persistent: true }).onOk(async () => { await api.delete(`/barber/appointments/${item._id}`); $q.notify({ message: 'Agendamento excluído.', color: 'dark' }); await loadDashboard() })
}
onMounted(loadDashboard)
</script>

<style scoped>
.dashboard-title-meta{display:flex;align-items:center;gap:11px;flex-wrap:wrap}.dashboard-plan-badge{display:inline-flex;align-items:center;gap:5px;min-height:26px;padding:4px 9px;border:1px solid #dce1d9;border-radius:999px;background:#fff;color:#59625c;font-size:9px;font-weight:800;transition:.2s ease}.dashboard-plan-badge:hover{transform:translateY(-1px);border-color:#bfc8b9}.dashboard-plan-badge small{padding-left:6px;border-left:1px solid currentColor;font-size:7px;font-weight:600;opacity:.68;text-transform:uppercase}.dashboard-plan-badge.is-active{border-color:#c9dfb5;background:#edf8e4;color:#396122}.dashboard-plan-badge.is-suspended{border-color:#e8c4bf;background:#fff0ee;color:#8c3129}.dashboard-plan-badge.is-free{background:#f0f2ef;color:#5f6762}@media(max-width:600px){.dashboard-title-meta{align-items:flex-start;flex-direction:column;gap:8px}.dashboard-plan-badge{min-height:24px}}
</style>
