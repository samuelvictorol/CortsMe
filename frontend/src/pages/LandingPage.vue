<template>
  <q-page class="landing-page">
    <section class="hero-section container">
      <div class="hero-copy">
        <div class="eyebrow"><span class="pulse-dot" /> A agenda que trabalha por você</div>
        <h1>Menos mensagens.<br><span>Mais cadeiras ocupadas.</span></h1>
        <p>Seu site, agenda e atendimento inteligente em um só lugar. Feito para barbearias que querem crescer sem complicação.</p>
        <div class="hero-actions">
          <q-btn to="/barbearia-premium" unelevated rounded color="dark" size="lg" no-caps label="Ver experiência ao vivo" icon-right="arrow_outward" />
          <a href="#como-funciona" class="text-link">Descobrir como funciona <q-icon name="south" /></a>
        </div>
        <div class="trust-row">
          <div class="avatar-stack"><q-avatar v-for="n in 4" :key="n" size="36px" :color="['blue-grey-8','brown-5','grey-9','green-8'][n - 1]" text-color="white">{{ ['RM','LC','AV','JP'][n - 1] }}</q-avatar></div>
          <div><div class="stars">★★★★★</div><small>Profissionais no controle da própria agenda</small></div>
        </div>
      </div>

      <div class="hero-visual" aria-label="Prévia da agenda CortsMe">
        <div class="visual-orbit visual-orbit--one" />
        <div class="visual-orbit visual-orbit--two" />
        <div class="phone-card">
          <div class="phone-top"><span>9:41</span><div class="phone-island" /><q-icon name="signal_cellular_alt" size="16px" /></div>
          <div class="phone-content">
            <div class="row items-center justify-between"><div><small>Bom dia, Rafael</small><h5>Sua agenda</h5></div><q-avatar color="lime-5" text-color="dark">RM</q-avatar></div>
            <div class="mini-date-row"><div v-for="date in miniDates" :key="date.day" :class="['mini-date', { active: date.active }]"><small>{{ date.week }}</small><b>{{ date.day }}</b></div></div>
            <div class="schedule-label"><b>Hoje</b><span>4 horários</span></div>
            <div v-for="slot in previewSlots" :key="slot.time" class="preview-slot">
              <div class="slot-time">{{ slot.time }}</div>
              <div class="slot-line" :class="slot.color" />
              <div><b>{{ slot.name }}</b><small>{{ slot.service }}</small></div>
              <q-icon name="more_horiz" color="grey-6" />
            </div>
          </div>
          <div class="phone-nav"><q-icon name="home" /><q-icon name="calendar_month" color="dark" /><span class="phone-fab"><q-icon name="add" /></span><q-icon name="chat_bubble_outline" /><q-icon name="person_outline" /></div>
        </div>
        <div class="floating-card floating-card--top"><span class="success-icon"><q-icon name="check" /></span><div><b>Novo agendamento</b><small>Lucas · Corte premium</small></div></div>
        <div class="floating-card floating-card--bottom"><q-icon name="smart_toy" color="dark" size="27px" /><div><b>Bot atendendo</b><small>Respostas em segundos</small></div><span class="online-dot" /></div>
      </div>
    </section>

    <section class="brand-strip"><div class="container"><span>FEITO PARA QUEM FAZ ACONTECER</span><div class="brand-types"><b>BARBEARIAS</b><i>•</i><b>SALÕES</b><i>•</i><b>ESTÚDIOS</b><i>•</i><b>PROFISSIONAIS</b></div></div></section>

    <section id="como-funciona" class="section-block container">
      <div class="section-heading"><span class="section-number">01</span><div><small>SIMPLES DE VERDADE</small><h2>Do primeiro clique<br>ao corte confirmado.</h2></div><p>Você configura uma vez. O CortsMe cuida do caminho entre descoberta, dúvida e agendamento.</p></div>
      <div class="steps-grid">
        <article v-for="(step, index) in steps" :key="step.title" class="step-card">
          <span>0{{ index + 1 }}</span><q-icon :name="step.icon" /><h3>{{ step.title }}</h3><p>{{ step.text }}</p><div class="step-line" />
        </article>
      </div>
    </section>

    <section id="recursos" class="dark-section">
      <div class="container feature-layout">
        <div class="feature-copy"><small>UM NEGÓCIO MAIS LEVE</small><h2>Tudo conversa.<br>Você só acompanha.</h2><p>Agenda, site e bot compartilham a mesma disponibilidade. Sem horário duplicado, sem cliente perdido, sem informação desencontrada.</p><q-btn to="/login" rounded outline color="lime-5" no-caps label="Conhecer o painel" icon-right="arrow_forward" /></div>
        <div class="feature-list">
          <div v-for="feature in features" :key="feature.title" class="feature-item"><span><q-icon :name="feature.icon" /></span><div><h4>{{ feature.title }}</h4><p>{{ feature.text }}</p></div><q-icon name="north_east" /></div>
        </div>
      </div>
    </section>

    <section id="planos" class="pricing-section">
      <div class="container">
        <div class="pricing-heading">
          <div>
            <span class="pricing-kicker">PLANOS TRANSPARENTES</span>
            <h2>Um investimento pequeno.<br>Uma agenda muito mais cheia.</h2>
          </div>
          <div class="pricing-heading__aside">
            <p>Escolha o ritmo do seu negócio. Os planos pagos são cobrados à vista e liberam <b>30 dias de acesso</b>, sem fidelidade.</p>
            <div class="pricing-trust"><q-icon name="verified_user" /><span>Pagamento seguro pela InfinitePay</span></div>
          </div>
        </div>

        <div class="pricing-grid" :class="`pricing-grid--${Math.min(publicPlans.length, 5)}`">
          <article v-for="(plan, index) in publicPlans" :key="plan.id || plan.code" :class="['pricing-card', { featured: plan.featured }]">
            <div v-if="plan.featured" class="popular-label"><q-icon name="auto_awesome" /> MAIS ESCOLHIDO</div>
            <div class="pricing-card__top">
              <span class="plan-index">{{ String(index + 1).padStart(2, '0') }}</span>
              <q-badge v-if="plan.free" rounded color="blue-grey-1" text-color="blue-grey-9" label="Para começar" />
            </div>
            <h3>{{ plan.name }}</h3>
            <p>{{ plan.description }}</p>
            <div class="public-plan-price">
              <template v-if="plan.price > 0">
                <span>R$</span><strong>{{ wholePrice(plan.price) }}</strong><sup>,{{ priceCents(plan.price) }}</sup>
              </template>
              <strong v-else class="free-price">Grátis</strong>
            </div>
            <span class="price-period">{{ plan.price > 0 ? 'pagamento mensal à vista · 30 dias' : 'site publicado sem cobrança' }}</span>
            <q-separator />
            <ul>
              <li v-for="benefit in plan.benefits.slice(0, 6)" :key="benefit"><q-icon name="check" /><span>{{ benefit }}</span></li>
            </ul>
            <q-btn
              rounded
              unelevated
              no-caps
              :color="plan.featured ? 'lime-5' : 'dark'"
              :text-color="plan.featured ? 'dark' : 'white'"
              :label="plan.free ? 'Criar minha conta' : `Escolher ${plan.name}`"
              icon-right="arrow_outward"
              @click="openProfessionalAccess(plan)"
            />
          </article>
        </div>

        <div class="pricing-footnote">
          <q-icon name="event_repeat" />
          <span>Sem cobrança automática: você renova somente quando quiser continuar. O acesso é atualizado assim que o pagamento for confirmado.</span>
        </div>
      </div>
    </section>

    <section id="para-quem" class="cta-section container">
      <div class="cta-card"><span class="cta-blur" /><small>PRONTO PARA VIRAR A CHAVE?</small><h2>Seu próximo cliente<br>já pode estar procurando.</h2><p>Dê a ele um caminho simples até a sua cadeira.</p><q-btn to="/login" size="lg" rounded unelevated color="lime-5" text-color="dark" no-caps label="Começar com CortsMe" icon-right="arrow_outward" /></div>
    </section>

    <q-dialog v-model="professionalDialog" persistent transition-show="scale" transition-hide="scale">
      <q-card class="professional-access-dialog">
        <header class="professional-dialog__header">
          <div class="professional-dialog__brand"><span>CM</span><div><small>ACESSO PROFISSIONAL</small><b>CortsMe para negócios</b></div></div>
          <q-btn flat round icon="close" :disable="professionalLoading" aria-label="Fechar" v-close-popup />
        </header>

        <section v-if="selectedPlan" class="selected-plan-strip" :class="{ paid: !selectedPlan.free }">
          <span class="selected-plan-strip__icon"><q-icon :name="selectedPlan.free ? 'language' : 'workspace_premium'" /></span>
          <div><small>PLANO SELECIONADO</small><b>{{ selectedPlan.name }}</b><span>{{ selectedPlan.free ? 'Site público gratuito' : `${formatCurrency(selectedPlan.price)} à vista · ${selectedPlan.durationDays || 30} dias` }}</span></div>
          <q-btn flat dense rounded no-caps label="Trocar" icon-right="south" v-close-popup @click="scrollToPlans" />
        </section>

        <q-card-section v-if="auth.isLogged && auth.user?.role === 'BARBER'" class="active-professional-session">
          <span class="active-session-icon"><q-icon name="verified_user" /></span>
          <div class="active-session-copy">
            <small>VOCÊ JÁ ESTÁ CONECTADO</small>
            <h2>Olá, {{ firstName(auth.user?.name) }}.</h2>
            <p>{{ selectedPlan?.free ? 'Seu painel profissional está pronto para continuar.' : 'Vamos abrir seu financeiro com o plano escolhido para você revisar antes de pagar.' }}</p>
            <div class="active-session-user"><q-avatar size="35px" color="lime-4" text-color="dark">{{ initials(auth.user?.name) }}</q-avatar><span><b>{{ auth.user?.name }}</b><small>{{ auth.user?.email || 'Perfil profissional' }}</small></span></div>
          </div>
          <q-btn class="full-width" rounded unelevated color="dark" no-caps :label="selectedPlan?.free ? 'Ir para meu painel' : 'Continuar para o financeiro'" icon-right="arrow_forward" @click="continueProfessional" />
          <q-btn flat rounded no-caps label="Entrar com outra conta profissional" @click="useAnotherAccount" />
        </q-card-section>

        <template v-else>
          <q-banner v-if="auth.isLogged && auth.user?.role !== 'BARBER'" rounded class="wrong-profile-banner">
            <template #avatar><q-icon name="business_center" /></template>
            <b>Esta é uma conta de cliente</b>
            <span>Para administrar um salão ou barbearia, entre com uma conta profissional ou crie seu perfil abaixo.</span>
          </q-banner>

          <q-tabs v-model="professionalTab" dense no-caps align="justify" active-color="dark" indicator-color="lime-7" class="professional-tabs">
            <q-tab name="login" icon="login" label="Entrar" />
            <q-tab name="register" icon="storefront" label="Criar conta" />
          </q-tabs>
          <q-separator />

          <q-tab-panels v-model="professionalTab" animated class="professional-panels">
            <q-tab-panel name="login">
              <div class="professional-form-heading"><span>JÁ É PARCEIRO?</span><h2>Entre no seu negócio.</h2><p>Use os mesmos dados do painel profissional.</p></div>
              <q-form class="professional-form" @submit="submitProfessionalLogin">
                <q-input v-model.trim="professionalLogin.identity" outlined rounded label="E-mail ou telefone" autocomplete="username"><template #prepend><q-icon name="alternate_email" /></template></q-input>
                <q-input v-model="professionalLogin.password" outlined rounded :type="showLoginPassword ? 'text' : 'password'" label="Senha" autocomplete="current-password"><template #prepend><q-icon name="lock_outline" /></template><template #append><q-icon :name="showLoginPassword ? 'visibility_off' : 'visibility'" class="cursor-pointer" @click="showLoginPassword = !showLoginPassword" /></template></q-input>
                <q-btn type="submit" class="full-width" rounded unelevated color="dark" size="lg" no-caps label="Entrar e continuar" icon-right="arrow_forward" :loading="professionalLoading" />
              </q-form>
              <p class="professional-help">Seu cadastro é de cliente? <button type="button" @click="professionalTab = 'register'">Crie um perfil profissional.</button></p>
            </q-tab-panel>

            <q-tab-panel name="register">
              <div class="professional-form-heading"><span>COMECE AGORA</span><h2>Crie seu espaço profissional.</h2><p>Você configura site, horários e equipe depois, direto no painel.</p></div>
              <q-form class="professional-form register-professional-form" @submit="submitProfessionalRegister">
                <div class="professional-field-grid">
                  <q-input v-model.trim="professionalRegister.name" outlined rounded label="Seu nome *" autocomplete="name"><template #prepend><q-icon name="person_outline" /></template></q-input>
                  <q-input v-model.trim="professionalRegister.businessName" outlined rounded label="Nome do negócio *" autocomplete="organization"><template #prepend><q-icon name="storefront" /></template></q-input>
                </div>
                <div class="professional-field-grid">
                  <q-input v-model.trim="professionalRegister.email" outlined rounded type="email" label="E-mail profissional *" autocomplete="email"><template #prepend><q-icon name="alternate_email" /></template></q-input>
                  <q-input v-model="professionalRegister.phone" outlined rounded label="Telefone *" mask="(##) #####-####" unmasked-value autocomplete="tel"><template #prepend><q-icon name="phone_iphone" /></template></q-input>
                </div>
                <q-input v-model="professionalRegister.password" outlined rounded :type="showRegisterPassword ? 'text' : 'password'" label="Crie uma senha *" autocomplete="new-password" hint="Use pelo menos 8 caracteres"><template #prepend><q-icon name="lock_outline" /></template><template #append><q-icon :name="showRegisterPassword ? 'visibility_off' : 'visibility'" class="cursor-pointer" @click="showRegisterPassword = !showRegisterPassword" /></template></q-input>
                <q-checkbox v-model="professionalRegister.accepted" color="positive"><span class="terms-copy">Li e aceito os <a href="#" @click.stop>Termos de Uso</a> e a <a href="#" @click.stop>Política de Privacidade</a>.</span></q-checkbox>
                <q-btn type="submit" class="full-width" rounded unelevated color="dark" size="lg" no-caps :label="selectedPlan?.free ? 'Criar conta gratuita' : 'Criar conta e escolher plano'" icon-right="arrow_forward" :loading="professionalLoading" />
              </q-form>
              <div class="professional-security"><q-icon name="lock" /><span>Seus dados são protegidos. O pagamento só acontece no checkout seguro da InfinitePay.</span></div>
            </q-tab-panel>
          </q-tab-panels>
        </template>
      </q-card>
    </q-dialog>

    <footer class="landing-footer"><div class="container row items-center justify-between"><BrandLogo light /><span>© 2026 CortsMe. Tecnologia que aproxima.</span><div><a href="#">Privacidade</a><a href="#">Termos</a></div></div></footer>
  </q-page>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
