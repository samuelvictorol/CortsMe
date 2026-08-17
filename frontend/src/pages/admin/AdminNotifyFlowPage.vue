<template>
  <q-page class="dashboard-page notifyflow-page">
    <div class="page-intro notifyflow-intro"><div><span class="page-overline">INTEGRAÇÃO CORTSME</span><h1>NotifyFlow</h1><p>Filas, agendamentos e entregas exclusivamente do app CortsMe.</p></div><div class="row q-gutter-sm"><q-badge rounded :color="connected ? 'positive' : 'negative'" :label="connected ? 'Integração online' : 'Integração indisponível'" /><q-btn round flat icon="refresh" :loading="loading" aria-label="Atualizar" @click="refresh" /></div></div>

    <q-banner v-if="error" rounded class="notifyflow-error"><template #avatar><q-icon name="cloud_off" /></template>{{ error }}<template #action><q-btn flat rounded no-caps label="Tentar novamente" @click="refresh" /></template></q-banner>

    <section class="notifyflow-summary">
      <article><span class="summary-icon green"><q-icon name="send" /></span><div><small>ENTREGAS</small><b>{{ metric('total') }}</b><p>{{ metric('delivered') }} entregues</p></div></article>
      <article><span class="summary-icon blue"><q-icon name="schedule" /></span><div><small>AGENDADOS / FILA</small><b>{{ queueMetric('delayed') + queueMetric('waiting') }}</b><p>{{ queueMetric('active') }} processando</p></div></article>
      <article><span class="summary-icon purple"><q-icon name="mark_email_read" /></span><div><small>ENVIADOS</small><b>{{ metric('sent') }}</b><p>WhatsApp e Gmail</p></div></article>
      <article><span class="summary-icon red"><q-icon name="error_outline" /></span><div><small>FALHAS</small><b>{{ metric('failed') + queueMetric('failed') }}</b><p>Requerem atenção</p></div></article>
    </section>

    <section class="panel-card notifyflow-card">
      <header class="notifyflow-card__heading"><div><span>ATIVIDADE DO APP</span><h2>Disparos e agendamentos</h2></div><small v-if="lastActivity">Última atividade {{ dateTime(lastActivity) }}</small></header>
      <div class="notifyflow-toolbar">
        <q-input v-model="filters.search" outlined rounded dense debounce="450" placeholder="Buscar template ou identificador" @update:model-value="resetAndLoad"><template #prepend><q-icon name="search" /></template><template #append><q-icon v-if="filters.search" name="close" class="cursor-pointer" @click="filters.search = ''; resetAndLoad()" /></template></q-input>
        <q-select v-model="filters.status" outlined rounded dense clearable :options="statusOptions" emit-value map-options label="Status" @update:model-value="resetAndLoad" />
        <q-select v-model="filters.channel" outlined rounded dense clearable :options="channelOptions" emit-value map-options label="Canal" @update:model-value="resetAndLoad" />
      </div>

      <q-table flat hide-pagination row-key="id" :rows="rows" :columns="columns" :loading="loading" :grid="$q.screen.lt.md" class="notifyflow-table">
        <template #body-cell-kind="props"><q-td :props="props"><div class="kind-cell"><span><q-icon :name="props.row.kind === 'schedule' ? 'event_repeat' : 'notifications_active'" /></span><div><b>{{ props.row.kind === 'schedule' ? 'Agendamento' : 'Disparo' }}</b><small>{{ props.row.templateName }}</small></div></div></q-td></template>
        <template #body-cell-channel="props"><q-td :props="props"><q-chip dense :icon="channelIcon(props.value)" color="grey-2" text-color="dark" :label="channelLabel(props.value)" /></q-td></template>
        <template #body-cell-status="props"><q-td :props="props"><q-badge rounded :color="statusColor(props.value)" :label="statusLabel(props.value)" /></q-td></template>
        <template #body-cell-date="props"><q-td :props="props"><b class="date-main">{{ dateTime(props.row.relevantDate) }}</b><small class="date-detail">{{ props.row.kind === 'schedule' ? 'Execução programada' : 'Última atualização' }}</small></q-td></template>
        <template #item="props"><div class="q-pa-xs col-12"><article class="notifyflow-mobile-item"><header><div class="kind-cell"><span><q-icon :name="props.row.kind === 'schedule' ? 'event_repeat' : 'notifications_active'" /></span><div><b>{{ props.row.kind === 'schedule' ? 'Agendamento' : 'Disparo' }}</b><small>{{ props.row.templateName }}</small></div></div><q-badge rounded :color="statusColor(props.row.status)" :label="statusLabel(props.row.status)" /></header><div class="mobile-meta"><span><q-icon :name="channelIcon(props.row.channel)" /> {{ channelLabel(props.row.channel) }}</span><span><q-icon name="schedule" /> {{ dateTime(props.row.relevantDate) }}</span><span v-if="props.row.recipient"><q-icon name="person_outline" /> {{ props.row.recipient }}</span></div><p v-if="props.row.error"><q-icon name="error_outline" /> {{ props.row.error }}</p></article></div></template>
        <template #no-data><div class="notifyflow-empty"><q-icon name="notifications_none" /><h3>Nenhuma atividade encontrada.</h3><p>Os lembretes do CortsMe aparecerão aqui quando forem enfileirados.</p></div></template>
      </q-table>
      <footer class="notifyflow-footer"><span>Mostrando {{ rows.length }} de {{ pagination.total }} registros do CortsMe</span><q-pagination v-if="pagination.pages > 1" v-model="pagination.page" :max="pagination.pages" direction-links color="dark" @update:model-value="loadActivity" /></footer>
    </section>

    <section v-if="queues.length" class="queue-strip"><article v-for="queue in queues" :key="queue.name"><span><q-icon name="dns" /></span><div><b>{{ queue.name }}</b><small>{{ Number(queue.waiting || 0) }} aguardando · {{ Number(queue.active || 0) }} ativos · {{ Number(queue.failed || 0) }} falhas</small></div></article></section>
  </q-page>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'

