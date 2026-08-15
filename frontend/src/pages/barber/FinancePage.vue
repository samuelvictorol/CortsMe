<template>
  <q-page class="billing-page">
    <header class="billing-hero">
      <div>
        <span class="billing-eyebrow">FINANCEIRO</span>
        <h1>Plano e pagamentos</h1>
        <p>Gerencie o acesso da sua barbearia e acompanhe cada pagamento em um só lugar.</p>
      </div>
      <q-btn flat round icon="refresh" aria-label="Atualizar dados financeiros" :loading="loading" @click="loadBilling" />
    </header>

    <div v-if="loading && !loaded" class="billing-loading">
      <q-spinner-dots size="44px" color="dark" />
      <span>Consultando seu plano...</span>
    </div>

    <template v-else>
      <section v-if="returnReference" class="return-card" :class="{ success: returnVerified }">
        <div class="return-icon"><q-icon :name="returnVerified ? 'verified' : 'sync'" /></div>
        <div>
          <span>RETORNO DO PAGAMENTO</span>
          <h2>{{ returnVerified ? 'Pagamento identificado' : 'Estamos conferindo seu pagamento' }}</h2>
          <p>{{ returnVerified ? 'Seu plano e os recursos liberados já foram atualizados.' : 'Se você concluiu o pagamento, confirme agora. A liberação também acontece automaticamente pelo webhook.' }}</p>
          <small>Referência: {{ returnReference }}</small>
        </div>
        <q-btn v-if="!returnVerified" rounded unelevated color="dark" no-caps label="Verificar pagamento" icon="sync" :loading="verifying" @click="verifyReturn" />
      </section>

      <section v-if="loadError" class="billing-error">
        <q-icon name="cloud_off" />
        <div><b>Não foi possível carregar o financeiro</b><span>{{ loadError }}</span></div>
        <q-btn flat rounded no-caps label="Tentar novamente" @click="loadBilling" />
      </section>

      <template v-else>
        <section class="billing-summary-grid">
          <article class="current-plan-card">
            <div class="plan-card-top">
              <span>SEU PLANO ATUAL</span>
              <q-badge rounded :class="['plan-badge', planTone]" :label="currentPlanName" />
            </div>
            <h2>{{ currentPlanName }}</h2>
            <p>{{ currentPlanDescription }}</p>
            <div class="plan-meta">
              <div><q-icon name="shield" /><span>Status<b>{{ statusLabel }}</b></span></div>
              <div><q-icon name="event" /><span>Válido até<b>{{ validUntilLabel }}</b></span></div>
              <div><q-icon name="hourglass_bottom" /><span>Tempo restante<b>{{ remainingLabel }}</b></span></div>
            </div>
          </article>

          <article class="billing-health-card" :class="statusTone">
            <span class="health-icon"><q-icon :name="statusIcon" /></span>
            <div><small>SITUAÇÃO DA CONTA</small><h3>{{ accountHeadline }}</h3><p>{{ accountMessage }}</p></div>
          </article>
        </section>

        <section v-if="!providerConfigured" class="configuration-lock">
          <div class="lock-illustration"><q-icon name="lock_clock" /></div>
          <div>
            <span>PAGAMENTOS EM CONFIGURAÇÃO</span>
            <h2>Os pacotes ainda não estão disponíveis.</h2>
            <p>O administrador precisa concluir a configuração da InfinitePay e do webhook antes que novos pagamentos sejam iniciados. Seu plano atual continua visível acima.</p>
          </div>
        </section>

        <section v-else class="plans-section">
          <div class="section-heading">
            <div><span>PACOTES DISPONÍVEIS</span><h2>Escolha o próximo ciclo</h2><p>Pagamento único, acesso por período e nenhuma renovação automática.</p></div>
            <div class="secure-payment"><q-icon name="lock" /><span>Checkout seguro<br><b>InfinitePay</b></span></div>
          </div>

          <div v-if="plans.length" class="plans-grid">
            <article v-for="plan in plans.slice(0, 5)" :key="plan._id || plan.id || plan.slug" :class="['billing-plan', { featured: isHighlighted(plan), current: isCurrentPlan(plan) }]">
              <div class="billing-plan__head">
                <span v-if="isHighlighted(plan)" class="recommended-label">{{ plan.badge || 'MAIS ESCOLHIDO' }}</span>
                <span v-else class="plan-index">{{ plan.durationDays || plan.days || 30 }} DIAS DE ACESSO</span>
                <q-icon :name="isCurrentPlan(plan) ? 'verified' : 'north_east'" />
              </div>
              <h3>{{ plan.name }}</h3>
              <p>{{ plan.description || 'Recursos para organizar, atender e fazer sua barbearia crescer.' }}</p>
              <div class="plan-price"><small>R$</small><b>{{ priceMajor(planPrice(plan)) }}</b><span>,{{ priceCents(planPrice(plan)) }}<small> por ciclo</small></span></div>
              <ul>
                <li v-for="feature in planFeatures(plan)" :key="feature"><q-icon name="check" />{{ feature }}</li>
              </ul>
              <q-btn class="full-width" rounded :outline="!isHighlighted(plan)" unelevated color="dark" no-caps :label="isCurrentPlan(plan) ? 'Renovar este plano' : 'Escolher este plano'" icon-right="arrow_forward" :loading="checkoutPlanId === planKey(plan)" :disable="checkoutLoading && checkoutPlanId !== planKey(plan)" @click="startCheckout(plan)" />
            </article>
          </div>
          <div v-else class="plans-empty"><q-icon name="inventory_2" /><h3>Nenhum pacote publicado</h3><p>Assim que o administrador publicar os pacotes, eles aparecerão aqui.</p></div>
        </section>

        <section class="payments-card">
          <header><div><span>HISTÓRICO</span><h2>Seus pagamentos</h2></div><q-badge outline color="grey-8" :label="`${paymentsTotal} registro${paymentsTotal === 1 ? '' : 's'}`" /></header>
          <div v-if="paymentsLoading" class="payments-loading"><q-spinner-dots size="34px" /></div>
          <div v-else-if="payments.length" class="payments-list">
            <article v-for="payment in payments" :key="payment._id || payment.orderNsu || payment.order_nsu">
              <span class="payment-icon"><q-icon :name="paymentStatusIcon(payment.status)" /></span>
              <div class="payment-main"><b>{{ payment.planName || payment.plan?.name || 'Plano CortsMe' }}</b><small>{{ formatDateTime(payment.paidAt || payment.createdAt || payment.updatedAt) }}</small></div>
              <div class="payment-reference"><span>REFERÊNCIA</span><b>{{ payment.orderNsu || payment.order_nsu || payment.transactionNsu || payment.transaction_nsu || '—' }}</b></div>
              <b class="payment-value">{{ formatCurrency(paymentAmount(payment)) }}</b>
              <q-badge rounded :color="paymentStatusColor(payment.status)" :label="paymentStatusLabel(payment.status)" />
            </article>
          </div>
          <div v-else class="payments-empty"><q-icon name="receipt_long" /><div><b>Nenhum pagamento por aqui ainda.</b><span>Quando você contratar ou renovar um plano, o registro aparecerá nesta lista.</span></div></div>
          <footer v-if="paymentsPages > 1">
            <span>Página {{ page }} de {{ paymentsPages }}</span>
            <q-pagination v-model="page" :max="paymentsPages" direction-links boundary-links color="dark" active-color="dark" @update:model-value="loadBilling" />
          </footer>
        </section>
      </template>
    </template>

    <q-dialog v-model="onboardingCheckoutDialog" persistent transition-show="scale" transition-hide="scale">
      <q-card class="checkout-confirm-dialog">
        <header class="checkout-confirm-header">
          <div class="checkout-confirm-brand"><span><q-icon name="workspace_premium" /></span><div><small>CONFIRME SUA ESCOLHA</small><b>Ativação do plano CortsMe</b></div></div>
          <q-btn flat round icon="close" aria-label="Fechar confirmação" :disable="checkoutLoading" v-close-popup />
        </header>

        <q-card-section v-if="onboardingPlan" class="checkout-confirm-content">
          <div class="checkout-plan-summary">
            <div><small>PLANO SELECIONADO</small><h2>{{ onboardingPlan.name }}</h2><p>{{ onboardingPlan.description || 'Recursos para organizar e fazer seu negócio crescer.' }}</p></div>
            <div class="checkout-plan-price"><span>R$</span><b>{{ priceMajor(planPrice(onboardingPlan)) }}</b><sup>,{{ priceCents(planPrice(onboardingPlan)) }}</sup></div>
          </div>

          <div class="checkout-cycle-grid">
            <article><q-icon name="event_available" /><span><small>PERÍODO DE ACESSO</small><b>{{ onboardingPlan.durationDays || onboardingPlan.days || 30 }} dias</b></span></article>
            <article><q-icon name="credit_card" /><span><small>FORMA DE COBRANÇA</small><b>Pagamento único</b></span></article>
            <article><q-icon name="event_repeat" /><span><small>RENOVAÇÃO</small><b>Sem recorrência automática</b></span></article>
          </div>

          <div class="checkout-features-preview">
            <b>O que você libera agora</b>
            <div><span v-for="feature in planFeatures(onboardingPlan).slice(0, 3)" :key="feature"><q-icon name="check_circle" />{{ feature }}</span></div>
          </div>

          <q-banner rounded class="checkout-security-note">
            <template #avatar><q-icon name="lock" /></template>
            Você será direcionado ao checkout seguro da InfinitePay. Nada será cobrado sem sua confirmação por lá.
          </q-banner>
        </q-card-section>

        <q-card-actions class="checkout-confirm-actions">
          <q-btn flat rounded no-caps label="Agora não" :disable="checkoutLoading" v-close-popup />
          <q-btn rounded unelevated color="dark" no-caps label="Confirmar e ir para pagamento" icon-right="arrow_forward" :loading="checkoutLoading" @click="confirmOnboardingCheckout" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'

