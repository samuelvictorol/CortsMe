<template>
  <q-page class="dashboard-page admin-data-page">
    <div class="page-intro">
      <div><span class="page-overline">GESTÃO GLOBAL</span><h1>{{ config.title }}</h1><p>{{ config.subtitle }}</p></div>
      <q-btn v-if="resource === 'users'" rounded unelevated color="dark" no-caps label="Novo usuário" icon="add" @click="openNew" />
    </div>

    <section class="panel-card data-card">
      <div class="data-toolbar">
        <q-input v-model="search" outlined rounded dense debounce="400" :placeholder="config.search" @update:model-value="resetAndLoad"><template #prepend><q-icon name="search" /></template><template #append><q-icon v-if="search" name="close" class="cursor-pointer" @click="search = ''; resetAndLoad()" /></template></q-input>
        <q-select v-if="resource === 'users'" v-model="roleFilter" outlined rounded dense clearable :options="roleOptions" emit-value map-options label="Perfil" @update:model-value="resetAndLoad" />
        <q-select v-if="resource === 'appointments'" v-model="statusFilter" outlined rounded dense clearable :options="statusOptions" emit-value map-options label="Status" @update:model-value="resetAndLoad" />
        <q-btn flat round icon="refresh" aria-label="Atualizar" @click="load" />
      </div>

      <q-table flat :rows="rows" :columns="columns" :row-key="rowKey" :loading="loading" hide-pagination :grid="$q.screen.lt.md" class="admin-table">
        <template #body-cell-user="props">
          <q-td :props="props"><div class="table-user"><q-avatar color="grey-3" text-color="dark" size="36px"><img v-if="rowAvatar(props.row)" :src="rowAvatar(props.row)" alt=""><span v-else>{{ initials(rowTitle(props.row)) }}</span></q-avatar><div><b>{{ rowTitle(props.row) }}</b><small>{{ rowSubtitle(props.row) }}</small></div></div></q-td>
        </template>
        <template #body-cell-active="props"><q-td :props="props"><q-badge rounded :color="props.value ? 'positive' : 'grey-5'" :label="props.value ? 'Ativo' : 'Inativo'" /></q-td></template>
        <template #body-cell-published="props"><q-td :props="props"><q-badge rounded :color="props.value ? 'positive' : 'warning'" :label="props.value ? 'Publicado' : 'Rascunho'" /></q-td></template>
        <template #body-cell-status="props"><q-td :props="props"><q-badge rounded :color="statusColor(props.value)" :label="statusLabel(props.value)" /></q-td></template>
        <template #body-cell-createdAt="props"><q-td :props="props">{{ dateTime(props.value) }}</q-td></template>
        <template #body-cell-start="props"><q-td :props="props">{{ dateTime(props.value) }}</q-td></template>
        <template #body-cell-actions="props"><q-td :props="props"><q-btn v-if="resource !== 'bot-logs'" flat round dense icon="edit" @click="openEdit(props.row)" /><q-btn flat round dense icon="delete_outline" color="negative" @click="remove(props.row)" /></q-td></template>
        <template #item="props">
          <div class="q-pa-xs col-12"><article class="admin-mobile-card"><header><div class="table-user"><q-avatar color="grey-3" text-color="dark" size="42px"><img v-if="rowAvatar(props.row)" :src="rowAvatar(props.row)" alt=""><span v-else>{{ initials(rowTitle(props.row)) }}</span></q-avatar><div><b>{{ rowTitle(props.row) }}</b><small>{{ rowSubtitle(props.row) }}</small></div></div><div><q-btn v-if="resource !== 'bot-logs'" flat round dense icon="edit" @click="openEdit(props.row)" /><q-btn flat round dense icon="delete_outline" color="negative" @click="remove(props.row)" /></div></header><dl><template v-for="column in columns.filter(item => !['user', 'actions'].includes(item.name))" :key="column.name"><dt>{{ column.label }}</dt><dd>{{ mobileValue(column, props.row) }}</dd></template></dl></article></div>
        </template>
      </q-table>
      <div class="table-footer"><span>Mostrando {{ rows.length }} de {{ pagination.total }} registros</span><q-pagination v-if="pagination.pages > 1" v-model="pagination.page" :max="pagination.pages" direction-links color="dark" @update:model-value="load" /></div>
    </section>

    <q-dialog v-model="dialog" @hide="clearAdminAvatarFile">
      <q-card class="admin-dialog">
        <q-card-section class="dialog-title"><div><span>{{ editing ? 'EDITAR REGISTRO' : 'NOVO CADASTRO' }}</span><h3>{{ editing ? (form.name || form.businessName || form.serviceName) : 'Adicionar usuário' }}</h3></div><q-btn flat round icon="close" v-close-popup /></q-card-section>
        <q-card-section class="form-stack" v-if="resource === 'users'">
          <div class="admin-avatar-editor">
            <q-avatar size="72px" color="grey-3" text-color="dark"><img v-if="adminAvatarPreview" :src="adminAvatarPreview" alt="Prévia do avatar"><span v-else>{{ initials(form.name) }}</span></q-avatar>
            <div><b>Foto do usuário</b><small>Upload seguro ou URL HTTPS · JPEG, PNG ou WebP · até 4 MB</small><div class="admin-avatar-buttons"><q-btn outline rounded no-caps icon="photo_camera" :label="adminAvatarFile ? 'Trocar arquivo' : 'Escolher arquivo'"><q-file class="absolute-full transparent-file" borderless accept="image/jpeg,image/png,image/webp" :max-file-size="4194304" @update:model-value="prepareAdminAvatar" @rejected="avatarRejected" /></q-btn><q-btn v-if="adminAvatarPreview" flat rounded no-caps color="negative" icon="delete_outline" label="Remover" @click="removeAdminAvatarSelection" /></div></div>
          </div>
          <q-input v-model.trim="form.avatar" outlined rounded label="URL HTTPS do avatar (alternativa ao upload)" @update:model-value="avatarUrlChanged"><template #prepend><q-icon name="link" /></template></q-input>
          <q-input v-model="form.name" outlined rounded label="Nome completo" />
          <q-input v-model="form.email" outlined rounded label="E-mail" />
          <q-input v-model="form.phone" outlined rounded label="Telefone" mask="(##) #####-####" unmasked-value />
          <q-input v-model.trim="form.whatsappMetaPhone" outlined rounded label="Número alternativo do WhatsApp Meta (opcional)" placeholder="+556181748795" hint="Formato E.164 do Brasil: +55, DDD e número, sem espaços." />
          <q-select v-model="form.role" outlined rounded :options="roleOptions" emit-value map-options label="Perfil" />
          <template v-if="form.role === 'BARBER'"><q-input v-model="form.businessName" outlined rounded label="Nome da barbearia" /><q-input v-model="form.slug" outlined rounded label="URL pública" prefix="/" /></template>
          <q-input v-if="form.provider !== 'google'" v-model="form.password" outlined rounded type="password" :label="editing ? 'Nova senha (opcional)' : 'Senha inicial'" />
          <q-banner v-else rounded class="google-admin-note"><template #avatar><q-icon name="account_circle" /></template>Esta conta usa Google; a senha não é editada pelo CortsMe.</q-banner>
          <q-toggle v-if="editing" v-model="form.active" label="Cadastro ativo" color="positive" />
        </q-card-section>
        <q-card-section class="form-stack" v-else-if="resource === 'profiles'"><q-input v-model="form.businessName" outlined rounded label="Nome do negócio" /><q-input v-model="form.slug" outlined rounded label="URL pública" prefix="/" /><q-input v-model="form.address" outlined rounded label="Endereço" /><div class="row"><q-toggle v-model="form.active" label="Perfil ativo" color="positive" /><q-toggle v-model="form.published" label="Site publicado" color="positive" /></div></q-card-section>
        <q-card-section class="form-stack" v-else-if="resource === 'appointments'"><q-input v-model="form.serviceName" outlined rounded label="Serviço" /><q-input v-model="form.start" outlined rounded type="datetime-local" label="Data e hora" stack-label /><q-select v-model="form.status" outlined rounded :options="statusOptions" emit-value map-options label="Status" /><q-input v-model="form.note" outlined rounded type="textarea" label="Observação" /></q-card-section>
        <q-card-actions class="q-pa-md"><q-space /><q-btn flat rounded no-caps label="Cancelar" v-close-popup /><q-btn rounded unelevated color="dark" no-caps label="Salvar" :loading="saving" @click="save" /></q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'

