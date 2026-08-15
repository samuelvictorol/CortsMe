<template>
  <q-layout view="hHh lpR fFf" class="public-shell">
    <q-header class="public-header text-dark">
      <q-toolbar class="container public-toolbar">
        <router-link to="/" class="no-decoration"><BrandLogo /></router-link>
        <q-space />
        <nav class="gt-sm header-links">
          <a href="/#como-funciona">Como funciona</a>
          <a href="/#recursos">Recursos</a>
          <a href="/#para-quem">Para profissionais</a>
        </nav>
        <q-space class="gt-sm" />
        <q-btn v-if="auth.isLogged" :to="auth.home" unelevated rounded color="dark" label="Abrir painel" no-caps />
        <q-btn v-else to="/login" unelevated rounded color="dark" label="Entrar" no-caps />
      </q-toolbar>
    </q-header>
    <q-page-container><router-view /></q-page-container>
  </q-layout>
</template>

<script setup>
import BrandLogo from 'components/BrandLogo.vue'
import { useAuthStore } from 'stores/auth-store'
const auth = useAuthStore()
</script>