const $q = useQuasar()
const loading = ref(false)
const error = ref('')
const statusPayload = ref({})
const rows = ref([])
const filters = reactive({ search: '', status: null, channel: null })
const pagination = reactive({ page: 1, pages: 1, total: 0, limit: 20 })
let refreshTimer

const statusOptions = [
  { label: 'Na fila', value: 'queued' }, { label: 'Agendado', value: 'scheduled' },
  { label: 'Processando', value: 'processing' }, { label: 'Pausado', value: 'paused' },
  { label: 'Enviado', value: 'sent' }, { label: 'Parcial', value: 'partial' },
  { label: 'Concluído', value: 'completed' }, { label: 'Falhou', value: 'failed' },
  { label: 'Cancelado', value: 'cancelled' }
]
const channelOptions = [{ label: 'WhatsApp', value: 'whatsapp_cloud' }, { label: 'Gmail', value: 'email' }]
const columns = [
  { name: 'kind', label: 'Atividade', field: 'kind', align: 'left' },
  { name: 'channel', label: 'Canal', field: 'channel', align: 'left' },
  { name: 'recipient', label: 'Destino', field: 'recipient', align: 'left' },
  { name: 'status', label: 'Status', field: 'status', align: 'left' },
  { name: 'date', label: 'Data', field: 'relevantDate', align: 'left' }
]
const notifyFlowStatus = computed(() => {
  const wrapped = statusPayload.value.notifyFlow ?? statusPayload.value
  return wrapped?.data && !Array.isArray(wrapped.data) ? wrapped.data : wrapped || {}
})
const localStatus = computed(() => statusPayload.value.local || {})
const localCounts = computed(() => localStatus.value.counts || {})
const connected = computed(() => {
  const explicit = notifyFlowStatus.value.connected ?? notifyFlowStatus.value.ok
  return explicit === undefined ? ['ok', 'connected', 'online'].includes(String(notifyFlowStatus.value.status || '').toLowerCase()) : Boolean(explicit)
})
const queues = computed(() => Array.isArray(notifyFlowStatus.value.queues) ? notifyFlowStatus.value.queues : Object.entries(notifyFlowStatus.value.queues || {}).map(([name, values]) => ({ name, ...values })))
const deliveries = computed(() => notifyFlowStatus.value.deliveries || notifyFlowStatus.value.metrics || {})
const lastActivity = computed(() => notifyFlowStatus.value.lastActivityAt || rows.value[0]?.relevantDate)
const countForStatus = key => Number(localCounts.value[String(key).toUpperCase()] || 0)
const metric = key => {
  if (key === 'total') return Number(deliveries.value.total ?? Object.values(localCounts.value).reduce((sum, value) => sum + Number(value || 0), 0))
  if (key === 'delivered') return Number(deliveries.value.delivered ?? countForStatus('DELIVERED'))
  if (key === 'sent') return Number(deliveries.value.sent ?? countForStatus('SENT'))
  if (key === 'failed') return Number(deliveries.value.failed ?? countForStatus('FAILED'))
  return Number(deliveries.value[key] || 0)
}
const queueMetric = key => {
  const remoteCount = queues.value.reduce((sum, queue) => sum + Number(queue[key] || 0), 0)
  if (remoteCount) return remoteCount
  return key === 'waiting' ? countForStatus('QUEUED') : key === 'active' ? countForStatus('PROCESSING') : key === 'failed' ? countForStatus('FAILED') : 0
}
const statusLabel = value => ({ QUEUED: 'Na fila', WAITING: 'Na fila', ACTIVE: 'Processando', PROCESSING: 'Processando', PAUSED: 'Pausado', SCHEDULED: 'Agendado', SENT: 'Enviado', PARTIAL: 'Parcial', DELIVERED: 'Entregue', COMPLETED: 'Concluído', FAILED: 'Falhou', CANCELLED: 'Cancelado', CANCELED: 'Cancelado' }[String(value || '').toUpperCase()] || value || 'Pendente')
const statusColor = value => { const status = String(value || '').toUpperCase(); if (['DELIVERED', 'COMPLETED'].includes(status)) return 'positive'; if (['FAILED'].includes(status)) return 'negative'; if (['SENT', 'ACTIVE', 'PROCESSING'].includes(status)) return 'blue'; if (['CANCELLED', 'CANCELED'].includes(status)) return 'blue-grey'; return 'warning' }
const channelLabel = value => ({ WHATSAPP: 'WhatsApp', WHATSAPP_CLOUD: 'WhatsApp', GMAIL: 'Gmail', EMAIL: 'Gmail', GLOBAL: 'WhatsApp + Gmail' }[String(value || '').toUpperCase()] || value || '—')
const channelIcon = value => ['WHATSAPP', 'WHATSAPP_CLOUD'].includes(String(value || '').toUpperCase()) ? 'chat' : 'alternate_email'
const dateTime = value => value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'

