<template>
  <q-page class="reset-page">
    <section class="reset-card">
      <div class="reset-brand"><span><q-icon :name="success ? 'task_alt' : 'lock_reset'" /></span><div><small>CORTSME · CONTA SEGURA</small><b>{{ success ? 'Senha atualizada' : 'Redefinir senha' }}</b></div></div>

      <div v-if="checking" class="reset-state"><q-spinner-dots size="46px" color="dark" /><p>Validando seu link seguro…</p></div>
      <div v-else-if="invalid" class="reset-state"><q-icon name="link_off" color="negative" size="54px" /><h1>Este link não está mais disponível.</h1><p>{{ invalidMessage }}</p><q-btn to="/esqueci-senha" rounded unelevated color="dark" no-caps label="Solicitar outro link" icon-right="arrow_forward" /></div>
      <div v-else-if="success" class="reset-state"><q-icon name="verified_user" color="positive" size="54px" /><h1>Tudo pronto para entrar.</h1><p>Sua nova senha já está ativa. Use o perfil correto para continuar.</p><q-btn :to="loginRoute" rounded unelevated color="dark" no-caps label="Ir para o login" icon-right="arrow_forward" /></div>

      <template v-else>
        <span class="reset-overline">LINK VALIDADO</span>
        <h1>Crie uma nova senha.</h1>
        <p>Use ao menos oito caracteres. Ao concluir, outros links de recuperação desta conta deixam de funcionar.</p>
        <q-form class="reset-form" @submit="submit">
          <q-input v-model="password" outlined rounded :type="showPassword ? 'text' : 'password'" label="Nova senha" autocomplete="new-password" :rules="[passwordRule]" lazy-rules>
            <template #prepend><q-icon name="lock_outline" /></template>
            <template #append><q-icon :name="showPassword ? 'visibility_off' : 'visibility'" class="cursor-pointer" @click="showPassword = !showPassword" /></template>
          </q-input>
          <q-input v-model="confirmation" outlined rounded :type="showPassword ? 'text' : 'password'" label="Confirmar nova senha" autocomplete="new-password" :rules="[confirmationRule]" lazy-rules><template #prepend><q-icon name="verified" /></template></q-input>
          <q-btn type="submit" rounded unelevated color="dark" size="lg" class="full-width" no-caps label="Salvar nova senha" icon-right="arrow_forward" :loading="saving" />
        </q-form>
      </template>
    </section>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'

const route = useRoute()
const $q = useQuasar()
const checking = ref(true)
const invalid = ref(false)
const invalidMessage = ref('Solicite uma nova recuperação para continuar.')
const saving = ref(false)
const success = ref(false)
const password = ref('')
const confirmation = ref('')
const showPassword = ref(false)
const accountRole = ref('USER')
const token = computed(() => String(route.params.token || ''))
const loginRoute = computed(() => ({ path: '/login', query: { perfil: accountRole.value === 'BARBER' ? 'profissional' : 'cliente' } }))
const passwordRule = value => String(value || '').length >= 8 || 'Use pelo menos 8 caracteres.'
const confirmationRule = value => value === password.value || 'As senhas precisam ser iguais.'
const roleFromAccountType = value => String(value || '').toLowerCase() === 'professional' ? 'BARBER' : 'USER'

async function validate () {
  checking.value = true
  try {
    const { data } = await api.get(`/auth/reset-password/${encodeURIComponent(token.value)}`)
    if (data?.valid === false) throw new Error(data.message || 'Link inválido.')
    accountRole.value = data?.role || data?.user?.role || roleFromAccountType(data?.accountType)
  } catch (error) {
    invalid.value = true
    invalidMessage.value = error.response?.data?.message || error.message || invalidMessage.value
  } finally { checking.value = false }
}

async function submit () {
  if (passwordRule(password.value) !== true || confirmationRule(confirmation.value) !== true) return
  saving.value = true
  try {
    const { data } = await api.post('/auth/reset-password', { token: token.value, password: password.value })
    accountRole.value = data?.role || data?.user?.role || (data?.accountType ? roleFromAccountType(data.accountType) : accountRole.value)
    success.value = true
  } catch (error) {
    if ([400, 404, 410].includes(error.response?.status)) {
      invalid.value = true
      invalidMessage.value = error.response?.data?.message || 'O link expirou ou já foi utilizado.'
    } else $q.notify({ type: 'negative', message: error.response?.data?.message || 'Não foi possível salvar a nova senha.' })
  } finally { saving.value = false }
}

onMounted(validate)
</script>

<style scoped>
.reset-page{min-height:calc(100vh - 76px);display:grid;place-items:center;padding:42px 18px 80px;background:radial-gradient(circle at 20% 15%,#eff6e5,transparent 34%),#f5f6f2;color:#171b19}.reset-card{width:min(570px,100%);min-height:560px;padding:35px 44px 44px;border:1px solid #dfe3dc;border-radius:26px;background:#fff;box-shadow:0 25px 75px rgba(24,33,27,.09)}.reset-brand{display:flex;align-items:center;gap:11px;margin-bottom:56px}.reset-brand>span{width:43px;height:43px;display:grid;place-items:center;border-radius:13px;background:#18201a;color:#c8f45d;font-size:23px}.reset-brand small,.reset-brand b{display:block}.reset-brand small{color:#858d87;font-size:7px;font-weight:900;letter-spacing:1.4px}.reset-brand b{margin-top:3px;font-size:13px}.reset-overline{color:#71953c;font-size:8px;font-weight:900;letter-spacing:1.6px}.reset-card>h1,.reset-state h1{margin:9px 0;font-size:34px;line-height:1.05;letter-spacing:-1.6px}.reset-card>p,.reset-state p{color:#727b75;font-size:12px;line-height:1.7}.reset-form{margin-top:27px;display:grid;gap:12px}.reset-state{min-height:370px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.reset-state p{max-width:390px;margin:0 0 23px}.reset-state h1{font-size:28px}@media(max-width:520px){.reset-page{padding:12px 8px 75px}.reset-card{min-height:530px;padding:27px 19px 36px;border-radius:20px}.reset-brand{margin-bottom:44px}.reset-card>h1{font-size:30px}}
</style>
