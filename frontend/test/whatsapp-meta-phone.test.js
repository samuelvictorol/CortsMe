import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const source = path => readFile(new URL(path, root), 'utf8')

test('cadastro Google de cliente envia o telefone opcional informado', async () => {
  const authPage = await source('src/pages/AuthPage.vue')
  assert.match(authPage, /registerMode\.value && form\.phone \? \{ phone: form\.phone \}/)
  assert.match(authPage, /accountType: isProfessional\.value \? 'professional' : 'client'/)
})

test('cliente, profissional e admin editam telefone principal e override Meta separadamente', async () => {
  const [userProfile, barberSettings, adminData] = await Promise.all([
    source('src/pages/user/UserProfile.vue'),
    source('src/pages/barber/SettingsPage.vue'),
    source('src/pages/admin/AdminDataPage.vue')
  ])

  assert.match(userProfile, /form\.whatsappMetaPhone/)
  assert.match(userProfile, /\^\\\+55\[1-9\]/)
  assert.match(barberSettings, /account\.phone/)
  assert.match(barberSettings, /account\.whatsappMetaPhone/)
  assert.match(barberSettings, /phone: account\.phone, whatsappMetaPhone: account\.whatsappMetaPhone/)
  assert.match(barberSettings, /WhatsApp público do negócio/)
  assert.match(adminData, /form\.whatsappMetaPhone/)
  assert.match(adminData, /Formato E\.164 do Brasil/)
})