const route = useRoute()
const router = useRouter()
const $q = useQuasar()
const loading = ref(false)
const loaded = ref(false)
const paymentsLoading = ref(false)
const verifying = ref(false)
const returnVerified = ref(false)
const loadError = ref('')
const rawBilling = ref({})
const page = ref(1)
const checkoutLoading = ref(false)
const checkoutPlanId = ref('')
const onboardingCheckoutDialog = ref(false)
const onboardingPlan = ref(null)
const onboardingHandled = ref(false)

const root = computed(() => rawBilling.value?.billing || rawBilling.value?.summary || rawBilling.value || {})
const subscription = computed(() => root.value.subscription || root.value.membership || {})
const currentPlan = computed(() => root.value.currentPlan || subscription.value.plan || root.value.plan || {})
const plans = computed(() => { const source = root.value.plans || rawBilling.value.plans || root.value.availablePlans || []; const items = Array.isArray(source) ? source : source.items || source.docs || source.data || []; return items.filter(plan => !plan.isFree && plan.active !== false) })
const paymentsSource = computed(() => root.value.payments || rawBilling.value.payments || root.value.history || [])
const payments = computed(() => Array.isArray(paymentsSource.value) ? paymentsSource.value : paymentsSource.value.items || paymentsSource.value.docs || paymentsSource.value.data || [])
const pagination = computed(() => root.value.pagination || rawBilling.value.pagination || root.value.paymentsPagination || paymentsSource.value.pagination || paymentsSource.value.meta || {})
const paymentsTotal = computed(() => Number(pagination.value.total ?? root.value.paymentsTotal ?? payments.value.length))
const paymentsPages = computed(() => Math.max(1, Number(pagination.value.pages ?? pagination.value.totalPages ?? Math.ceil(paymentsTotal.value / (pagination.value.limit || 10)))))
const statusFromData = computed(() => String(subscription.value.status || root.value.status || currentPlan.value.status || '').toUpperCase())
const billingStatus = computed(() => statusFromData.value || (isFree.value ? 'FREE' : 'ACTIVE'))
const validUntil = computed(() => subscription.value.periodEnd || subscription.value.expiresAt || subscription.value.validUntil || subscription.value.currentPeriodEnd || root.value.periodEnd || root.value.expiresAt || root.value.validUntil)
const daysRemaining = computed(() => {
  const supplied = subscription.value.daysRemaining ?? root.value.daysRemaining
  if (supplied !== undefined && supplied !== null) return Number(supplied)
  if (!validUntil.value) return null
  return Math.ceil((new Date(validUntil.value).getTime() - Date.now()) / 86400000)
})
const isFree = computed(() => {
  const value = String(currentPlan.value.slug || currentPlan.value.code || currentPlan.value.type || currentPlan.value.name || '').toUpperCase()
  return statusFromData.value === 'FREE' || currentPlan.value.isFree === true || ['FREE', 'GRATUITO', 'GRÁTIS'].some(item => value.includes(item))
})
const isSuspended = computed(() => ['SUSPENDED', 'EXPIRED', 'PAST_DUE', 'OVERDUE', 'CANCELED', 'CANCELLED', 'INACTIVE'].includes(billingStatus.value))
const isExpiring = computed(() => !isSuspended.value && daysRemaining.value !== null && daysRemaining.value >= 0 && daysRemaining.value <= 7)
const providerConfigured = computed(() => {
  const explicit = root.value.providerConfigured ?? root.value.configurationReady ?? root.value.checkoutConfigured ?? root.value.checkoutEnabled ?? root.value.canCheckout ?? root.value.requirementsMet ?? root.value.ready ?? root.value.configured ?? rawBilling.value.providerConfigured ?? rawBilling.value.configurationReady ?? rawBilling.value.checkoutConfigured ?? rawBilling.value.configured
  if (explicit !== undefined) return Boolean(explicit)
  const config = root.value.paymentConfig || rawBilling.value.paymentConfig || {}
  if (Object.keys(config).length) return Boolean(config.configured ?? config.ready ?? config.requirementsMet ?? ((config.infinitePayHandle || config.handle) && config.webhookUrl))
  return false
})
const currentPlanName = computed(() => currentPlan.value.name || (isFree.value ? 'Plano Gratuito' : 'Sem plano ativo'))
const currentPlanDescription = computed(() => currentPlan.value.description || (isFree.value ? 'Seu site continua publicado. Ative um pacote para liberar agendamentos e o assistente.' : 'Mantenha seu pagamento em dia para usar todos os recursos do CortsMe.'))
const statusLabel = computed(() => ({ ACTIVE: 'Ativo', PAID: 'Ativo', FREE: 'Gratuito', PENDING: 'Aguardando pagamento', PENDING_PAYMENT: 'Aguardando pagamento', PAST_DUE: 'Pagamento pendente', OVERDUE: 'Expirado', EXPIRED: 'Expirado', SUSPENDED: 'Suspenso', CANCELED: 'Cancelado', CANCELLED: 'Cancelado' }[billingStatus.value] || billingStatus.value))
const validUntilLabel = computed(() => validUntil.value ? new Date(validUntil.value).toLocaleDateString('pt-BR') : (isFree.value ? 'Sem validade' : '—'))
const remainingLabel = computed(() => daysRemaining.value === null ? (isFree.value ? 'Plano contínuo' : '—') : daysRemaining.value < 0 ? 'Expirado' : daysRemaining.value === 0 ? 'Expira hoje' : `${daysRemaining.value} dia${daysRemaining.value === 1 ? '' : 's'}`)
const planTone = computed(() => isSuspended.value ? 'negative' : isFree.value ? 'free' : isExpiring.value ? 'warning' : 'active')
const statusTone = computed(() => isSuspended.value ? 'danger' : isExpiring.value ? 'warning' : isFree.value ? 'neutral' : 'healthy')
const statusIcon = computed(() => isSuspended.value ? 'lock' : isExpiring.value ? 'schedule' : isFree.value ? 'explore' : 'verified_user')
const accountHeadline = computed(() => isSuspended.value ? 'Recursos suspensos' : isExpiring.value ? 'Seu acesso vence em breve' : isFree.value ? 'Você está no plano gratuito' : 'Tudo certo com seu acesso')
const accountMessage = computed(() => isSuspended.value ? 'Escolha um pacote para reativar agendamentos e o assistente.' : isExpiring.value ? `Renove agora para evitar interrupções. ${remainingLabel.value}.` : isFree.value ? 'Seu site permanece no ar; os recursos de conversão ficam disponíveis em um pacote pago.' : 'Agendamento online e assistente estão liberados para sua barbearia.')
const returnReference = computed(() => route.query.order_nsu || route.query.slug || route.query.transaction_nsu || '')

