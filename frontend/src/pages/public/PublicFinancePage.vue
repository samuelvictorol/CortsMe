<template>
  <q-page class="public-finance-page">
    <main class="public-finance-shell">
      <header class="public-finance-header"><div><span>ACESSO FINANCEIRO SEGURO</span><h1>{{ businessName }}</h1><p>Confira o último pagamento e escolha o próximo ciclo do seu plano CortsMe.</p></div><q-icon name="account_balance_wallet" /></header>

      <div v-if="loading" class="finance-state"><q-spinner-dots size="48px" color="dark" /><p>Carregando seu financeiro…</p></div>
      <div v-else-if="error" class="finance-state"><q-icon name="link_off" size="54px" color="negative" /><h2>Este acesso não está disponível.</h2><p>{{ error }}</p><q-btn to="/login?perfil=profissional" rounded unelevated color="dark" no-caps label="Entrar no painel profissional" /></div>

      <template v-else>
        <section class="finance-summary-grid">
          <article class="current-plan"><small>PLANO ATUAL</small><div><h2>{{ currentPlan.name || 'Plano CortsMe' }}</h2><q-badge rounded :color="subscriptionTone" :label="subscriptionLabel" /></div><p>{{ currentPlan.description || 'Recursos do seu negócio no CortsMe.' }}</p><footer><span><q-icon name="event" /> Validade</span><b>{{ periodEndLabel }}</b></footer></article>
          <article class="last-payment"><small>ÚLTIMO PAGAMENTO</small><template v-if="lastPayment.id || lastPayment.createdAt"><h3>{{ paymentAmount }}</h3><p>{{ paymentDate }} · {{ paymentStatus }}</p><span v-if="lastPayment.orderNsu">Ref. {{ lastPayment.orderNsu }}</span></template><template v-else><q-icon name="receipt_long" /><h3>Nenhum pagamento</h3><p>Escolha um plano abaixo para começar.</p></template></article>
        </section>

        <section class="public-plans"><div class="public-plans__heading"><div><span>RENOVAR OU FAZER UPGRADE</span><h2>Escolha o próximo ciclo.</h2></div><div><q-icon name="verified_user" /><span>Checkout protegido<br><b>InfinitePay</b></span></div></div>
          <div v-if="plans.length" class="public-plans-grid"><article v-for="plan in plans" :key="planKey(plan)" :class="{ featured: plan.highlighted }"><q-badge v-if="plan.highlighted" rounded color="lime-6" text-color="dark" label="RECOMENDADO" /><h3>{{ plan.name }}</h3><p>{{ plan.description }}</p><div class="plan-price"><small>R$</small><b>{{ majorPrice(plan) }}</b><span>,{{ centsPrice(plan) }}<small>/ {{ plan.durationDays || 30 }} dias</small></span></div><ul><li v-for="feature in planFeatures(plan)" :key="feature"><q-icon name="check_circle" /> {{ feature }}</li></ul><q-btn rounded unelevated color="dark" class="full-width" no-caps :label="isCurrentPlan(plan) ? 'Renovar este plano' : 'Escolher este plano'" icon-right="arrow_forward" :loading="checkoutPlanId === planKey(plan)" :disable="Boolean(checkoutPlanId)" @click="checkout(plan)" /></article></div>
          <div v-else class="plans-empty"><q-icon name="hourglass_empty" /><h3>Planos temporariamente indisponíveis.</h3><p>Acesse novamente mais tarde ou abra o painel profissional.</p></div>
        </section>
        <div class="public-finance-security"><q-icon name="lock" /><span>Este link mostra apenas o financeiro da barbearia associada e não permite acessar outros perfis.</span></div>
      </template>
    </main>
  </q-page>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'

