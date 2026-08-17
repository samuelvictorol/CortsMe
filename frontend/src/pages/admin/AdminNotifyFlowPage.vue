<template>
  <q-page class="dashboard-page notifyflow-page">
    <div class="page-intro notifyflow-intro">
      <div><span class="page-overline">INTEGRAÇÃO CORTSME</span><h1>NotifyFlow</h1><p>Filas, agendamentos e entregas exclusivamente do app CortsMe.</p></div>
      <div class="row q-gutter-sm"><q-badge rounded :color="connected ? 'positive' : 'negative'" :label="connected ? 'Integração online' : 'Integração indisponível'" /><q-btn round flat icon="refresh" :loading="loading" aria-label="Atualizar" @click="refresh" /></div>
    </div>

    <q-banner v-if="error || activityWarning" rounded class="notifyflow-error"><template #avatar><q-icon :name="error ? 'cloud_off' : 'info_outline'" /></template>{{ error || activityWarning }}<template #action><q-btn flat rounded no-caps label="Tentar novamente" @click="refresh" /></template></q-banner>

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

      <q-table flat hide-pagination row-key="id" :rows="rows" :columns="columns" :loading="loading" :grid="$q.screen.lt.md" class="notifyflow-table" @row-click="openDetailsFromRow">
        <template #body-cell-kind="props"><q-td :props="props"><div class="kind-cell"><span><q-icon :name="props.row.kind === 'schedule' ? 'event_repeat' : 'notifications_active'" /></span><div><b>{{ props.row.kind === 'schedule' ? 'Agendamento' : 'Disparo' }}</b><small>{{ props.row.templateName }}</small></div></div></q-td></template>
        <template #body-cell-channel="props"><q-td :props="props"><q-chip dense :icon="channelIcon(props.value)" color="grey-2" text-color="dark" :label="channelLabel(props.value)" /></q-td></template>
        <template #body-cell-status="props"><q-td :props="props"><q-badge rounded :color="statusColor(props.value)" :label="statusLabel(props.value)" /></q-td></template>
        <template #body-cell-date="props"><q-td :props="props"><b class="date-main">{{ dateTime(props.row.relevantDate) }}</b><small class="date-detail">{{ props.row.kind === 'schedule' ? 'Execução programada' : 'Última atualização' }}</small></q-td></template>
        <template #body-cell-details="props"><q-td :props="props"><q-btn flat round dense icon="visibility" aria-label="Ver detalhes" @click.stop="openDetails(props.row)" /></q-td></template>
        <template #item="props">
          <div class="q-pa-xs col-12"><article class="notifyflow-mobile-item" role="button" tabindex="0" @click="openDetails(props.row)" @keyup.enter="openDetails(props.row)"><header><div class="kind-cell"><span><q-icon :name="props.row.kind === 'schedule' ? 'event_repeat' : 'notifications_active'" /></span><div><b>{{ props.row.kind === 'schedule' ? 'Agendamento' : 'Disparo' }}</b><small>{{ props.row.templateName }}</small></div></div><q-badge rounded :color="statusColor(props.row.status)" :label="statusLabel(props.row.status)" /></header><div class="mobile-meta"><span><q-icon :name="channelIcon(props.row.channel)" /> {{ channelLabel(props.row.channel) }}</span><span><q-icon name="schedule" /> {{ dateTime(props.row.relevantDate) }}</span><span v-if="props.row.recipient"><q-icon name="person_outline" /> {{ props.row.recipient }}</span><span v-if="props.row.attempts"><q-icon name="replay" /> {{ props.row.attempts }} tentativa(s)</span></div><p v-if="props.row.error"><q-icon name="error_outline" /> {{ props.row.error }}</p><q-btn flat rounded no-caps icon-right="chevron_right" label="Abrir detalhes" class="full-width q-mt-sm" @click.stop="openDetails(props.row)" /></article></div>
        </template>
        <template #no-data><div class="notifyflow-empty"><q-icon name="notifications_none" /><h3>Nenhuma atividade encontrada.</h3><p>Os lembretes do CortsMe aparecerão aqui quando forem enfileirados.</p></div></template>
      </q-table>
      <footer class="notifyflow-footer"><span>Mostrando {{ rows.length }} de {{ pagination.total }} registros do CortsMe</span><q-pagination v-if="pagination.pages > 1" v-model="pagination.page" :max="pagination.pages" direction-links color="dark" @update:model-value="loadActivity" /></footer>
    </section>

    <section v-if="queues.length" class="queue-strip"><article v-for="queue in queues" :key="queue.name"><span><q-icon name="dns" /></span><div><b>{{ queue.name }}</b><small>{{ Number(queue.waiting || 0) }} aguardando · {{ Number(queue.delayed || 0) }} agendados · {{ Number(queue.active || 0) }} ativos · {{ Number(queue.failed || 0) }} falhas</small></div></article></section>

    <q-dialog v-model="detailsOpen">
      <q-card class="dispatch-dialog">
        <q-card-section class="dispatch-dialog__header"><div><span>DETALHES DO CORTSME</span><h2>{{ selected?.templateName || 'Atividade NotifyFlow' }}</h2><p>{{ selected?.kind === 'schedule' ? 'Agendamento' : 'Disparo' }} · {{ selected?.dispatchKind || selected?.entityType || 'notificação' }}</p></div><q-btn flat round icon="close" v-close-popup /></q-card-section>
        <q-linear-progress v-if="detailsLoading" indeterminate color="lime-7" />
        <q-card-section v-if="selected" class="dispatch-dialog__body">
          <div class="dispatch-status-line"><q-badge rounded :color="statusColor(selected.status)" :label="statusLabel(selected.status)" /><q-chip dense :icon="channelIcon(selected.channel)" :label="channelLabel(selected.channel)" /><q-chip dense icon="shield" :label="selected.source === 'local' ? 'Registro CortsMe' : 'NotifyFlow'" /></div>

          <section class="detail-section"><header><q-icon name="receipt_long" /><b>Entrega</b></header><dl class="detail-grid"><div><dt>Destino</dt><dd>{{ selected.recipient || 'Protegido' }}</dd></div><div><dt>Tentativas locais</dt><dd>{{ selected.attempts || 0 }}</dd></div><div><dt>Status NotifyFlow</dt><dd>{{ selected.responseStatus || '—' }}</dd></div><div><dt>ID NotifyFlow</dt><dd class="mono">{{ selected.notifyFlowId || '—' }}</dd></div><div><dt>Agendado para</dt><dd>{{ dateTime(selected.scheduledAt) }}</dd></div><div><dt>Enviado em</dt><dd>{{ dateTime(selected.sentAt) }}</dd></div></dl><q-banner v-if="selected.error" rounded class="detail-error"><template #avatar><q-icon name="error_outline" /></template>{{ selected.error }}</q-banner></section>

          <section v-if="remoteDetail || remoteError" class="detail-section remote-delivery-section"><header><q-icon name="outbox" /><b>Entrega no NotifyFlow</b><q-badge v-if="remoteDetail" rounded :color="statusColor(remoteDetail.status)" :label="statusLabel(remoteDetail.status)" /></header><q-banner v-if="remoteError" rounded class="detail-error">{{ remoteError }}</q-banner><template v-if="remoteDetail"><div class="remote-summary"><q-chip dense icon="people" :label="`${remoteDeliveries.length} entrega(s)`" /><q-chip v-if="remoteDetail.queue?.phase" dense icon="route" :label="`Fila: ${queueStateLabel(remoteDetail.queue.phase)}`" /><q-chip v-if="remoteDetail.summary?.failed" dense color="red-1" text-color="negative" icon="error_outline" :label="`${remoteDetail.summary.failed} falha(s)`" /></div><dl v-if="remoteDetail.queue" class="detail-grid remote-queue-grid"><div><dt>Entrada na fila</dt><dd>{{ dateTime(remoteDetail.queue.enteredAt) }}</dd></div><div><dt>Execução prevista</dt><dd>{{ dateTime(remoteDetail.queue.scheduledAt) }}</dd></div><div><dt>Saída da fila</dt><dd>{{ dateTime(remoteDetail.queue.exitedAt) }}</dd></div><div><dt>Job NotifyFlow</dt><dd class="mono">{{ remoteDetail.queue.jobId || '—' }}</dd></div></dl><div v-if="remoteDeliveries.length" class="delivery-list"><article v-for="delivery in remoteDeliveries" :key="delivery.id"><div><q-icon :name="channelIcon(delivery.channel)" /><span><b>{{ channelLabel(delivery.channel) }}</b><small>{{ delivery.recipient?.emailMasked || delivery.recipient?.phoneMasked || 'Destino protegido' }}</small></span></div><q-badge rounded :color="statusColor(delivery.status)" :label="statusLabel(delivery.status)" /><dl><div><dt>Tentativas</dt><dd>{{ delivery.attempts || 0 }}</dd></div><div><dt>Provedor</dt><dd>{{ delivery.externalProvider || '—' }}</dd></div><div><dt>Enviado</dt><dd>{{ dateTime(delivery.sentAt) }}</dd></div><div><dt>Próxima tentativa</dt><dd>{{ dateTime(delivery.retryNotBefore) }}</dd></div></dl><p v-if="delivery.errorMessage"><q-icon name="error_outline" /> {{ delivery.errorMessage }}</p></article></div><div v-if="remoteNotifications.length" class="schedule-runs"><b>Execuções desta programação</b><article v-for="notification in remoteNotifications" :key="notification.id"><span class="mono">{{ notification.id }}</span><q-badge rounded :color="statusColor(notification.status)" :label="statusLabel(notification.status)" /><small>{{ dateTime(notification.createdAt) }}</small></article></div></template></section>

          <section class="detail-section"><header><q-icon name="dns" /><b>Fila Redis / BullMQ</b><q-badge v-if="selectedQueue" rounded :color="queueStateColor(selectedQueue.state)" :label="queueStateLabel(selectedQueue.state)" /></header><div v-if="selectedQueue" class="queue-detail"><dl class="detail-grid"><div><dt>Job</dt><dd class="mono">{{ selectedQueue.id || selected.jobId || '—' }}</dd></div><div><dt>Fila</dt><dd>{{ selectedQueue.name || 'notifications' }}</dd></div><div><dt>Tentativas BullMQ</dt><dd>{{ selectedQueue.attemptsMade || 0 }}</dd></div><div><dt>Atraso restante</dt><dd>{{ duration(selectedQueue.delay) }}</dd></div><div><dt>Iniciado</dt><dd>{{ timestamp(selectedQueue.processedOn) }}</dd></div><div><dt>Finalizado</dt><dd>{{ timestamp(selectedQueue.finishedOn) }}</dd></div></dl><div v-if="selectedQueue.progress !== undefined && selectedQueue.progress !== null" class="queue-progress"><span>Progresso</span><q-linear-progress rounded size="9px" :value="queueProgress" color="positive" track-color="grey-3" /><b>{{ Math.round(queueProgress * 100) }}%</b></div><q-banner v-if="selectedQueue.failedReason" rounded class="detail-error">{{ selectedQueue.failedReason }}</q-banner></div><div v-else class="queue-empty"><q-icon name="inventory_2" /><span>{{ queueError || 'O job já foi removido da fila ou esta atividade não possui um job local.' }}</span></div></section>

          <section class="detail-section"><header><q-icon name="fingerprint" /><b>Rastreabilidade isolada</b></header><dl class="detail-grid"><div><dt>Registro local</dt><dd class="mono">{{ selected.id }}</dd></div><div><dt>Perfil</dt><dd>{{ selected.profile?.businessName || selected.profileId || 'Sistema CortsMe' }}</dd></div><div><dt>Entidade</dt><dd>{{ selected.entityType || '—' }}</dd></div><div><dt>ID da entidade</dt><dd class="mono">{{ selected.entityId || '—' }}</dd></div><div><dt>Criado</dt><dd>{{ dateTime(selected.createdAt) }}</dd></div><div><dt>Atualizado</dt><dd>{{ dateTime(selected.updatedAt) }}</dd></div></dl></section>

          <section v-if="metadataEntries.length" class="detail-section"><header><q-icon name="data_object" /><b>Metadados permitidos</b></header><dl class="metadata-list"><div v-for="entry in metadataEntries" :key="entry[0]"><dt>{{ entry[0] }}</dt><dd>{{ formatMetadata(entry[1]) }}</dd></div></dl></section>

          <section v-if="remoteTimeline.length" class="detail-section"><header><q-icon name="timeline" /><b>Linha do tempo NotifyFlow</b></header><ol class="timeline-list"><li v-for="event in remoteTimeline" :key="event.id"><span :class="`timeline-dot timeline-dot--${event.level || 'info'}`" /><div><header><b>{{ event.message || event.action }}</b><time>{{ dateTime(event.createdAt) }}</time></header><small>{{ event.stage }} · {{ event.channel || 'global' }}</small><p v-if="event.context && Object.keys(event.context).length" class="mono">{{ formatMetadata(event.context) }}</p></div></li></ol></section>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'

