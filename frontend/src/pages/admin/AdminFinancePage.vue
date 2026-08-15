<template>
  <q-page class="dashboard-page finance-admin-page">
    <div class="finance-hero">
      <div>
        <span class="page-overline">RECEITA E ACESSOS</span>
        <h1>Financeiro</h1>
        <p>Configure a cobrança, organize os planos e acompanhe cada pagamento da plataforma.</p>
      </div>
      <div class="hero-actions">
        <q-chip
          :color="settingsReady ? 'green-1' : 'orange-1'"
          :text-color="settingsReady ? 'green-9' : 'orange-10'"
          :icon="settingsReady ? 'verified' : 'warning_amber'"
        >
          {{ settingsReady ? 'InfinitePay pronta' : 'Configuração incompleta' }}
        </q-chip>
        <q-btn flat round icon="refresh" aria-label="Atualizar financeiro" :loading="refreshing" @click="refreshAll" />
      </div>
    </div>

    <section class="billing-summary-grid">
      <article v-for="item in summaryCards" :key="item.label" class="summary-card">
        <span class="summary-icon" :class="item.tone"><q-icon :name="item.icon" /></span>
        <div><small>{{ item.label }}</small><strong>{{ item.value }}</strong><span>{{ item.hint }}</span></div>
      </article>
    </section>

    <section class="finance-grid q-mt-lg">
      <q-card flat class="finance-panel settings-panel">
        <q-card-section class="panel-title">
          <div>
            <span>INTEGRAÇÃO</span>
            <h2>InfinitePay</h2>
            <p>Estes dados controlam a criação dos links mensais e o retorno dos pagamentos.</p>
          </div>
          <span class="provider-mark">∞</span>
        </q-card-section>

        <q-banner v-if="settingsError" dense rounded class="error-banner q-mx-lg q-mt-md">
          <template #avatar><q-icon name="error_outline" color="negative" /></template>
          {{ settingsError }}
          <template #action><q-btn flat dense no-caps label="Tentar novamente" @click="loadSettings" /></template>
        </q-banner>

        <q-card-section class="settings-form">
          <q-skeleton v-if="settingsLoading" type="rect" height="270px" />
          <template v-else>
            <q-input
              v-model.trim="settingsForm.infiniteTag"
              outlined
              rounded
              label="InfiniteTag"
              prefix="$"
              hint="Identificador público da conta InfinitePay"
              maxlength="80"
            >
              <template #prepend><q-icon name="alternate_email" /></template>
            </q-input>
            <q-input
              v-model.trim="settingsForm.webhookUrl"
              outlined
              rounded
              label="URL do webhook"
              hint="Endpoint HTTPS que receberá a confirmação da InfinitePay"
            >
              <template #prepend><q-icon name="webhook" /></template>
              <template #append><q-btn flat round dense icon="content_copy" @click="copy(settingsForm.webhookUrl)" /></template>
            </q-input>
            <q-input
              v-model.trim="settingsForm.redirectUrl"
              outlined
              rounded
              label="URL de retorno"
              hint="Página exibida ao barbeiro depois do checkout"
            >
              <template #prepend><q-icon name="keyboard_return" /></template>
            </q-input>

            <div class="requirements-box">
              <div class="requirements-head"><b>Requisitos mínimos</b><span>{{ completedRequirements }}/4 concluídos</span></div>
              <div v-for="requirement in settingsRequirements" :key="requirement.label" :class="['requirement', { done: requirement.done }]">
                <q-icon :name="requirement.done ? 'check_circle' : 'radio_button_unchecked'" />
                <span>{{ requirement.label }}</span>
              </div>
            </div>
          </template>
        </q-card-section>
        <q-card-actions class="panel-actions">
          <span v-if="settingsUpdatedAt">Atualizado em {{ dateTime(settingsUpdatedAt) }}</span>
          <q-space />
          <q-btn rounded unelevated color="dark" no-caps icon="save" label="Salvar configuração" :loading="settingsSaving" @click="saveSettings" />
        </q-card-actions>
      </q-card>

      <q-card flat class="finance-panel plans-panel">
        <q-card-section class="panel-title plans-heading">
          <div>
            <span>CATÁLOGO</span>
            <h2>Planos mensais</h2>
            <p>Até cinco opções, com valores e recursos independentes.</p>
          </div>
          <q-btn
            rounded
            unelevated
            color="lime-5"
            text-color="dark"
            no-caps
            icon="add"
            label="Novo plano"
            :disable="plans.length >= 5"
            @click="openPlan()"
          >
            <q-tooltip v-if="plans.length >= 5">O limite de cinco planos já foi atingido.</q-tooltip>
          </q-btn>
        </q-card-section>

        <q-banner v-if="plansError" dense rounded class="error-banner q-mx-lg q-mt-md">
          <template #avatar><q-icon name="error_outline" color="negative" /></template>
          {{ plansError }}
          <template #action><q-btn flat dense no-caps label="Tentar novamente" @click="loadPlans" /></template>
        </q-banner>

        <q-card-section class="plans-body">
          <div v-if="plansLoading" class="plans-list">
            <q-skeleton v-for="n in 3" :key="n" type="rect" height="105px" />
          </div>
          <div v-else-if="plans.length" class="plans-list">
            <article v-for="plan in plans" :key="plan.id" class="plan-row" :class="{ inactive: !plan.active }">
              <div class="plan-order">{{ String(plan.order || plans.indexOf(plan) + 1).padStart(2, '0') }}</div>
              <div class="plan-main">
                <div class="plan-name-line">
                  <b>{{ plan.name }}</b>
                  <q-badge v-if="plan.free" rounded color="blue-grey-1" text-color="blue-grey-9" label="Gratuito" />
                  <q-badge :color="plan.active ? 'green-1' : 'grey-3'" :text-color="plan.active ? 'green-9' : 'grey-8'" rounded :label="plan.active ? 'Ativo' : 'Inativo'" />
                </div>
                <small>{{ plan.code }} · {{ activeFeatureCount(plan.features) }} recursos liberados</small>
              </div>
              <div class="plan-price"><strong>{{ currency(plan.price) }}</strong><small>/ 30 dias</small></div>
              <q-btn flat round dense icon="more_horiz">
                <q-menu auto-close anchor="bottom right" self="top right">
                  <q-list dense style="min-width: 160px">
                    <q-item clickable @click="openPlan(plan)"><q-item-section avatar><q-icon name="edit" /></q-item-section><q-item-section>Editar</q-item-section></q-item>
                    <q-item clickable class="text-negative" @click="removePlan(plan)"><q-item-section avatar><q-icon name="delete_outline" /></q-item-section><q-item-section>Excluir</q-item-section></q-item>
                  </q-list>
                </q-menu>
              </q-btn>
            </article>
          </div>
          <div v-else class="empty-plans">
            <q-icon name="sell" />
            <b>Nenhum plano cadastrado</b>
            <span>Crie a primeira opção para começar a liberar cobranças.</span>
          </div>
        </q-card-section>
      </q-card>
    </section>

    <q-card flat class="finance-panel ledger-panel q-mt-lg">
      <q-tabs v-model="activeTab" dense align="left" narrow-indicator active-color="dark" indicator-color="lime-7" class="ledger-tabs">
        <q-tab name="subscriptions" no-caps icon="workspace_premium" label="Assinaturas e acessos" />
        <q-tab name="payments" no-caps icon="receipt_long" label="Pagamentos" />
      </q-tabs>
      <q-separator />

      <q-tab-panels v-model="activeTab" animated>
        <q-tab-panel name="subscriptions" class="q-pa-none">
          <div class="ledger-toolbar">
            <q-input v-model="subscriptionFilters.search" outlined rounded dense debounce="450" placeholder="Buscar barbearia, e-mail ou telefone" @update:model-value="resetAndLoadSubscriptions">
              <template #prepend><q-icon name="search" /></template>
              <template #append><q-icon v-if="subscriptionFilters.search" name="close" class="cursor-pointer" @click="subscriptionFilters.search = ''; resetAndLoadSubscriptions()" /></template>
            </q-input>
            <q-select v-model="subscriptionFilters.planId" outlined rounded dense clearable emit-value map-options :options="planFilterOptions" label="Plano" @update:model-value="resetAndLoadSubscriptions" />
            <q-select v-model="subscriptionFilters.status" outlined rounded dense clearable emit-value map-options :options="subscriptionStatusOptions" label="Status" @update:model-value="resetAndLoadSubscriptions" />
            <q-btn flat round icon="refresh" @click="loadSubscriptions" />
          </div>
          <q-banner v-if="subscriptionsError" dense class="error-banner ledger-error">{{ subscriptionsError }}</q-banner>
          <q-table
            flat
            row-key="id"
            hide-pagination
            :rows="subscriptions"
            :columns="subscriptionColumns"
            :loading="subscriptionsLoading"
            class="finance-table"
          >
            <template #body-cell-barber="props">
              <q-td :props="props"><div class="barber-cell"><q-avatar size="38px" color="grey-3" text-color="dark">{{ initials(props.row.barberName) }}</q-avatar><div><b>{{ props.row.barberName }}</b><small>{{ props.row.barberEmail || props.row.barberPhone || 'Sem contato' }}</small></div></div></q-td>
            </template>
            <template #body-cell-plan="props"><q-td :props="props"><q-badge rounded color="lime-2" text-color="dark" :label="props.row.planName" /><small class="table-subline">{{ props.row.planCode }}</small></q-td></template>
            <template #body-cell-status="props"><q-td :props="props"><q-badge rounded :color="subscriptionStatusColor(props.row.status)" :label="subscriptionStatusLabel(props.row.status)" /></q-td></template>
            <template #body-cell-periodEnd="props"><q-td :props="props"><b>{{ dateOnly(props.row.periodEnd) }}</b><small class="table-subline">{{ expiryHint(props.row.periodEnd) }}</small></q-td></template>
            <template #body-cell-actions="props"><q-td :props="props"><q-btn flat round dense icon="tune" aria-label="Ajustar acesso" @click="openSubscription(props.row)"><q-tooltip>Ajustar plano e acesso</q-tooltip></q-btn></q-td></template>
            <template #no-data><div class="table-empty"><q-icon name="inbox" /><span>Nenhuma assinatura encontrada.</span></div></template>
          </q-table>
          <div class="table-pagination"><span>{{ subscriptionsPagination.total }} registros</span><q-pagination v-model="subscriptionsPagination.page" :max="subscriptionsPagination.pages" direction-links color="dark" @update:model-value="loadSubscriptions" /></div>
        </q-tab-panel>

        <q-tab-panel name="payments" class="q-pa-none">
          <div class="ledger-toolbar">
            <q-input v-model="paymentFilters.search" outlined rounded dense debounce="450" placeholder="Buscar barbearia, pedido ou transação" @update:model-value="resetAndLoadPayments">
              <template #prepend><q-icon name="search" /></template>
              <template #append><q-icon v-if="paymentFilters.search" name="close" class="cursor-pointer" @click="paymentFilters.search = ''; resetAndLoadPayments()" /></template>
            </q-input>
            <q-select v-model="paymentFilters.planId" outlined rounded dense clearable emit-value map-options :options="planFilterOptions" label="Plano" @update:model-value="resetAndLoadPayments" />
            <q-select v-model="paymentFilters.status" outlined rounded dense clearable emit-value map-options :options="paymentStatusOptions" label="Status" @update:model-value="resetAndLoadPayments" />
            <q-btn flat round icon="refresh" @click="loadPayments" />
          </div>
          <q-banner v-if="paymentsError" dense class="error-banner ledger-error">{{ paymentsError }}</q-banner>
          <q-table flat row-key="id" hide-pagination :rows="payments" :columns="paymentColumns" :loading="paymentsLoading" class="finance-table">
            <template #body-cell-barber="props"><q-td :props="props"><div class="barber-cell"><q-avatar size="38px" color="grey-3" text-color="dark">{{ initials(props.row.barberName) }}</q-avatar><div><b>{{ props.row.barberName }}</b><small>{{ props.row.planName }}</small></div></div></q-td></template>
            <template #body-cell-amount="props"><q-td :props="props"><b>{{ currency(props.row.amount) }}</b><small class="table-subline">30 dias de acesso</small></q-td></template>
            <template #body-cell-status="props"><q-td :props="props"><q-badge rounded :color="paymentStatusColor(props.row.status)" :label="paymentStatusLabel(props.row.status)" /></q-td></template>
            <template #body-cell-createdAt="props"><q-td :props="props">{{ dateTime(props.row.createdAt) }}</q-td></template>
            <template #body-cell-reference="props"><q-td :props="props"><span class="reference-code">{{ props.row.reference }}</span></q-td></template>
            <template #no-data><div class="table-empty"><q-icon name="receipt_long" /><span>Nenhum pagamento encontrado.</span></div></template>
          </q-table>
          <div class="table-pagination"><span>{{ paymentsPagination.total }} registros</span><q-pagination v-model="paymentsPagination.page" :max="paymentsPagination.pages" direction-links color="dark" @update:model-value="loadPayments" /></div>
        </q-tab-panel>
      </q-tab-panels>
    </q-card>

    <q-dialog v-model="planDialog" persistent>
      <q-card class="finance-dialog plan-dialog">
        <q-card-section class="dialog-heading">
          <div><span>{{ editingPlanId ? 'EDITAR PLANO' : 'NOVO PLANO' }}</span><h2>{{ editingPlanId ? planForm.name : 'Criar opção mensal' }}</h2></div>
          <q-btn flat round icon="close" :disable="planSaving" v-close-popup />
        </q-card-section>
        <q-card-section class="dialog-scroll scroll">
          <div class="form-grid">
            <q-input v-model.trim="planForm.name" outlined rounded label="Nome do plano *" maxlength="60" />
            <q-input v-model.trim="planForm.code" outlined rounded label="Código único *" maxlength="40" hint="Ex.: PROFISSIONAL" @update:model-value="normalizePlanCode" />
            <q-input v-model.number="planForm.price" outlined rounded type="number" min="0" step="0.01" label="Valor mensal *" prefix="R$" :disable="planForm.free" />
            <q-input v-model.number="planForm.order" outlined rounded type="number" min="1" max="5" label="Ordem de exibição" />
          </div>
          <q-input v-model.trim="planForm.description" outlined rounded type="textarea" autogrow maxlength="240" label="Descrição" class="q-mt-md" />
          <q-select v-model="planForm.benefits" outlined rounded use-input use-chips multiple new-value-mode="add-unique" label="Vantagens" hint="Digite uma vantagem e pressione Enter" class="q-mt-md" />
          <div class="toggle-row q-mt-md"><q-toggle v-model="planForm.active" color="positive" label="Disponível para contratação" /><q-toggle v-model="planForm.free" color="blue-grey" label="Plano gratuito" @update:model-value="onFreePlanChange" /><q-toggle v-model="planForm.featured" color="lime-8" label="Destacar na vitrine" /></div>
          <div class="features-editor">
            <div class="features-title"><div><b>Recursos liberados</b><small>As regras podem ser ampliadas futuramente sem alterar o plano.</small></div><q-icon name="tune" /></div>
            <q-toggle v-for="feature in featureOptions" :key="feature.key" v-model="planForm.features[feature.key]" :label="feature.label" :icon="feature.icon" color="positive" />
          </div>
        </q-card-section>
        <q-card-actions class="dialog-actions"><q-btn flat rounded no-caps label="Cancelar" :disable="planSaving" v-close-popup /><q-btn rounded unelevated color="dark" no-caps label="Salvar plano" :loading="planSaving" @click="savePlan" /></q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="subscriptionDialog" persistent>
      <q-card class="finance-dialog subscription-dialog">
        <q-card-section class="dialog-heading">
          <div><span>AJUSTE MANUAL</span><h2>{{ subscriptionForm.barberName }}</h2><p>Altere somente após validar a situação financeira deste estabelecimento.</p></div>
          <q-btn flat round icon="close" :disable="subscriptionSaving" v-close-popup />
        </q-card-section>
        <q-card-section class="dialog-form">
          <q-select v-model="subscriptionForm.planId" outlined rounded emit-value map-options :options="planFilterOptions" label="Plano atual" />
          <q-select v-model="subscriptionForm.status" outlined rounded emit-value map-options :options="subscriptionStatusOptions" label="Status de acesso" />
          <q-input v-model="subscriptionForm.periodEnd" outlined rounded type="date" stack-label label="Vencimento do acesso" :disable="subscriptionForm.status === 'FREE'" :hint="subscriptionForm.status === 'FREE' ? 'O plano gratuito não expira.' : ''" />
          <q-input v-model.trim="subscriptionForm.note" outlined rounded type="textarea" autogrow maxlength="300" label="Motivo do ajuste" hint="Este texto pode ser usado na auditoria administrativa." />
          <q-banner rounded class="manual-warning"><template #avatar><q-icon name="info" /></template>O ajuste é imediato e pode liberar ou suspender agendamentos e chatbot.</q-banner>
        </q-card-section>
        <q-card-actions class="dialog-actions"><q-btn flat rounded no-caps label="Cancelar" :disable="subscriptionSaving" v-close-popup /><q-btn rounded unelevated color="dark" no-caps label="Aplicar ajuste" :loading="subscriptionSaving" @click="saveSubscription" /></q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { copyToClipboard, useQuasar } from 'quasar'
