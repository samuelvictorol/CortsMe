<template>
  <q-page class="dashboard-page customers-page">
    <div class="page-intro">
      <div><span class="page-overline">RELACIONAMENTO</span><h1>Clientes</h1><p>Conheça quem senta na sua cadeira e acompanhe cada serviço realizado.</p></div>
      <div class="customer-total-pill"><q-icon name="groups" /><div><b>{{ pagination.total }}</b><span>clientes atendidos</span></div></div>
    </div>

    <section class="panel-card customers-panel">
      <div class="customers-toolbar">
        <q-input v-model="search" outlined rounded dense debounce="350" placeholder="Buscar por nome, telefone, e-mail ou serviço" @update:model-value="load">
          <template #prepend><q-icon name="search" /></template>
          <template #append><q-icon v-if="search" name="close" class="cursor-pointer" @click="search = ''; load()" /></template>
        </q-input>
        <span>Histórico exclusivo desta barbearia</span>
      </div>

      <div v-if="loading" class="customers-loading"><q-spinner-dots size="42px" /></div>
      <div v-else-if="customers.length" class="customer-grid">
        <article v-for="customer in customers" :key="customer.key" class="customer-card" @click="openCustomer(customer)">
          <div class="customer-card__top">
            <q-avatar size="58px" color="grey-3" text-color="dark"><img v-if="customer.avatar" :src="customer.avatar"><span v-else>{{ initials(customer.name) }}</span></q-avatar>
            <div class="col"><h3>{{ customer.name }}</h3><span>{{ customer.registered ? 'Cliente cadastrado' : 'Atendimento manual' }}</span></div>
            <q-btn flat round dense icon="arrow_outward" aria-label="Ver cliente" />
          </div>
          <div class="customer-contact"><span><q-icon name="phone_iphone" /> {{ customer.phone || 'Telefone não informado' }}</span><span><q-icon name="alternate_email" /> {{ customer.email || 'E-mail não informado' }}</span></div>
          <div class="customer-metrics"><div><b>{{ customer.completedCuts }}</b><span>concluídos</span></div><div><b>{{ customer.totalAppointments }}</b><span>agendamentos</span></div><div><b>{{ customer.cancelledCount }}</b><span>cancelados</span></div></div>
          <div class="customer-card__footer"><span><small>ÚLTIMO SERVIÇO</small><b>{{ customer.latestService }}</b></span><span>{{ customer.lastVisit ? shortDate(customer.lastVisit) : 'Ainda sem visita concluída' }}</span></div>
        </article>
      </div>
      <div v-else class="empty-state customers-empty"><span><q-icon name="person_search" /></span><h2>Nenhum cliente encontrado</h2><p>Os clientes aparecem aqui assim que fazem o primeiro agendamento.</p></div>

      <div v-if="pagination.pages > 1" class="table-footer"><span>Página {{ pagination.page }} de {{ pagination.pages }}</span><q-pagination v-model="pagination.page" :max="pagination.pages" direction-links color="dark" @update:model-value="load" /></div>
    </section>

    <q-dialog v-model="dialog">
      <q-card v-if="detail" class="customer-dialog">
        <q-card-section class="customer-dialog__hero">
          <q-avatar size="82px" color="grey-3" text-color="dark"><img v-if="detail.avatar" :src="detail.avatar"><span v-else>{{ initials(detail.name) }}</span></q-avatar>
          <div class="col"><span>PERFIL DO CLIENTE</span><h2>{{ detail.name }}</h2><p>{{ detail.email || 'E-mail não informado' }} · {{ detail.phone || 'Telefone não informado' }}</p></div>
          <q-btn flat round dense icon="close" aria-label="Fechar" v-close-popup />
        </q-card-section>
        <q-card-section class="customer-dialog__body">
          <div class="customer-detail-stats"><div><q-icon name="content_cut" /><span><b>{{ detail.completedCuts }}</b> cortes concluídos</span></div><div><q-icon name="event_note" /><span><b>{{ detail.totalAppointments }}</b> agendamentos</span></div><div><q-icon name="payments" /><span><b>{{ money(detail.totalSpent) }}</b> em serviços</span></div><div><q-icon name="history" /><span>Cliente desde <b>{{ shortDate(detail.customerSince) }}</b></span></div></div>
          <div class="customer-history-head"><div><span>HISTÓRICO COMPLETO</span><h3>Serviços e pacotes</h3></div><q-badge v-if="detail.editedCount" rounded color="blue-grey-8" :label="`${detail.editedCount} alterado(s)`" /></div>
          <div class="customer-history-list">
            <article v-for="appointment in detail.appointments" :key="appointment._id" :class="{ cancelled: appointment.status === 'CANCELLED' }">
              <div class="history-date"><b>{{ day(appointment.start) }}</b><span>{{ month(appointment.start) }}</span><small>{{ year(appointment.start) }}</small></div>
              <div class="history-line" />
              <div class="history-content"><div><q-badge rounded :color="statusColor(appointment.status)" :label="statusLabel(appointment.status)" /><small>{{ dateTime(appointment.start) }}</small></div><h4>{{ appointment.serviceName }}</h4><p>{{ appointment.duration }} min · {{ money(appointment.price) }} · {{ sourceLabel(appointment.source) }}</p><span v-if="appointment.note"><q-icon name="notes" /> {{ appointment.note }}</span>
                <q-expansion-item v-if="appointment.history?.length > 1" dense dense-toggle icon="edit_note" :label="`${appointment.history.length - 1} atualização(ões)`" class="appointment-audit">
                  <div v-for="entry in appointment.history.slice().reverse()" :key="entry._id" class="audit-entry"><b>{{ actionLabel(entry.action) }}</b><small>{{ dateTime(entry.at) }}</small><span v-for="change in entry.changes" :key="change.field">{{ fieldLabel(change.field) }}: {{ readableChange(change.from) }} → {{ readableChange(change.to) }}</span></div>
                </q-expansion-item>
              </div>
            </article>
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'

