<template>
  <q-page class="auth-page">
    <aside class="auth-showcase gt-sm">
      <div class="showcase-grid" />
      <div class="showcase-orbit orbit-one" />
      <div class="showcase-orbit orbit-two" />

      <div class="showcase-copy">
        <span class="showcase-kicker"><i /> CORTSME PARA CADA MOMENTO</span>
        <h1>{{ showcaseTitle }}</h1>
        <p>{{ showcaseDescription }}</p>
      </div>

      <div class="showcase-preview">
        <div class="preview-head">
          <span class="preview-icon"><q-icon :name="isProfessional ? 'content_cut' : 'event_available'" /></span>
          <div><small>{{ isProfessional ? 'SEU NEGÓCIO' : 'SUA ROTINA' }}</small><b>{{ isProfessional ? 'Mais leve. Mais profissional.' : 'Seu horário, sem complicação.' }}</b></div>
          <q-icon name="north_east" />
        </div>
        <div class="preview-lines"><span /><span /><span /></div>
        <div class="preview-proof"><q-icon name="verified_user" /><span>{{ isProfessional ? 'Agenda, site e bot no mesmo lugar' : 'Reserva segura e acompanhamento fácil' }}</span></div>
      </div>

      <footer class="showcase-footer">
        <div class="avatar-stack">
          <q-avatar size="30px" color="lime-3" text-color="dark">RM</q-avatar>
          <q-avatar size="30px" color="blue-grey-2" text-color="dark">LA</q-avatar>
          <q-avatar size="30px" color="orange-2" text-color="dark">BC</q-avatar>
        </div>
        <span>Uma experiência feita para quem atende<br>e para quem quer ser bem atendido.</span>
      </footer>
    </aside>

    <main class="auth-panel">
      <section class="auth-shell">
        <header class="auth-heading">
          <div>
            <span class="auth-overline">{{ registerMode ? 'COMECE AGORA' : 'BEM-VINDO DE VOLTA' }}</span>
            <h2>{{ pageTitle }}</h2>
            <p>{{ pageDescription }}</p>
          </div>
          <q-chip v-if="selectedPlan" dense color="lime-2" text-color="dark" icon="sell">Plano {{ selectedPlan }}</q-chip>
        </header>

        <div class="audience-selector" role="tablist" aria-label="Tipo de acesso">
          <button
            v-for="option in audienceOptions"
            :key="option.value"
            type="button"
            role="tab"
            :aria-selected="audience === option.value"
            :class="{ active: audience === option.value }"
            @click="selectAudience(option.value)"
          >
            <span class="audience-icon"><q-icon :name="option.icon" /></span>
            <span><b>{{ option.label }}</b><small>{{ option.hint }}</small></span>
            <q-icon class="audience-check" :name="audience === option.value ? 'check_circle' : 'radio_button_unchecked'" />
          </button>
        </div>

        <q-banner v-if="isProfessional && registerMode" rounded class="professional-note">
          <template #avatar><q-icon name="storefront" /></template>
          Seu perfil profissional já nasce com site, agenda e plano gratuito. Você poderá escolher um pacote no painel financeiro.
        </q-banner>

        <div v-if="registerMode && !isProfessional" class="avatar-picker">
          <q-avatar size="64px" color="grey-3" text-color="dark">
            <img v-if="avatarPreview" :src="avatarPreview" alt="Prévia da foto de perfil">
            <q-icon v-else name="person" />
          </q-avatar>
          <div class="avatar-copy"><b>Sua foto</b><span>Ajuda o profissional a reconhecer você.</span><small>JPG, PNG ou WebP · até 4 MB</small></div>
          <q-btn outline rounded no-caps icon="photo_camera" :label="avatarFile ? 'Trocar' : 'Adicionar'" class="avatar-upload">
            <q-file
              class="absolute-full transparent-file"
              borderless
              accept="image/jpeg,image/png,image/webp"
              :max-file-size="4194304"
              @update:model-value="prepareAvatar"
              @rejected="avatarRejected"
            />
          </q-btn>
        </div>

        <q-form class="auth-fields" @submit="submit">
          <div v-if="registerMode" :class="['register-grid', { 'register-grid--two': isProfessional }]">
            <q-input v-model.trim="form.name" outlined rounded label="Nome completo" autocomplete="name" :rules="[required('Informe seu nome.')]" lazy-rules>
              <template #prepend><q-icon name="person_outline" /></template>
            </q-input>
            <q-input
              v-if="isProfessional"
              v-model.trim="form.businessName"
              outlined rounded
              label="Nome do salão ou barbearia"
              autocomplete="organization"
              :rules="[required('Informe o nome do negócio.')]"
              lazy-rules
            >
              <template #prepend><q-icon name="storefront" /></template>
            </q-input>
          </div>

          <q-input
            v-model.trim="form.identity"
            outlined rounded
            :label="registerMode ? 'E-mail' : 'E-mail ou telefone'"
            :autocomplete="registerMode ? 'email' : 'username'"
            :type="registerMode ? 'email' : 'text'"
            :rules="registerMode ? [required('Informe seu e-mail.'), emailRule] : [required('Informe seu e-mail ou telefone.')]"
            lazy-rules
          >
            <template #prepend><q-icon name="alternate_email" /></template>
          </q-input>

          <div v-if="registerMode" :class="['register-grid', { 'register-grid--two': isProfessional }]">
            <q-input
              v-model="form.phone"
              outlined rounded
              label="Telefone"
              mask="(##) #####-####"
              unmasked-value
              autocomplete="tel"
              :rules="isProfessional ? [required('Informe o telefone profissional.'), phoneRule] : [optionalPhoneRule]"
              lazy-rules
            >
              <template #prepend><q-icon name="phone_iphone" /></template>
            </q-input>
            <q-input
              v-if="isProfessional"
              v-model.trim="form.slug"
              outlined rounded
              label="URL personalizada (opcional)"
              prefix="corts.me/"
              maxlength="60"
              hint="Você poderá alterar depois"
              :rules="[slugRule]"
              lazy-rules
              @update:model-value="normalizeSlug"
            >
              <template #prepend><q-icon name="link" /></template>
            </q-input>
          </div>

          <q-input
            v-model="form.password"
            outlined rounded
            label="Senha"
            :type="showPassword ? 'text' : 'password'"
            :autocomplete="registerMode ? 'new-password' : 'current-password'"
            :rules="registerMode ? [required('Crie uma senha.'), passwordRule] : [required('Informe sua senha.')]"
            lazy-rules
          >
            <template #prepend><q-icon name="lock_outline" /></template>
            <template #append><q-icon :name="showPassword ? 'visibility_off' : 'visibility'" class="cursor-pointer" @click="showPassword = !showPassword" /></template>
          </q-input>

          <div v-if="!registerMode" class="login-meta">
            <q-checkbox v-model="remember" dense label="Manter conectado por 90 dias" />
            <span><q-icon name="shield" /> Sessão protegida</span>
          </div>

          <q-btn
            type="submit"
            rounded unelevated
            color="dark"
            size="lg"
            class="full-width submit-button"
            no-caps
            :loading="loading"
            :label="submitLabel"
            icon-right="arrow_forward"
          />
        </q-form>

        <template v-if="googleEligible">
          <div class="auth-divider"><span>ou continue com</span></div>
          <div v-if="googleConfigured" ref="googleButton" class="google-signin" />
          <q-btn
            v-else rounded outline color="grey-5" text-color="dark"
            class="full-width google-button" no-caps
            label="Continuar com Google"
            icon="img:https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            @click="googleUnavailable"
          />
        </template>
        <div v-else class="professional-google-hint"><q-icon name="info_outline" /> O cadastro profissional é concluído pelo formulário acima.</div>

        <p class="switch-auth">
          {{ registerMode ? 'Já possui uma conta?' : 'Primeira vez no CortsMe?' }}
          <router-link :to="alternateRoute">{{ registerMode ? 'Fazer login' : 'Criar minha conta' }}</router-link>
        </p>
        <p class="auth-terms">Ao continuar, você concorda com os termos de uso e a política de privacidade do CortsMe.</p>
      </section>
    </main>
  </q-page>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