import BrandLogo from 'components/BrandLogo.vue'
import { useAuthStore } from 'stores/auth-store'

const router = useRouter()
const $q = useQuasar()
const auth = useAuthStore()
const professionalDialog = ref(false)
const professionalTab = ref('login')
const professionalLoading = ref(false)
const selectedPlan = ref(null)
const showLoginPassword = ref(false)
const showRegisterPassword = ref(false)
const professionalLogin = reactive({ identity: '', password: '' })
const professionalRegister = reactive({ name: '', businessName: '', email: '', phone: '', password: '', accepted: false })
const miniDates = [{ week: 'SEG', day: 12 }, { week: 'TER', day: 13 }, { week: 'QUA', day: 14, active: true }, { week: 'QUI', day: 15 }, { week: 'SEX', day: 16 }]
const previewSlots = [
  { time: '09:00', name: 'Lucas Ferreira', service: 'Corte premium · 45 min', color: 'green' },
  { time: '10:00', name: 'André Lima', service: 'Barba completa · 30 min', color: 'blue' },
  { time: '11:30', name: 'João Pedro', service: 'Combo corte + barba · 70 min', color: 'orange' }
]
const steps = [
  { icon: 'web', title: 'Monte seu site', text: 'Escolha cores, imagens e blocos. Publique seu endereço exclusivo sem depender de ninguém.' },
  { icon: 'smart_toy', title: 'Atenda no automático', text: 'Seu bot responde dúvidas com o contexto do seu negócio e direciona cada cliente.' },
  { icon: 'event_available', title: 'Receba agendamentos', text: 'O cliente escolhe entre horários realmente livres. A agenda atualiza na mesma hora.' }
]
const features = [
  { icon: 'calendar_month', title: 'Agenda sem conflitos', text: 'Horários, pausas, serviços e ajustes em uma visão clara.' },
  { icon: 'web_asset', title: 'Site com a sua cara', text: 'Um ponto de venda bonito, rápido e pronto para o mobile.' },
  { icon: 'forum', title: 'Assistente que converte', text: 'Respostas contextualizadas que levam naturalmente ao agendamento.' },
  { icon: 'notifications_active', title: 'Tudo em tempo real', text: 'Novos agendamentos e mudanças chegam ao painel imediatamente.' }
]