const route = useRoute()
const $q = useQuasar()
const resource = computed(() => route.params.resource)
const rows = ref([])
const loading = ref(false)
const search = ref('')
const roleFilter = ref(null)
const statusFilter = ref(null)
const pagination = ref({ page: 1, pages: 1, total: 0 })
const dialog = ref(false)
const editing = ref(null)
const saving = ref(false)
const form = reactive({})
const adminAvatarFile = ref(null)
const adminAvatarObjectUrl = ref('')

const configs = { users: { title: 'Usuários', subtitle: 'Clientes e profissionais cadastrados na plataforma.', search: 'Buscar por nome, e-mail ou telefone' }, profiles: { title: 'Barbearias', subtitle: 'Perfis profissionais, URLs públicas e status de publicação.', search: 'Buscar negócio ou URL' }, appointments: { title: 'Agendamentos', subtitle: 'Todos os horários marcados em qualquer estabelecimento.', search: 'Buscar agendamento' }, 'bot-logs': { title: 'Interações do bot', subtitle: 'Perguntas, respostas e intenções registradas por barbearia.', search: 'Buscar nas conversas' } }
const config = computed(() => configs[resource.value] || configs.users)
const roleOptions = [{ label: 'Cliente', value: 'USER' }, { label: 'Barbeiro / salão', value: 'BARBER' }]
const statusOptions = [{ label: 'Confirmado', value: 'CONFIRMED' }, { label: 'Pendente', value: 'PENDING' }, { label: 'Concluído', value: 'COMPLETED' }, { label: 'Cancelado', value: 'CANCELLED' }]
const columnSets = { users: [{ name: 'user', label: 'Usuário', field: 'name', align: 'left' }, { name: 'role', label: 'Perfil', field: row => ({ USER: 'Cliente', BARBER: 'Barbeiro', ADMIN: 'Admin' }[row.role]), align: 'left' }, { name: 'active', label: 'Status', field: 'active' }, { name: 'createdAt', label: 'Cadastro', field: 'createdAt' }], profiles: [{ name: 'user', label: 'Negócio', field: 'businessName', align: 'left' }, { name: 'slug', label: 'URL', field: row => `/${row.slug}`, align: 'left' }, { name: 'published', label: 'Site', field: 'published' }, { name: 'active', label: 'Perfil', field: 'active' }], appointments: [{ name: 'user', label: 'Cliente', field: 'user', align: 'left' }, { name: 'serviceName', label: 'Serviço', field: 'serviceName', align: 'left' }, { name: 'profile', label: 'Barbearia', field: row => row.profile?.businessName, align: 'left' }, { name: 'start', label: 'Horário', field: 'start' }, { name: 'status', label: 'Status', field: 'status' }], 'bot-logs': [{ name: 'message', label: 'Pergunta', field: 'message', align: 'left' }, { name: 'response', label: 'Resposta', field: 'response', align: 'left' }, { name: 'profile', label: 'Barbearia', field: row => row.profile?.businessName, align: 'left' }, { name: 'intent', label: 'Intenção', field: 'intent' }, { name: 'createdAt', label: 'Data', field: 'createdAt' }] }
const columns = computed(() => [...(columnSets[resource.value] || columnSets.users), { name: 'actions', label: '', field: 'actions', align: 'right' }])
const adminAvatarPreview = computed(() => adminAvatarObjectUrl.value || (/^https?:\/\//i.test(form.avatar || '') ? form.avatar : ''))

const rowKey = row => row.id || row._id
const initials = value => String(value || 'CM').split(' ').slice(0, 2).map(part => part[0]).join('').toUpperCase()
const rowAvatar = row => row.avatar || row.owner?.avatar || row.user?.avatar || ''
const rowTitle = row => row.name || row.user?.name || row.businessName || row.customerName || 'Cliente balcão'
const rowSubtitle = row => row.email || row.user?.email || row.owner?.email || row.customerPhone || row.slug || ''
const dateTime = value => value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'
const statusLabel = value => statusOptions.find(item => item.value === value)?.label || value
const statusColor = value => ({ CONFIRMED: 'positive', PENDING: 'warning', COMPLETED: 'blue-grey', CANCELLED: 'negative' }[value])
function fieldValue (column, row) { return typeof column.field === 'function' ? column.field(row) : row[column.field] }
function mobileValue (column, row) { const value = fieldValue(column, row); if (['createdAt', 'start'].includes(column.name)) return dateTime(value); if (['active', 'published'].includes(column.name)) return value ? 'Sim' : 'Não'; if (column.name === 'status') return statusLabel(value); return value || '—' }

async function load () { loading.value = true; try { const { data } = await api.get(`/admin/${resource.value}`, { params: { page: pagination.value.page, limit: 10, search: search.value || undefined, role: roleFilter.value || undefined, status: statusFilter.value || undefined } }); rows.value = data.data; pagination.value = data.pagination } finally { loading.value = false } }
function resetAndLoad () { pagination.value.page = 1; load() }
function clearForm () { Object.keys(form).forEach(key => delete form[key]); clearAdminAvatarFile() }
function openNew () { editing.value = null; clearForm(); Object.assign(form, { name: '', email: '', phone: '', whatsappMetaPhone: '', password: '', avatar: '', provider: 'local', role: 'USER', active: true, businessName: '', slug: '' }); dialog.value = true }
function openEdit (row) { editing.value = row; clearForm(); Object.assign(form, JSON.parse(JSON.stringify(row))); if (form.start) form.start = form.start.slice(0, 16); dialog.value = true }
function clearAdminAvatarFile () { if (adminAvatarObjectUrl.value) URL.revokeObjectURL(adminAvatarObjectUrl.value); adminAvatarObjectUrl.value = ''; adminAvatarFile.value = null }
function prepareAdminAvatar (file) { if (!file) return; clearAdminAvatarFile(); adminAvatarFile.value = file; adminAvatarObjectUrl.value = URL.createObjectURL(file); form.avatar = '' }
function avatarRejected () { $q.notify({ type: 'negative', message: 'Use uma imagem JPEG, PNG ou WebP de até 4 MB.' }) }
function avatarUrlChanged (value) { if (value && adminAvatarFile.value) { clearAdminAvatarFile(); form.avatar = value } }
function removeAdminAvatarSelection () { clearAdminAvatarFile(); form.avatar = '' }
function validAvatarValue (value) { if (!value || /^https?:\/\/[^/]+\/api\/media\/avatar\//i.test(value)) return true; try { return new URL(value).protocol === 'https:' } catch { return false } }

async function save () {
  saving.value = true
  try {
    let payload = { ...form }
    let response
    if (resource.value === 'profiles') payload = { businessName: form.businessName, slug: form.slug, address: form.address, active: form.active, published: form.published }
    if (resource.value === 'appointments') payload = { serviceName: form.serviceName, start: form.start, status: form.status, note: form.note }
    if (resource.value === 'users') {
      if (!validAvatarValue(form.avatar)) throw new Error('Informe uma URL HTTPS válida para o avatar.')
      if (!payload.password) delete payload.password
      delete payload.avatarUrl; delete payload.avatarSource; delete payload.createdAt; delete payload.id; delete payload._id
      let requestPayload = payload
      if (adminAvatarFile.value) {
        delete payload.avatar
        requestPayload = new FormData()
        requestPayload.append('data', JSON.stringify(payload))
        requestPayload.append('image', adminAvatarFile.value)
      }
      response = editing.value ? await api.patch(`/admin/users/${editing.value.id || editing.value._id}`, requestPayload) : await api.post('/admin/users', requestPayload)
    } else {
      response = await api.patch(`/admin/${resource.value}/${editing.value._id || editing.value.id}`, payload)
    }
    $q.notify({ type: response?.data?.avatarWarning ? 'warning' : 'positive', message: response?.data?.avatarWarning || 'Registro salvo.' })
    dialog.value = false
    await load()
  } catch (error) { $q.notify({ type: 'negative', message: error.response?.data?.message || error.message || 'Não foi possível salvar.' }) } finally { saving.value = false }
}

function remove (row) { $q.dialog({ title: 'Remover registro?', message: 'Os dados relacionados poderão ser removidos. Esta ação não pode ser desfeita.', cancel: true, persistent: true }).onOk(async () => { await api.delete(`/admin/${resource.value}/${row._id || row.id}`); $q.notify({ message: 'Registro removido.', color: 'dark' }); load() }) }
watch(resource, () => { pagination.value.page = 1; search.value = ''; load() })
onMounted(load)
</script>

<style scoped>
.admin-mobile-card{padding:15px;border:1px solid #e0e3dc;border-radius:15px;background:#fff}.admin-mobile-card header{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.admin-mobile-card dl{display:grid;grid-template-columns:auto 1fr;gap:6px 12px;margin:14px 0 0;padding-top:12px;border-top:1px solid #eceee9;font-size:9px}.admin-mobile-card dt{color:#858d87}.admin-mobile-card dd{margin:0;text-align:right;overflow-wrap:anywhere}.admin-avatar-editor{display:grid;grid-template-columns:72px 1fr;gap:14px;align-items:center;padding:13px;border:1px solid #e0e4dc;border-radius:15px;background:#f8faf5}.admin-avatar-editor b,.admin-avatar-editor small{display:block}.admin-avatar-editor small{margin-top:3px;color:#7d867f;font-size:8px}.admin-avatar-buttons{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.google-admin-note{border:1px solid #dde5d3;background:#f5f9ef;color:#65705e;font-size:9px}.transparent-file{opacity:0;cursor:pointer}@media(max-width:600px){.admin-data-page{padding-left:12px;padding-right:12px}.data-toolbar{grid-template-columns:1fr}.admin-dialog{width:calc(100vw - 20px);max-height:92vh}.admin-avatar-editor{grid-template-columns:1fr;text-align:center}.admin-avatar-editor>.q-avatar{margin:auto}.admin-avatar-buttons{justify-content:center}.table-footer{align-items:flex-start;flex-direction:column;gap:8px;overflow-x:auto}}
</style>