function normalizeRow (item, index) {
  const notification = item.notification || {}
  const schedule = item.schedule || {}
  const metadata = item.metadata || notification.metadata || schedule.metadata || {}
  const kind = item.type === 'schedule' || item.kind === 'schedule' || Object.keys(schedule).length ? 'schedule' : 'notification'
  return {
    id: String(item.id || item._id || notification.id || schedule.id || `${kind}-${index}`),
    kind,
    templateName: item.templateName || item.template?.name || notification.templateName || schedule.templateName || metadata.templateName || 'Template CortsMe',
    channel: item.channel || notification.channel || schedule.channel || '',
    recipient: item.recipientMasked || item.recipient || notification.recipientMasked || 'Destino protegido',
    status: item.status || notification.status || schedule.status || 'QUEUED',
    relevantDate: item.scheduledAt || schedule.nextRunAt || item.deliveredAt || item.processedAt || item.updatedAt || item.createdAt,
    error: item.error?.message || item.error || notification.error || '',
    metadata
  }
}

async function loadStatus () {
  const { data } = await api.get('/admin/notifyflow/status')
  statusPayload.value = data?.data || data || {}
}
async function loadActivity () {
  const { data } = await api.get('/admin/notifyflow/activity', { params: { page: pagination.page, limit: pagination.limit, search: filters.search || undefined, status: filters.status || undefined, channel: filters.channel || undefined } })
  const root = data?.data && !Array.isArray(data.data) ? data.data : data
  const items = Array.isArray(data?.data) ? data.data : root?.items || root?.activity || []
  rows.value = items.map(normalizeRow)
  const meta = data?.pagination || root?.pagination || data?.meta || root?.meta || {}
  pagination.total = Number(meta.total ?? items.length)
  pagination.pages = Math.max(1, Number(meta.pages ?? meta.totalPages ?? Math.ceil(pagination.total / pagination.limit)))
}
async function refresh () {
  loading.value = true
  try { await Promise.all([loadStatus(), loadActivity()]); error.value = '' }
  catch (requestError) { error.value = requestError.response?.data?.message || 'Não foi possível consultar a atividade do NotifyFlow.' }
  finally { loading.value = false }
}
function resetAndLoad () { pagination.page = 1; loadActivity().catch(() => undefined) }

function refreshFromSocket () { refresh() }
onMounted(() => { refresh(); refreshTimer = window.setInterval(refresh, 30000); window.addEventListener('cortsme:notifyflow-activity', refreshFromSocket) })
onBeforeUnmount(() => { window.clearInterval(refreshTimer); window.removeEventListener('cortsme:notifyflow-activity', refreshFromSocket) })
</script>