const route = useRoute(); const router = useRouter(); const $q = useQuasar()
const search = ref(''); const customers = ref([]); const loading = ref(false); const dialog = ref(false); const detail = ref(null)
const pagination = ref({ page: 1, pages: 1, total: 0, limit: 9 })
const statusLabel = value => ({ CONFIRMED: 'Confirmado', PENDING: 'Pendente', COMPLETED: 'Concluído', CANCELLED: 'Cancelado' }[value] || value)
const statusColor = value => ({ CONFIRMED: 'positive', PENDING: 'warning', COMPLETED: 'blue-grey', CANCELLED: 'negative' }[value] || 'grey')
const sourceLabel = value => ({ web: 'Agenda online', bot: 'Bot', manual: 'Painel' }[value] || value)
const actionLabel = value => ({ CREATED: 'Agendamento criado', EDITED: 'Dados editados', STATUS_CHANGED: 'Status atualizado', CANCELLED: 'Agendamento cancelado', ADJUSTMENT_REQUESTED: 'Ajuste solicitado' }[value] || value)
const fieldLabel = value => ({ start: 'Horário', status: 'Status', serviceName: 'Serviço', duration: 'Duração', price: 'Valor', note: 'Observação', customerName: 'Nome', customerPhone: 'Telefone' }[value] || value)
const initials = value => String(value || 'CL').split(' ').slice(0, 2).map(item => item[0]).join('').toUpperCase()
const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const shortDate = value => value ? new Date(value).toLocaleDateString('pt-BR') : '—'
const dateTime = value => value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'
const day = value => String(new Date(value).getDate()).padStart(2, '0')
const month = value => new Date(value).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase()
const year = value => new Date(value).getFullYear()
function readableChange (value) { if (!value) return 'vazio'; if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return dateTime(value); return statusLabel(value) }

async function load () {
  loading.value = true
  try { const { data } = await api.get('/barber/customers', { params: { page: pagination.value.page, limit: pagination.value.limit, search: search.value } }); customers.value = data.data; pagination.value = data.pagination }
  finally { loading.value = false }
}
async function openCustomer (customer) {
  try { detail.value = (await api.get(`/barber/customers/${encodeURIComponent(customer.key)}`)).data.customer; dialog.value = true }
  catch (error) { $q.notify({ type: 'negative', message: error.response?.data?.message || 'Não foi possível abrir o cliente.' }) }
}
async function openByAppointment (appointmentId) {
  try { detail.value = (await api.get(`/barber/customers/appointment/${appointmentId}`)).data.customer; dialog.value = true; await router.replace('/barber/clientes') }
  catch (error) { $q.notify({ type: 'negative', message: error.response?.data?.message || 'Não foi possível abrir o cliente.' }) }
}
onMounted(async () => { await load(); if (route.query.appointment) await openByAppointment(route.query.appointment) })
</script>