const fallbackPlans = [
  {
    id: 'free',
    code: 'GRATUITO',
    name: 'Gratuito',
    price: 0,
    free: true,
    description: 'Sua presença digital começa aqui, com um site bonito e sempre publicado.',
    benefits: ['Site público responsivo', 'Página própria da barbearia', 'Serviços e contatos visíveis', 'Painel básico do negócio'],
    order: 1
  },
  {
    id: 'essential',
    code: 'ESSENCIAL',
    name: 'Essencial',
    price: 49.9,
    description: 'Para quem quer transformar visitas em horários marcados todos os dias.',
    benefits: ['Tudo do plano Gratuito', 'Agendamento online liberado', 'Agenda e horários de funcionamento', 'Clientes e histórico de cortes', 'Notificações em tempo real'],
    order: 2
  },
  {
    id: 'professional',
    code: 'PROFISSIONAL',
    name: 'Profissional',
    price: 89.9,
    description: 'A experiência completa para atender, converter e crescer no automático.',
    benefits: ['Tudo do plano Essencial', 'Chatbot inteligente no site', 'Agendamento pelo bot', 'Editor completo de páginas', 'Logs e insights de atendimento', 'Suporte prioritário'],
    featured: true,
    order: 3
  }
]

const remotePlans = ref([])
const publicPlans = computed(() => {
  const source = remotePlans.value.length ? remotePlans.value : fallbackPlans
  const sorted = source.filter(plan => plan.active !== false).map(plan => ({ ...plan })).sort((a, b) => a.order - b.order).slice(0, 5)
  if (!sorted.some(plan => plan.featured) && sorted.length > 1) sorted[Math.min(2, sorted.length - 1)].featured = true
  return sorted
})

