<template>
  <q-page class="booking-page" v-if="profile">
    <header class="booking-header"><router-link :to="`/${profile.slug}`" class="barber-sign"><span class="barber-sign__mark">{{ profile.businessName[0] }}</span><span>{{ profile.businessName }}</span></router-link><q-btn :to="`/${profile.slug}`" flat rounded no-caps icon="arrow_back" label="Voltar para o site" /></header>
    <main class="booking-main container">
      <div class="booking-title"><span>AGENDAMENTO ONLINE</span><h1>Escolha seu momento.</h1><p>Os horários abaixo estão livres e atualizados em tempo real.</p></div>
      <div class="booking-layout">
        <section class="booking-flow">
          <div class="booking-step"><span class="step-number">1</span><div class="col"><h3>Qual experiência você quer?</h3><div class="booking-service-list"><button v-for="service in profile.services.filter(s => s.active)" :key="service._id" :class="{ active: selectedService?._id === service._id }" @click="selectService(service)"><span><b>{{ service.name }}</b><small>{{ service.description }}</small></span><span><b>R$ {{ money(service.price) }}</b><small>{{ service.duration }} min</small></span><q-icon :name="selectedService?._id === service._id ? 'check_circle' : 'radio_button_unchecked'" /></button></div></div></div>
          <div class="booking-step" :class="{ muted: !selectedService }"><span class="step-number">2</span><div class="col booking-date-step"><div class="booking-date-heading"><h3>Qual é o melhor dia?</h3><small>10 próximos dias</small></div><div class="date-picker-shell"><div ref="dateStrip" class="date-picker-row" @scroll="updateDateScroll"><button v-for="date in dates" :key="date.value" :class="{ active: selectedDate === date.value, closed: date.closed }" :disabled="!selectedService || date.closed" :title="date.closed ? 'Barbearia fechada neste dia' : ''" @click="chooseDate(date.value)"><small>{{ date.week }}</small><b>{{ date.day }}</b><span>{{ date.closed ? 'FECHADO' : date.month }}</span></button></div><q-btn v-if="selectedService" class="date-scroll-action" rounded unelevated color="dark" :icon="dateStripEnd ? 'calendar_month' : 'arrow_forward'" :label="dateStripEnd ? 'Ver mais' : undefined" :aria-label="dateStripEnd ? 'Abrir calendário completo' : 'Ver próximos dias'" @click="dateStripEnd ? openCalendar() : scrollDates()" /></div><div class="date-picker-hint"><q-icon name="swipe" /> Deslize ou use a seta para ver os próximos dias.</div></div></div>
          <div class="booking-step" :class="{ muted: !selectedDate }"><span class="step-number">3</span><div class="col"><h3>Escolha o horário</h3><div v-if="loadingSlots" class="q-py-md"><q-spinner-dots size="36px" /></div><div v-else-if="slots.length" class="slots-grid"><button v-for="slot in slots" :key="slot.start" :class="{ active: selectedSlot?.start === slot.start }" @click="selectedSlot = slot">{{ slot.label }}</button></div><div v-else-if="selectedDate" class="empty-slots"><q-icon name="event_busy" /> Nenhum horário disponível neste dia. Tente o próximo.</div></div></div>
        </section>
        <aside class="booking-summary">
          <div class="summary-label-row"><span>SEU AGENDAMENTO</span><span v-if="publicPlanName" :class="['public-plan-pill', { blocked: bookingBlocked }]">{{ publicPlanName }}</span></div>
          <div v-if="!selectedService" class="summary-empty"><q-icon name="content_cut" /><p>Escolha um serviço para montar seu agendamento.</p></div>
          <template v-else>
            <h3>{{ selectedService.name }}</h3>
            <div class="summary-line"><q-icon name="schedule" /><span>{{ selectedService.duration }} minutos</span></div>
            <div class="summary-line"><q-icon name="calendar_today" /><span>{{ selectedDateLabel || 'Escolha uma data' }}</span></div>
            <div class="summary-line"><q-icon name="alarm" /><span>{{ selectedSlot?.label || 'Escolha um horário' }}</span></div>
            <q-separator spaced />
            <div class="summary-price"><span>Total</span><b>R$ {{ money(selectedService.price) }}</b></div>
            <div v-if="bookingBlocked" class="booking-plan-lock"><q-icon name="lock_clock" /><div><b>{{ bookingBlockedTitle }}</b><small>{{ bookingBlockedMessage }}</small></div></div>
            <div v-else-if="selectedSlot" :class="['booking-auth-state', { authenticated: auth.isLogged }]"><q-icon :name="auth.isLogged ? 'verified_user' : 'person_outline'" /><div><b>{{ auth.isLogged ? `Agendando como ${auth.user?.name?.split(' ')[0]}` : 'Falta apenas entrar na sua conta' }}</b><small>{{ auth.isLogged ? 'Seus dados foram atualizados nesta tela.' : 'Sua escolha será mantida durante o login.' }}</small></div></div>
            <q-btn rounded unelevated color="dark" size="lg" :class="['full-width q-mt-md booking-confirm-btn', { 'booking-confirm-btn--locked': bookingBlocked }]" no-caps :label="confirmButtonLabel" :icon="bookingBlocked ? 'lock' : auth.isLogged ? undefined : 'login'" icon-right="arrow_forward" :disable="!selectedSlot" :loading="confirming" @click="confirm" />
            <small class="safe-note"><q-icon :name="bookingBlocked ? 'info' : 'lock'" /> {{ bookingBlocked ? 'O site e os horários continuam disponíveis para consulta.' : 'Reserva segura. Você poderá solicitar ajustes depois.' }}</small>
          </template>
        </aside>
      </div>
    </main>

    <q-dialog v-model="calendarDialog">
      <q-card class="booking-calendar-dialog"><q-card-section class="booking-calendar-head"><div><span>ESCOLHA OUTRA DATA</span><h2>Calendário completo</h2><p>Somente os dias de funcionamento podem ser selecionados.</p></div><q-btn flat round dense icon="close" aria-label="Fechar" v-close-popup /></q-card-section><q-card-section class="booking-calendar-body"><q-date v-model="calendarDate" mask="YYYY-MM-DD" minimal flat :options="isOperatingDate" :navigation-min-year-month="todayMonth" color="dark" @update:model-value="calendarPicked" /><aside><span>HORÁRIO DE FUNCIONAMENTO</span><template v-if="calendarHours"><h3>{{ fullDate(calendarDate) }}</h3><p><q-icon name="schedule" /> {{ calendarHours.start }} às {{ calendarHours.end }}</p><p v-if="calendarHours.breakStart"><q-icon name="coffee" /> Pausa: {{ calendarHours.breakStart }} às {{ calendarHours.breakEnd }}</p><small>Após escolher o dia, mostraremos apenas horários realmente livres.</small></template><template v-else><h3>Escolha um dia disponível</h3><p>Os dias fechados aparecem desabilitados.</p></template></aside></q-card-section></q-card>
    </q-dialog>

    <q-dialog v-model="loginDialog">
      <q-card class="quick-login-dialog">
        <q-card-section class="quick-login-header">
          <div class="quick-login-icon"><q-icon name="lock_open" /></div>
          <div class="col"><span>LOGIN RÁPIDO</span><h2>Entre sem perder seu horário.</h2><p>Serviço, data e horário continuam selecionados.</p></div>
          <q-btn flat round dense icon="close" aria-label="Fechar" v-close-popup />
        </q-card-section>
        <q-form @submit="quickLogin">
          <q-card-section class="quick-login-form">
            <q-input v-model="loginForm.identity" outlined rounded autofocus label="E-mail ou telefone" autocomplete="username">
              <template #prepend><q-icon name="person_outline" /></template>
            </q-input>
            <q-input v-model="loginForm.password" outlined rounded label="Senha" :type="showPassword ? 'text' : 'password'" autocomplete="current-password">
              <template #prepend><q-icon name="lock_outline" /></template>
              <template #append><q-icon :name="showPassword ? 'visibility_off' : 'visibility'" class="cursor-pointer" @click="showPassword = !showPassword" /></template>
            </q-input>
            <router-link class="quick-login-forgot" to="/esqueci-senha?perfil=cliente">Esqueci minha senha</router-link>
            <q-btn type="submit" rounded unelevated color="dark" size="lg" class="full-width" no-caps label="Entrar e continuar" icon-right="arrow_forward" :loading="loginLoading" />
            <div class="quick-login-separator"><span>ou</span></div>
            <p class="quick-login-register">Ainda não tem conta? <router-link :to="{ path: '/cadastro', query: { redirect: route.fullPath } }">Criar conta gratuitamente</router-link></p>
          </q-card-section>
        </q-form>
        <q-card-section class="quick-login-footer"><q-icon name="shield" /><span>Login seguro. Seus dados de acesso ficam salvos por até 120 dias.</span></q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