const $q = useQuasar()
const loading = ref(false)
const error = ref('')
const activityWarning = ref('')
const statusPayload = ref({})
const rows = ref([])
const filters = reactive({ search: '', status: null, channel: null })
const pagination = reactive({ page: 1, pages: 1, total: 0, limit: 20 })
const detailsOpen = ref(false)
const detailsLoading = ref(false)
const selected = ref(null)
const selectedQueue = ref(null)
const queueError = ref('')
const remoteDetail = ref(null)
const remoteError = ref('')
let refreshTimer

const statusOptions = [{ label: 'Na fila', value: 'queued' }, { label: 'Agendado', value: 'scheduled' }, { label: 'Processando', value: 'processing' }, { label: 'Pausado', value: 'paused' }, { label: 'Enviado', value: 'sent' }, { label: 'Parcial', value: 'partial' }, { label: 'Concluído', value: 'completed' }, { label: 'Falhou', value: 'failed' }, { label: 'Ignorado', value: 'skipped' }, { label: 'Cancelado', value: 'cancelled' }]
const channelOptions = [{ label: 'WhatsApp', value: 'whatsapp_cloud' }, { label: 'Gmail', value: 'email' }]
const columns = [{ name: 'kind', label: 'Atividade', field: 'kind', align: 'left' }, { name: 'channel', label: 'Canal', field: 'channel', align: 'left' }, { name: 'recipient', label: 'Destino', field: 'recipient', align: 'left' }, { name: 'status', label: 'Status', field: 'status', align: 'left' }, { name: 'date', label: 'Data', field: 'relevantDate', align: 'left' }, { name: 'details', label: '', field: 'details', align: 'right' }]
const notifyFlowStatus = computed(() => { const wrapped = statusPayload.value.notifyFlow ?? statusPayload.value; return wrapped?.data && !Array.isArray(wrapped.data) ? wrapped.data : wrapped || {} })
const localStatus = computed(() => statusPayload.value.local || {})
const localCounts = computed(() => localStatus.value.counts || {})
const connected = computed(() => { const explicit = notifyFlowStatus.value.connected ?? notifyFlowStatus.value.ok; return explicit === undefined ? ['ok', 'connected', 'online'].includes(String(notifyFlowStatus.value.status || '').toLowerCase()) : Boolean(explicit) })
const queues = computed(() => {
  const remote = Array.isArray(notifyFlowStatus.value.queues) ? notifyFlowStatus.value.queues : Object.entries(notifyFlowStatus.value.queues || {}).map(([name, values]) => ({ name, ...values }))
  const local = localStatus.value.queue
  return local && Object.keys(local).length ? [...remote, { name: local.name || 'cortsme-notifications', ...local }] : remote
})
const deliveries = computed(() => notifyFlowStatus.value.deliveries || notifyFlowStatus.value.metrics || {})
const lastActivity = computed(() => notifyFlowStatus.value.lastActivityAt || rows.value[0]?.relevantDate)
const metadataEntries = computed(() => Object.entries(selected.value?.metadata || {}).filter(([, value]) => value !== undefined && value !== null && value !== ''))
const queueProgress = computed(() => { const raw = selectedQueue.value?.progress; const number = typeof raw === 'object' ? Number(raw.percent ?? raw.progress ?? 0) : Number(raw || 0); return Math.max(0, Math.min(1, number > 1 ? number / 100 : number)) })
const remoteDeliveries = computed(() => Array.isArray(remoteDetail.value?.deliveries) ? remoteDetail.value.deliveries : [])
const remoteTimeline = computed(() => Array.isArray(remoteDetail.value?.timeline) ? remoteDetail.value.timeline : [])
const remoteNotifications = computed(() => Array.isArray(remoteDetail.value?.notifications) ? remoteDetail.value.notifications : [])