function unwrapResponse (data) { return data?.data || data || {} }
function priceNumber (value) { return Number(value || 0) }
function priceMajor (value) { return Math.floor(priceNumber(value)).toLocaleString('pt-BR') }
function priceCents (value) { return Math.round((priceNumber(value) % 1) * 100).toString().padStart(2, '0') }
function formatCurrency (value) { return priceNumber(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function planPrice (plan) { return plan.priceCents !== undefined && plan.priceCents !== null ? Number(plan.priceCents) / 100 : Number(plan.price || plan.value || 0) }
function paymentAmount (payment) { const cents = payment.paidAmountCents || payment.amountCents; return cents !== undefined && cents !== null ? Number(cents) / 100 : payment.amount ?? payment.price ?? payment.value }
function isHighlighted (plan) { return Boolean(plan.highlighted || plan.featured || plan.recommended) }
function planKey (plan) { return plan._id || plan.id || plan.slug }
function formatDateTime (value) { return value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }) : 'Data não informada' }
function planFeatures (plan) {
  const features = plan.features || plan.benefits || plan.advantages || []
  const normalized = features.map(item => typeof item === 'string' ? item : item.label || item.name).filter(Boolean)
  return normalized.length ? normalized.slice(0, 6) : ['Site público sempre no ar', 'Agendamentos online', 'Assistente de atendimento']
}
function isCurrentPlan (plan) { return String(plan._id || plan.id || plan.slug) === String(currentPlan.value._id || currentPlan.value.id || currentPlan.value.slug) }
function paymentStatusLabel (status) { return ({ PAID: 'Pago', APPROVED: 'Aprovado', CONFIRMED: 'Confirmado', PENDING: 'Pendente', PROCESSING: 'Processando', FAILED: 'Falhou', EXPIRED: 'Expirado', CANCELLED: 'Cancelado', CANCELED: 'Cancelado', REFUNDED: 'Estornado' }[String(status || '').toUpperCase()] || status || 'Pendente') }
function paymentStatusColor (status) { const value = String(status || '').toUpperCase(); if (['PAID', 'APPROVED', 'CONFIRMED'].includes(value)) return 'positive'; if (['FAILED', 'EXPIRED', 'CANCELLED', 'CANCELED'].includes(value)) return 'negative'; if (value === 'REFUNDED') return 'blue-grey'; return 'warning' }
function paymentStatusIcon (status) { const value = String(status || '').toUpperCase(); return ['PAID', 'APPROVED', 'CONFIRMED'].includes(value) ? 'check_circle' : ['FAILED', 'EXPIRED', 'CANCELLED', 'CANCELED'].includes(value) ? 'error' : 'schedule' }

