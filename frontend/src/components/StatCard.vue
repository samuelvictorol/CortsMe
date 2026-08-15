<template><article class="stat-card"><div><span>{{ label }}</span><h3>{{ value }}</h3><small v-if="hint"><q-icon :name="positive ? 'trending_up' : 'info'" /> {{ hint }}</small></div><span class="stat-card__icon"><q-icon :name="icon" /></span></article></template>
<script setup>defineProps({ label: String, value: [String, Number], hint: String, icon: String, positive: Boolean })</script>