import { useAuthStore } from 'stores/auth-store'
const route = useRoute(); const router = useRouter(); const $q = useQuasar(); const auth = useAuthStore()
const profile = ref(null); const selectedService = ref(null); const selectedDate = ref(''); const selectedSlot = ref(null); const slots = ref([]); const loadingSlots = ref(false); const confirming = ref(false)
const loginDialog = ref(false); const loginLoading = ref(false); const showPassword = ref(false); const calendarDialog = ref(false); const calendarDate = ref(''); const dateStrip = ref(null); const dateStripEnd = ref(false)
const loginForm = reactive({ identity: '', password: '' })
const weekdays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']; const months = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']
const normalizeDateValue = value => String(value || '').replaceAll('/', '-')
const localDateValue = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const parseLocalDate = value => { const [year, month, day] = normalizeDateValue(value).split('-').map(Number); return new Date(year, month - 1, day) }
const todayValue = localDateValue(new Date()); const todayMonth = todayValue.slice(0, 7).replace('-', '/')
const businessHoursMap = computed(() => new Map((profile.value?.businessHours || []).map(hours => [hours.weekday, hours])))
const dates = computed(() => Array.from({ length: 10 }, (_, index) => { const date = new Date(); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() + index); const hours = businessHoursMap.value.get(date.getDay()); return { value: localDateValue(date), week: index === 0 ? 'HOJE' : weekdays[date.getDay()], day: date.getDate(), month: months[date.getMonth()], closed: !hours?.enabled } }))
const selectedDateLabel = computed(() => { const item = dates.value.find(date => date.value === selectedDate.value); if (item) return `${item.week}, ${item.day} ${item.month}`; return selectedDate.value ? fullDate(selectedDate.value) : '' })
const calendarHours = computed(() => calendarDate.value ? businessHoursMap.value.get(parseLocalDate(calendarDate.value).getDay()) : null)
const publicBilling = computed(() => profile.value?.billing || profile.value?.subscription || {})
const publicEntitlements = computed(() => profile.value?.entitlements || publicBilling.value?.entitlements || {})
const publicPlan = computed(() => publicBilling.value?.plan || publicBilling.value?.currentPlan || profile.value?.plan || {})
const publicPlanName = computed(() => publicPlan.value?.name || publicBilling.value?.planName || '')
const publicBillingStatus = computed(() => String(publicBilling.value?.status || publicBilling.value?.subscriptionStatus || '').toUpperCase())
const isFreePlan = computed(() => {
  const planValue = String(publicPlan.value?.slug || publicPlan.value?.code || publicPlan.value?.type || publicPlanName.value || '').toUpperCase()
  return publicBilling.value?.isFree === true || publicPlan.value?.isFree === true || ['FREE', 'GRATUITO', 'GRÁTIS'].some(item => planValue.includes(item))
})
const bookingEntitlement = computed(() => {
  const entitlements = publicEntitlements.value
  return entitlements.onlineBooking ?? entitlements.booking ?? entitlements.appointments ?? entitlements.canBook ?? entitlements.canCreateAppointments
})
const accountUnavailable = computed(() => ['SUSPENDED', 'EXPIRED', 'PAST_DUE', 'OVERDUE', 'CANCELED', 'CANCELLED', 'INACTIVE'].includes(publicBillingStatus.value))
const bookingBlocked = computed(() => bookingEntitlement.value === false || isFreePlan.value || accountUnavailable.value)
const bookingBlockedTitle = computed(() => isFreePlan.value ? 'Não disponível no plano gratuito' : 'Agendamento temporariamente indisponível')
const bookingBlockedMessage = computed(() => isFreePlan.value ? 'O profissional precisa ativar um pacote CortsMe para receber agendamentos online.' : 'O acesso do estabelecimento precisa ser reativado pelo profissional.')
const confirmButtonLabel = computed(() => bookingBlocked.value ? (isFreePlan.value ? 'Não disponível no plano gratuito' : 'Agendamento indisponível') : auth.isLogged ? 'Confirmar agendamento' : 'Entrar para confirmar')
const money = value => Number(value).toFixed(2).replace('.', ',')
function fullDate (value) { if (!value) return ''; return parseLocalDate(value).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) }
function isOperatingDate (value) { const normalized = normalizeDateValue(value); if (normalized < todayValue) return false; return Boolean(businessHoursMap.value.get(parseLocalDate(normalized).getDay())?.enabled) }
function selectService (service) { selectedService.value = service; selectedSlot.value = null; if (selectedDate.value) loadSlots() }
function chooseDate (value) { selectedDate.value = value; loadSlots() }
function updateDateScroll () { const strip = dateStrip.value; if (!strip) return; dateStripEnd.value = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 8 }
function scrollDates () { const strip = dateStrip.value; if (!strip) return; strip.scrollBy({ left: Math.max(strip.clientWidth - 80, 220), behavior: 'smooth' }); window.setTimeout(updateDateScroll, 450) }
function openCalendar () { calendarDate.value = selectedDate.value || dates.value.find(item => !item.closed)?.value || todayValue; calendarDialog.value = true }
function calendarPicked (value) { if (!value || !isOperatingDate(value)) return; selectedDate.value = value; calendarDialog.value = false; loadSlots() }
async function loadSlots () { if (!selectedService.value || !selectedDate.value) return; loadingSlots.value = true; selectedSlot.value = null; try { slots.value = (await api.get(`/public/barbers/${profile.value.slug}/availability`, { params: { date: selectedDate.value, duration: selectedService.value.duration } })).data.slots } finally { loadingSlots.value = false } }
async function confirm () {
  if (bookingBlocked.value) {
    $q.notify({ color: 'dark', icon: 'lock', position: 'top', timeout: 5000, message: bookingBlockedMessage.value, caption: bookingBlockedTitle.value })
    return
  }
  if (!auth.isLogged) { loginDialog.value = true; return }
  confirming.value = true
  try { await api.post('/appointments', { slug: profile.value.slug, serviceId: selectedService.value._id, start: selectedSlot.value.start }); $q.notify({ type: 'positive', message: 'Agendamento confirmado! Você já pode vê-lo no seu painel.', icon: 'event_available' }); router.push('/user') }
  catch (error) {
    if (error.response?.status === 402) $q.notify({ color: 'dark', icon: 'lock', position: 'top', timeout: 5000, message: 'O profissional precisa ativar um plano para receber agendamentos.', caption: 'Agendamento indisponível' })
    else $q.notify({ type: 'negative', message: error.response?.data?.message || 'Não foi possível reservar.' })
    loadSlots()
  }
  finally { confirming.value = false }
}
async function quickLogin () {
  loginLoading.value = true
  try {
    await auth.login(loginForm)
    loginDialog.value = false
    loginForm.password = ''
    $q.notify({ type: 'positive', message: 'Login realizado. Agora é só confirmar seu agendamento.', icon: 'verified_user', position: 'top' })
  } catch (error) {
    $q.notify({ type: 'negative', message: error.response?.data?.message || 'Não foi possível entrar. Confira seus dados.' })
  } finally { loginLoading.value = false }
}
onMounted(async () => {
  const { data } = await api.get(`/public/barbers/${route.params.slug}`)
  profile.value = { ...data.profile, billing: data.profile?.billing || data.billing, entitlements: data.profile?.entitlements || data.entitlements, plan: data.profile?.plan || data.plan }
  selectedService.value = profile.value.services.find(s => s._id === route.query.service) || null
  window.requestAnimationFrame(updateDateScroll)
})
</script>