async function requestBilling () {
  try { return await api.get('/barber/billing', { params: { page: page.value, limit: 10 } }) }
  catch (error) {
    if (![404, 405].includes(error.response?.status)) throw error
    return api.get('/barber/billing/summary', { params: { page: page.value, limit: 10 } })
  }
}
async function loadBilling () {
  loading.value = true
  paymentsLoading.value = loaded.value
  loadError.value = ''
  try {
    const billingPayload = unwrapResponse((await requestBilling()).data)
    let paymentsPayload = null
    try { paymentsPayload = (await api.get('/barber/billing/payments', { params: { page: page.value, limit: 10 } })).data } catch (error) { if (![404, 405].includes(error.response?.status)) throw error }
    rawBilling.value = paymentsPayload
      ? { ...billingPayload, payments: paymentsPayload.data || paymentsPayload.items || [], pagination: paymentsPayload.pagination || paymentsPayload.meta || {} }
      : billingPayload
  }
  catch (error) { loadError.value = error.response?.data?.message || 'Confira sua conexão e tente outra vez.' }
  finally { loading.value = false; paymentsLoading.value = false; loaded.value = true }
}
async function startCheckout (plan) {
  if (!providerConfigured.value) { $q.notify({ type: 'warning', message: 'Os pagamentos ainda não foram configurados pelo administrador.' }); return }
  const planId = planKey(plan)
  checkoutPlanId.value = planId
  checkoutLoading.value = true
  let checkoutWindow
  try {
    checkoutWindow = window.open('about:blank', '_blank')
    if (checkoutWindow) checkoutWindow.opener = null
    const { data } = await api.post('/barber/billing/checkout', { planId })
    const payload = unwrapResponse(data)
    const url = payload.checkoutUrl || payload.paymentUrl || payload.paymentLink || payload.url || payload.link
    if (!url) throw new Error('CHECKOUT_URL_MISSING')
    if (checkoutWindow) { checkoutWindow.location.href = url; checkoutWindow.focus() } else window.location.assign(url)
    $q.notify({ color: 'dark', icon: 'open_in_new', message: 'Checkout aberto. Após pagar, volte para conferir a liberação.' })
  } catch (error) {
    checkoutWindow?.close()
    $q.notify({ type: 'negative', message: error.response?.data?.message || 'Não foi possível iniciar o pagamento.' })
  } finally { checkoutLoading.value = false; checkoutPlanId.value = '' }
}

