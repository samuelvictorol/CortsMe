<template>
  <q-page class="recovery-page">
    <main class="recovery-shell">
      <section class="recovery-copy">
        <span class="recovery-overline">RECUPERAÇÃO SEGURA</span>
        <h1>Volte para a sua rotina.</h1>
        <p>Informe o contato da conta. Se ela puder redefinir a senha, o CortsMe enviará um link pelo NotifyFlow sem revelar se o cadastro existe.</p>
        <div class="recovery-proof"><q-icon name="verified_user" /><span>Link temporário, uso único e válido somente para a conta solicitada.</span></div>
      </section>

      <section class="recovery-card">
        <router-link to="/login" class="back-link"><q-icon name="arrow_back" /> Voltar ao login</router-link>
        <template v-if="!sent">
          <span class="card-kicker">ESQUECI MINHA SENHA</span>
          <h2>Onde você usa o CortsMe?</h2>
          <p>Escolha o perfil para receber instruções adequadas ao seu acesso.</p>

          <div class="profile-choice" role="radiogroup" aria-label="Perfil da conta">
            <button v-for="option in profileOptions" :key="option.value" type="button" :class="{ active: accountType === option.value }" :aria-checked="accountType === option.value" role="radio" @click="accountType = option.value">
              <q-icon :name="option.icon" />
              <span><b>{{ option.label }}</b><small>{{ option.hint }}</small></span>
              <q-icon :name="accountType === option.value ? 'check_circle' : 'radio_button_unchecked'" />
            </button>
          </div>

          <q-form class="recovery-form" @submit="submit">
            <q-input v-model.trim="identity" outlined rounded label="E-mail ou telefone" autocomplete="username" :rules="[required]" lazy-rules>
              <template #prepend><q-icon name="alternate_email" /></template>
            </q-input>
            <q-btn type="submit" rounded unelevated color="dark" size="lg" class="full-width" no-caps label="Enviar link de recuperação" icon-right="arrow_forward" :loading="loading" />
          </q-form>
          <div class="google-note"><q-icon name="info_outline" /><span>Entrou pelo Google e nunca criou senha? Continue usando o botão Google no login.</span></div>
        </template>

        <template v-else>
          <div class="recovery-success"><span><q-icon name="mark_email_read" /></span><h2>Confira suas mensagens.</h2><p>Se os dados corresponderem a uma conta elegível, você receberá as instruções em instantes por WhatsApp ou Gmail.</p><q-btn :to="loginRoute" rounded unelevated color="dark" class="full-width" no-caps label="Voltar ao login" icon-right="arrow_forward" /><q-btn flat rounded class="full-width" no-caps label="Enviar novamente" @click="sent = false" /></div>
        </template>
      </section>
    </main>
  </q-page>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'

const route = useRoute()
const $q = useQuasar()
const profileOptions = [
  { value: 'client', label: 'Cliente', hint: 'Agendamentos e perfil', icon: 'person_outline' },
  { value: 'professional', label: 'Profissional', hint: 'Salão ou barbearia', icon: 'storefront' }
]
const accountType = ref(route.query.perfil === 'profissional' ? 'professional' : 'client')
const identity = ref('')
const loading = ref(false)
const sent = ref(false)
const loginRoute = computed(() => ({ path: '/login', query: { perfil: accountType.value === 'professional' ? 'profissional' : 'cliente' } }))
const required = value => Boolean(String(value || '').trim()) || 'Informe seu e-mail ou telefone.'

async function submit () {
  loading.value = true
  try {
    await api.post('/auth/forgot-password', { identity: identity.value, accountType: accountType.value })
    sent.value = true
  } catch (error) {
    if (error.response?.status === 429) $q.notify({ type: 'warning', message: 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.' })
    else $q.notify({ type: 'negative', message: error.response?.data?.message || 'Não foi possível solicitar a recuperação agora.' })
  } finally { loading.value = false }
}
</script>

<style scoped>
.recovery-page{min-height:calc(100vh - 76px);display:grid;place-items:center;padding:50px 24px 80px;background:#f4f5f0;color:#171b19}.recovery-shell{width:min(1080px,100%);display:grid;grid-template-columns:.86fr 1.14fr;overflow:hidden;border:1px solid #dfe3db;border-radius:28px;background:#fff;box-shadow:0 28px 80px rgba(23,31,26,.09)}.recovery-copy{position:relative;min-height:610px;padding:72px 58px;display:flex;flex-direction:column;justify-content:center;overflow:hidden;background:#171d19;color:#fff}.recovery-copy:after{position:absolute;width:420px;height:420px;right:-270px;bottom:-230px;border:70px solid #c8f45d;border-radius:50%;opacity:.86;content:''}.recovery-overline,.card-kicker{font-size:9px;font-weight:900;letter-spacing:1.8px;color:#91bd4a}.recovery-copy h1{max-width:430px;margin:22px 0;font-size:50px;line-height:.98;letter-spacing:-3px}.recovery-copy>p{max-width:430px;margin:0;color:#b3bbb6;line-height:1.75}.recovery-proof{position:relative;z-index:1;margin-top:42px;padding:15px;display:flex;align-items:center;gap:11px;border:1px solid #39413c;border-radius:14px;color:#c7cec9;font-size:11px}.recovery-proof .q-icon{color:#c8f45d;font-size:22px}.recovery-card{padding:48px 58px 52px}.back-link{display:inline-flex;align-items:center;gap:6px;margin-bottom:48px;color:#6f7872;font-size:11px}.recovery-card h2{margin:8px 0;font-size:32px;letter-spacing:-1.4px}.recovery-card>p{margin:0;color:#747d77;font-size:12px}.profile-choice{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:27px 0 20px}.profile-choice button{min-width:0;padding:12px;display:grid;grid-template-columns:36px 1fr auto;align-items:center;gap:9px;border:1px solid #dfe3dc;border-radius:14px;background:#fff;color:#343b36;text-align:left;cursor:pointer}.profile-choice button.active{border-color:#1f2721;background:#f2f7e9}.profile-choice button>.q-icon:first-child{font-size:21px}.profile-choice button>.q-icon:last-child{color:#729341}.profile-choice b,.profile-choice small{display:block}.profile-choice b{font-size:11px}.profile-choice small{margin-top:2px;color:#8a928d;font-size:8px}.recovery-form{display:grid;gap:10px}.google-note{margin-top:20px;padding:12px;display:flex;align-items:flex-start;gap:8px;border-radius:12px;background:#f3f5f1;color:#747c77;font-size:9px;line-height:1.5}.google-note .q-icon{font-size:18px}.recovery-success{min-height:430px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.recovery-success>span{width:70px;height:70px;display:grid;place-items:center;border-radius:22px;background:#e8f4dc;color:#5b8137;font-size:34px}.recovery-success p{max-width:430px;margin:0 0 26px;color:#737b76;line-height:1.7}.recovery-success .q-btn{max-width:380px;margin-top:8px}@media(max-width:850px){.recovery-page{padding:28px 16px 70px}.recovery-shell{grid-template-columns:1fr}.recovery-copy{display:none}.recovery-card{padding:34px 28px 42px}.back-link{margin-bottom:35px}}@media(max-width:520px){.recovery-page{padding:14px 9px 76px}.recovery-shell{border-radius:20px}.recovery-card{padding:28px 17px 34px}.recovery-card h2{font-size:27px}.profile-choice{grid-template-columns:1fr}.recovery-success{min-height:390px}}
</style>