const countForStatus = key => Number(localCounts.value[String(key).toUpperCase()] || 0)
const metric = key => { if (key === 'total') return Number(deliveries.value.total ?? Object.values(localCounts.value).reduce((sum, value) => sum + Number(value || 0), 0)); if (key === 'delivered') return Number(deliveries.value.delivered ?? countForStatus('DELIVERED')); if (key === 'sent') return Number(deliveries.value.sent ?? countForStatus('SENT')); if (key === 'failed') return Number(deliveries.value.failed ?? countForStatus('FAILED')); return Number(deliveries.value[key] || 0) }
const queueMetric = key => { const remoteCount = queues.value.reduce((sum, queue) => sum + Number(queue[key] || 0), 0); if (remoteCount) return remoteCount; return key === 'waiting' ? countForStatus('QUEUED') : key === 'active' ? countForStatus('PROCESSING') : key === 'failed' ? countForStatus('FAILED') : 0 }
const statusLabel = value => ({ QUEUED: 'Na fila', WAITING: 'Na fila', DELAYED: 'Agendado', ACTIVE: 'Processando', PROCESSING: 'Processando', PAUSED: 'Pausado', SCHEDULED: 'Agendado', SENT: 'Enviado', PARTIAL: 'Parcial', DELIVERED: 'Entregue', READ: 'Lida', COMPLETED: 'Concluído', FAILED: 'Falhou', SKIPPED: 'Ignorado', CANCELLED: 'Cancelado', CANCELED: 'Cancelado' }[String(value || '').toUpperCase()] || value || 'Pendente')
const statusColor = value => { const status = String(value || '').toUpperCase(); if (['DELIVERED', 'COMPLETED'].includes(status)) return 'positive'; if (status === 'FAILED') return 'negative'; if (['SENT', 'ACTIVE', 'PROCESSING'].includes(status)) return 'blue'; if (['CANCELLED', 'CANCELED'].includes(status)) return 'blue-grey'; return 'warning' }
const channelLabel = value => ({ WHATSAPP: 'WhatsApp', WHATSAPP_CLOUD: 'WhatsApp', GMAIL: 'Gmail', EMAIL: 'Gmail', GLOBAL: 'WhatsApp + Gmail' }[String(value || '').toUpperCase()] || value || '—')
const channelIcon = value => ['WHATSAPP', 'WHATSAPP_CLOUD'].includes(String(value || '').toUpperCase()) ? 'chat' : String(value || '').toUpperCase() === 'GLOBAL' ? 'hub' : 'alternate_email'
const dateTime = value => value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'
const timestamp = value => value ? dateTime(typeof value === 'number' ? new Date(value) : value) : '—'
const duration = value => { const ms = Number(value || 0); if (!ms) return '—'; if (ms < 60000) return `${Math.ceil(ms / 1000)} s`; if (ms < 3600000) return `${Math.ceil(ms / 60000)} min`; return `${(ms / 3600000).toFixed(1).replace('.', ',')} h` }
const queueStateLabel = value => ({ waiting: 'Aguardando', delayed: 'Agendado', recovery_pending: 'Aguardando recuperação', active: 'Processando', exited: 'Saiu da fila', completed: 'Concluído', failed: 'Falhou', paused: 'Pausado' }[String(value || '').toLowerCase()] || value || 'Desconhecido')
const queueStateColor = value => ({ completed: 'positive', failed: 'negative', active: 'blue', paused: 'blue-grey' }[String(value || '').toLowerCase()] || 'warning')
function formatMetadata (value) { if (typeof value === 'string') return value; try { return JSON.stringify(value) } catch { return String(value) } }