import { api } from 'boot/axios'

const $q = useQuasar()
const activeTab = ref('subscriptions')
const refreshing = ref(false)

const settingsForm = reactive({ infiniteTag: 'aitosoftwares', webhookUrl: '', redirectUrl: '' })
const settingsLoading = ref(false)
const settingsSaving = ref(false)
const settingsError = ref('')
const settingsUpdatedAt = ref(null)

const plans = ref([])
const plansLoading = ref(false)
const plansError = ref('')
const planDialog = ref(false)
const planSaving = ref(false)
const editingPlanId = ref(null)
const planForm = reactive(emptyPlan())

const subscriptions = ref([])
const subscriptionsLoading = ref(false)
const subscriptionsError = ref('')
const subscriptionsPagination = reactive({ page: 1, pages: 1, total: 0, limit: 10 })
const subscriptionFilters = reactive({ search: '', planId: null, status: null })
const subscriptionDialog = ref(false)
const subscriptionSaving = ref(false)
const subscriptionId = ref(null)
const subscriptionForm = reactive({ barberName: '', planId: null, status: 'ACTIVE', periodEnd: '', note: '' })

const payments = ref([])
const paymentsLoading = ref(false)
const paymentsError = ref('')
const paymentsPagination = reactive({ page: 1, pages: 1, total: 0, limit: 10 })
const paymentFilters = reactive({ search: '', planId: null, status: null })

