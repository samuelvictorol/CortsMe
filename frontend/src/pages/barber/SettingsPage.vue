<template>
  <q-page class="dashboard-page" v-if="profile">
    <div class="page-intro"><div><span class="page-overline">CONFIGURAÇÕES</span><h1>Seu negócio</h1><p>Serviços, horários e integrações usados pelo site, agenda e bot.</p></div><q-btn rounded unelevated color="dark" no-caps label="Salvar alterações" icon="save" :loading="saving" @click="save" /></div>
    <div class="settings-grid">
      <section class="panel-card settings-card"><div class="panel-heading"><div><span>INFORMAÇÕES</span><h3>Perfil da barbearia</h3></div></div><div class="form-stack"><q-input v-model="profile.businessName" outlined rounded label="Nome do negócio" /><q-input v-model="profile.description" outlined rounded type="textarea" autogrow label="Descrição" /><q-input v-model="profile.address" outlined rounded label="Endereço" icon="location_on" /><q-input v-model="profile.whatsapp" outlined rounded label="WhatsApp" prefix="+" hint="Código do país + DDD + número" /></div></section>
      <section class="panel-card settings-card services-card"><div class="panel-heading"><div><span>CATÁLOGO</span><h3>Serviços</h3></div><q-btn flat round icon="add" @click="addService" /></div><div class="service-editor" v-for="(service, index) in profile.services" :key="service._id || index"><div class="row items-center"><q-toggle v-model="service.active" color="positive" /><q-input v-model="service.name" dense borderless class="col text-weight-medium" /><q-btn flat round dense icon="delete_outline" @click="profile.services.splice(index, 1)" /></div><q-input v-model="service.description" outlined rounded dense label="Descrição" /><div class="row q-col-gutter-sm"><q-input v-model.number="service.duration" outlined rounded dense type="number" suffix="min" class="col" /><q-input v-model.number="service.price" outlined rounded dense type="number" prefix="R$" class="col" /></div></div></section>
      <section class="panel-card settings-card hours-card"><div class="panel-heading"><div><span>DISPONIBILIDADE</span><h3>Horários de funcionamento</h3></div></div><div class="hour-row" v-for="hour in sortedHours" :key="hour.weekday"><q-toggle v-model="hour.enabled" color="positive" /><b>{{ days[hour.weekday] }}</b><template v-if="hour.enabled"><q-input v-model="hour.start" dense outlined rounded type="time" /><span>até</span><q-input v-model="hour.end" dense outlined rounded type="time" /><small>Pausa</small><q-input v-model="hour.breakStart" dense outlined rounded type="time" /><span>—</span><q-input v-model="hour.breakEnd" dense outlined rounded type="time" /></template><span v-else class="closed-label">Fechado</span></div></section>
      <section class="panel-card settings-card"><div class="panel-heading"><div><span>AUTOMAÇÕES</span><h3>Webhook</h3></div></div><p class="settings-copy">Receba um POST sempre que um agendamento for criado ou atualizado.</p><q-input v-model="profile.webhookUrl" outlined rounded label="URL do webhook" placeholder="https://seu-sistema.com/webhook" /><div class="webhook-info"><q-icon name="bolt" /><span>Eventos enviados: <b>appointment.created</b>, <b>appointment.updated</b> e <b>appointment.deleted</b>.</span></div></section>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
const $q = useQuasar(); const profile = ref(null); const saving = ref(false); const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const sortedHours = computed(() => [...(profile.value?.businessHours || [])].sort((a, b) => (a.weekday === 0 ? 7 : a.weekday) - (b.weekday === 0 ? 7 : b.weekday)))
function addService () { profile.value.services.push({ name: 'Novo serviço', description: '', duration: 30, price: 0, active: true }) }
async function save () { saving.value = true; try { profile.value = (await api.put('/barber/profile', profile.value)).data.profile; $q.notify({ type: 'positive', message: 'Configurações salvas.' }) } catch (error) { $q.notify({ type: 'negative', message: error.response?.data?.message || 'Não foi possível salvar.' }) } finally { saving.value = false } }
onMounted(async () => { profile.value = (await api.get('/barber/profile')).data.profile })
</script>
