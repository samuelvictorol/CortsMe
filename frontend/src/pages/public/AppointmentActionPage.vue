<template>
  <q-page class="action-page">
    <main class="action-card">
      <header class="action-card__header"><span><q-icon name="event_available" /></span><div><small>CORTSME · AGENDAMENTO</small><b>{{ businessName }}</b></div></header>

      <div v-if="loading" class="action-state"><q-spinner-dots size="48px" color="dark" /><p>Buscando os dados do seu horário…</p></div>
      <div v-else-if="error" class="action-state"><q-icon name="link_off" size="54px" color="negative" /><h1>Não conseguimos abrir este link.</h1><p>{{ error }}</p><q-btn to="/" rounded unelevated color="dark" no-caps label="Ir para o CortsMe" /></div>
      <div v-else-if="completedAction" class="action-state"><q-icon :name="completedAction === 'cancel' ? 'event_busy' : 'verified'" size="56px" :color="completedAction === 'cancel' ? 'negative' : 'positive'" /><h1>{{ completedAction === 'cancel' ? 'Agendamento cancelado.' : 'Presença confirmada.' }}</h1><p>{{ resultMessage }}</p><q-btn v-if="publicPage" :href="publicPage" rounded unelevated color="dark" no-caps label="Visitar a barbearia" icon-right="arrow_forward" /></div>

      <template v-else>
        <section class="action-heading"><span>CONFIRME EM POUCOS TOQUES</span><h1>Seu horário está chegando.</h1><p>Confira os dados antes de confirmar ou liberar o horário para outra pessoa.</p></section>
        <section class="appointment-summary">
          <div class="date-block"><small>{{ month }}</small><b>{{ day }}</b><span>{{ weekday }}</span></div>
          <div class="appointment-summary__main"><q-badge rounded :color="statusColor" :label="statusLabel" /><h2>{{ serviceName }}</h2><p><q-icon name="schedule" /> {{ dateLabel }} às {{ timeLabel }}</p><p v-if="address"><q-icon name="location_on" /> {{ address }}</p></div>
        </section>
        <div v-if="alreadyResolved" class="resolved-note"><q-icon name="info" /><span>Este agendamento já está {{ String(status).toUpperCase() === 'CANCELLED' ? 'cancelado' : 'concluído' }}. Nenhuma ação adicional é necessária.</span></div>
        <div v-else class="action-buttons"><q-btn v-if="canConfirm" rounded unelevated color="dark" size="lg" no-caps label="Confirmar presença" icon="check_circle" :loading="submitting === 'confirm'" :disable="Boolean(submitting)" @click="act('confirm')" /><q-btn v-if="canCancel" rounded outline color="negative" size="lg" no-caps label="Cancelar agendamento" icon="event_busy" :loading="submitting === 'cancel'" :disable="Boolean(submitting)" @click="confirmCancellation" /></div>
        <small class="action-security"><q-icon name="lock" /> Este link só permite agir neste agendamento e não mostra dados de outros clientes.</small>
      </template>
    </main>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'

