<script setup lang="ts">
import AdminShell from '../layouts/AdminShell.vue';
import AdminManagementPanel from './AdminManagementPanel.vue';
</script>

<template>
  <AdminShell page-title="管理员管理" page-subtitle="管理后台账号、角色与状态">
    <AdminManagementPanel />
  </AdminShell>
</template>