const featureOptions = [
  { key: 'publicSite', label: 'Publicar e manter o site', icon: 'language' },
  { key: 'onlineBooking', label: 'Confirmar agendamento online', icon: 'event_available' },
  { key: 'botBooking', label: 'Usar chatbot e agendar pelo bot', icon: 'smart_toy' }
]

const subscriptionStatusOptions = [
  { label: 'Plano gratuito', value: 'FREE' },
  { label: 'Ativo', value: 'ACTIVE' },
  { label: 'Aguardando pagamento', value: 'PENDING_PAYMENT' },
  { label: 'Vencido', value: 'EXPIRED' },
  { label: 'Suspenso', value: 'SUSPENDED' },
  { label: 'Cancelado', value: 'CANCELLED' }
]

const paymentStatusOptions = [
  { label: 'Aguardando pagamento', value: 'PENDING' },
  { label: 'Processando', value: 'PROCESSING' },
  { label: 'Pago', value: 'PAID' },
  { label: 'Falhou', value: 'FAILED' },
  { label: 'Cancelado', value: 'CANCELLED' }
]

const subscriptionColumns = [
  { name: 'barber', label: 'Barbearia / salão', field: 'barberName', align: 'left' },
  { name: 'plan', label: 'Plano', field: 'planName', align: 'left' },
  { name: 'status', label: 'Acesso', field: 'status', align: 'left' },
  { name: 'periodEnd', label: 'Vencimento', field: 'periodEnd', align: 'left' },
  { name: 'updatedAt', label: 'Última alteração', field: row => dateTime(row.updatedAt), align: 'left' },
  { name: 'actions', label: '', field: 'actions', align: 'right' }
]