function queryValue (value) {
  return Array.isArray(value) ? value[0] : value
}

function planIdentifiers (plan) {
  return [plan?._id, plan?.id, plan?.slug, plan?.code, plan?.name]
    .filter(value => value !== undefined && value !== null)
    .map(value => String(value).trim().toLowerCase())
}

async function clearOnboardingQuery () {
  const query = { ...route.query }
  delete query.autoCheckout
  delete query.planId
  delete query.plan
  await router.replace({ path: route.path, query, hash: route.hash })
}

async function consumeOnboardingCheckout () {
  if (onboardingHandled.value || String(queryValue(route.query.autoCheckout) || '') !== '1') return
  onboardingHandled.value = true

  const requested = [queryValue(route.query.planId), queryValue(route.query.plan)]
    .filter(Boolean)
    .map(value => String(value).trim().toLowerCase())

  try { await clearOnboardingQuery() } catch { /* a flag local ainda impede abertura duplicada */ }

  if (loadError.value) {
    $q.notify({ type: 'negative', message: 'Não foi possível conferir o plano escolhido. Atualize o financeiro e tente novamente.' })
    return
  }
  if (!providerConfigured.value) {
    $q.notify({ type: 'warning', message: 'Os pagamentos ainda não estão disponíveis. A configuração da InfinitePay precisa ser concluída pelo administrador.' })
    return
  }
  if (!requested.length) {
    $q.notify({ type: 'warning', message: 'O plano escolhido não foi informado. Selecione uma opção disponível abaixo.' })
    return
  }

  const selected = plans.value.find(plan => planIdentifiers(plan).some(identifier => requested.includes(identifier)))
  if (!selected || selected.active === false || selected.isFree === true || planPrice(selected) <= 0) {
    $q.notify({ type: 'warning', message: 'Esse plano não está mais disponível para pagamento. Escolha uma das opções exibidas abaixo.' })
    return
  }

  onboardingPlan.value = selected
  onboardingCheckoutDialog.value = true
}

async function confirmOnboardingCheckout () {
  const selected = onboardingPlan.value
  if (!selected) {
    onboardingCheckoutDialog.value = false
    $q.notify({ type: 'warning', message: 'Não foi possível identificar o plano. Escolha uma opção novamente.' })
    return
  }
  if (!providerConfigured.value) {
    onboardingCheckoutDialog.value = false
    $q.notify({ type: 'warning', message: 'O checkout ficou indisponível. Atualize a página ou fale com o suporte.' })
    return
  }
  onboardingCheckoutDialog.value = false
  await startCheckout(selected)
}