import { useAuthStore } from 'stores/auth-store'

const route = useRoute()
const router = useRouter()
const $q = useQuasar()
const auth = useAuthStore()

const audienceOptions = [
  { value: 'client', label: 'Sou cliente', hint: 'Quero agendar', icon: 'person_outline' },
  { value: 'professional', label: 'Sou profissional', hint: 'Tenho salão ou barbearia', icon: 'content_cut' }
]
const audience = ref(route.query.perfil === 'profissional' || route.query.plano ? 'professional' : 'client')
const form = reactive({ name: '', businessName: '', identity: '', phone: '', password: '', slug: '' })
const loading = ref(false)
const showPassword = ref(false)
const remember = ref(true)
const avatarFile = ref(null)
const avatarPreview = ref('')
const googleButton = ref(null)
const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID)

const registerMode = computed(() => route.path === '/cadastro')
const isProfessional = computed(() => audience.value === 'professional')
const selectedPlan = computed(() => String(route.query.plano || '').trim())
const googleEligible = computed(() => !registerMode.value || !isProfessional.value)
const pageTitle = computed(() => registerMode.value
  ? (isProfessional.value ? 'Coloque seu negócio no mapa.' : 'Seu próximo horário começa aqui.')
  : (isProfessional.value ? 'Acesse seu painel profissional.' : 'Entre para cuidar dos seus horários.'))