const route = useRoute()
const $q = useQuasar()
const loading = ref(true)
const error = ref('')
const payload = ref({})
const checkoutPlanId = ref('')
const token = computed(() => String(route.params.token || ''))
const root = computed(() => payload.value.billing || payload.value.data?.billing || payload.value.data || payload.value)
const profile = computed(() => payload.value.profile || root.value.profile || {})
const subscription = computed(() => root.value.subscription || root.value.currentSubscription || root.value)
const currentPlan = computed(() => subscription.value.plan || root.value.currentPlan || root.value.plan || {})
const lastPayment = computed(() => root.value.lastPayment || payload.value.lastPayment || root.value.payments?.[0] || {})
const plans = computed(() => (root.value.plans || payload.value.plans || []).filter(plan => plan.active !== false && !plan.isFree && Number(plan.priceCents ?? plan.price ?? 0) > 0))
const businessName = computed(() => profile.value.businessName || payload.value.businessName || 'CortsMe')
const status = computed(() => String(subscription.value.status || root.value.status || '').toUpperCase())
const subscriptionLabel = computed(() => ({ ACTIVE: 'Ativo', FREE: 'Gratuito', PENDING_PAYMENT: 'Pagamento pendente', EXPIRED: 'Expirado', SUSPENDED: 'Suspenso', CANCELLED: 'Cancelado' }[status.value] || status.value || 'Ativo'))
const subscriptionTone = computed(() => ['EXPIRED', 'SUSPENDED', 'CANCELLED'].includes(status.value) ? 'negative' : status.value === 'ACTIVE' ? 'positive' : 'warning')
const periodEndLabel = computed(() => { const value = subscription.value.periodEnd || subscription.value.expiresAt || root.value.periodEnd; return value ? new Date(value).toLocaleDateString('pt-BR') : 'Sem vencimento' })
const paymentAmount = computed(() => money((lastPayment.value.paidAmountCents || lastPayment.value.amountCents || 0) / 100))
const paymentDate = computed(() => lastPayment.value.paidAt || lastPayment.value.createdAt ? new Date(lastPayment.value.paidAt || lastPayment.value.createdAt).toLocaleDateString('pt-BR') : '')
const paymentStatus = computed(() => ({ PAID: 'Pago', PENDING: 'Pendente', PROCESSING: 'Processando', FAILED: 'Falhou' }[String(lastPayment.value.status || '').toUpperCase()] || lastPayment.value.status || 'Registrado'))
const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const planKey = plan => String(plan.id || plan._id || plan.slug)
const planValue = plan => plan.priceCents !== undefined ? Number(plan.priceCents) / 100 : Number(plan.price || 0)
const majorPrice = plan => Math.floor(planValue(plan)).toLocaleString('pt-BR')
const centsPrice = plan => Math.round((planValue(plan) % 1) * 100).toString().padStart(2, '0')
const planFeatures = plan => (plan.features || ['Agendamentos online', 'Site público', 'Assistente CortsMe']).slice(0, 5)
const isCurrentPlan = plan => planKey(plan) === String(currentPlan.value.id || currentPlan.value._id || currentPlan.value.slug)

async function load () {
  try { payload.value = (await api.get(`/public/finance/${encodeURIComponent(token.value)}`)).data || {}; error.value = '' }
  catch (requestError) { error.value = requestError.response?.data?.message || 'O link pode ter expirado. Solicite um novo acesso no painel.' }
  finally { loading.value = false }
}

