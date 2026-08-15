<template>
  <div v-if="profile?.bot?.enabled" class="bot-widget">
    <transition name="bot-pop">
      <div v-if="open" class="bot-panel">
        <div class="bot-header">
          <div class="row items-center"><q-avatar color="lime-5" text-color="dark" icon="smart_toy" /><div class="q-ml-sm"><b>{{ profile.bot.name || 'Cort' }}</b><small><span class="online-dot" /> Online agora</small></div></div>
          <q-btn flat round dense icon="close" color="white" @click="open = false" />
        </div>
        <div ref="scroll" class="bot-messages">
          <div v-for="(item, index) in messages" :key="index" :class="['bot-message', item.from]">
            <div class="bot-message__content">
              <span>{{ item.text }}</span>
              <div v-if="item.action?.type === 'SHOW_MAP' && safeMapUrl(item.action.url)" class="bot-map-card">
                <iframe :src="safeMapUrl(item.action.url)" :title="item.action.title || 'Localização'" loading="lazy" referrerpolicy="no-referrer-when-downgrade" />
                <a :href="item.action.url" target="_blank" rel="noopener">Abrir mapa completo <q-icon name="open_in_new" /></a>
              </div>
              <q-btn v-else-if="item.action" :to="item.action.url" rounded unelevated color="dark" class="q-mt-sm" no-caps :label="item.action.type === 'LOGIN' ? 'Entrar para agendar' : 'Ver horários livres'" icon-right="arrow_forward" />
            </div>
          </div>
          <div v-if="typing" class="bot-message bot"><div class="typing"><i /><i /><i /></div></div>
        </div>
        <div class="bot-suggestions"><button v-for="suggestion in suggestions" :key="suggestion" @click="send(suggestion)">{{ suggestion }}</button></div>
        <form class="bot-input" @submit.prevent="send(input)"><input v-model="input" placeholder="Digite sua dúvida..." aria-label="Mensagem para o assistente"><q-btn round unelevated color="dark" icon="arrow_upward" type="submit" :disable="!input.trim()" /></form>
        <div class="bot-powered">Assistente exclusivo de {{ profile.businessName }} · CortsMe</div>
      </div>
    </transition>
    <q-btn v-if="!open" class="bot-trigger" round unelevated color="dark" icon="chat_bubble" size="lg" @click="openBot"><q-badge floating color="lime-5" rounded /></q-btn>
  </div>
</template>

<script setup>
import { nextTick, ref } from 'vue'
import { api } from 'boot/axios'

const props = defineProps({ profile: Object })
const open = ref(false); const input = ref(''); const typing = ref(false); const scroll = ref(null)
const messages = ref([]); const suggestions = ref(props.profile?.bot?.menuOptions?.slice(0, 4) || [])
const sessionId = crypto.randomUUID?.() || String(Date.now())
function safeMapUrl (value) {
  try {
    const url = new URL(value)
    const allowed = ['www.google.com', 'google.com', 'maps.google.com', 'www.openstreetmap.org', 'openstreetmap.org']
    return url.protocol === 'https:' && allowed.includes(url.hostname) ? url.toString() : ''
  } catch { return '' }
}
function openBot () {
  open.value = true
  if (!messages.value.length) messages.value.push({ from: 'bot', text: props.profile.bot.greeting })
}
async function send (text) {
  const message = String(text || '').trim()
  if (!message) return
  messages.value.push({ from: 'user', text: message }); input.value = ''; typing.value = true
  await nextTick(); scroll.value?.scrollTo({ top: scroll.value.scrollHeight, behavior: 'smooth' })
  try {
    const { data } = await api.post(`/public/barbers/${props.profile.slug}/bot`, { message, sessionId })
    typing.value = false
    messages.value.push({ from: 'bot', text: data.answer, action: data.action })
    suggestions.value = data.suggestions || []
  } catch { typing.value = false; messages.value.push({ from: 'bot', text: 'Tive uma pequena pausa. Tente novamente em instantes.' }) }
  await nextTick(); scroll.value?.scrollTo({ top: scroll.value.scrollHeight, behavior: 'smooth' })
}
</script>
