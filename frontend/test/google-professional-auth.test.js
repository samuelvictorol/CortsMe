import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('onboarding profissional diferencia Google sem senha do cadastro tradicional', async () => {
  const [authPage, landingPage] = await Promise.all([
    readFile(path.join(frontendRoot, 'src/pages/AuthPage.vue'), 'utf8'),
    readFile(path.join(frontendRoot, 'src/pages/LandingPage.vue'), 'utf8')
  ])

  assert.match(authPage, /Forma de cadastro profissional/)
  assert.match(authPage, /Continuar com Google[\s\S]*Sem criar uma nova senha/)
  assert.match(authPage, /registerMode\.value && form\.phone \? \{ phone: form\.phone \}/)
  assert.match(authPage, /googleProfessionalRegistration[\s\S]*businessName: form\.businessName/)
  assert.match(authPage, /accountType: isProfessional\.value \? 'professional' : 'client'/)
  assert.match(authPage, /v-if="!googleProfessionalRegistration"[\s\S]*v-model="form\.password"/)
  assert.match(landingPage, /professionalGoogleRoute[\s\S]*Criar com Google, sem senha/)
  assert.match(landingPage, /perfil: 'profissional'/)
})