function normalizeRow (item, index, source = 'remote') {
  const notification = item.notification || {}
  const schedule = item.schedule || {}
  const metadata = item.metadata || notification.metadata || schedule.metadata || {}
  const kind = item.kind === 'schedule' || item.type === 'schedule' || Object.keys(schedule).length ? 'schedule' : 'notification'
  const channels = item.channels || notification.channels || schedule.channels || []
  return {
    id: String(item.id || item._id || notification.id || schedule.id || `${kind}-${source}-${index}`), localId: String(item.localId || ''), source: item.source || source, kind,
    dispatchKind: item.dispatchKind || '', templateName: item.templateName || item.template?.name || notification.templateName || schedule.templateName || metadata.templateName || 'Template CortsMe',
    channels, channel: item.channel || notification.channel || schedule.channel || (channels.length > 1 ? 'global' : channels[0]) || '',
    recipient: item.recipientMasked || item.recipient || notification.recipientMasked || 'Destino protegido',
    status: item.displayStatus || item.status || notification.status || schedule.status || 'QUEUED',
    scheduledAt: item.scheduledAt || schedule.nextRunAt || null,
    relevantDate: item.relevantDate || item.scheduledAt || schedule.nextRunAt || item.deliveredAt || item.processedAt || item.updatedAt || item.createdAt,
    createdAt: item.createdAt, updatedAt: item.updatedAt, sentAt: item.sentAt || item.deliveredAt,
    attempts: Number(item.attempts || 0), notifyFlowId: item.notifyFlowId || notification.id || (source === 'remote' ? item.id || item._id : '') || '', responseStatus: item.responseStatus || '',
    error: item.error?.message || item.error || item.lastError || notification.error || '', entityType: item.entityType || metadata.entityType || '', entityId: item.entityId || metadata.entityId || '',
    profileId: item.profileId || item.profile?.id || metadata.profileId || '', profile: item.profile || null, jobId: item.jobId || '', metadata, remoteQueue: item.remoteQueue || item.queue || null
  }
}

