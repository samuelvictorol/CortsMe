<template>
  <div class="brand-logo" :class="{ 'brand-logo--light': light }">
    <span class="brand-logo__mark">C</span>
    <span>Corts<span class="brand-logo__dot">.</span>Me</span>
  </div>
</template>

<script setup>
defineProps({ light: Boolean })
</script>
