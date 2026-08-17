<template>
  <q-page class="dashboard-page profile-page">
    <div class="page-intro">
      <div><span class="page-overline">MINHA CONTA</span><h1>Dados pessoais</h1><p>Mantenha sua foto e seus contatos atualizados para facilitar seus agendamentos.</p></div>
      <q-btn rounded unelevated color="dark" no-caps label="Salvar alterações" icon="save" :loading="saving" @click="save" />
    </div>

    <div class="profile-grid">
      <section class="panel-card avatar-card">
        <div class="avatar-upload">
          <q-avatar size="116px" color="grey-3" text-color="dark">
            <img v-if="auth.user?.avatar" :src="auth.user.avatar" alt="Foto do perfil">
            <span v-else>{{ initials }}</span>
          </q-avatar>
          <q-btn round unelevated color="dark" icon="photo_camera" class="avatar-button" :loading="uploading" aria-label="Enviar foto">
            <q-file class="absolute-full transparent-file" borderless accept="image/jpeg,image/png,image/webp" :max-file-size="4194304" @update:model-value="uploadAvatar" @rejected="avatarRejected" />
          </q-btn>
        </div>
        <h3>{{ auth.user?.name }}</h3>
        <p>Cliente CortsMe</p>
        <q-badge rounded color="lime-5" text-color="dark" :label="auth.user?.provider === 'google' ? 'Conta Google' : 'Conta protegida'" />
        <q-separator spaced />
        <div class="avatar-url-block">
          <small>Ou use uma imagem hospedada por URL HTTPS:</small>
          <q-input v-model.trim="avatarUrl" outlined rounded dense label="URL do avatar" placeholder="https://exemplo.com/foto.jpg" :disable="uploading || applyingUrl">
            <template #prepend><q-icon name="link" /></template>
          </q-input>
          <div class="avatar-actions">
            <q-btn outline rounded no-caps icon="check" label="Usar URL" :loading="applyingUrl" @click="applyAvatarUrl" />
            <q-btn v-if="auth.user?.avatar" flat rounded no-caps color="negative" icon="delete_outline" label="Remover" :disable="uploading || applyingUrl" @click="removeAvatar" />
          </div>
        </div>
        <p class="avatar-help"><q-icon name="shield" /> JPEG, PNG ou WebP, até 4 MB. O arquivo fica associado somente à sua conta.</p>
      </section>

      <section class="panel-card profile-form-card">
        <div class="panel-heading"><div><span>INFORMAÇÕES</span><h3>Seu perfil</h3></div></div>
        <div class="form-stack">
          <q-input v-model="form.name" outlined rounded label="Nome completo"><template #prepend><q-icon name="person_outline" /></template></q-input>
          <q-input v-model="form.email" outlined rounded label="E-mail"><template #prepend><q-icon name="alternate_email" /></template></q-input>
          <q-input v-model="form.phone" outlined rounded label="Telefone" mask="(##) #####-####" unmasked-value><template #prepend><q-icon name="phone_iphone" /></template></q-input>
          <q-input v-model.trim="form.whatsappMetaPhone" outlined rounded type="tel" label="Número alternativo do WhatsApp Meta (opcional)" placeholder="+556181748795" hint="Use E.164 brasileiro. Seu telefone principal não será alterado."><template #prepend><q-icon name="chat" /></template></q-input>
          <template v-if="auth.user?.provider !== 'google'">
            <q-separator spaced />
            <h4>Alterar senha</h4>
            <q-input v-model="form.password" outlined rounded type="password" label="Nova senha (opcional)" hint="Use entre 8 e 128 caracteres"><template #prepend><q-icon name="lock_outline" /></template></q-input>
          </template>
          <q-banner v-else rounded class="google-password-note"><template #avatar><q-icon name="account_circle" /></template>Sua senha e o acesso desta conta continuam gerenciados pelo Google.</q-banner>
          <div class="privacy-box"><q-icon name="encrypted" /><div><b>Seus dados ficam protegidos</b><p>Contato cifrado no banco e usado apenas para sua conta e agendamentos.</p></div></div>
        </div>
      </section>
    </div>
  </q-page>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
import { useAuthStore } from 'stores/auth-store'

