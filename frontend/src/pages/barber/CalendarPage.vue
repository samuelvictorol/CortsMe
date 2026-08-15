<template>
  <q-page class="dashboard-page calendar-page">
    <div class="page-intro"><div><span class="page-overline">AGENDA INTELIGENTE</span><h1>Meu calendário</h1><p>Visualize, mova e acompanhe todos os atendimentos.</p></div><q-btn rounded unelevated color="dark" no-caps label="Adicionar horário" icon="add" @click="openNew" /></div>
    <div class="calendar-toolbar"><div class="calendar-legend"><span><i class="confirmed" /> Confirmado</span><span><i class="pending" /> Pendente</span><span><i class="completed" /> Concluído</span></div><q-btn-toggle v-model="mobileView" class="lt-md" rounded unelevated toggle-color="dark" :options="[{ label: 'Dia', value: 'timeGridDay' }, { label: 'Mês', value: 'dayGridMonth' }]" @update:model-value="changeView" /></div>
    <section class="panel-card full-calendar-card"><FullCalendar ref="calendarRef" :options="calendarOptions" /></section>

    <q-dialog v-model="dialog"><q-card class="appointment-dialog"><q-card-section class="dialog-title"><div><span>{{ editing ? 'DETALHES DO AGENDAMENTO' : 'NOVO AGENDAMENTO' }}</span><h3>{{ editing ? form.customerName || 'Atendimento' : 'Reserve um horário manual' }}</h3></div><q-btn flat round icon="close" aria-label="Fechar" v-close-popup /></q-card-section>
      <q-card-section v-if="editing" class="appointment-customer-card"><q-avatar size="64px" color="grey-3" text-color="dark"><img v-if="customerAvatar" :src="customerAvatar"><span v-else>{{ initials(customerName) }}</span></q-avatar><div class="col"><span>CLIENTE</span><b>{{ customerName }}</b><small>{{ customerProfile?.email || editing.user?.email || 'E-mail não informado' }}</small><small>{{ customerProfile?.phone || editing.user?.phone || form.customerPhone || 'Telefone não informado' }}</small></div><div v-if="customerLoading" class="customer-loading-mini"><q-spinner-dots /></div><div v-else class="appointment-customer-stats"><b>{{ customerProfile?.completedCuts || 0 }}</b><span>cortes concluídos</span><q-btn flat rounded dense no-caps label="Ver cliente" icon-right="arrow_forward" @click="goCustomer" /></div></q-card-section>
      <q-card-section class="q-gutter-md"><q-input v-model="form.customerName" outlined rounded label="Nome do cliente" /><q-input v-model="form.customerPhone" outlined rounded label="Telefone" mask="(##) #####-####" /><q-select v-model="form.serviceId" :options="serviceOptions" emit-value map-options outlined rounded label="Serviço" /><q-input v-model="form.start" outlined rounded type="datetime-local" label="Data e horário" stack-label /><q-select v-if="editing" v-model="form.status" :options="statusOptions" emit-value map-options outlined rounded label="Status" /><q-input v-model="form.note" outlined rounded type="textarea" label="Observações" autogrow /></q-card-section><q-card-actions class="q-pa-md"><q-btn v-if="editing" flat rounded color="negative" no-caps label="Excluir" icon="delete_outline" @click="remove" /><q-space /><q-btn flat rounded no-caps label="Cancelar" v-close-popup /><q-btn unelevated rounded color="dark" no-caps :label="editing ? 'Salvar alterações' : 'Criar agendamento'" :loading="saving" @click="save" /></q-card-actions></q-card></q-dialog>
  </q-page>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useRoute, useRouter } from 'vue-router'
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import ptBrLocale from '@fullcalendar/core/locales/pt-br'
import { api } from 'boot/axios'
const $q = useQuasar(); const route = useRoute(); const router = useRouter(); const calendarRef = ref(null); const appointments = ref([]); const profile = ref(null); const dialog = ref(false); const editing = ref(null); const saving = ref(false); const mobileView = ref('timeGridDay'); const customerProfile = ref(null); const customerLoading = ref(false)
const emptyForm = () => ({ customerName: '', customerPhone: '', serviceId: '', start: '', status: 'CONFIRMED', note: '' }); const form = reactive(emptyForm())
const serviceOptions = computed(() => { const options = profile.value?.services?.filter(s => s.active).map(s => ({ label: `${s.name} · ${s.duration} min`, value: s._id })) || []; if (editing.value?.serviceId && !options.some(item => item.value === String(editing.value.serviceId))) options.unshift({ label: `${editing.value.serviceName} · ${editing.value.duration} min`, value: String(editing.value.serviceId) }); return options })
const customerAvatar = computed(() => customerProfile.value?.avatar || editing.value?.user?.avatar || '')
const customerName = computed(() => customerProfile.value?.name || editing.value?.user?.name || form.customerName || 'Cliente')
const statusOptions = [{ label: 'Confirmado', value: 'CONFIRMED' }, { label: 'Pendente', value: 'PENDING' }, { label: 'Concluído', value: 'COMPLETED' }, { label: 'Cancelado', value: 'CANCELLED' }]
const calendarOptions = computed(() => ({ plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin], locale: ptBrLocale, initialView: $q.screen.lt.md ? 'timeGridDay' : 'timeGridWeek', height: 'auto', firstDay: 1, nowIndicator: true, allDaySlot: false, slotMinTime: '07:00:00', slotMaxTime: '22:00:00', slotDuration: '00:30:00', expandRows: true, editable: false, selectable: true, headerToolbar: { left: 'prev,next today', center: 'title', right: $q.screen.lt.md ? '' : 'dayGridMonth,timeGridWeek,timeGridDay' }, buttonText: { today: 'Hoje', month: 'Mês', week: 'Semana', day: 'Dia' }, events: appointments.value.map(item => ({ id: item._id, title: `${item.user?.name || item.customerName || 'Cliente'} · ${item.serviceName}`, start: item.start, end: item.end, classNames: [`event-${item.status.toLowerCase()}`], extendedProps: item })), select: info => openNew(info.start), eventClick: info => openEdit(info.event.extendedProps), datesSet: loadAppointments }))
function localInput (date) { const d = new Date(date); const pad = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}` }
function openNew (date = new Date(Date.now() + 3600000)) { editing.value = null; Object.assign(form, emptyForm(), { start: localInput(date) }); dialog.value = true }
const initials = value => String(value || 'CL').split(' ').slice(0, 2).map(item => item[0]).join('').toUpperCase()
async function openEdit (item) { editing.value = item; customerProfile.value = null; Object.assign(form, { customerName: item.customerName || item.user?.name || '', customerPhone: item.customerPhone || item.user?.phone || '', serviceId: String(item.serviceId || ''), start: localInput(item.start), status: item.status, note: item.note }); dialog.value = true; customerLoading.value = true; try { customerProfile.value = (await api.get(`/barber/customers/appointment/${item._id}`)).data.customer } catch { customerProfile.value = null } finally { customerLoading.value = false } }
function goCustomer () { const appointmentId = editing.value?._id; dialog.value = false; if (appointmentId) router.push({ path: '/barber/clientes', query: { appointment: appointmentId } }) }
async function loadAppointments () { const view = calendarRef.value?.getApi()?.view; const params = { page: 1, limit: 100, from: view?.activeStart?.toISOString(), to: view?.activeEnd?.toISOString() }; appointments.value = (await api.get('/barber/appointments', { params })).data.data }
async function save () { saving.value = true; try { if (editing.value) await api.patch(`/barber/appointments/${editing.value._id}`, form); else await api.post('/barber/appointments', form); $q.notify({ type: 'positive', message: 'Agenda atualizada.' }); dialog.value = false; await loadAppointments() } catch (error) { $q.notify({ type: 'negative', message: error.response?.data?.message || 'Não foi possível salvar.' }) } finally { saving.value = false } }
function remove () { $q.dialog({ title: 'Excluir agendamento?', message: 'Essa ação remove o horário da agenda.', cancel: true, persistent: true }).onOk(async () => { await api.delete(`/barber/appointments/${editing.value._id}`); dialog.value = false; loadAppointments() }) }
function changeView (view) { calendarRef.value?.getApi().changeView(view) }
onMounted(async () => {
  profile.value = (await api.get('/barber/profile')).data.profile
  await loadAppointments()
  if (route.query.appointment) {
    try {
      const selected = appointments.value.find(item => item._id === route.query.appointment) || (await api.get(`/barber/appointments/${route.query.appointment}`)).data.appointment
      await router.replace({ path: '/barber/calendario' })
      await openEdit(selected)
    } catch (error) {
      $q.notify({ type: 'negative', message: error.response?.data?.message || 'Não foi possível abrir o agendamento.' })
    }
  }
})
</script>
