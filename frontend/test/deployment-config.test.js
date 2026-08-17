import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = path.resolve(frontendRoot, '..')

test('frontend de produção encaminha API e WebSocket para a rede privada', async () => {
  const [dockerfile, nginx] = await Promise.all([
    readFile(path.join(frontendRoot, 'Dockerfile'), 'utf8'),
    readFile(path.join(frontendRoot, 'nginx.conf'), 'utf8')
  ])

  assert.match(dockerfile, /default\.conf\.template/)
  assert.match(dockerfile, /healthz/)
  assert.match(nginx, /location \^~ \/api\//)
  assert.match(nginx, /location \/socket\.io\//)
  assert.match(nginx, /proxy_pass http:\/\/\$api_upstream/)
})

test('Blueprint mantém API privada, worker e Redis gerenciado', async () => {
  const render = await readFile(path.join(repositoryRoot, 'render.yaml'), 'utf8')

  assert.match(render, /type: pserv\s+name: cortsme-api/)
  assert.match(render, /type: worker\s+name: cortsme-notifications-worker/)
  assert.match(render, /dockerCommand: npm run worker/)
  assert.match(render, /type: keyvalue\s+name: cortsme-redis/)
  assert.match(render, /fromGroup: cortsme-shared/)
  assert.match(render, /key: CONNECTION_STRING\s+sync: false/)
  assert.match(render, /envVarKey: CONNECTION_STRING/)
  assert.match(render, /key: NOTIFYFLOW_APP_TOKEN\s+sync: false/)
  assert.match(render, /envVarKey: NOTIFYFLOW_APP_TOKEN/)
  assert.match(render, /INFINITEPAY_WEBHOOK_URL/)
})

test('ambiente Docker local inicia o worker com Mongo e Redis saudáveis', async () => {
  const compose = await readFile(path.join(repositoryRoot, 'docker-compose.yml'), 'utf8')

  assert.match(compose, /\n  worker:\s+[\s\S]*?command: npm run worker/)
  assert.match(compose, /worker:\s+[\s\S]*?env_file: \.env/)
  assert.match(compose, /worker:\s+[\s\S]*?mongo:\s+condition: service_healthy[\s\S]*?redis:\s+condition: service_healthy/)
})