async function verifyReturn () {
  if (!returnReference.value) return
  verifying.value = true
  const identifiers = { order_nsu: route.query.order_nsu, slug: route.query.slug, transaction_nsu: route.query.transaction_nsu }
  try {
    let response
    try { response = await api.post('/barber/billing/verify', identifiers) }
    catch (error) {
      if (![404, 405].includes(error.response?.status)) throw error
      response = await api.get('/barber/billing/check', { params: identifiers })
    }
    const payload = unwrapResponse(response.data)
    const status = String(payload.status || payload.payment?.status || '').toUpperCase()
    returnVerified.value = payload.paid === true || payload.verified === true || ['PAID', 'APPROVED', 'CONFIRMED'].includes(status)
    await loadBilling()
    $q.notify({ type: returnVerified.value ? 'positive' : 'info', message: returnVerified.value ? 'Pagamento confirmado e acesso atualizado.' : 'O pagamento ainda não foi confirmado. Tente novamente em instantes.' })
  } catch (error) { $q.notify({ type: 'negative', message: error.response?.data?.message || 'Ainda não conseguimos verificar esse pagamento.' }) }
  finally { verifying.value = false }
}

onMounted(async () => {
  await loadBilling()
  if (returnReference.value) await verifyReturn()
  await consumeOnboardingCheckout()
})
</script>