async function checkout (plan) {
  const key = planKey(plan)
  checkoutPlanId.value = key
  const checkoutWindow = window.open('about:blank', '_blank')
  if (checkoutWindow) checkoutWindow.opener = null
  try {
    const { data } = await api.post(`/public/finance/${encodeURIComponent(token.value)}/checkout`, { planId: key })
    const url = data.checkoutUrl || data.url || data.payment?.checkoutUrl
    if (!/^https:\/\//i.test(String(url || ''))) throw new Error('CHECKOUT_URL_MISSING')
    if (checkoutWindow) { checkoutWindow.location.href = url; checkoutWindow.focus() } else window.location.assign(url)
    $q.notify({ color: 'dark', icon: 'open_in_new', message: 'Checkout aberto com segurança. Ao concluir, volte para conferir o novo plano.' })
  } catch (requestError) {
    checkoutWindow?.close()
    $q.notify({ type: 'negative', message: requestError.response?.data?.message || 'Não foi possível gerar o link de pagamento.' })
  } finally { checkoutPlanId.value = '' }
}

function refreshOnFocus () { if (!checkoutPlanId.value) load() }
onMounted(() => { load(); window.addEventListener('focus', refreshOnFocus) })
onBeforeUnmount(() => window.removeEventListener('focus', refreshOnFocus))
</script>

<style scoped>
.public-finance-page{min-height:calc(100vh - 76px);padding:44px 20px 85px;background:#f4f5f0;color:#171b19}.public-finance-shell{width:min(1120px,100%);margin:0 auto}.public-finance-header{padding:34px 38px;display:flex;align-items:center;justify-content:space-between;gap:25px;border-radius:24px;background:#171d19;color:#fff}.public-finance-header span,.public-plans__heading>div:first-child>span,.current-plan>small,.last-payment>small{color:#9abf55;font-size:8px;font-weight:900;letter-spacing:1.6px}.public-finance-header h1{margin:7px 0;font-size:37px;letter-spacing:-1.8px}.public-finance-header p{margin:0;color:#adb6b0}.public-finance-header>.q-icon{font-size:52px;color:#c8f45d}.finance-summary-grid{margin-top:18px;display:grid;grid-template-columns:1.3fr .7fr;gap:16px}.current-plan,.last-payment{padding:25px;border:1px solid #dfe3dc;border-radius:20px;background:#fff}.current-plan>div{display:flex;align-items:center;justify-content:space-between;gap:15px}.current-plan h2{margin:13px 0 4px;font-size:27px}.current-plan>p{color:#737c76}.current-plan footer{margin-top:24px;padding-top:16px;display:flex;align-items:center;justify-content:space-between;border-top:1px solid #eceee9}.current-plan footer span{color:#7c857f;font-size:10px}.last-payment{background:#edf5e4}.last-payment>.q-icon{margin-top:24px;font-size:32px;color:#65843e}.last-payment h3{margin:20px 0 4px;font-size:25px}.last-payment p{margin:0;color:#677064;font-size:11px}.last-payment>span:last-child{display:block;margin-top:14px;color:#84907c;font-size:8px}.public-plans{margin-top:45px}.public-plans__heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:18px}.public-plans__heading h2{margin:5px 0 0;font-size:30px}.public-plans__heading>div:last-child{display:flex;align-items:center;gap:9px;color:#737c76;font-size:9px}.public-plans__heading>div:last-child>.q-icon{font-size:25px;color:#678a3c}.public-plans-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:13px}.public-plans-grid article{min-height:430px;padding:23px;display:flex;flex-direction:column;border:1px solid #dfe3dc;border-radius:20px;background:#fff}.public-plans-grid article.featured{border:2px solid #202720;background:#f3f9e9}.public-plans-grid h3{margin:18px 0 7px;font-size:23px}.public-plans-grid article>p{min-height:48px;margin:0;color:#747d77;font-size:11px}.plan-price{margin:22px 0;display:flex;align-items:flex-start}.plan-price>b{font-size:38px;line-height:1}.plan-price>small{margin:5px 3px 0 0}.plan-price>span{font-size:15px;font-weight:800}.plan-price span small{display:block;color:#858e88;font-size:8px;font-weight:400}.public-plans-grid ul{flex:1;margin:0 0 20px;padding:0;list-style:none}.public-plans-grid li{margin:9px 0;display:flex;gap:7px;color:#5f6862;font-size:10px}.public-plans-grid li .q-icon{color:#739747;font-size:15px}.plans-empty,.finance-state{min-height:320px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;border:1px dashed #d8ddd5;border-radius:20px}.plans-empty>.q-icon{font-size:38px}.plans-empty h3,.finance-state h2{margin:12px 0 4px}.plans-empty p,.finance-state p{max-width:450px;color:#7a837d}.finance-state{min-height:520px;border:0}.public-finance-security{margin-top:20px;display:flex;align-items:center;justify-content:center;gap:6px;color:#8b938e;font-size:9px}@media(max-width:760px){.public-finance-page{padding:20px 12px 80px}.public-finance-header{padding:28px 23px}.public-finance-header h1{font-size:31px}.public-finance-header>.q-icon{display:none}.finance-summary-grid{grid-template-columns:1fr}.public-plans__heading{align-items:flex-start;flex-direction:column}.public-plans__heading>div:last-child{display:none}}@media(max-width:480px){.public-finance-page{padding:9px 8px 75px}.public-finance-header{padding:25px 17px;border-radius:19px}.public-finance-header h1{font-size:28px}.current-plan,.last-payment{padding:20px}.current-plan>div{align-items:flex-start;flex-direction:column}.public-plans-grid{grid-template-columns:1fr}.public-finance-security{align-items:flex-start;text-align:left}}
</style>
