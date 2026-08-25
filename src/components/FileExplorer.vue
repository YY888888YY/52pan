<template>
  <div class="file-explorer">
    <FileTable
      :files="files"
      :order-by="orderBy"
      :desc="desc"
      @sort="sort"
      :navigate-to="navigateTo"
    />
  </div>
</template>

<script>
import jQuery from 'jquery';
const $ = jQuery;
const _ = require('lodash');

import FileTable from './FileTable.vue';

export default {
  name: 'FileExplorer',
  components: { FileTable },
  props: {
    files: { type: Array, default() { return []; } },
    orderBy: { type: String, default: 'name' },
    desc: { type: Boolean, default: false },
    // ✅ 新增：接收导航方法
    navigateTo: { type: Function, default: function() {} }
  },
  mounted() {
    this.$root.$on('upload-complete', this.refreshFiles);
  },
  beforeDestroy() {
    this.$root.$off('upload-complete', this.refreshFiles);
  },
  methods: {
    sort(field) { this.$emit('sort', field); },
    refreshFiles() {
      if (this.$parent.fetchList) this.$parent.fetchList();
    }
  }
};
</script>

<style scoped lang="scss">
.file-explorer { margin-top: 16px; }
</style>
