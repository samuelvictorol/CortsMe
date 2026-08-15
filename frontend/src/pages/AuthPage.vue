<template>
  <q-page class="auth-page row">
    <section class="auth-brand gt-sm col-6">
      <div class="auth-brand__content"><span class="eyebrow eyebrow--dark"><span class="pulse-dot" /> Sua agenda em movimento</span><h1>Tempo para cuidar<br>do que importa.</h1><p>Uma experiência simples para profissionais e clientes, do primeiro contato ao atendimento.</p></div>
      <div class="auth-quote"><q-icon name="format_quote" /><p>Minha agenda parou de depender do WhatsApp. Hoje eu vejo o dia inteiro em segundos.</p><span>Rafael Martins · Barbearia Premium</span></div>
    </section>
    <section class="auth-form-wrap col-12 col-md-6">
      <div class="auth-form">
        <div class="lt-md q-mb-xl"><BrandLogo /></div>
        <span class="form-kicker">{{ registerMode ? 'CRIE SUA CONTA' : 'BEM-VINDO DE VOLTA' }}</span>
        <h2>{{ registerMode ? 'Seu próximo corte começa aqui.' : 'Entre no seu espaço.' }}</h2>
        <p class="form-subtitle">{{ registerMode ? 'Cadastre-se como cliente em menos de um minuto.' : 'Use seu e-mail ou telefone para continuar.' }}</p>
        <div v-if="registerMode" class="register-avatar-picker"><q-avatar size="68px" color="grey-3" text-color="dark"><img v-if="avatarPreview" :src="avatarPreview"><q-icon v-else name="person" /></q-avatar><div class="col"><b>Sua foto</b><span>Ajuda o profissional a reconhecer você na chegada.</span><small>A foto do Google é importada automaticamente.</small></div><q-btn outline rounded no-caps icon="photo_camera" :label="avatarFile ? 'Trocar' : 'Adicionar'"><q-file class="absolute-full transparent-file" borderless accept="image/*" :max-file-size="4194304" @update:model-value="prepareAvatar" @rejected="avatarRejected" /></q-btn></div>
        <q-form class="q-gutter-md q-mt-lg" @submit="submit">
          <q-input v-if="registerMode" v-model="form.name" outlined rounded label="Nome completo" autocomplete="name"><template #prepend><q-icon name="person_outline" /></template></q-input>
          <q-input v-model="form.identity" outlined rounded :label="registerMode ? 'E-mail' : 'E-mail ou telefone'" autocomplete="username"><template #prepend><q-icon name="alternate_email" /></template></q-input>
          <q-input v-if="registerMode" v-model="form.phone" outlined rounded label="Telefone" mask="(##) #####-####" unmasked-value autocomplete="tel"><template #prepend><q-icon name="phone_iphone" /></template></q-input>
          <q-input v-model="form.password" outlined rounded label="Senha" :type="showPassword ? 'text' : 'password'" autocomplete="current-password"><template #prepend><q-icon name="lock_outline" /></template><template #append><q-icon :name="showPassword ? 'visibility_off' : 'visibility'" class="cursor-pointer" @click="showPassword = !showPassword" /></template></q-input>
          <div v-if="!registerMode" class="row justify-between"><q-checkbox v-model="remember" dense label="Manter conectado por 90 dias" /><a class="muted-link">Esqueci minha senha</a></div>
          <q-btn type="submit" rounded unelevated color="dark" size="lg" class="full-width" no-caps :loading="loading" :label="registerMode ? 'Criar minha conta' : 'Entrar'" icon-right="arrow_forward" />
        </q-form>
        <div class="auth-divider"><span>ou continue com</span></div>
        <div v-if="googleConfigured" ref="googleButton" class="google-signin" />
        <q-btn v-else rounded outline color="grey-5" text-color="dark" class="full-width google-btn" no-caps label="Google" icon="img:https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" @click="googleUnavailable" />
        <p class="switch-auth">{{ registerMode ? 'Já tem uma conta?' : 'Ainda não tem conta?' }} <router-link :to="registerMode ? '/login' : '/cadastro'">{{ registerMode ? 'Entrar' : 'Criar conta' }}</router-link></p>
      </div>
    </section>
  </q-page>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import BrandLogo from 'components/BrandLogo.vue'
import { api } from 'boot/axios'
import { useAuthStore } from 'stores/auth-store'

const route = useRoute(); const router = useRouter(); const $q = useQuasar(); const auth = useAuthStore()
const form = reactive({ name: '', identity: '', phone: '', password: '' })
const loading = ref(false); const showPassword = ref(false); const remember = ref(true); const avatarFile = ref(null); const avatarPreview = ref('')
const googleButton = ref(null); const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID)
const registerMode = computed(() => route.path === '/cadastro')
function clearAvatarPreview () { if (avatarPreview.value) URL.revokeObjectURL(avatarPreview.value); avatarPreview.value = ''; avatarFile.value = null }
watch(registerMode, () => { Object.assign(form, { name: '', identity: '', phone: '', password: '' }); clearAvatarPreview() })
function prepareAvatar (file) { if (!file) return; if (avatarPreview.value) URL.revokeObjectURL(avatarPreview.value); avatarFile.value = file; avatarPreview.value = URL.createObjectURL(file) }
function avatarRejected () { $q.notify({ type: 'negative', message: 'Use uma imagem JPG, PNG ou WebP de até 4 MB.' }) }
async function submit () {
  loading.value = true
  try {
    if (registerMode.value) {
      await auth.register({ name: form.name, email: form.identity, phone: form.phone, password: form.password })
      if (avatarFile.value) {
        try { const upload = new FormData(); upload.append('image', avatarFile.value); const { data } = await api.post('/auth/avatar', upload); auth.user = data.user; localStorage.setItem('cortsme_user', JSON.stringify(data.user)) }
        catch { $q.notify({ type: 'warning', message: 'Conta criada. Você pode adicionar sua foto depois em Meu perfil.' }) }
      }
    }
    else await auth.login({ identity: form.identity, password: form.password })
    const redirect = route.query.redirect
    router.push(redirect || auth.home)
  } catch (error) { $q.notify({ type: 'negative', message: error.response?.data?.message || 'Não foi possível continuar.' }) }
  finally { loading.value = false }
}
function googleUnavailable () { $q.notify({ message: 'Adicione o GOOGLE_CLIENT_ID no .env para ativar o login Google.', color: 'dark', icon: 'info' }) }
async function handleGoogle (response) {
  try {
    const { data } = await api.post('/auth/google', { credential: response.credential })
    auth.setSession(data)
    router.push(route.query.redirect || auth.home)
  } catch (error) { $q.notify({ type: 'negative', message: error.response?.data?.message || 'Login Google indisponível.' }) }
}
onMounted(() => {
  if (!googleConfigured) return
  const script = document.createElement('script')
  script.src = 'https://accounts.google.com/gsi/client'
  script.async = true
  script.onload = () => {
    window.google.accounts.id.initialize({ client_id: process.env.GOOGLE_CLIENT_ID, callback: handleGoogle })
    window.google.accounts.id.renderButton(googleButton.value, { theme: 'outline', size: 'large', shape: 'pill', width: 440, text: registerMode.value ? 'signup_with' : 'signin_with', locale: 'pt-BR' })
  }
  document.head.appendChild(script)
})
onBeforeUnmount(clearAvatarPreview)
</script>