async function loadStatus () { const { data } = await api.get('/admin/notifyflow/status'); statusPayload.value = data?.data || data || {} }
function activityPayload (response) { const data = response?.data; const root = data?.data && !Array.isArray(data.data) ? data.data : data; const items = Array.isArray(data?.data) ? data.data : root?.items || root?.activity || []; return { items, pagination: data?.pagination || root?.pagination || data?.meta || root?.meta || {} } }
async function loadActivity () {
  const params = { page: pagination.page, limit: pagination.limit, search: filters.search || undefined, status: filters.status || undefined, channel: filters.channel || undefined }
  const response = await api.get('/admin/notifyflow/feed', { params })
  const payload = activityPayload(response)
  rows.value = payload.items.map((item, index) => normalizeRow(item, index, item.source || 'remote'))
  pagination.total = Number(payload.pagination.total || rows.value.length)
  pagination.pages = Math.max(1, Number(payload.pagination.pages || Math.ceil(pagination.total / pagination.limit)))
  pagination.page = Math.max(1, Number(payload.pagination.page || pagination.page))
  activityWarning.value = response.data?.integration?.warning || ''
}
async function refresh () { loading.value = true; try { await Promise.all([loadStatus(), loadActivity()]); error.value = '' } catch (requestError) { error.value = requestError.response?.data?.message || 'Não foi possível consultar a atividade do NotifyFlow.' } finally { loading.value = false } }
async function resetAndLoad () { pagination.page = 1; loading.value = true; try { await loadActivity(); error.value = '' } catch (requestError) { error.value = requestError.response?.data?.message || 'Não foi possível atualizar a atividade.' } finally { loading.value = false } }