const paymentColumns = [
  { name: 'barber', label: 'Barbearia / plano', field: 'barberName', align: 'left' },
  { name: 'amount', label: 'Valor', field: 'amount', align: 'left' },
  { name: 'status', label: 'Status', field: 'status', align: 'left' },
  { name: 'createdAt', label: 'Criado em', field: 'createdAt', align: 'left' },
  { name: 'paidAt', label: 'Pago em', field: row => row.paidAt ? dateTime(row.paidAt) : '—', align: 'left' },
  { name: 'reference', label: 'Referência', field: 'reference', align: 'left' }
]

const settingsRequirements = computed(() => [
  { label: 'InfiniteTag válida', done: /^[a-zA-Z0-9._-]{2,80}$/.test(cleanInfiniteTag(settingsForm.infiniteTag)) },
  { label: 'Webhook HTTPS configurado', done: isHttpsUrl(settingsForm.webhookUrl) },
  { label: 'Retorno HTTPS ou localhost configurado', done: isReturnUrl(settingsForm.redirectUrl) },
  { label: 'Ao menos um plano pago ativo', done: plans.value.some(plan => plan.active && !plan.free && plan.price > 0) }
])
const completedRequirements = computed(() => settingsRequirements.value.filter(item => item.done).length)
const settingsReady = computed(() => completedRequirements.value === settingsRequirements.value.length)
const settingsFieldsReady = computed(() => settingsRequirements.value.slice(0, 3).every(item => item.done))
const planFilterOptions = computed(() => plans.value.map(plan => ({ label: plan.name, value: plan.id })))
const paidPayments = computed(() => payments.value.filter(payment => payment.status === 'PAID'))
const activeSubscriptions = computed(() => subscriptions.value.filter(subscription => subscription.status === 'ACTIVE').length)
const grossVisibleRevenue = computed(() => paidPayments.value.reduce((sum, payment) => sum + payment.amount, 0))
const expiringSubscriptions = computed(() => subscriptions.value.filter(subscription => {
  const days = daysUntil(subscription.periodEnd)
  return days >= 0 && days <= 7
}).length)
const summaryCards = computed(() => [
  { label: 'Acessos ativos', value: activeSubscriptions.value, hint: 'na página atual', icon: 'verified_user', tone: 'green' },
  { label: 'Receita confirmada', value: currency(grossVisibleRevenue.value), hint: 'nos pagamentos exibidos', icon: 'payments', tone: 'lime' },
  { label: 'Vencem em 7 dias', value: expiringSubscriptions.value, hint: 'pedem atenção', icon: 'timer', tone: 'orange' },
  { label: 'Planos disponíveis', value: plans.value.filter(plan => plan.active).length, hint: `de ${plans.value.length} cadastrados`, icon: 'sell', tone: 'blue' }
])

function emptyFeatures () {
  return { publicSite: true, onlineBooking: false, botBooking: false }
}

function emptyPlan () {
  return { name: '', code: '', price: 0, description: '', benefits: [], active: true, free: false, featured: false, order: 1, features: emptyFeatures() }
}

function firstDefined (...values) {
  return values.find(value => value !== undefined && value !== null)
}

function listFrom (payload, keys = []) {
  if (Array.isArray(payload)) return payload
  for (const key of keys) if (Array.isArray(payload?.[key])) return payload[key]
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.data?.data)) return payload.data.data
  for (const key of keys) if (Array.isArray(payload?.data?.[key])) return payload.data[key]
  return []
}

function paginationFrom (payload, count) {
  const source = payload?.pagination || payload?.meta || payload?.data?.pagination || payload?.data?.meta || {}
  const total = Number(firstDefined(source.total, source.totalItems, source.count, count)) || 0
  const limit = Number(firstDefined(source.limit, source.perPage, 10)) || 10
  const pages = Number(firstDefined(source.pages, source.totalPages, Math.ceil(total / limit), 1)) || 1
  return { total, limit, pages: Math.max(1, pages) }
}

