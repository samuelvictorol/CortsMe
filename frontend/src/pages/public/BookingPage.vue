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
        <aside class="booking-summary"><span>SEU AGENDAMENTO</span><div v-if="!selectedService" class="summary-empty"><q-icon name="content_cut" /><p>Escolha um serviço para montar seu agendamento.</p></div><template v-else><h3>{{ selectedService.name }}</h3><div class="summary-line"><q-icon name="schedule" /><span>{{ selectedService.duration }} minutos</span></div><div class="summary-line"><q-icon name="calendar_today" /><span>{{ selectedDateLabel || 'Escolha uma data' }}</span></div><div class="summary-line"><q-icon name="alarm" /><span>{{ selectedSlot?.label || 'Escolha um horário' }}</span></div><q-separator spaced /><div class="summary-price"><span>Total</span><b>R$ {{ money(selectedService.price) }}</b></div><div v-if="selectedSlot" :class="['booking-auth-state', { authenticated: auth.isLogged }]"><q-icon :name="auth.isLogged ? 'verified_user' : 'person_outline'" /><div><b>{{ auth.isLogged ? `Agendando como ${auth.user?.name?.split(' ')[0]}` : 'Falta apenas entrar na sua conta' }}</b><small>{{ auth.isLogged ? 'Seus dados foram atualizados nesta tela.' : 'Sua escolha será mantida durante o login.' }}</small></div></div><q-btn rounded unelevated color="dark" size="lg" class="full-width q-mt-md booking-confirm-btn" no-caps :label="auth.isLogged ? 'Confirmar agendamento' : 'Entrar para confirmar'" :icon="auth.isLogged ? undefined : 'login'" icon-right="arrow_forward" :disable="!selectedSlot" :loading="confirming" @click="confirm" /><small class="safe-note"><q-icon name="lock" /> Reserva segura. Você poderá solicitar ajustes depois.</small></template></aside>
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
            <q-btn type="submit" rounded unelevated color="dark" size="lg" class="full-width" no-caps label="Entrar e continuar" icon-right="arrow_forward" :loading="loginLoading" />
            <div class="quick-login-separator"><span>ou</span></div>
            <p class="quick-login-register">Ainda não tem conta? <router-link :to="{ path: '/cadastro', query: { redirect: route.fullPath } }">Criar conta gratuitamente</router-link></p>
          </q-card-section>
        </q-form>
        <q-card-section class="quick-login-footer"><q-icon name="shield" /><span>Login seguro. Sua sessão fica ativa por até 90 dias.</span></q-card-section>
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
  if (!auth.isLogged) { loginDialog.value = true; return }
  confirming.value = true
  try { await api.post('/appointments', { slug: profile.value.slug, serviceId: selectedService.value._id, start: selectedSlot.value.start }); $q.notify({ type: 'positive', message: 'Agendamento confirmado! Você já pode vê-lo no seu painel.', icon: 'event_available' }); router.push('/user') }
  catch (error) { $q.notify({ type: 'negative', message: error.response?.data?.message || 'Não foi possível reservar.' }); loadSlots() }
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
onMounted(async () => { profile.value = (await api.get(`/public/barbers/${route.params.slug}`)).data.profile; selectedService.value = profile.value.services.find(s => s._id === route.query.service) || null; window.requestAnimationFrame(updateDateScroll) })
</script>