function firstDefined (...values) {
  return values.find(value => value !== undefined && value !== null)
}

function planPrice (plan) {
  const cents = firstDefined(plan.priceCents, plan.priceInCents, plan.amountCents, plan.amountInCents, plan.monthlyPriceInCents)
  if (cents !== undefined) return Number(cents) / 100
  const value = Number(firstDefined(plan.monthlyPrice, plan.price, plan.amount, 0)) || 0
  return value > 1000 ? value / 100 : value
}

function normalizePublicPlan (plan, index) {
  const price = planPrice(plan)
  const benefits = firstDefined(plan.benefits, plan.advantages, plan.perks, Array.isArray(plan.features) ? plan.features : [])
  return {
    id: String(firstDefined(plan._id, plan.id, plan.code, index)),
    code: String(firstDefined(plan.code, plan.slug, `PLANO_${index + 1}`)).toUpperCase(),
    name: firstDefined(plan.name, plan.title, 'Plano CortsMe'),
    price,
    free: Boolean(firstDefined(plan.free, plan.isFree, price === 0)),
    active: Boolean(firstDefined(plan.active, plan.enabled, true)),
    featured: Boolean(firstDefined(plan.featured, plan.highlighted, plan.recommended, false)),
    description: firstDefined(plan.description, plan.subtitle, 'Recursos pensados para simplificar a rotina do seu negócio.'),
    benefits: Array.isArray(benefits) && benefits.length ? benefits : benefitsFromFeatures(plan.entitlements || plan.resources || {}),
    order: Number(firstDefined(plan.order, plan.sortOrder, plan.displayOrder, index + 1))
  }
}

