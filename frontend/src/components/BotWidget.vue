<template>
  <div v-if="profile?.bot?.enabled" class="bot-widget">
    <transition name="bot-pop">
      <div v-if="open" class="bot-panel">
        <div class="bot-header">
          <div class="row items-center"><q-avatar :color="botBlocked ? 'grey-5' : 'lime-5'" text-color="dark" :icon="botBlocked ? 'lock' : 'smart_toy'" /><div class="q-ml-sm"><b>{{ profile.bot.name || 'Cort' }}</b><small><span :class="botBlocked ? 'blocked-dot' : 'online-dot'" /> {{ botBlocked ? 'Aguardando ativação do plano' : 'Online agora' }}</small></div></div>
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
              <q-btn v-else-if="item.action" :to="botBlocked ? undefined : item.action.url" rounded unelevated color="dark" class="q-mt-sm" no-caps :label="botBlocked ? 'Recurso indisponível' : item.action.type === 'LOGIN' ? 'Entrar para agendar' : 'Ver horários livres'" :icon="botBlocked ? 'lock' : undefined" icon-right="arrow_forward" :disable="botBlocked" />
            </div>
          </div>
          <div v-if="typing" class="bot-message bot"><div class="typing"><i /><i /><i /></div></div>
        </div>
        <div v-if="botBlocked" class="bot-plan-lock"><q-icon name="lock_clock" /><div><b>Assistente disponível nos planos pagos</b><small>O profissional precisa ativar um pacote CortsMe para liberar as conversas e os agendamentos.</small></div></div>
        <div v-if="!botBlocked" class="bot-suggestions"><button v-for="suggestion in suggestions" :key="suggestion" @click="send(suggestion)">{{ suggestion }}</button></div>
        <form class="bot-input" @submit.prevent="send(input)"><input v-model="input" :placeholder="botBlocked ? 'Assistente temporariamente indisponível' : 'Digite sua dúvida...'" aria-label="Mensagem para o assistente" :disabled="botBlocked"><q-btn round unelevated color="dark" :icon="botBlocked ? 'lock' : 'arrow_upward'" type="submit" :disable="botBlocked || !input.trim()" /></form>
        <div class="bot-powered">Assistente exclusivo de {{ profile.businessName }} · CortsMe</div>
      </div>
    </transition>
    <q-btn v-if="!open" class="bot-trigger" round unelevated color="dark" icon="chat_bubble" size="lg" @click="openBot"><q-badge floating color="lime-5" rounded /></q-btn>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { api } from 'boot/axios'

const props = defineProps({ profile: Object })
const open = ref(false); const input = ref(''); const typing = ref(false); const scroll = ref(null)
const messages = ref([]); const suggestions = ref(props.profile?.bot?.menuOptions?.slice(0, 4) || [])
const serverBlocked = ref(false)
const remoteBilling = ref(null); const remoteEntitlements = ref(null); const remotePlan = ref(null)
const billing = computed(() => props.profile?.billing || props.profile?.subscription || remoteBilling.value || {})
const entitlements = computed(() => props.profile?.entitlements || remoteEntitlements.value || billing.value?.entitlements || {})
const plan = computed(() => billing.value?.plan || billing.value?.currentPlan || props.profile?.plan || remotePlan.value || {})
const planValue = computed(() => String(plan.value?.slug || plan.value?.code || plan.value?.type || plan.value?.name || billing.value?.planName || '').toUpperCase())
const statusValue = computed(() => String(billing.value?.status || billing.value?.subscriptionStatus || '').toUpperCase())
const isFreePlan = computed(() => billing.value?.isFree === true || plan.value?.isFree === true || ['FREE', 'GRATUITO', 'GRÁTIS'].some(item => planValue.value.includes(item)))
const botEntitlement = computed(() => entitlements.value.bot ?? entitlements.value.chatbot ?? entitlements.value.botInteractions ?? entitlements.value.canUseBot)
const botBlocked = computed(() => serverBlocked.value || botEntitlement.value === false || isFreePlan.value || ['SUSPENDED', 'EXPIRED', 'PAST_DUE', 'OVERDUE', 'CANCELED', 'CANCELLED', 'INACTIVE'].includes(statusValue.value))
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
  if (!messages.value.length) messages.value.push({ from: 'bot', text: botBlocked.value ? 'Olá! Este assistente está visível para você conhecer o recurso, mas as conversas e os agendamentos ainda não foram liberados. O profissional precisa ativar um plano CortsMe.' : props.profile.bot.greeting })
}
async function send (text) {
  const message = String(text || '').trim()
  if (!message) return
  if (botBlocked.value) {
    if (!messages.value.some(item => item.blockedReminder)) messages.value.push({ from: 'bot', blockedReminder: true, text: 'Esta conversa não pode ser enviada agora. Peça ao profissional para ativar um plano CortsMe.' })
    return
  }
  messages.value.push({ from: 'user', text: message }); input.value = ''; typing.value = true
  await nextTick(); scroll.value?.scrollTo({ top: scroll.value.scrollHeight, behavior: 'smooth' })
  try {
    const { data } = await api.post(`/public/barbers/${props.profile.slug}/bot`, { message, sessionId })
    typing.value = false
    messages.value.push({ from: 'bot', text: data.answer, action: data.action })
    suggestions.value = data.suggestions || []
  } catch (error) {
    typing.value = false
    if (error.response?.status === 402) {
      serverBlocked.value = true
      suggestions.value = []
      messages.value.push({ from: 'bot', text: 'O acesso deste assistente precisa ser reativado pelo profissional. Nenhuma mensagem foi processada ou agendamento criado.' })
    } else messages.value.push({ from: 'bot', text: 'Tive uma pequena pausa. Tente novamente em instantes.' })
  }
  await nextTick(); scroll.value?.scrollTo({ top: scroll.value.scrollHeight, behavior: 'smooth' })
}
onMounted(async () => {
  if (props.profile?.billing || props.profile?.entitlements || !props.profile?.slug) return
  try {
    const { data } = await api.get(`/public/barbers/${props.profile.slug}`)
    remoteBilling.value = data.billing || data.profile?.billing || null
    remoteEntitlements.value = data.entitlements || data.profile?.entitlements || null
    remotePlan.value = data.plan || data.profile?.plan || null
  } catch { /* mantém o bot disponível quando o servidor não informa o plano */ }
})
</script>

<style scoped>
.blocked-dot{display:inline-block;width:7px;height:7px;margin-right:5px;border-radius:50%;background:#9ba09c}.bot-plan-lock{display:flex;align-items:flex-start;gap:10px;margin:0 12px 8px;padding:12px;border:1px solid #e6d6c2;border-radius:13px;background:#fff7eb;color:#543e2a}.bot-plan-lock>.q-icon{flex:0 0 auto;width:29px;height:29px;display:grid;place-items:center;border-radius:9px;background:#efddc5;font-size:16px}.bot-plan-lock b,.bot-plan-lock small{display:block}.bot-plan-lock b{font-size:10px}.bot-plan-lock small{margin-top:3px;color:#7b6855;font-size:8px;line-height:1.45}.bot-input input:disabled{cursor:not-allowed;color:#7c827e;background:#f0f1ee}.bot-input:has(input:disabled){background:#f0f1ee}.bot-message.bot .bot-message__content:has(+ *){border-color:#e1e4de}@media(max-width:600px){.bot-plan-lock{margin:0 9px 7px;padding:10px}}
</style>