<style scoped>
.billing-page{max-width:1500px;margin:0 auto;padding:38px 40px 80px;color:#171b19}.billing-hero{display:flex;align-items:center;justify-content:space-between;gap:24px;margin-bottom:28px}.billing-eyebrow,.section-heading span,.payments-card header span,.return-card>div:nth-child(2)>span,.configuration-lock span{font-size:9px;font-weight:800;letter-spacing:1.7px;color:#7c847f}.billing-hero h1{margin:7px 0 6px;font-size:40px;line-height:1;letter-spacing:-2px}.billing-hero p{margin:0;color:#707873}.billing-loading{min-height:440px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:#717873}.return-card{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:18px;margin-bottom:18px;padding:20px;border:1px solid #ded9c6;border-radius:18px;background:#fff9df}.return-card.success{border-color:#cbe3bd;background:#f0f8e8}.return-icon{width:50px;height:50px;display:grid;place-items:center;border-radius:15px;background:#f1d96f;font-size:25px}.return-card.success .return-icon{background:#c8edab}.return-card h2{margin:4px 0;font-size:18px}.return-card p{margin:0;color:#626b65;font-size:12px}.return-card small{display:block;margin-top:5px;color:#8b918d;font-size:9px}.billing-error{display:flex;align-items:center;gap:14px;padding:20px;border:1px solid #edcfcb;border-radius:16px;background:#fff6f4}.billing-error>.q-icon{font-size:28px;color:#a3463d}.billing-error div{flex:1}.billing-error b,.billing-error span{display:block}.billing-error span{margin-top:3px;color:#7c716f;font-size:11px}.billing-summary-grid{display:grid;grid-template-columns:1.5fr .7fr;gap:17px}.current-plan-card,.billing-health-card,.payments-card{border:1px solid #e0e3dc;border-radius:21px;background:#fff;box-shadow:0 10px 35px rgba(25,35,29,.035)}.current-plan-card{padding:27px}.plan-card-top{display:flex;align-items:center;justify-content:space-between}.plan-card-top>span{font-size:9px;font-weight:800;letter-spacing:1.5px;color:#7a827d}.plan-badge{padding:7px 11px;background:#eff2ec;color:#555f58}.plan-badge.active{background:#dff4cc;color:#315a22}.plan-badge.warning{background:#fff0bd;color:#69500b}.plan-badge.negative{background:#f9dad5;color:#832c25}.plan-badge.free{background:#e9ece8;color:#5d655f}.current-plan-card h2{margin:18px 0 5px;font-size:31px;letter-spacing:-1.4px}.current-plan-card>p{margin:0;color:#727a75;line-height:1.6;font-size:12px}.plan-meta{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:26px}.plan-meta>div{min-width:0;display:flex;align-items:center;gap:10px;padding:13px;border-radius:13px;background:#f5f7f2}.plan-meta .q-icon{font-size:20px;color:#6e805b}.plan-meta span,.plan-meta b{display:block}.plan-meta span{min-width:0;color:#8b928d;font-size:8px}.plan-meta b{margin-top:3px;overflow:hidden;text-overflow:ellipsis;color:#222824;font-size:11px;white-space:nowrap}.billing-health-card{display:flex;align-items:flex-start;gap:15px;padding:25px;background:#edf7e4}.billing-health-card.warning{background:#fff6dc;border-color:#eadcae}.billing-health-card.danger{background:#fff0ee;border-color:#ebcbc6}.billing-health-card.neutral{background:#f0f2ef}.health-icon{flex:0 0 auto;width:48px;height:48px;display:grid;place-items:center;border-radius:14px;background:#ccebab;color:#315b20;font-size:23px}.warning .health-icon{background:#f1d879;color:#6b5105}.danger .health-icon{background:#efc3bd;color:#872e27}.neutral .health-icon{background:#dfe3de;color:#566058}.billing-health-card small{font-size:8px;letter-spacing:1.3px;font-weight:800;color:#778074}.billing-health-card h3{margin:7px 0;font-size:20px;letter-spacing:-.5px}.billing-health-card p{margin:0;color:#687269;font-size:11px;line-height:1.55}.configuration-lock{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:25px;margin-top:20px;padding:32px;border:1px dashed #bbc1ba;border-radius:20px;background:#f0f2ee}.lock-illustration{width:72px;height:72px;display:grid;place-items:center;border-radius:21px;background:#dfe4dc;color:#626c65;font-size:33px}.configuration-lock h2{margin:6px 0;font-size:24px}.configuration-lock p{max-width:720px;margin:0;color:#6d756f;line-height:1.6}.plans-section{margin-top:44px}.section-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:19px}.section-heading h2{margin:5px 0;font-size:30px;letter-spacing:-1.2px}.section-heading p{margin:0;color:#747c77;font-size:12px}.secure-payment{display:flex;align-items:center;gap:9px;color:#757d78;font-size:9px}.secure-payment>.q-icon{width:38px;height:38px;display:grid;place-items:center;border-radius:11px;background:#e8eee1;color:#668343;font-size:18px}.secure-payment span{font-weight:400;letter-spacing:0}.secure-payment b{color:#303733}.plans-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(235px,1fr));gap:14px}.billing-plan{position:relative;display:flex;flex-direction:column;min-height:460px;padding:24px;border:1px solid #dde1da;border-radius:20px;background:#fff;overflow:hidden}.billing-plan.featured{border:2px solid #1e2420;background:#f3f9e9;box-shadow:0 15px 40px rgba(43,59,47,.09)}.billing-plan.current:after{content:'PLANO ATUAL';position:absolute;right:-31px;top:17px;padding:5px 32px;transform:rotate(39deg);background:#171b19;color:#fff;font-size:7px;font-weight:800;letter-spacing:1px}.billing-plan__head{min-height:22px;display:flex;align-items:center;justify-content:space-between;color:#7b837e}.plan-index,.recommended-label{font-size:8px;font-weight:800;letter-spacing:1.2px}.recommended-label{color:#5c7e2f}.billing-plan h3{margin:19px 0 7px;font-size:24px;letter-spacing:-1px}.billing-plan>p{min-height:50px;margin:0;color:#777e79;font-size:11px;line-height:1.55}.plan-price{display:flex;align-items:flex-start;margin:22px 0}.plan-price>b{font-size:38px;line-height:.95;letter-spacing:-2px}.plan-price>small{margin:3px 4px 0 0}.plan-price>span{font-size:15px;font-weight:700}.plan-price span small{display:block;margin-top:2px;color:#858c87;font-size:8px;font-weight:400}.billing-plan ul{flex:1;margin:0 0 22px;padding:0;list-style:none}.billing-plan li{display:flex;align-items:flex-start;gap:8px;margin:10px 0;color:#59615c;font-size:10px}.billing-plan li .q-icon{color:#658d3d;font-size:15px}.plans-empty{min-height:210px;display:grid;place-items:center;align-content:center;text-align:center;border:1px dashed #d5d9d2;border-radius:19px;color:#838a85}.plans-empty>.q-icon{font-size:35px}.plans-empty h3{margin:9px 0 2px;color:#2e3531}.plans-empty p{margin:0}.payments-card{margin-top:28px;overflow:hidden}.payments-card>header{min-height:82px;padding:20px 24px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e8eae5}.payments-card h2{margin:4px 0 0;font-size:21px}.payments-list article{min-height:76px;padding:13px 24px;display:grid;grid-template-columns:40px 1.1fr 1fr auto auto;align-items:center;gap:14px;border-bottom:1px solid #eef0eb}.payment-icon{width:38px;height:38px;display:grid;place-items:center;border-radius:12px;background:#edf4e6;color:#527a31;font-size:19px}.payment-main b,.payment-main small,.payment-reference span,.payment-reference b{display:block}.payment-main b{font-size:12px}.payment-main small{margin-top:3px;color:#8a918d;font-size:9px}.payment-reference span{font-size:7px;letter-spacing:1px;color:#969c98}.payment-reference b{max-width:230px;margin-top:3px;overflow:hidden;text-overflow:ellipsis;font-size:9px;white-space:nowrap}.payment-value{font-size:13px}.payments-loading{min-height:170px;display:grid;place-items:center}.payments-empty{min-height:150px;display:flex;align-items:center;justify-content:center;gap:15px;color:#858d88}.payments-empty>.q-icon{font-size:35px}.payments-empty b,.payments-empty span{display:block}.payments-empty b{color:#313834}.payments-empty span{margin-top:4px;font-size:10px}.payments-card>footer{padding:15px 22px;display:flex;align-items:center;justify-content:space-between;background:#fafbf8;color:#858c87;font-size:10px}
.checkout-confirm-dialog{width:min(650px,calc(100vw - 26px));max-width:650px;border-radius:24px;overflow:hidden;background:#fbfcf9;color:#171b19}.checkout-confirm-header{min-height:76px;padding:14px 17px 14px 23px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e4e7e0;background:#fff}.checkout-confirm-brand{display:flex;align-items:center;gap:12px}.checkout-confirm-brand>span{width:43px;height:43px;display:grid;place-items:center;border-radius:14px;background:#18201a;color:#c8f45d;font-size:22px}.checkout-confirm-brand small,.checkout-confirm-brand b{display:block}.checkout-confirm-brand small{color:#7d857f;font-size:7px;font-weight:900;letter-spacing:1.5px}.checkout-confirm-brand b{margin-top:3px;font-size:13px}.checkout-confirm-content{padding:26px 27px}.checkout-plan-summary{display:grid;grid-template-columns:1fr auto;align-items:start;gap:28px}.checkout-plan-summary small{color:#788173;font-size:8px;font-weight:900;letter-spacing:1.4px}.checkout-plan-summary h2{margin:6px 0 4px;font-size:29px;line-height:1;letter-spacing:-1.2px}.checkout-plan-summary p{max-width:390px;margin:0;color:#717a74;font-size:11px;line-height:1.55}.checkout-plan-price{display:flex;align-items:flex-start;white-space:nowrap}.checkout-plan-price>span{margin:6px 4px 0 0;font-size:10px;font-weight:800}.checkout-plan-price>b{font-size:39px;line-height:1;letter-spacing:-2px}.checkout-plan-price>sup{margin:4px 0 0 3px;font-size:12px;font-weight:800}.checkout-cycle-grid{margin-top:24px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.checkout-cycle-grid article{min-width:0;padding:13px 11px;display:flex;align-items:center;gap:9px;border:1px solid #e1e5dd;border-radius:13px;background:#fff}.checkout-cycle-grid article>.q-icon{flex:0 0 auto;color:#668641;font-size:20px}.checkout-cycle-grid span,.checkout-cycle-grid small,.checkout-cycle-grid b{display:block;min-width:0}.checkout-cycle-grid small{color:#8b928d;font-size:6px;font-weight:800;letter-spacing:.7px}.checkout-cycle-grid b{margin-top:3px;overflow:hidden;text-overflow:ellipsis;font-size:9px;white-space:nowrap}.checkout-features-preview{margin-top:19px;padding:15px;border-radius:14px;background:#f0f5e8}.checkout-features-preview>b{font-size:10px}.checkout-features-preview>div{margin-top:9px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.checkout-features-preview span{display:flex;align-items:flex-start;gap:5px;color:#5f695e;font-size:8px;line-height:1.4}.checkout-features-preview .q-icon{flex:0 0 auto;color:#6d963d;font-size:14px}.checkout-security-note{margin-top:18px;border:1px solid #dde4d4;background:#f7f9f3;color:#687363;font-size:9px;line-height:1.5}.checkout-security-note .q-icon{color:#537a32;font-size:19px}.checkout-confirm-actions{min-height:76px;padding:13px 22px;display:flex;justify-content:flex-end;gap:7px;border-top:1px solid #e4e7e0;background:#fff}.checkout-confirm-actions .q-btn:last-child{min-height:46px;padding:0 20px}
@media(max-width:950px){.billing-page{padding:28px 20px 90px}.billing-summary-grid{grid-template-columns:1fr}.billing-health-card{align-items:center}.plans-grid{grid-template-columns:repeat(2,1fr)}.payments-list article{grid-template-columns:40px 1fr auto auto}.payment-reference{display:none}}
@media(max-width:620px){.billing-page{padding:23px 14px 90px}.billing-hero{align-items:flex-start}.billing-hero h1{font-size:32px}.return-card{grid-template-columns:auto 1fr;padding:16px}.return-card>.q-btn{grid-column:1/-1;width:100%}.plan-meta{grid-template-columns:1fr}.current-plan-card{padding:20px}.billing-health-card{align-items:flex-start;padding:19px}.configuration-lock{grid-template-columns:1fr;padding:22px}.lock-illustration{width:56px;height:56px}.section-heading{align-items:flex-start;flex-direction:column}.plans-grid{grid-template-columns:1fr}.billing-plan{min-height:420px}.payments-list article{grid-template-columns:36px 1fr auto;padding:13px 14px}.payments-list .q-badge{grid-column:2}.payment-value{grid-column:3;grid-row:1}.payments-card>footer{align-items:flex-start;flex-direction:column;gap:10px}.payments-empty{padding:20px;text-align:left}.checkout-confirm-dialog{width:calc(100vw - 16px);border-radius:20px}.checkout-confirm-header{min-height:68px;padding:11px 10px 11px 15px}.checkout-confirm-brand>span{width:38px;height:38px;border-radius:12px;font-size:19px}.checkout-confirm-content{max-height:68vh;padding:21px 17px;overflow-y:auto}.checkout-plan-summary{grid-template-columns:1fr;gap:17px}.checkout-plan-price>b{font-size:35px}.checkout-cycle-grid{grid-template-columns:1fr}.checkout-cycle-grid article{padding:11px}.checkout-features-preview>div{grid-template-columns:1fr}.checkout-confirm-actions{padding:11px 14px;align-items:stretch;flex-direction:column-reverse}.checkout-confirm-actions .q-btn{width:100%}.checkout-confirm-actions .q-btn:last-child{min-height:48px}}
</style>