function openDetailsFromRow (event, row) { openDetails(row) }
async function openDetails (row) {
  selected.value = { ...row }
  selectedQueue.value = null
  queueError.value = ''
  remoteDetail.value = null
  remoteError.value = ''
  detailsOpen.value = true
  detailsLoading.value = true
  try {
    const localDispatchId = row.localId || (row.source === 'local' ? row.id : '')
    if (localDispatchId) {
      try {
        const { data } = await api.get(`/admin/notifyflow/dispatches/${encodeURIComponent(localDispatchId)}`)
        const root = data?.data && !Array.isArray(data.data) ? data.data : data
        const localRow = normalizeRow(root.dispatch || row, 0, 'local')
        selected.value = {
          ...localRow,
          id: row.id,
          localId: localDispatchId,
          source: row.source,
          kind: row.kind,
          status: row.source === 'combined' ? row.status : localRow.status,
          notifyFlowId: row.notifyFlowId || localRow.notifyFlowId,
          remoteQueue: row.remoteQueue || null
        }
        selectedQueue.value = root.queue || null
        queueError.value = root.queueError || ''
      } catch (requestError) { queueError.value = requestError.response?.data?.message || 'Não foi possível carregar o estado atual da fila.' }
    }
    const activityType = row.source === 'local' ? 'notification' : row.kind
    const activityId = row.notifyFlowId || (row.source === 'remote' ? row.id : selected.value.notifyFlowId)
    if (/^[a-f\d]{24}$/i.test(String(activityId || '')) && ['notification', 'schedule'].includes(activityType)) {
      try {
        const { data } = await api.get(`/admin/notifyflow/activity/${activityType}/${encodeURIComponent(activityId)}`)
        remoteDetail.value = data?.data && !Array.isArray(data.data) ? data.data : data
      } catch (requestError) { remoteError.value = requestError.response?.data?.message || 'Não foi possível consultar a entrega detalhada no NotifyFlow.' }
    }
  } finally { detailsLoading.value = false }
}

function refreshFromSocket () { refresh() }
onMounted(() => { refresh(); refreshTimer = window.setInterval(refresh, 30000); window.addEventListener('cortsme:notifyflow-activity', refreshFromSocket) })
onBeforeUnmount(() => { window.clearInterval(refreshTimer); window.removeEventListener('cortsme:notifyflow-activity', refreshFromSocket) })
</script>

