import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const source = path => readFile(new URL(path, root), 'utf8')

test('cadastro oferece URL e upload para cliente e profissional, inclusive Google', async () => {
  const authPage = await source('src/pages/AuthPage.vue')
  assert.match(authPage, /<div v-if="registerMode" class="avatar-picker">/)
  assert.match(authPage, /form\.avatarUrl/)
  assert.match(authPage, /accept="image\/jpeg,image\/png,image\/webp"/)
  assert.match(authPage, /:max-file-size="4194304"/)
  assert.match(authPage, /if \(registerMode\.value\) await syncRegistrationAvatar\(\)/)
  assert.doesNotMatch(authPage, /registerMode && !isProfessional/)
})

test('perfis USER e BARBER permitem upload, URL HTTPS e remoção', async () => {
  const [userProfile, barberSettings] = await Promise.all([
    source('src/pages/user/UserProfile.vue'),
    source('src/pages/barber/SettingsPage.vue')
  ])
  for (const page of [userProfile, barberSettings]) {
    assert.match(page, /api\.post\('\/auth\/avatar'/)
    assert.match(page, /api\.put\('\/auth\/avatar'/)
    assert.match(page, /api\.delete\('\/auth\/avatar'/)
    assert.match(page, /protocol === 'https:'/)
  }
})

test('admin gerencia avatar e abre fila, entregas e timeline do NotifyFlow', async () => {
  const [adminData, notifyFlow] = await Promise.all([
    source('src/pages/admin/AdminDataPage.vue'),
    source('src/pages/admin/AdminNotifyFlowPage.vue')
  ])
  assert.match(adminData, /requestPayload = new FormData\(\)/)
  assert.match(adminData, /requestPayload\.append\('data', JSON\.stringify\(payload\)\)/)
  assert.match(adminData, /requestPayload\.append\('image', adminAvatarFile\.value\)/)
  assert.match(adminData, /avatarWarning/)
  assert.match(adminData, /form\.whatsappMetaPhone/)
  assert.match(adminData, /rowAvatar/)
  assert.match(adminData, /:grid="\$q\.screen\.lt\.md"/)
  assert.match(notifyFlow, /\/admin\/notifyflow\/feed/)
  assert.match(notifyFlow, /\/admin\/notifyflow\/dispatches/)
  assert.match(notifyFlow, /\/admin\/notifyflow\/activity\/\$\{activityType\}/)
  assert.doesNotMatch(notifyFlow, /Promise\.allSettled\(\[api\.get\('\/admin\/notifyflow\/dispatches'/)
  assert.match(notifyFlow, /remoteDeliveries/)
  assert.match(notifyFlow, /remoteTimeline/)
  assert.match(notifyFlow, /selectedQueue/)
})