function benefitsFromFeatures (features) {
  const labels = {
    publicSite: 'Site público responsivo',
    publishedSite: 'Site público responsivo',
    onlineBooking: 'Agendamento online',
    botBooking: 'Agendamento pelo chatbot',
    chatbot: 'Chatbot e agendamento assistido',
    advancedBot: 'Bot e histórico de interações',
    realtimeNotifications: 'Notificações em tempo real',
    siteBuilder: 'Editor completo do site'
  }
  const enabled = Object.entries(features).filter(([, value]) => value).map(([key]) => labels[key]).filter(Boolean)
  return enabled.length ? enabled : ['Site público responsivo', 'Painel para gerenciar o negócio']
}

function wholePrice (value) {
  return Math.floor(Number(value || 0)).toLocaleString('pt-BR')
}

function priceCents (value) {
  return String(Math.round((Number(value || 0) % 1) * 100)).padStart(2, '0')
}

function formatCurrency (value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function firstName (name) {
  return String(name || 'profissional').trim().split(/\s+/)[0]
}

function initials (name) {
  return String(name || 'CM').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()
}

function openProfessionalAccess (plan) {
  selectedPlan.value = plan
  professionalTab.value = 'login'
  professionalDialog.value = true
}

function scrollToPlans () {
  window.setTimeout(() => document.querySelector('#planos')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 180)
}

function useAnotherAccount () {
  auth.logout()
  Object.assign(professionalLogin, { identity: '', password: '' })
  professionalTab.value = 'login'
}

function professionalError (error, fallback) {
  const fieldError = error?.response?.data?.errors?.[0]?.message
  return fieldError || error?.response?.data?.message || error?.response?.data?.error || fallback
}

async function continueProfessional () {
  if (auth.user?.role !== 'BARBER') {
    $q.notify({ type: 'warning', message: 'Entre com uma conta profissional para continuar.' })
    professionalTab.value = 'login'
    return
  }
  const plan = selectedPlan.value
  if (!plan) return
  professionalDialog.value = false
  if (plan.free || Number(plan.price) === 0) {
    await router.push('/barber')
    return
  }
  await router.push({
    path: '/barber/financeiro',
    query: {
      planId: plan.id || plan.code,
      plan: plan.code,
      autoCheckout: '1'
    }
  })
}

async function submitProfessionalLogin () {
  if (!professionalLogin.identity || !professionalLogin.password) {
    $q.notify({ type: 'warning', message: 'Informe seu e-mail ou telefone e a senha.' })
    return
  }
  professionalLoading.value = true
  try {
    await auth.login({ identity: professionalLogin.identity, email: professionalLogin.identity, password: professionalLogin.password })
    if (auth.user?.role !== 'BARBER') {
      $q.notify({ type: 'warning', message: 'Esta conta é de cliente. Use uma conta profissional ou crie seu negócio.' })
      return
    }
    $q.notify({ type: 'positive', message: `Bem-vindo, ${firstName(auth.user.name)}.` })
    await continueProfessional()
  } catch (error) {
    $q.notify({ type: 'negative', message: professionalError(error, 'Não foi possível entrar na conta profissional.') })
  } finally {
    professionalLoading.value = false
  }
}

function validateProfessionalRegister () {
  if (!professionalRegister.name || !professionalRegister.businessName || !professionalRegister.email || !professionalRegister.phone || !professionalRegister.password) return 'Preencha todos os campos obrigatórios.'
  if (!/^\S+@\S+\.\S+$/.test(professionalRegister.email)) return 'Informe um e-mail profissional válido.'
  if (String(professionalRegister.phone).replace(/\D/g, '').length < 10) return 'Informe um telefone válido com DDD.'
  if (professionalRegister.password.length < 8) return 'Crie uma senha com pelo menos 8 caracteres.'
  if (!professionalRegister.accepted) return 'Aceite os Termos de Uso e a Política de Privacidade.'
  return ''
}

async function submitProfessionalRegister () {
  const validation = validateProfessionalRegister()
  if (validation) {
    $q.notify({ type: 'warning', message: validation })
    return
  }
  professionalLoading.value = true
  try {
    const plan = selectedPlan.value
    const { data } = await api.post('/auth/register-professional', {
      name: professionalRegister.name.trim(),
      businessName: professionalRegister.businessName.trim(),
      email: professionalRegister.email.trim().toLowerCase(),
      phone: String(professionalRegister.phone).replace(/\D/g, ''),
      password: professionalRegister.password,
      planId: plan?.id || undefined,
      planCode: plan?.code || undefined
    })
    const session = data?.session || data?.data || data
    if (!session?.token || !session?.user) throw new Error('A conta foi criada, mas a sessão não foi retornada.')
    auth.setSession(session)
    if (auth.user?.role !== 'BARBER') throw new Error('O cadastro não retornou um perfil profissional válido.')
    $q.notify({ type: 'positive', message: 'Seu espaço profissional foi criado.' })
    await continueProfessional()
  } catch (error) {
    $q.notify({ type: 'negative', message: professionalError(error, 'Não foi possível criar o perfil profissional.') })
  } finally {
    professionalLoading.value = false
  }
}

async function loadPublicPlans () {
  try {
    const { data } = await api.get('/billing/plans')
    const list = Array.isArray(data) ? data : (data?.plans || data?.data?.plans || data?.data || [])
    if (Array.isArray(list) && list.length) remotePlans.value = list.map(normalizePublicPlan)
  } catch {
    remotePlans.value = []
  }
}

onMounted(loadPublicPlans)
</script>

<style scoped>
.pricing-section { padding: 122px 0 105px; background: #eef0e9; }
.pricing-heading { display: grid; grid-template-columns: 1.25fr .75fr; gap: 70px; align-items: end; }
.pricing-kicker { color: #747c77; font-size: 10px; font-weight: 800; letter-spacing: 2px; }
.pricing-heading h2 { margin: 15px 0 0; max-width: 800px; font-size: clamp(42px, 5vw, 64px); line-height: .98; letter-spacing: -3.6px; }
.pricing-heading__aside p { margin: 0 0 20px; color: #626a65; font-size: 14px; line-height: 1.75; }
.pricing-trust { display: inline-flex; align-items: center; gap: 8px; color: #4e6045; font-size: 10px; font-weight: 700; }.pricing-trust .q-icon { color: #72983d; font-size: 19px; }
.pricing-grid { margin-top: 58px; display: grid; gap: 14px; align-items: stretch; }.pricing-grid--1 { grid-template-columns: minmax(280px, 430px); justify-content: center; }.pricing-grid--2 { grid-template-columns: repeat(2, 1fr); }.pricing-grid--3 { grid-template-columns: repeat(3, 1fr); }.pricing-grid--4 { grid-template-columns: repeat(4, 1fr); }.pricing-grid--5 { grid-template-columns: repeat(5, 1fr); }
.pricing-card { position: relative; min-width: 0; padding: 28px; display: flex; flex-direction: column; background: #fff; border: 1px solid #dde1d8; border-radius: 23px; box-shadow: 0 15px 35px rgba(31, 41, 34, .035); transition: transform .2s ease, box-shadow .2s ease; }.pricing-card:hover { transform: translateY(-5px); box-shadow: 0 24px 48px rgba(31, 41, 34, .09); }.pricing-card.featured { background: #181d1a; color: #fff; border-color: #181d1a; box-shadow: 0 22px 48px rgba(23, 29, 25, .2); }
.popular-label { position: absolute; left: 26px; top: -14px; height: 28px; padding: 0 12px; display: flex; align-items: center; gap: 5px; border-radius: 14px; background: #c8f45d; color: #171b19; font-size: 8px; font-weight: 900; letter-spacing: 1px; }.pricing-card__top { min-height: 27px; display: flex; justify-content: space-between; align-items: center; }.plan-index { color: #969d98; font-size: 9px; font-weight: 800; letter-spacing: 1px; }
.pricing-card h3 { margin: 26px 0 9px; font-size: 24px; letter-spacing: -.8px; }.pricing-card > p { min-height: 61px; margin: 0; color: #747c77; font-size: 12px; line-height: 1.6; }.pricing-card.featured > p { color: #aeb5b1; }
.public-plan-price { min-height: 60px; margin-top: 25px; display: flex; align-items: flex-start; }.public-plan-price > span { margin: 9px 4px 0 0; font-size: 11px; font-weight: 800; }.public-plan-price strong { font-size: 47px; line-height: 1; letter-spacing: -2.4px; }.public-plan-price sup { margin: 5px 0 0 3px; font-size: 14px; font-weight: 800; }.public-plan-price .free-price { font-size: 38px; }
.price-period { min-height: 29px; display: block; color: #858d87; font-size: 8px; font-weight: 700; letter-spacing: .3px; text-transform: uppercase; }.pricing-card.featured .price-period { color: #909893; }.pricing-card .q-separator { margin: 16px 0 19px; background: #e4e7e0; }.pricing-card.featured .q-separator { background: #373d39; }
.pricing-card ul { min-height: 170px; margin: 0 0 23px; padding: 0; display: grid; align-content: start; gap: 12px; list-style: none; }.pricing-card li { display: grid; grid-template-columns: 19px 1fr; gap: 8px; align-items: start; color: #626a65; font-size: 10px; line-height: 1.45; }.pricing-card.featured li { color: #c1c7c3; }.pricing-card li .q-icon { width: 18px; height: 18px; display: grid; place-items: center; border-radius: 50%; background: #eef6e1; color: #65883c; font-size: 12px; }.pricing-card.featured li .q-icon { background: #334029; color: #c8f45d; }.pricing-card > .q-btn { width: 100%; min-height: 48px; margin-top: auto; }
.pricing-footnote { margin-top: 27px; display: flex; align-items: center; justify-content: center; gap: 9px; color: #717974; font-size: 10px; text-align: center; }.pricing-footnote .q-icon { color: #6f923e; font-size: 19px; }
.professional-access-dialog { width: min(690px, calc(100vw - 26px)); max-width: 690px; max-height: min(92vh, 820px); border-radius: 25px; overflow: hidden; background: #fbfcf9; }
.professional-dialog__header { min-height: 72px; padding: 13px 18px 13px 23px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e5e8e1; background: #fff; }.professional-dialog__brand { display: flex; align-items: center; gap: 11px; }.professional-dialog__brand > span { width: 37px; height: 37px; display: grid; place-items: center; border-radius: 11px; background: #181d1a; color: #c8f45d; font-size: 11px; font-weight: 900; transform: rotate(-3deg); }.professional-dialog__brand small,.professional-dialog__brand b { display: block; }.professional-dialog__brand small { color: #89908b; font-size: 7px; font-weight: 800; letter-spacing: 1.4px; }.professional-dialog__brand b { margin-top: 2px; font-size: 13px; }
.selected-plan-strip { min-height: 82px; padding: 14px 21px; display: grid; grid-template-columns: 43px 1fr auto; align-items: center; gap: 12px; background: #f0f5e8; border-bottom: 1px solid #dde5d4; }.selected-plan-strip.paid { background: #e9f8c9; border-color: #d6e9ad; }.selected-plan-strip__icon { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 13px; background: #fff; color: #607d32; font-size: 21px; box-shadow: 0 6px 14px rgba(44, 62, 35, .07); }.selected-plan-strip small,.selected-plan-strip b,.selected-plan-strip div > span { display: block; }.selected-plan-strip small { color: #76816c; font-size: 7px; font-weight: 900; letter-spacing: 1.3px; }.selected-plan-strip b { margin: 2px 0; font-size: 15px; }.selected-plan-strip div > span { color: #6c7664; font-size: 9px; }.selected-plan-strip .q-btn { font-size: 9px; }
.professional-tabs { min-height: 57px; padding: 0 18px; background: #fff; }.professional-tabs :deep(.q-tab__label) { font-size: 11px; font-weight: 750; }.professional-tabs :deep(.q-tab__icon) { font-size: 18px; }
.professional-panels { background: #fbfcf9; }.professional-panels :deep(.q-tab-panel) { max-height: min(64vh, 590px); padding: 24px 29px 27px; overflow-y: auto; }.professional-form-heading > span { color: #78806f; font-size: 8px; font-weight: 900; letter-spacing: 1.5px; }.professional-form-heading h2 { margin: 5px 0 4px; font-size: 26px; line-height: 1.1; letter-spacing: -1.1px; }.professional-form-heading p { margin: 0; color: #78807b; font-size: 11px; }
.professional-form { margin-top: 20px; display: grid; gap: 13px; }.professional-form :deep(.q-field__control) { min-height: 52px; }.professional-form > .q-btn { min-height: 51px; margin-top: 2px; }.professional-field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }.terms-copy { color: #737b76; font-size: 9px; }.terms-copy a { color: #303833; font-weight: 800; border-bottom: 1px solid #afb5b0; }
.professional-help { margin: 19px 0 0; color: #858c87; font-size: 10px; text-align: center; }.professional-help button { padding: 0; border: 0; border-bottom: 1px solid #9da49f; background: transparent; color: #303632; font-size: inherit; font-weight: 800; cursor: pointer; }.professional-security { margin-top: 15px; padding: 10px 12px; display: flex; align-items: center; justify-content: center; gap: 7px; border-radius: 10px; background: #f1f4ec; color: #778071; font-size: 8px; }.professional-security .q-icon { color: #5e7f3c; font-size: 15px; }
.wrong-profile-banner { margin: 17px 22px 0; background: #fff3df; border: 1px solid #efdcb9; color: #755523; font-size: 10px; }.wrong-profile-banner b,.wrong-profile-banner span { display: block; }.wrong-profile-banner span { margin-top: 3px; color: #8b6c3b; }.wrong-profile-banner .q-icon { font-size: 23px; }
.active-professional-session { padding: 31px 31px 27px; display: grid; justify-items: center; text-align: center; }.active-session-icon { width: 62px; height: 62px; display: grid; place-items: center; border-radius: 20px; background: #edf7dc; color: #5d8432; font-size: 31px; }.active-session-copy > small { display: block; margin-top: 17px; color: #7d8677; font-size: 8px; font-weight: 900; letter-spacing: 1.5px; }.active-session-copy h2 { margin: 5px 0; font-size: 27px; letter-spacing: -1px; }.active-session-copy > p { max-width: 480px; margin: 0 auto; color: #747c77; font-size: 11px; line-height: 1.6; }.active-session-user { width: min(340px, 100%); margin: 19px auto 22px; padding: 10px 13px; display: flex; align-items: center; gap: 10px; border: 1px solid #e2e5de; border-radius: 13px; background: #fff; text-align: left; }.active-session-user b,.active-session-user small { display: block; }.active-session-user b { font-size: 11px; }.active-session-user small { margin-top: 2px; color: #898f8b; font-size: 8px; }.active-professional-session > .q-btn { min-height: 48px; }.active-professional-session > .q-btn:last-child { min-height: 36px; margin-top: 7px; color: #747b76; font-size: 9px; }
@media (max-width: 1180px) { .pricing-grid--4,.pricing-grid--5 { grid-template-columns: repeat(2, 1fr); }.pricing-card ul { min-height: 0; } }
@media (max-width: 820px) { .pricing-section { padding: 85px 0 75px; }.pricing-heading { grid-template-columns: 1fr; gap: 27px; }.pricing-heading h2 { letter-spacing: -2.5px; }.pricing-grid,.pricing-grid--1,.pricing-grid--2,.pricing-grid--3,.pricing-grid--4,.pricing-grid--5 { grid-template-columns: 1fr; margin-top: 43px; }.pricing-card { padding: 26px 23px; }.pricing-card > p { min-height: 0; }.pricing-card ul { min-height: 0; }.pricing-footnote { align-items: flex-start; text-align: left; } }
@media (max-width: 620px) { .professional-access-dialog { width: calc(100vw - 16px); max-height: 95vh; border-radius: 20px; }.professional-dialog__header { min-height: 65px; padding: 10px 10px 10px 16px; }.selected-plan-strip { min-height: 75px; padding: 12px 15px; grid-template-columns: 39px 1fr; }.selected-plan-strip__icon { width: 38px; height: 38px; }.selected-plan-strip .q-btn { display: none; }.professional-tabs { padding: 0 6px; }.professional-panels :deep(.q-tab-panel) { max-height: 65vh; padding: 21px 17px 24px; }.professional-field-grid { grid-template-columns: 1fr; gap: 13px; }.professional-form-heading h2 { font-size: 23px; }.wrong-profile-banner { margin: 12px 13px 0; }.active-professional-session { padding: 25px 18px 22px; } }
</style>