function priceFrom (source) {
  const cents = firstDefined(source.priceCents, source.priceInCents, source.amountCents, source.paidAmountCents, source.amountInCents, source.monthlyPriceInCents)
  if (cents !== undefined) return Number(cents) / 100
  const value = Number(firstDefined(source.monthlyPrice, source.price, source.amount, 0)) || 0
  return value > 1000 ? value / 100 : value
}

function normalizePlan (source, index = 0) {
  const rawFeatures = source.entitlements || source.resources || source.featureFlags || {}
  const features = { ...emptyFeatures() }
  features.publicSite = Boolean(firstDefined(rawFeatures.publicSite, rawFeatures.publishedSite, source.publicSite, true))
  features.onlineBooking = Boolean(firstDefined(rawFeatures.onlineBooking, source.onlineBooking, false))
  features.botBooking = Boolean(firstDefined(rawFeatures.botBooking, rawFeatures.chatbot, source.botBooking, false))
  return {
    raw: source,
    id: String(firstDefined(source._id, source.id, source.planId, source.code, index)),
    name: firstDefined(source.name, source.title, 'Plano sem nome'),
    code: String(firstDefined(source.code, source.slug, source.key, '')).toUpperCase(),
    price: priceFrom(source),
    description: firstDefined(source.description, source.subtitle, ''),
    benefits: firstDefined(source.benefits, source.advantages, source.perks, Array.isArray(source.features) ? source.features : []),
    active: Boolean(firstDefined(source.active, source.enabled, true)),
    free: Boolean(firstDefined(source.free, source.isFree, priceFrom(source) === 0)),
    featured: Boolean(firstDefined(source.featured, source.highlighted, source.recommended, false)),
    order: Number(firstDefined(source.order, source.sortOrder, source.displayOrder, index + 1)),
    features
  }
}

function normalizeSubscription (source, index = 0) {
  const barber = source.barber || source.profile || source.user || source.barberProfile || {}
  const plan = source.plan || source.billingPlan || {}
  return {
    raw: source,
    id: String(firstDefined(source._id, source.id, source.subscriptionId, index)),
    barberName: firstDefined(barber.businessName, source.businessName, barber.name, source.barberName, 'Barbearia sem nome'),
    barberEmail: firstDefined(barber.email, barber.user?.email, source.barberEmail, source.email, ''),
    barberPhone: firstDefined(barber.phone, barber.user?.phone, source.barberPhone, ''),
    planId: String(firstDefined(plan._id, plan.id, source.planId, plan.code, '')),
    planName: firstDefined(plan.name, source.planName, 'Gratuito'),
    planCode: firstDefined(plan.code, source.planCode, ''),
    status: String(firstDefined(source.status, source.subscriptionStatus, 'PENDING_PAYMENT')).toUpperCase(),
    periodEnd: firstDefined(source.currentPeriodEnd, source.expiresAt, source.periodEnd, source.accessUntil, null),
    updatedAt: firstDefined(source.updatedAt, source.createdAt, null)
  }
}

function normalizePayment (source, index = 0) {
  const barber = source.barber || source.profile || source.user || {}
  const plan = source.plan || source.billingPlan || {}
  return {
    raw: source,
    id: String(firstDefined(source._id, source.id, source.paymentId, index)),
    barberName: firstDefined(barber.businessName, source.businessName, barber.name, source.barberName, 'Barbearia sem nome'),
    planName: firstDefined(plan.name, source.planName, 'Plano'),
    amount: priceFrom(source),
    status: String(firstDefined(source.status, source.paymentStatus, 'PENDING')).toUpperCase(),
    createdAt: firstDefined(source.createdAt, source.requestedAt, null),
    paidAt: firstDefined(source.paidAt, source.approvedAt, null),
    reference: firstDefined(source.orderNsu, source.order_nsu, source.transactionId, source.externalId, source.reference, '—')
  }
}

function errorMessage (error, fallback) {
  return error?.response?.data?.message || error?.response?.data?.error || error?.message || fallback
}

async function loadSettings () {
  settingsLoading.value = true
  settingsError.value = ''
  try {
    const { data } = await api.get('/admin/billing/settings')
    const source = data?.settings || data?.data?.settings || data?.data || data || {}
    settingsForm.infiniteTag = cleanInfiniteTag(firstDefined(source.infiniteTag, source.infinitepayTag, source.handle, 'aitosoftwares'))
    settingsForm.webhookUrl = firstDefined(source.webhookUrl, source.webhookURL, source.urls?.webhook, '')
    settingsForm.redirectUrl = firstDefined(source.redirectUrl, source.redirectBaseUrl, source.returnUrl, source.urls?.redirect, '')
    settingsUpdatedAt.value = firstDefined(source.updatedAt, data?.updatedAt, null)
  } catch (error) {
    settingsError.value = errorMessage(error, 'Não foi possível carregar a configuração da InfinitePay.')
  } finally {
    settingsLoading.value = false
  }
}

async function saveSettings () {
  if (!settingsFieldsReady.value) {
    $q.notify({ type: 'warning', message: 'Preencha a InfiniteTag e URLs HTTPS válidas.' })
    return
  }
  settingsSaving.value = true
  settingsError.value = ''
  try {
    const payload = {
      handle: cleanInfiniteTag(settingsForm.infiniteTag),
      webhookUrl: settingsForm.webhookUrl,
      redirectBaseUrl: settingsForm.redirectUrl
    }
    const { data } = await api.put('/admin/billing/settings', payload)
    settingsUpdatedAt.value = firstDefined(data?.settings?.updatedAt, data?.data?.updatedAt, data?.updatedAt, new Date().toISOString())
    $q.notify({ type: 'positive', message: 'Configuração financeira salva.' })
  } catch (error) {
    settingsError.value = errorMessage(error, 'Não foi possível salvar a configuração.')
    $q.notify({ type: 'negative', message: settingsError.value })
  } finally {
    settingsSaving.value = false
  }
}