const route = useRoute()
const $q = useQuasar()
const loading = ref(true)
const error = ref('')
const payload = ref({})
const submitting = ref('')
const completedAction = ref('')
const resultMessage = ref('A barbearia receberá a atualização imediatamente.')
const token = computed(() => String(route.params.token || ''))
const appointment = computed(() => payload.value.appointment || payload.value.data?.appointment || payload.value.data || payload.value)
const profile = computed(() => payload.value.profile || appointment.value.business || appointment.value.profile || {})
const actions = computed(() => payload.value.actions || payload.value.data?.actions || {})
const businessName = computed(() => profile.value.businessName || payload.value.businessName || 'Seu estabelecimento')
const serviceName = computed(() => appointment.value.serviceName || appointment.value.service?.name || 'Atendimento agendado')
const status = computed(() => appointment.value.status || payload.value.status || '')
const start = computed(() => new Date(appointment.value.start || appointment.value.scheduledAt || Date.now()))
const address = computed(() => profile.value.address || payload.value.address || '')
const publicPage = computed(() => payload.value.publicUrl || (profile.value.slug ? `/${profile.value.slug}` : ''))
const day = computed(() => String(start.value.getDate()).padStart(2, '0'))
const month = computed(() => start.value.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase())
const weekday = computed(() => start.value.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''))
const dateLabel = computed(() => start.value.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }))
const timeLabel = computed(() => start.value.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
const statusLabel = computed(() => ({ CONFIRMED: 'Confirmado', PENDING: 'Aguardando confirmação', CANCELLED: 'Cancelado', COMPLETED: 'Concluído' }[String(status.value).toUpperCase()] || 'Agendado'))
const statusColor = computed(() => ({ CONFIRMED: 'positive', PENDING: 'warning', CANCELLED: 'negative', COMPLETED: 'blue-grey' }[String(status.value).toUpperCase()] || 'grey-6'))
const hasExplicitActions = computed(() => Object.prototype.hasOwnProperty.call(actions.value, 'canConfirm') || Object.prototype.hasOwnProperty.call(actions.value, 'canCancel'))
const canConfirm = computed(() => hasExplicitActions.value ? Boolean(actions.value.canConfirm) : !['CONFIRMED', 'CANCELLED', 'COMPLETED'].includes(String(status.value).toUpperCase()))
const canCancel = computed(() => hasExplicitActions.value ? Boolean(actions.value.canCancel) : !['CANCELLED', 'COMPLETED'].includes(String(status.value).toUpperCase()))
const alreadyResolved = computed(() => payload.value.canAct === false || (!canConfirm.value && !canCancel.value))

async function load () {
  loading.value = true
  error.value = ''
  try { payload.value = (await api.get(`/public/appointment-actions/${encodeURIComponent(token.value)}`)).data || {} }
  catch (requestError) { error.value = requestError.response?.data?.message || 'O link pode ter expirado ou já ter sido utilizado.' }
  finally { loading.value = false }
}

async function act (action) {
  submitting.value = action
  try {
    const { data } = await api.post(`/public/appointment-actions/${encodeURIComponent(token.value)}`, { action })
    payload.value = {
      ...payload.value,
      ...(data || {}),
      appointment: { ...appointment.value, ...(data?.status ? { status: data.status } : {}) },
      actions: { canConfirm: false, canCancel: false }
    }
    completedAction.value = action
    resultMessage.value = data?.message || resultMessage.value
  } catch (requestError) { $q.notify({ type: 'negative', message: requestError.response?.data?.message || 'Não foi possível atualizar o agendamento.' }) }
  finally { submitting.value = '' }
}

function confirmCancellation () {
  $q.dialog({ title: 'Cancelar este agendamento?', message: 'O horário será liberado para outra pessoa.', cancel: true, persistent: true, ok: { label: 'Sim, cancelar', color: 'negative', rounded: true }, cancel: { label: 'Manter horário', flat: true, rounded: true } }).onOk(() => act('cancel'))
}

onMounted(load)
</script>

<style scoped>
.action-page{min-height:calc(100vh - 76px);display:grid;place-items:center;padding:44px 16px 82px;background:radial-gradient(circle at 80% 15%,#eaf4dd,transparent 30%),#f4f5f0;color:#171b19}.action-card{width:min(680px,100%);min-height:610px;padding:34px 40px 42px;border:1px solid #dde2da;border-radius:28px;background:#fff;box-shadow:0 28px 80px rgba(23,31,26,.09)}.action-card__header{display:flex;align-items:center;gap:11px}.action-card__header>span{width:45px;height:45px;display:grid;place-items:center;border-radius:14px;background:#18201a;color:#c8f45d;font-size:23px}.action-card__header small,.action-card__header b{display:block}.action-card__header small{color:#858d87;font-size:7px;font-weight:900;letter-spacing:1.3px}.action-card__header b{margin-top:3px;font-size:13px}.action-heading{margin:48px 0 27px}.action-heading>span{color:#72953e;font-size:8px;font-weight:900;letter-spacing:1.6px}.action-heading h1,.action-state h1{margin:8px 0;font-size:36px;line-height:1.02;letter-spacing:-1.8px}.action-heading p,.action-state p{margin:0;color:#737c76;font-size:12px;line-height:1.7}.appointment-summary{padding:20px;display:grid;grid-template-columns:76px 1fr;gap:20px;border:1px solid #e0e4dc;border-radius:18px;background:#fafbf8}.date-block{display:flex;flex-direction:column;align-items:center;justify-content:center;border-right:1px solid #e1e5de}.date-block small{color:#719044;font-size:9px;font-weight:900}.date-block b{font-size:34px;line-height:1.1}.date-block span{color:#858d87;font-size:9px;text-transform:capitalize}.appointment-summary__main h2{margin:9px 0;font-size:20px}.appointment-summary__main p{margin:5px 0;color:#6f7872;font-size:11px}.appointment-summary__main .q-icon{margin-right:5px}.resolved-note{margin-top:18px;padding:13px;display:flex;gap:8px;border-radius:12px;background:#f1f4ed;color:#687363;font-size:10px}.action-buttons{margin-top:22px;display:grid;grid-template-columns:1fr 1fr;gap:10px}.action-buttons .q-btn{min-height:52px}.action-security{display:flex;align-items:center;justify-content:center;gap:5px;margin-top:18px;color:#919892;font-size:8px;text-align:center}.action-state{min-height:480px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.action-state p{max-width:430px;margin:0 0 24px}@media(max-width:560px){.action-page{padding:12px 8px 76px}.action-card{min-height:570px;padding:26px 17px 34px;border-radius:21px}.action-heading{margin:38px 0 22px}.action-heading h1{font-size:30px}.appointment-summary{grid-template-columns:61px 1fr;gap:13px;padding:15px}.date-block b{font-size:29px}.action-buttons{grid-template-columns:1fr}.action-security{align-items:flex-start;text-align:left}}
</style>