<style scoped>
.notifyflow-page{color:#171b19}.notifyflow-intro .q-badge{align-self:center;padding:8px 12px}.notifyflow-error{margin-bottom:16px;border:1px solid #edcbc6;background:#fff1ef;color:#7d312a}.notifyflow-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:13px;margin-bottom:18px}.notifyflow-summary article{min-height:112px;padding:19px;display:flex;align-items:center;gap:14px;border:1px solid #e0e3dc;border-radius:17px;background:#fff}.summary-icon{flex:0 0 auto;width:43px;height:43px;display:grid;place-items:center;border-radius:13px;font-size:21px}.summary-icon.green{background:#e9f4df;color:#568236}.summary-icon.blue{background:#e2eff5;color:#447c98}.summary-icon.purple{background:#eee7f7;color:#7956a1}.summary-icon.red{background:#fae7e4;color:#b0574d}.notifyflow-summary small,.notifyflow-summary b,.notifyflow-summary p{display:block}.notifyflow-summary small{color:#858d87;font-size:7px;font-weight:900;letter-spacing:1.1px}.notifyflow-summary b{margin-top:4px;font-size:25px}.notifyflow-summary p{margin:1px 0 0;color:#858d87;font-size:9px}.notifyflow-card{overflow:hidden}.notifyflow-card__heading{min-height:79px;padding:18px 22px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e8eae5}.notifyflow-card__heading span{color:#818983;font-size:8px;font-weight:900;letter-spacing:1.4px}.notifyflow-card__heading h2{margin:4px 0 0;font-size:21px}.notifyflow-card__heading>small{color:#89908c;font-size:9px}.notifyflow-toolbar{padding:14px 18px;display:grid;grid-template-columns:minmax(260px,1fr) 180px 170px;gap:9px;border-bottom:1px solid #eceee9}.notifyflow-table :deep(th){color:#7d8580;font-size:8px;font-weight:900;letter-spacing:1px;text-transform:uppercase}.notifyflow-table :deep(td){height:67px;font-size:10px}.kind-cell{display:flex;align-items:center;gap:10px}.kind-cell>span{width:35px;height:35px;display:grid;place-items:center;border-radius:10px;background:#edf4e5;color:#5d8238;font-size:18px}.kind-cell b,.kind-cell small{display:block}.kind-cell b{font-size:10px}.kind-cell small{max-width:210px;margin-top:2px;overflow:hidden;color:#858d87;font-size:8px;text-overflow:ellipsis;white-space:nowrap}.date-main,.date-detail{display:block}.date-detail{margin-top:2px;color:#929994;font-size:8px}.notifyflow-footer{min-height:61px;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;border-top:1px solid #e9ebe6;color:#7d8580;font-size:10px}.notifyflow-empty{min-height:270px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.notifyflow-empty>.q-icon{font-size:41px;color:#829177}.notifyflow-empty h3{margin:10px 0 3px}.notifyflow-empty p{margin:0;color:#858d87}.notifyflow-mobile-item{padding:15px;border:1px solid #e1e4de;border-radius:15px;background:#fff}.notifyflow-mobile-item header{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.mobile-meta{margin-top:13px;display:flex;flex-wrap:wrap;gap:8px 15px;color:#6f7872;font-size:9px}.notifyflow-mobile-item p{margin:12px 0 0;padding:9px;border-radius:8px;background:#fff0ee;color:#8b3d36;font-size:9px}.queue-strip{margin-top:16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px}.queue-strip article{padding:14px;display:flex;align-items:center;gap:10px;border:1px solid #e0e3dc;border-radius:14px;background:#fff}.queue-strip article>span{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:#f0f3ec}.queue-strip b,.queue-strip small{display:block}.queue-strip b{font-size:10px}.queue-strip small{margin-top:3px;color:#858d87;font-size:8px}@media(max-width:1050px){.notifyflow-summary{grid-template-columns:repeat(2,1fr)}.notifyflow-toolbar{grid-template-columns:1fr 1fr}.notifyflow-toolbar>.q-input{grid-column:1/-1}}@media(max-width:600px){.notifyflow-page{padding:24px 12px 90px}.notifyflow-intro>div:last-child{width:100%;justify-content:space-between}.notifyflow-summary{grid-template-columns:1fr 1fr;gap:8px}.notifyflow-summary article{min-height:95px;padding:13px;gap:9px}.summary-icon{width:36px;height:36px;font-size:18px}.notifyflow-summary b{font-size:20px}.notifyflow-summary p{display:none}.notifyflow-card__heading{align-items:flex-start;flex-direction:column;gap:6px}.notifyflow-toolbar{grid-template-columns:1fr;padding:12px}.notifyflow-toolbar>.q-input{grid-column:auto}.notifyflow-footer{align-items:flex-start;flex-direction:column;gap:9px;overflow-x:auto}}
</style>