async function loadPlans () {
  plansLoading.value = true
  plansError.value = ''
  try {
    const { data } = await api.get('/admin/billing/plans')
    plans.value = listFrom(data, ['plans']).map(normalizePlan).sort((a, b) => a.order - b.order)
  } catch (error) {
    plansError.value = errorMessage(error, 'Não foi possível carregar os planos.')
  } finally {
    plansLoading.value = false
  }
}

function openPlan (plan = null) {
  editingPlanId.value = plan?.id || null
  Object.assign(planForm, plan ? {
    name: plan.name,
    code: plan.code,
    price: plan.price,
    description: plan.description,
    benefits: [...plan.benefits],
    active: plan.active,
    free: plan.free,
    featured: plan.featured,
    order: plan.order,
    features: { ...emptyFeatures(), ...plan.features }
  } : { ...emptyPlan(), order: Math.min(5, plans.value.length + 1) })
  planDialog.value = true
}

function normalizePlanCode (value) {
  planForm.code = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]/g, '_').toUpperCase()
}

function onFreePlanChange (free) {
  if (free) planForm.price = 0
}

function planPayload () {
  const price = planForm.free ? 0 : Math.max(0, Number(planForm.price) || 0)
  return {
    name: planForm.name.trim(),
    slug: planForm.code.trim().toLowerCase(),
    priceCents: Math.round(price * 100),
    durationDays: 30,
    description: planForm.description.trim(),
    features: planForm.benefits.map(value => String(value).trim()).filter(Boolean),
    active: planForm.active,
    isFree: planForm.free,
    highlighted: planForm.featured,
    displayOrder: Math.min(5, Math.max(1, Number(planForm.order) || 1)),
    entitlements: {
      publishedSite: planForm.features.publicSite,
      onlineBooking: planForm.features.onlineBooking,
      chatbot: planForm.features.botBooking
    }
  }
}

async function savePlan () {
  if (!planForm.name.trim() || !planForm.code.trim()) {
    $q.notify({ type: 'warning', message: 'Informe nome e código do plano.' })
    return
  }
  if (!editingPlanId.value && plans.value.length >= 5) {
    $q.notify({ type: 'warning', message: 'O limite de cinco planos foi atingido.' })
    return
  }
  planSaving.value = true
  try {
    if (editingPlanId.value) await api.patch(`/admin/billing/plans/${encodeURIComponent(editingPlanId.value)}`, planPayload())
    else await api.post('/admin/billing/plans', planPayload())
    $q.notify({ type: 'positive', message: editingPlanId.value ? 'Plano atualizado.' : 'Plano criado.' })
    planDialog.value = false
    await loadPlans()
  } catch (error) {
    $q.notify({ type: 'negative', message: errorMessage(error, 'Não foi possível salvar o plano.') })
  } finally {
    planSaving.value = false
  }
}

function removePlan (plan) {
  $q.dialog({
    title: `Excluir ${plan.name}?`,
    message: 'Planos vinculados a históricos financeiros podem não ser removidos; nesse caso, apenas inative o plano.',
    cancel: { rounded: true, flat: true, label: 'Cancelar' },
    ok: { rounded: true, unelevated: true, color: 'negative', label: 'Excluir' },
    persistent: true
  }).onOk(async () => {
    try {
      await api.delete(`/admin/billing/plans/${encodeURIComponent(plan.id)}`)
      $q.notify({ message: 'Plano removido.', color: 'dark' })
      await loadPlans()
    } catch (error) {
      $q.notify({ type: 'negative', message: errorMessage(error, 'Não foi possível excluir o plano.') })
    }
  })
}

async function loadSubscriptions () {
  subscriptionsLoading.value = true
  subscriptionsError.value = ''
  try {
    const { data } = await api.get('/admin/billing/subscriptions', { params: {
      page: subscriptionsPagination.page,
      limit: subscriptionsPagination.limit,
      search: subscriptionFilters.search || undefined,
      planId: subscriptionFilters.planId || undefined,
      status: subscriptionFilters.status || undefined
    } })
    const list = listFrom(data, ['subscriptions'])
    subscriptions.value = list.map(normalizeSubscription)
    Object.assign(subscriptionsPagination, paginationFrom(data, list.length))
  } catch (error) {
    subscriptionsError.value = errorMessage(error, 'Não foi possível carregar as assinaturas.')
  } finally {
    subscriptionsLoading.value = false
  }
}

function resetAndLoadSubscriptions () {
  subscriptionsPagination.page = 1
  loadSubscriptions()
}

function openSubscription (subscription) {
  subscriptionId.value = subscription.id
  Object.assign(subscriptionForm, {
    barberName: subscription.barberName,
    planId: subscription.planId || null,
    status: subscription.status,
    periodEnd: toDateInput(subscription.periodEnd),
    note: ''
  })
  subscriptionDialog.value = true
}

async function saveSubscription () {
  if (!subscriptionForm.planId || !subscriptionForm.status || (subscriptionForm.status !== 'FREE' && !subscriptionForm.periodEnd)) {
    $q.notify({ type: 'warning', message: 'Informe plano, status e vencimento.' })
    return
  }
  subscriptionSaving.value = true
  try {
    await api.patch(`/admin/billing/subscriptions/${encodeURIComponent(subscriptionId.value)}`, {
      planId: subscriptionForm.planId,
      status: subscriptionForm.status,
      periodEnd: subscriptionForm.status === 'FREE' ? null : endOfLocalDayIso(subscriptionForm.periodEnd),
      note: subscriptionForm.note || undefined
    })
    $q.notify({ type: 'positive', message: 'Acesso financeiro ajustado.' })
    subscriptionDialog.value = false
    await loadSubscriptions()
  } catch (error) {
    $q.notify({ type: 'negative', message: errorMessage(error, 'Não foi possível ajustar a assinatura.') })
  } finally {
    subscriptionSaving.value = false
  }
}

async function loadPayments () {
  paymentsLoading.value = true
  paymentsError.value = ''
  try {
    const { data } = await api.get('/admin/billing/payments', { params: {
      page: paymentsPagination.page,
      limit: paymentsPagination.limit,
      search: paymentFilters.search || undefined,
      planId: paymentFilters.planId || undefined,
      status: paymentFilters.status || undefined
    } })
    const list = listFrom(data, ['payments'])
    payments.value = list.map(normalizePayment)
    Object.assign(paymentsPagination, paginationFrom(data, list.length))
  } catch (error) {
    paymentsError.value = errorMessage(error, 'Não foi possível carregar os pagamentos.')
  } finally {
    paymentsLoading.value = false
  }
}