<style scoped>
.summary-label-row{display:flex;align-items:center;justify-content:space-between;gap:8px}.summary-label-row>span:first-child{font-size:9px;font-weight:800;letter-spacing:1.5px;color:#858c87}.public-plan-pill{max-width:140px;padding:5px 8px;overflow:hidden;border-radius:999px;background:#e7f4da;color:#426628;font-size:7px;font-weight:800;letter-spacing:.7px;text-overflow:ellipsis;text-transform:uppercase;white-space:nowrap}.public-plan-pill.blocked{background:#f0e6dc;color:#755435}.booking-plan-lock{display:flex;align-items:flex-start;gap:10px;margin-top:14px;padding:13px;border:1px solid #ead8c4;border-radius:13px;background:#fff8ed;color:#563f29}.booking-plan-lock>.q-icon{flex:0 0 auto;width:31px;height:31px;display:grid;place-items:center;border-radius:9px;background:#f2dfc6;font-size:17px}.booking-plan-lock b,.booking-plan-lock small{display:block}.booking-plan-lock b{font-size:10px}.booking-plan-lock small{margin-top:3px;color:#7e6b58;font-size:8px;line-height:1.45}.booking-confirm-btn--locked{background:#6b6e6b!important;color:#fff!important}.booking-confirm-btn--locked :deep(.q-icon){color:#dbe8cf}@media(max-width:600px){.summary-label-row{align-items:flex-start;flex-direction:column}.public-plan-pill{max-width:100%}.booking-plan-lock{padding:11px}.booking-confirm-btn--locked{font-size:11px}}
.quick-login-forgot{align-self:flex-end;margin-top:-6px;color:#38423b;font-size:9px;font-weight:800}
</style>
