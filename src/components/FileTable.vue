<template>
  <div class="table-responsive">
    <table class="table table-sm table-hover sortable table-bordered file-table">
      <thead class="thead-light">
        <tr>
          <th class="icon-col" @click="sort('isDir')" />
          <th class="name-col" @click="sort('name')">文件名</th>
          <th class="size-col text-right" @click="sort('size')">大小</th>
          <th class="date-col text-left" @click="sort('time')">上传日期</th>
          <th class="action-col text-center" @click.stop>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="file in sortedFiles" :key="file.path" @click="file.isDir && navigateTo(file)">
          <td class="icon-col">
            <svg v-if="file.isDir" version="1.1" width="14" height="16" aria-hidden="true">
              <path fill-rule="evenodd" d="M13 4H7V3c0-.66-.31-1-1-1H1c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1V5c0-.55-.45-1-1-1zM6 4H1V3h5v1z"/>
            </svg>
            <svg v-else version="1.1" width="12" height="16" aria-hidden="true">
              <path fill-rule="evenodd" d="M6 5H2V4h4v1zM2 8h7V7H2v1zm0 2h7V9H2v1zm0 2h7v-1H2v1zm10-7.5V14c0 .55-.45 1-1 1H1c-.55 0-1-.45-1-1V2c0-.55.45-1 1-1h7.5L12 4.5zM11 5L8 2H1v12h10V5z"/>
            </svg>
          </td>
          <td class="name-col">
            <!-- ✅ 文件夹用点击事件，文件用预览链接 -->
            <template v-if="file.isDir">
              <div class="folder-link" @click.stop="navigateTo(file)" :title="file.description" data-tooltip="toggle">
                {{ file.name }}
              </div>
            </template>
            <a v-else :href="file.fullUrl" :title="file.description" target="_blank" data-tooltip="toggle">
              {{ file.name }}
            </a>
          </td>
          <td :title="file.size" class="size-col text-right">{{ file.sizeReadable }}</td>
          <td :title="file.timeForHuman" class="date-col text-left">{{ file.timeFromNowForHuman }}</td>
          <td class="action-col text-center">
            <a v-if="file.isDir" :title="`打包下载 ${file.name}`" class="dir-download-btn" @click.stop="downloadFolder(file)">
              📦 下载
            </a>
            <a v-else :href="`${file.fullUrl}?download=1`" :download="file.name" :title="`下载 ${file.name}`" target="_blank" class="file-download-btn">
              ⬇ 下载
            </a>
          </td>
        </tr>
        <tr v-if="empty">
          <td class="icon-col" /><td class="name-col">没有文件</td><td class="size-col">-</td><td class="date-col">-</td><td class="action-col">-</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
import jQuery from 'jquery';
const $ = jQuery;
const _ = require('lodash');

export default {
  props: {
    files: { type: Array, default() { return []; } },
    orderBy: { type: String, default: 'name' },
    desc: { type: Boolean, default: false },
    // ✅ 新增：接收导航方法
    navigateTo: { type: Function, default: function() {} }
  },
  computed: {
    sortedFiles() {
      return _.orderBy(this.files, ['isDir', 'name'], ['desc', 'asc']);
    },
    empty() { return this.files.length <= 0; }
  },
  mounted() { this.addTooltipEventListener(); },
  updated() { this.addTooltipEventListener(); },
  methods: {
    sort(field) {
      if (field === this.orderBy) this.desc = !this.desc;
      else { this.orderBy = field; this.desc = ['isDir', 'name'].indexOf(field) >= 0 ? false : true; }
    },
    addTooltipEventListener() {
      var self = this;
      this.$nextTick(function() {
        $('.tooltip').remove();
        $(self.$el).find('[data-tooltip="toggle"]').tooltip({
          placement: 'bottom', container: 'body', boundary: 'window'
        });
      });
    },
    async downloadFolder(file) {
      const TOKEN = '14dfebd18a00e90447d76897020637ad';
      try {
        const res = await fetch(`/download.php?path=${encodeURIComponent(file.path)}`, {
          headers: { 'X-Upload-Token': TOKEN }
        });
        if (!res.ok) throw new Error('下载失败');
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${file.name}.zip`;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); window.URL.revokeObjectURL(url);
      } catch (e) { alert(`下载失败: ${e.message}`); }
    }
  }
};
</script>

<style scoped lang="scss">
/* 原有样式完全保留，新增文件夹链接样式 */
.file-table { table-layout: fixed; width: 100%; }
.icon-col { width: 36px; text-align: center; color: rgba(3,47,98,0.55); svg { fill: currentColor; } }
.name-col { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.folder-link { color: #3b82f6; cursor: pointer; &:hover { text-decoration: underline; } }
.size-col { width: 80px; white-space: nowrap; }
.date-col { width: 100px; white-space: nowrap; }
.action-col { width: 80px; white-space: nowrap; padding: 4px 6px; }
.dir-download-btn { padding: 3px 10px; font-size: 12px; color: #fff; background: #10b981; border-radius: 4px; &:hover { background: #059669; } }
.file-download-btn { padding: 3px 10px; font-size: 12px; color: #fff; background: #3b82f6; border-radius: 4px; &:hover { background: #2563eb; } }
</style>