function resetAndLoadPayments () {
  paymentsPagination.page = 1
  loadPayments()
}

async function refreshAll () {
  refreshing.value = true
  await Promise.allSettled([loadSettings(), loadPlans(), loadSubscriptions(), loadPayments()])
  refreshing.value = false
}

function cleanInfiniteTag (value) {
  return String(value || '').trim().replace(/^[$@]+/, '')
}

function isHttpsUrl (value) {
  try { return new URL(value).protocol === 'https:' } catch { return false }
}

function isReturnUrl (value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))
  } catch { return false }
}

function currency (value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function validDate (value) {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date : null
}

function dateTime (value) {
  const date = validDate(value)
  return date ? date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'
}

function dateOnly (value) {
  const date = validDate(value)
  return date ? date.toLocaleDateString('pt-BR') : 'Sem vencimento'
}

function toDateInput (value) {
  const date = validDate(value)
  if (!date) return ''
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

function endOfLocalDayIso (dateInput) {
  return new Date(`${dateInput}T23:59:59.999`).toISOString()
}

function daysUntil (value) {
  const date = validDate(value)
  if (!date) return Number.POSITIVE_INFINITY
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const end = new Date(date); end.setHours(0, 0, 0, 0)
  return Math.ceil((end - today) / 86400000)
}

function expiryHint (value) {
  const days = daysUntil(value)
  if (!Number.isFinite(days)) return 'Acesso sem prazo'
  if (days < 0) return `Vencido há ${Math.abs(days)} ${Math.abs(days) === 1 ? 'dia' : 'dias'}`
  if (days === 0) return 'Vence hoje'
  return `Faltam ${days} ${days === 1 ? 'dia' : 'dias'}`
}

function initials (value) {
  return String(value || 'CM').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()
}

function activeFeatureCount (features) {
  return Object.values(features || {}).filter(Boolean).length
}

function subscriptionStatusLabel (status) {
  return subscriptionStatusOptions.find(item => item.value === status)?.label || status
}

function subscriptionStatusColor (status) {
  return { FREE: 'blue-grey', ACTIVE: 'positive', PENDING_PAYMENT: 'warning', EXPIRING: 'orange', EXPIRED: 'negative', PAST_DUE: 'deep-orange', SUSPENDED: 'grey-7', CANCELLED: 'blue-grey', CANCELED: 'blue-grey' }[status] || 'grey'
}

function paymentStatusLabel (status) {
  return paymentStatusOptions.find(item => item.value === status)?.label || status
}

function paymentStatusColor (status) {
  return { PAID: 'positive', PENDING: 'warning', PROCESSING: 'info', EXPIRED: 'grey-7', FAILED: 'negative', CANCELLED: 'blue-grey', CANCELED: 'blue-grey', REFUNDED: 'purple' }[status] || 'grey'
}

function copy (value) {
  if (!value) return
  copyToClipboard(value).then(() => $q.notify({ message: 'URL copiada.', color: 'dark' }))
}

onMounted(refreshAll)
</script>

<style scoped>
.finance-admin-page { --finance-border: #e2e5de; --finance-muted: #737b76; }
.finance-hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 28px; }
.finance-hero h1 { margin: 7px 0 5px; font-size: clamp(34px, 4vw, 46px); line-height: 1; letter-spacing: -2px; }
.finance-hero p { margin: 0; color: var(--finance-muted); }
.hero-actions { display: flex; align-items: center; gap: 8px; }
.billing-summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.summary-card { min-height: 112px; padding: 19px; display: flex; align-items: center; gap: 15px; background: #fff; border: 1px solid var(--finance-border); border-radius: 18px; box-shadow: 0 8px 24px rgba(27, 36, 30, .025); }
.summary-icon { width: 43px; height: 43px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 13px; font-size: 21px; }
.summary-icon.green { color: #497e38; background: #e9f4e1; }.summary-icon.lime { color: #5e7b25; background: #eff8dc; }.summary-icon.orange { color: #a36621; background: #fff0dc; }.summary-icon.blue { color: #3d7189; background: #e4f1f6; }
.summary-card small,.summary-card strong,.summary-card span { display: block; }.summary-card small { color: #747d77; font-size: 10px; font-weight: 700; }.summary-card strong { margin: 5px 0 2px; font-size: 23px; letter-spacing: -.7px; }.summary-card > div > span { color: #959b97; font-size: 9px; }
.finance-grid { display: grid; grid-template-columns: minmax(330px, .85fr) minmax(500px, 1.15fr); gap: 18px; align-items: start; }
.finance-panel { background: #fff; border: 1px solid var(--finance-border); border-radius: 20px; box-shadow: 0 9px 30px rgba(25, 34, 28, .025); overflow: hidden; }
.panel-title { min-height: 105px; padding: 23px 25px; display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; border-bottom: 1px solid #eceee9; }
.panel-title > div > span,.dialog-heading span { color: #858d88; font-size: 9px; font-weight: 800; letter-spacing: 1.6px; }.panel-title h2 { margin: 4px 0 5px; font-size: 22px; letter-spacing: -.7px; }.panel-title p { margin: 0; color: #7d8580; font-size: 11px; line-height: 1.5; }
.provider-mark { width: 47px; height: 47px; display: grid; place-items: center; flex: 0 0 auto; border-radius: 15px; background: #191e1b; color: #c8f45d; font-size: 29px; font-weight: 800; }
.settings-form { min-height: 375px; padding: 22px 24px; display: grid; gap: 17px; }
.requirements-box { padding: 15px; background: #f6f8f3; border: 1px solid #e5e9df; border-radius: 14px; }
.requirements-head { margin-bottom: 9px; display: flex; justify-content: space-between; font-size: 10px; }.requirements-head span { color: #858d87; }
.requirement { padding: 4px 0; display: flex; align-items: center; gap: 8px; color: #8e9590; font-size: 10px; }.requirement.done { color: #4e7f3d; }.requirement .q-icon { font-size: 17px; }
.panel-actions { min-height: 69px; padding: 13px 22px; border-top: 1px solid #eceee9; }.panel-actions > span { color: #929894; font-size: 9px; }
.error-banner { background: #fff1f0; color: #8b312c; border: 1px solid #f1d2ce; font-size: 11px; }
.plans-heading { align-items: center; }.plans-body { min-height: 375px; padding: 17px; }.plans-list { display: grid; gap: 9px; }
.plan-row { min-height: 78px; padding: 12px 10px 12px 14px; display: grid; grid-template-columns: 35px 1fr auto 34px; align-items: center; gap: 10px; border: 1px solid #e4e7e0; border-radius: 14px; transition: .18s ease; }.plan-row:hover { border-color: #cbd5bd; box-shadow: 0 7px 18px rgba(30, 40, 32, .05); }.plan-row.inactive { opacity: .6; }
.plan-order { width: 30px; height: 30px; display: grid; place-items: center; background: #f2f4ef; border-radius: 9px; color: #7c847e; font-size: 9px; font-weight: 800; }.plan-name-line { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }.plan-main b { font-size: 12px; }.plan-main > small { display: block; margin-top: 5px; color: #8b928d; font-size: 9px; }.plan-price { text-align: right; }.plan-price strong,.plan-price small { display: block; }.plan-price strong { font-size: 15px; }.plan-price small { margin-top: 2px; color: #959b97; font-size: 8px; }
.empty-plans { min-height: 300px; display: grid; align-content: center; justify-items: center; text-align: center; color: #8b928e; }.empty-plans .q-icon { margin-bottom: 14px; color: #93ad62; font-size: 45px; }.empty-plans b { color: #252a27; }.empty-plans span { margin-top: 5px; font-size: 10px; }
.ledger-panel { min-height: 430px; }.ledger-tabs { min-height: 63px; padding: 0 13px; }.ledger-toolbar { padding: 15px 18px; display: grid; grid-template-columns: minmax(270px, 1fr) 190px 190px auto; gap: 9px; align-items: center; border-bottom: 1px solid #eceee9; }.ledger-error { margin: 12px 18px; border-radius: 10px; }
.finance-table :deep(.q-table th) { height: 45px; color: #808883; font-size: 9px; font-weight: 800; letter-spacing: .8px; text-transform: uppercase; }.finance-table :deep(.q-table td) { height: 65px; font-size: 11px; }.barber-cell { display: flex; align-items: center; gap: 10px; }.barber-cell b,.barber-cell small { display: block; }.barber-cell small,.table-subline { margin-top: 3px; color: #8c938e; font-size: 9px; }.table-subline { display: block; }.reference-code { padding: 5px 7px; background: #f2f4ef; border-radius: 6px; color: #626a65; font-family: monospace; font-size: 9px; }.table-empty { width: 100%; min-height: 230px; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 8px; color: #929995; }.table-empty .q-icon { font-size: 42px; }.table-pagination { min-height: 65px; padding: 10px 18px; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #eceee9; }.table-pagination > span { color: #8d948f; font-size: 10px; }
.finance-dialog { width: min(700px, calc(100vw - 28px)); max-width: 700px; border-radius: 22px; }.dialog-heading { padding: 22px 24px; display: flex; justify-content: space-between; gap: 18px; border-bottom: 1px solid #e8ebe5; }.dialog-heading h2 { margin: 4px 0 0; font-size: 23px; letter-spacing: -.8px; }.dialog-heading p { margin: 5px 0 0; color: #7d8580; font-size: 10px; }.dialog-scroll { max-height: min(70vh, 680px); padding: 23px 24px; }.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }.toggle-row { display: flex; flex-wrap: wrap; gap: 18px; }
.features-editor { margin-top: 21px; padding: 17px; display: grid; grid-template-columns: 1fr 1fr; gap: 5px 12px; background: #f6f8f3; border: 1px solid #e3e7dd; border-radius: 15px; }.features-title { grid-column: 1 / -1; margin-bottom: 7px; display: flex; align-items: center; justify-content: space-between; }.features-title b,.features-title small { display: block; }.features-title small { margin-top: 3px; color: #858d87; font-size: 9px; }.dialog-actions { min-height: 72px; padding: 12px 21px; justify-content: flex-end; border-top: 1px solid #e8ebe5; }.dialog-form { padding: 23px 24px; display: grid; gap: 15px; }.manual-warning { background: #f3f8e9; color: #576b44; font-size: 10px; }
@media (max-width: 1180px) { .billing-summary-grid { grid-template-columns: repeat(2, 1fr); }.finance-grid { grid-template-columns: 1fr; }.settings-form { min-height: auto; }.plans-body { min-height: auto; }.ledger-toolbar { grid-template-columns: 1fr 1fr; }.ledger-toolbar > .q-input { grid-column: 1 / -1; } }
@media (max-width: 700px) { .finance-admin-page { padding: 24px 15px 90px; }.finance-hero { align-items: flex-start; flex-direction: column; }.finance-hero p { font-size: 12px; }.hero-actions { width: 100%; justify-content: space-between; }.billing-summary-grid { grid-template-columns: 1fr; }.summary-card { min-height: 92px; }.panel-title { padding: 20px; }.plans-heading { align-items: flex-start; flex-direction: column; }.plans-heading .q-btn { width: 100%; }.plan-row { grid-template-columns: 34px 1fr 32px; }.plan-price { grid-column: 2; grid-row: 2; text-align: left; }.plan-price strong,.plan-price small { display: inline; margin-right: 4px; }.ledger-toolbar { grid-template-columns: 1fr; }.ledger-toolbar > .q-input { grid-column: auto; }.ledger-tabs :deep(.q-tab__label) { font-size: 10px; }.table-pagination { align-items: flex-start; flex-direction: column; gap: 9px; overflow-x: auto; }.form-grid,.features-editor { grid-template-columns: 1fr; }.features-title { grid-column: auto; }.dialog-scroll { max-height: 65vh; }.finance-table { max-width: 100%; overflow-x: auto; } }
</style>