const pageDescription = computed(() => registerMode.value
  ? (isProfessional.value ? 'Crie seu espaço, publique seu site e comece pelo plano gratuito.' : 'Crie sua conta de cliente em menos de um minuto.')
  : (isProfessional.value ? 'Gerencie agenda, clientes, site e pagamentos em um só lugar.' : 'Use seu e-mail ou telefone para continuar.'))
const showcaseTitle = computed(() => isProfessional.value ? 'Seu talento merece uma operação à altura.' : 'Mais tempo vivendo. Menos tempo combinando horário.')
const showcaseDescription = computed(() => isProfessional.value
  ? 'O CortsMe transforma atendimento, presença digital e agenda em uma experiência única para o seu negócio.'
  : 'Encontre o serviço certo, escolha um horário livre e acompanhe tudo de forma simples e segura.')
const submitLabel = computed(() => registerMode.value
  ? (isProfessional.value ? 'Criar meu espaço profissional' : 'Criar minha conta')
  : (isProfessional.value ? 'Entrar no painel profissional' : 'Entrar como cliente'))
const alternateRoute = computed(() => ({
  path: registerMode.value ? '/login' : '/cadastro',
  query: {
    ...(route.query.redirect ? { redirect: route.query.redirect } : {}),
    ...(selectedPlan.value ? { plano: selectedPlan.value } : {}),
    perfil: isProfessional.value ? 'profissional' : 'cliente'
  }
}))

function required (message) { return value => Boolean(String(value || '').trim()) || message }
function emailRule (value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim()) || 'Digite um e-mail válido.' }
function phoneRule (value) { return String(value || '').replace(/\D/g, '').length >= 10 || 'Digite um telefone com DDD.' }
function optionalPhoneRule (value) { return !value || phoneRule(value) }
function passwordRule (value) { return String(value || '').length >= 8 || 'Use pelo menos 8 caracteres.' }
function slugRule (value) { return !value || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || 'Use letras minúsculas, números e hífens.' }

function selectAudience (value) {
  audience.value = value
  if (value === 'professional') clearAvatarPreview()
  router.replace({ query: { ...route.query, perfil: value === 'professional' ? 'profissional' : 'cliente' } })
}

function normalizeSlug (value) {
  form.slug = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
}

function clearAvatarPreview () {
  if (avatarPreview.value) URL.revokeObjectURL(avatarPreview.value)
  avatarPreview.value = ''
  avatarFile.value = null
}

function resetForm () {
  Object.assign(form, { name: '', businessName: '', identity: '', phone: '', password: '', slug: '' })
  showPassword.value = false
  clearAvatarPreview()
}

function prepareAvatar (file) {
  if (!file) return
  if (avatarPreview.value) URL.revokeObjectURL(avatarPreview.value)
  avatarFile.value = file
  avatarPreview.value = URL.createObjectURL(file)
}

function avatarRejected () { $q.notify({ type: 'negative', message: 'Use uma imagem JPG, PNG ou WebP de até 4 MB.' }) }
function roleLabel (role) { return { USER: 'cliente', BARBER: 'profissional', ADMIN: 'administrador' }[role] || 'usuário' }

function orientRole (user) {
  const expectedRole = isProfessional.value ? 'BARBER' : 'USER'
  if (!user || user.role === expectedRole || user.role === 'ADMIN') return
  $q.notify({ color: 'blue-grey-9', icon: 'swap_horiz', timeout: 5000, message: `Esta conta possui perfil de ${roleLabel(user.role)}. Levamos você ao espaço correto.` })
}