const auth = useAuthStore()
const $q = useQuasar()
const saving = ref(false)
const uploading = ref(false)
const applyingUrl = ref(false)
const avatarUrl = ref(auth.user?.avatarSource === 'url' ? auth.user.avatar : '')
const form = reactive({ name: auth.user?.name || '', email: auth.user?.email || '', phone: auth.user?.phone || '', whatsappMetaPhone: auth.user?.whatsappMetaPhone || '', password: '' })
const initials = computed(() => auth.user?.name?.split(' ').slice(0, 2).map(item => item[0]).join('').toUpperCase() || 'CM')

function avatarRejected () { $q.notify({ type: 'negative', message: 'Use uma imagem JPEG, PNG ou WebP de até 4 MB.' }) }
function validAvatarUrl (value) { try { return new URL(value).protocol === 'https:' } catch { return false } }
function validWhatsappMetaPhone (value) { return !value || /^\+55[1-9]\d[1-9]\d{7,8}$/.test(String(value).trim()) }

async function uploadAvatar (file) {
  if (!file) return
  uploading.value = true
  const body = new FormData()
  body.append('image', file)
  try {
    const { data } = await api.post('/auth/avatar', body)
    avatarUrl.value = ''
    auth.updateUser(data.user)
    $q.notify({ type: 'positive', message: 'Foto atualizada.' })
  } catch (error) {
    $q.notify({ type: 'negative', message: error.response?.data?.message || 'Não foi possível enviar a foto.' })
  } finally { uploading.value = false }
}

async function applyAvatarUrl () {
  if (!validAvatarUrl(avatarUrl.value)) return $q.notify({ type: 'negative', message: 'Informe uma URL HTTPS válida.' })
  applyingUrl.value = true
  try {
    const { data } = await api.put('/auth/avatar', { url: avatarUrl.value })
    auth.updateUser(data.user)
    avatarUrl.value = data.user.avatar
    $q.notify({ type: 'positive', message: 'Foto por URL atualizada.' })
  } catch (error) {
    $q.notify({ type: 'negative', message: error.response?.data?.message || 'Não foi possível usar esta URL.' })
  } finally { applyingUrl.value = false }
}

function removeAvatar () {
  $q.dialog({ title: 'Remover foto?', message: 'Seu perfil voltará a mostrar suas iniciais.', cancel: true }).onOk(async () => {
    try {
      const { data } = await api.delete('/auth/avatar')
      avatarUrl.value = ''
      auth.updateUser(data.user)
      $q.notify({ message: 'Foto removida.', color: 'dark' })
    } catch (error) { $q.notify({ type: 'negative', message: error.response?.data?.message || 'Não foi possível remover a foto.' }) }
  })
}

async function save () {
  saving.value = true
  try {
    if (!validWhatsappMetaPhone(form.whatsappMetaPhone)) throw new Error('O número alternativo do WhatsApp deve usar E.164 brasileiro, por exemplo +556181748795.')
    const payload = { ...form }
    if (!payload.password || auth.user?.provider === 'google') delete payload.password
    const { data } = await api.patch('/auth/me', payload)
    if (data.token) auth.setSession(data); else auth.updateUser(data.user)
    form.password = ''
    $q.notify({ type: 'positive', message: 'Perfil atualizado.' })
  } catch (error) {
    $q.notify({ type: 'negative', message: error.response?.data?.message || error.message || 'Não foi possível salvar.' })
  } finally { saving.value = false }
}
</script>

<style scoped>
.avatar-url-block{width:100%;display:grid;gap:9px;text-align:left}.avatar-url-block>small{color:#7e8781;font-size:9px}.avatar-actions{display:flex;flex-wrap:wrap;gap:6px}.avatar-help{display:flex;align-items:flex-start;gap:5px;margin:16px 0 0!important;color:#7d857f!important;font-size:8px!important;line-height:1.5}.avatar-help .q-icon{flex:0 0 auto;font-size:15px;color:#64833d}.google-password-note{border:1px solid #dfe7d4;background:#f6faef;color:#63705b;font-size:10px}.transparent-file{opacity:0;cursor:pointer}@media(max-width:600px){.profile-page{padding-left:12px;padding-right:12px}.avatar-actions{display:grid;grid-template-columns:1fr 1fr}.avatar-actions .q-btn{font-size:9px}}
</style>