<style scoped>
.notifyflow-page{color:#171b19}.notifyflow-intro .q-badge{align-self:center;padding:8px 12px}.notifyflow-error{margin-bottom:16px;border:1px solid #edcbc6;background:#fff1ef;color:#7d312a}.notifyflow-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:13px;margin-bottom:18px}.notifyflow-summary article{min-height:112px;padding:19px;display:flex;align-items:center;gap:14px;border:1px solid #e0e3dc;border-radius:17px;background:#fff}.summary-icon{flex:0 0 auto;width:43px;height:43px;display:grid;place-items:center;border-radius:13px;font-size:21px}.summary-icon.green{background:#e9f4df;color:#568236}.summary-icon.blue{background:#e2eff5;color:#447c98}.summary-icon.purple{background:#eee7f7;color:#7956a1}.summary-icon.red{background:#fae7e4;color:#b0574d}.notifyflow-summary small,.notifyflow-summary b,.notifyflow-summary p{display:block}.notifyflow-summary small{color:#858d87;font-size:7px;font-weight:900;letter-spacing:1.1px}.notifyflow-summary b{margin-top:4px;font-size:25px}.notifyflow-summary p{margin:1px 0 0;color:#858d87;font-size:9px}.notifyflow-card{overflow:hidden}.notifyflow-card__heading{min-height:79px;padding:18px 22px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e8eae5}.notifyflow-card__heading span{color:#818983;font-size:8px;font-weight:900;letter-spacing:1.4px}.notifyflow-card__heading h2{margin:4px 0 0;font-size:21px}.notifyflow-card__heading>small{color:#89908c;font-size:9px}.notifyflow-toolbar{padding:14px 18px;display:grid;grid-template-columns:minmax(260px,1fr) 180px 170px;gap:9px;border-bottom:1px solid #eceee9}.notifyflow-table :deep(th){color:#7d8580;font-size:8px;font-weight:900;letter-spacing:1px;text-transform:uppercase}.notifyflow-table :deep(td){height:67px;font-size:10px;cursor:pointer}.kind-cell{display:flex;align-items:center;gap:10px}.kind-cell>span{width:35px;height:35px;display:grid;place-items:center;border-radius:10px;background:#edf4e5;color:#5d8238;font-size:18px}.kind-cell b,.kind-cell small{display:block}.kind-cell b{font-size:10px}.kind-cell small{max-width:210px;margin-top:2px;overflow:hidden;color:#858d87;font-size:8px;text-overflow:ellipsis;white-space:nowrap}.date-main,.date-detail{display:block}.date-detail{margin-top:2px;color:#929994;font-size:8px}.notifyflow-footer{min-height:61px;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;border-top:1px solid #e9ebe6;color:#7d8580;font-size:10px}.notifyflow-empty{min-height:270px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.notifyflow-empty>.q-icon{font-size:41px;color:#829177}.notifyflow-empty h3{margin:10px 0 3px}.notifyflow-empty p{margin:0;color:#858d87}.notifyflow-mobile-item{padding:15px;border:1px solid #e1e4de;border-radius:15px;background:#fff;cursor:pointer}.notifyflow-mobile-item header{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.mobile-meta{margin-top:13px;display:flex;flex-wrap:wrap;gap:8px 15px;color:#6f7872;font-size:9px}.notifyflow-mobile-item p{margin:12px 0 0;padding:9px;border-radius:8px;background:#fff0ee;color:#8b3d36;font-size:9px}.queue-strip{margin-top:16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px}.queue-strip article{padding:14px;display:flex;align-items:center;gap:10px;border:1px solid #e0e3dc;border-radius:14px;background:#fff}.queue-strip article>span{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:#f0f3ec}.queue-strip b,.queue-strip small{display:block}.queue-strip b{font-size:10px}.queue-strip small{margin-top:3px;color:#858d87;font-size:8px}.dispatch-dialog{width:min(780px,94vw);max-width:94vw;max-height:92vh;border-radius:20px}.dispatch-dialog__header{padding:21px 23px;display:flex;justify-content:space-between;gap:15px;border-bottom:1px solid #e8ebe5}.dispatch-dialog__header span{color:#78827b;font-size:8px;font-weight:900;letter-spacing:1.4px}.dispatch-dialog__header h2{margin:5px 0 2px;font-size:22px}.dispatch-dialog__header p{margin:0;color:#858d87;font-size:9px}.dispatch-dialog__body{display:grid;gap:12px;padding:18px 22px 24px}.dispatch-status-line{display:flex;flex-wrap:wrap;align-items:center;gap:7px}.detail-section{padding:15px;border:1px solid #e0e4dc;border-radius:15px;background:#fff}.detail-section>header{display:flex;align-items:center;gap:7px;margin-bottom:13px}.detail-section>header>.q-icon{font-size:19px;color:#63833e}.detail-section>header>b{font-size:11px}.detail-section>header>.q-badge{margin-left:auto}.detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 18px;margin:0}.detail-grid>div{min-width:0}.detail-grid dt,.metadata-list dt{color:#858d87;font-size:8px;text-transform:uppercase;letter-spacing:.6px}.detail-grid dd,.metadata-list dd{margin:3px 0 0;font-size:10px;overflow-wrap:anywhere}.mono{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}.detail-error{margin-top:13px;border:1px solid #efcfca;background:#fff2f0;color:#843b34;font-size:9px}.queue-progress{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:9px;margin-top:13px;color:#707970;font-size:8px}.queue-empty{display:flex;align-items:center;gap:8px;padding:10px;border-radius:10px;background:#f3f5f0;color:#7c847e;font-size:9px}.queue-empty .q-icon{font-size:18px}.metadata-list{display:grid;gap:7px;margin:0}.metadata-list>div{display:grid;grid-template-columns:minmax(120px,.35fr) minmax(0,1fr);gap:10px;padding:7px 0;border-bottom:1px solid #eff1ed}.metadata-list>div:last-child{border-bottom:0}.metadata-list dd{margin:0}
.remote-summary{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:11px}.delivery-list{display:grid;gap:9px}.delivery-list>article{padding:11px;border:1px solid #e5e8e1;border-radius:12px;background:#fafbf8}.delivery-list>article>div:first-child{display:flex;align-items:center;gap:7px}.delivery-list>article>div:first-child>span{display:flex;flex-direction:column}.delivery-list>article>div:first-child small{color:#7e8781;font-size:8px}.delivery-list>article>.q-badge{float:right;margin-top:-25px}.delivery-list dl{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0 0}.delivery-list dt{color:#858d87;font-size:7px;text-transform:uppercase}.delivery-list dd{margin:2px 0 0;font-size:8px}.delivery-list p{margin:9px 0 0;padding:7px;border-radius:7px;background:#fff0ee;color:#8c3f37;font-size:8px}.schedule-runs{display:grid;gap:7px;margin-top:13px}.schedule-runs>article{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:8px;padding:8px;border-radius:9px;background:#f5f7f2;font-size:8px}.timeline-list{display:grid;gap:0;margin:0;padding:0;list-style:none}.timeline-list li{display:grid;grid-template-columns:13px 1fr;gap:9px;position:relative;padding-bottom:14px}.timeline-list li:not(:last-child):before{content:'';position:absolute;left:5px;top:12px;bottom:0;width:1px;background:#dce2d7}.timeline-dot{z-index:1;width:11px;height:11px;margin-top:3px;border:2px solid #fff;border-radius:50%;background:#64843f;box-shadow:0 0 0 1px #bfcbb6}.timeline-dot--error{background:#ba5047;box-shadow:0 0 0 1px #e4b8b3}.timeline-list header{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.timeline-list header b{font-size:9px}.timeline-list time,.timeline-list small{color:#858d87;font-size:7px}.timeline-list p{margin:5px 0 0;padding:6px;border-radius:6px;background:#f5f7f2;font-size:7px;overflow-wrap:anywhere}
@media(max-width:1050px){.notifyflow-summary{grid-template-columns:repeat(2,1fr)}.notifyflow-toolbar{grid-template-columns:1fr 1fr}.notifyflow-toolbar>.q-input{grid-column:1/-1}}
@media(max-width:600px){.notifyflow-page{padding:24px 12px 90px}.notifyflow-intro>div:last-child{width:100%;justify-content:space-between}.notifyflow-summary{grid-template-columns:1fr 1fr;gap:8px}.notifyflow-summary article{min-height:95px;padding:13px;gap:9px}.summary-icon{width:36px;height:36px;font-size:18px}.notifyflow-summary b{font-size:20px}.notifyflow-summary p{display:none}.notifyflow-card__heading{align-items:flex-start;flex-direction:column;gap:6px}.notifyflow-toolbar{grid-template-columns:1fr;padding:12px}.notifyflow-toolbar>.q-input{grid-column:auto}.notifyflow-footer{align-items:flex-start;flex-direction:column;gap:9px;overflow-x:auto}.dispatch-dialog{width:calc(100vw - 16px);max-width:none;border-radius:15px}.dispatch-dialog__header{padding:16px}.dispatch-dialog__body{padding:13px}.detail-grid{grid-template-columns:1fr}.metadata-list>div{grid-template-columns:1fr;gap:2px}.delivery-list dl{grid-template-columns:1fr 1fr}.schedule-runs>article{grid-template-columns:1fr auto}.schedule-runs>article small{grid-column:1/-1}.timeline-list header{flex-direction:column;gap:2px}}
</style>