function safeDestination (role) {
  const fallback = { ADMIN: '/adm', BARBER: '/barber', USER: '/user' }[role] || '/'
  const requested = route.query.redirect
  if (typeof requested !== 'string' || !requested.startsWith('/') || requested.startsWith('//') || requested.includes('\\')) return fallback
  if (['/login', '/cadastro'].includes(requested.split('?')[0])) return fallback
  try {
    const resolved = router.resolve(requested)
    const protectedRoles = resolved.matched.flatMap(record => record.meta?.roles || [])
    if (protectedRoles.length && !protectedRoles.includes(role)) return fallback
    return resolved.fullPath
  } catch { return fallback }
}

function destinationAfterAuth (role) {
  if (role !== 'BARBER' || !selectedPlan.value) return safeDestination(role)
  const plan = selectedPlan.value.toUpperCase()
  if (['FREE', 'GRATUITO', 'GRÁTIS'].includes(plan)) return '/barber'
  return { path: '/barber/financeiro', query: { plan, autoCheckout: '1' } }
}

async function uploadCustomerAvatar () {
  if (!avatarFile.value) return
  try {
    const upload = new FormData()
    upload.append('image', avatarFile.value)
    const { data } = await api.post('/auth/avatar', upload)
    auth.updateUser(data.user)
  } catch {
    $q.notify({ type: 'warning', message: 'Conta criada. Você pode adicionar sua foto depois em Meu perfil.' })
  }
}

async function submit () {
  loading.value = true
  try {
    let result
    if (registerMode.value) {
      if (isProfessional.value) {
        result = await auth.registerProfessional({
          name: form.name, businessName: form.businessName, email: form.identity,
          phone: form.phone, password: form.password,
          ...(form.slug ? { slug: form.slug } : {}),
          ...(selectedPlan.value ? { planCode: selectedPlan.value } : {})
        })
      } else {
        result = await auth.register({ name: form.name, email: form.identity, phone: form.phone, password: form.password })
        await uploadCustomerAvatar()
      }
    } else {
      result = await auth.login({ identity: form.identity, password: form.password })
      orientRole(result.user)
    }
    await router.push(destinationAfterAuth(auth.user?.role))
  } catch (error) {
    $q.notify({ type: 'negative', message: error.response?.data?.message || 'Não foi possível continuar.' })
  } finally {
    loading.value = false
  }
}

function googleUnavailable () { $q.notify({ message: 'O login Google está temporariamente indisponível.', color: 'dark', icon: 'info' }) }

async function handleGoogle (response) {
  try {
    const { data } = await api.post('/auth/google', { credential: response.credential, accountType: isProfessional.value ? 'professional' : 'client' })
    auth.setSession(data)
    orientRole(data.user)
    await router.push(destinationAfterAuth(data.user?.role))
  } catch (error) {
    $q.notify({ type: 'negative', message: error.response?.data?.message || 'Login Google indisponível.' })
  }
}

function renderGoogleButton () {
  if (!googleConfigured || !googleEligible.value || !window.google || !googleButton.value) return
  googleButton.value.innerHTML = ''
  window.google.accounts.id.initialize({ client_id: process.env.GOOGLE_CLIENT_ID, callback: handleGoogle })
  window.google.accounts.id.renderButton(googleButton.value, {
    theme: 'outline', size: 'large', shape: 'pill', width: Math.min(480, window.innerWidth - 48),
    text: registerMode.value ? 'signup_with' : 'signin_with', locale: 'pt-BR'
  })
}

function loadGoogle () {
  if (!googleConfigured) return
  if (window.google) return renderGoogleButton()
  const existing = document.querySelector('script[data-cortsme-google]')
  if (existing) { existing.addEventListener('load', renderGoogleButton, { once: true }); return }
  const script = document.createElement('script')
  script.src = 'https://accounts.google.com/gsi/client'
  script.async = true
  script.dataset.cortsmeGoogle = 'true'
  script.addEventListener('load', renderGoogleButton, { once: true })
  document.head.appendChild(script)
}

watch(registerMode, () => { resetForm(); nextTick(renderGoogleButton) })
watch(googleEligible, () => nextTick(renderGoogleButton))
onMounted(loadGoogle)
onBeforeUnmount(clearAvatarPreview)
</script>

<style scoped>
.auth-page{min-height:calc(100vh - 76px);display:grid;grid-template-columns:minmax(430px,.92fr) minmax(560px,1.08fr);background:#f7f8f4;color:#171b19}.auth-showcase{position:sticky;top:76px;height:calc(100vh - 76px);min-height:690px;padding:clamp(54px,7vh,86px) clamp(45px,6vw,94px);overflow:hidden;background:#151a17;color:#fff}.showcase-grid{position:absolute;inset:0;opacity:.13;background-image:linear-gradient(rgba(255,255,255,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.12) 1px,transparent 1px);background-size:52px 52px;mask-image:linear-gradient(to bottom,black,transparent 78%)}.showcase-orbit{position:absolute;border:1px solid rgba(200,244,93,.19);border-radius:50%}.orbit-one{width:590px;height:590px;right:-320px;bottom:-210px}.orbit-two{width:420px;height:420px;right:-235px;bottom:-125px;background:rgba(200,244,93,.9);box-shadow:0 0 100px rgba(200,244,93,.12)}.showcase-copy,.showcase-preview,.showcase-footer{position:relative;z-index:1}.showcase-kicker{display:inline-flex;align-items:center;gap:10px;color:#adb5b0;font-size:9px;font-weight:800;letter-spacing:1.8px}.showcase-kicker i{width:7px;height:7px;border-radius:50%;background:#c8f45d;box-shadow:0 0 0 5px rgba(200,244,93,.12)}.showcase-copy h1{max-width:650px;margin:26px 0 22px;font-size:clamp(48px,5vw,76px);font-weight:770;line-height:.98;letter-spacing:-4.5px}.showcase-copy p{max-width:540px;margin:0;color:#aab2ad;font-size:16px;line-height:1.75}.showcase-preview{width:min(440px,90%);margin-top:clamp(44px,7vh,78px);padding:19px;border:1px solid #343b37;border-radius:20px;background:rgba(39,45,42,.88);box-shadow:0 25px 55px rgba(0,0,0,.22);backdrop-filter:blur(14px)}.preview-head{display:grid;grid-template-columns:48px 1fr auto;align-items:center;gap:13px}.preview-icon{width:46px;height:46px;display:grid;place-items:center;border-radius:14px;background:#c8f45d;color:#171b19;font-size:22px}.preview-head small,.preview-head b{display:block}.preview-head small{color:#7f8983;font-size:7px;letter-spacing:1.4px}.preview-head b{margin-top:4px;font-size:12px}.preview-head>.q-icon{color:#69726d}.preview-lines{display:flex;gap:6px;margin:20px 0 14px}.preview-lines span{height:5px;flex:1;border-radius:8px;background:#46504a}.preview-lines span:first-child{background:#c8f45d}.preview-proof{display:flex;align-items:center;gap:7px;color:#aeb6b1;font-size:9px}.preview-proof .q-icon{color:#91bd4a}.showcase-footer{position:absolute;left:clamp(45px,6vw,94px);bottom:45px;display:flex;align-items:center;gap:15px}.showcase-footer .avatar-stack{display:flex;padding-left:7px}.showcase-footer .q-avatar{margin-left:-7px;border:2px solid #151a17;font-size:8px;font-weight:800}.showcase-footer>span{color:#858f89;font-size:9px;line-height:1.6}.auth-panel{min-width:0;display:flex;align-items:flex-start;justify-content:center;padding:clamp(34px,6vh,72px) clamp(24px,6vw,90px) 70px;overflow-y:auto}.auth-shell{width:min(560px,100%)}.auth-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.auth-overline{color:#768078;font-size:9px;font-weight:800;letter-spacing:1.8px}.auth-heading h2{margin:9px 0 8px;font-size:clamp(31px,3.2vw,43px);line-height:1.05;letter-spacing:-2px}.auth-heading p{max-width:490px;margin:0;color:#747d77;font-size:12px;line-height:1.6}.auth-heading .q-chip{flex:0 0 auto}.audience-selector{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:27px 0 23px}.audience-selector button{min-width:0;display:grid;grid-template-columns:42px 1fr auto;align-items:center;gap:11px;padding:12px;border:1px solid #dce0d9;border-radius:16px;background:#fff;color:#303733;text-align:left;cursor:pointer;transition:.2s}.audience-selector button:hover{border-color:#aeb5aa;transform:translateY(-1px)}.audience-selector button.active{border-color:#1b211d;background:#f1f7e7;box-shadow:0 6px 18px rgba(26,34,28,.06)}.audience-icon{width:40px;height:40px;display:grid;place-items:center;border-radius:12px;background:#eff1ec;color:#606a63;font-size:20px}.active .audience-icon{background:#c8f45d;color:#171b19}.audience-selector b,.audience-selector small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.audience-selector b{font-size:12px}.audience-selector small{margin-top:3px;color:#8b938e;font-size:8px}.audience-check{color:#a7aea9}.active .audience-check{color:#678a2d}.professional-note{margin-bottom:17px;border:1px solid #dbe6c9;background:#f1f8e8;color:#526047;font-size:10px;line-height:1.5}.professional-note .q-icon{color:#70933c;font-size:21px}.avatar-picker{display:grid;grid-template-columns:64px 1fr auto;align-items:center;gap:14px;margin-bottom:17px;padding:13px;border:1px solid #e0e3dd;border-radius:16px;background:#fff}.avatar-picker .q-avatar{overflow:hidden}.avatar-copy b,.avatar-copy span,.avatar-copy small{display:block}.avatar-copy b{font-size:11px}.avatar-copy span{margin-top:3px;color:#737c76;font-size:9px}.avatar-copy small{margin-top:3px;color:#9ba19d;font-size:8px}.avatar-upload{font-size:10px}.transparent-file{opacity:0;cursor:pointer}.auth-fields{display:flex;flex-direction:column;gap:12px}.register-grid{display:grid;grid-template-columns:1fr;gap:12px}.register-grid--two{grid-template-columns:1fr 1fr}.auth-fields :deep(.q-field__control){min-height:54px;background:#fff}.auth-fields :deep(.q-field--rounded .q-field__control){border-radius:14px}.auth-fields :deep(.q-field__bottom){padding-top:5px;font-size:9px}.login-meta{display:flex;align-items:center;justify-content:space-between;margin:-2px 2px 2px;color:#68726b;font-size:10px}.login-meta>span{display:flex;align-items:center;gap:4px;color:#8b938e}.submit-button{min-height:53px;margin-top:2px;font-size:12px;font-weight:700;letter-spacing:.1px}.auth-divider{display:flex;align-items:center;gap:12px;margin:22px 0;color:#969e99;font-size:9px}.auth-divider:before,.auth-divider:after{height:1px;flex:1;background:#dfe3dc;content:''}.google-signin{min-height:44px;display:flex;justify-content:center;overflow:hidden}.google-button{min-height:46px;border-color:#d9ddd7!important;background:#fff}.professional-google-hint{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:18px;color:#838b86;font-size:9px}.switch-auth{margin:24px 0 0;text-align:center;color:#777f7a;font-size:11px}.switch-auth a{margin-left:4px;color:#1d231f;font-weight:800}.auth-terms{max-width:430px;margin:16px auto 0;color:#9ca29e;font-size:8px;line-height:1.6;text-align:center}@media(max-width:1023px){.auth-page{display:block;min-height:calc(100vh - 76px)}.auth-panel{min-height:calc(100vh - 76px);flex-direction:column;justify-content:flex-start;padding:30px max(22px,calc((100vw - 620px)/2)) 70px}.auth-shell{margin:0 auto}}@media(max-width:600px){.auth-page{min-height:calc(100vh - 66px)}.auth-panel{min-height:calc(100vh - 66px);padding:22px 14px 70px}.auth-heading{display:block;padding:0 5px}.auth-heading .q-chip{margin:12px 0 0}.auth-heading h2{font-size:31px;letter-spacing:-1.4px}.audience-selector{gap:7px;margin:22px 0 18px}.audience-selector button{grid-template-columns:34px 1fr;padding:10px 8px;gap:8px}.audience-icon{width:34px;height:34px;border-radius:10px;font-size:18px}.audience-check{display:none}.audience-selector b{font-size:10px}.audience-selector small{font-size:7px}.avatar-picker{grid-template-columns:55px 1fr;padding:11px}.avatar-picker .q-avatar{width:55px!important;height:55px!important}.avatar-picker .avatar-upload{grid-column:2;justify-self:start}.register-grid--two{grid-template-columns:1fr}.professional-note{font-size:9px}.auth-fields{gap:10px}.login-meta{font-size:9px}.login-meta :deep(.q-checkbox__label){font-size:9px}.submit-button{font-size:11px}.auth-terms{padding:0 12px}}
</style>
