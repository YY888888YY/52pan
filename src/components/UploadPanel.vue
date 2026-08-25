<template>
  <div class="upload-panel-wrapper">
    <transition name="fade">
      <div v-if="!panelVisible" class="upload-float-btn" @click="openPanel" title="上传文件">
        📤 上传
      </div>
    </transition>
    <transition name="slide-up">
      <div v-if="panelVisible" ref="panel" :style="{ left: panelLeft + 'px', top: panelTop + 'px' }" class="upload-panel">
        <div class="panel-header" @mousedown="startDrag">
          <span>📤 文件上传</span>
          <div class="panel-actions">
            <button class="panel-btn minimize" @click.stop="minimizePanel">─</button>
            <button class="panel-btn close" @click.stop="closePanel">✕</button>
          </div>
        </div>
        <div v-if="isMinimized" class="panel-minimized" @click="restorePanel">
          📤 上传中 ({{ uploadStats.success + uploadStats.error }}/{{ selectedFiles.length }})
        </div>
        <div v-else class="panel-content">
          <!-- ✅ 拆分两个input：点击选文件，拖拽选文件夹 -->
          <div class="upload-area" @dragover.prevent="dragover = true" @dragleave.prevent="dragover = false" @drop.prevent="handleDrop" @click="triggerFileInput">
            <!-- 点击用：仅选文件 -->
            <input ref="fileInput" type="file" multiple @change="handleFileSelect" class="hidden-input" />
            <!-- 拖拽用：支持文件夹 -->
            <input ref="folderInput" type="file" multiple webkitdirectory mozdirectory @change="handleFileSelect" class="hidden-input" style="display: none;" />
            <div class="upload-icon">📁</div>
            <p>点击选择文件/文件夹，或拖拽到此处</p>
            <p class="hint">✅ 支持文件夹上传 · 大文件自动分片(10MB+) · 并发30路</p>
          </div>
          <!-- 其余原有内容完全保留 -->
          <div class="panel-actions-bar">
            <button :disabled="selectedFiles.length === 0 || uploading" class="btn btn-primary" @click="startUpload">🚀 开始上传</button>
            <button :disabled="!uploading && !paused" class="btn btn-warning" @click="togglePause">{{ paused ? '▶ 继续' : '⏸ 暂停' }}</button>
            <button :disabled="uploading && !paused" class="btn btn-danger" @click="clearList">🗑 清空列表</button>
          </div>
          <div v-if="selectedFiles.length > 0" class="total-progress">
            <div class="progress-info">
              <span>总进度：{{ totalProgress }}% ({{ uploadStats.success }}/{{ selectedFiles.length }})</span>
              <span>速度：{{ formatSpeed(totalSpeed) }}</span>
            </div>
            <div class="progress-bar"><div :style="{ width: totalProgress + '%' }" class="progress-fill" /></div>
          </div>
          <div v-if="selectedFiles.length > 0" class="file-list">
            <div v-for="(state, index) in fileStates" :key="index" class="file-item">
              <div class="file-info">
                <span class="file-icon">{{ getFileIcon(state.file.name) }}</span>
                <span :title="state.relativePath || state.file.name" class="file-name">{{ state.relativePath || state.file.name }}</span>
                <span :class="state.status" class="file-status">{{ getStatusText(state) }}</span>
              </div>
              <div class="file-progress">
                <div class="progress-bar mini"><div :class="getProgressClass(state)" :style="{ width: state.progress + '%' }" class="progress-fill" /></div>
                <div class="file-progress-info">
                  <span>{{ formatSize(state.loaded) }} / {{ formatSize(state.total) }}</span>
                  <span v-if="state.speed > 0">{{ formatSpeed(state.speed) }}</span>
                  <span v-if="state.chunksTotal > 0" class="chunk-info">{{ state.chunksDone }}/{{ state.chunksTotal }} 分片</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
export default {
  name: 'UploadPanel',
  data: function() {
    return {
      panelVisible: false, isMinimized: false, panelLeft: window.innerWidth - 420, panelTop: window.innerHeight - 520,
      dragOffset: { x: 0, y: 0 }, dragging: false, dragover: false,
      selectedFiles: [], fileStates: [], uploading: false, paused: false, abortControllers: [],
      totalBytes: 0, uploadedBytes: 0, lastTotalBytes: 0, lastSampleTime: 0, totalSpeed: 0, speedTimer: null,
      UPLOAD_TOKEN: '14dfebd18a00e90447d76897020637ad',
      CHUNK_SIZE: 10 * 1024 * 1024, BIG_FILE_THRESHOLD: 10 * 1024 * 1024, MAX_CONCURRENT: 30,
      SCAN_SCRIPT: '/opt/down52pojie/php/scan.php'
    };
  },
  computed: {
    totalProgress: function() {
      return this.totalBytes === 0 ? 0 : ((this.uploadedBytes / this.totalBytes) * 100).toFixed(1);
    },
    uploadStats: function() {
      var stats = { waiting: 0, uploading: 0, success: 0, error: 0 };
      for (var i = 0; i < this.fileStates.length; i++) {
        var s = this.fileStates[i];
        if (s.status === 'waiting' || s.status === 'paused') stats.waiting++;
        else if (s.status === 'uploading' || s.status === 'chunking') stats.uploading++;
        else if (s.status === 'success') stats.success++;
        else if (s.status === 'error') stats.error++;
      }
      return stats;
    }
  },
  mounted: function() { window.addEventListener('resize', this.handleResize); },
  beforeDestroy: function() { window.removeEventListener('resize', this.handleResize); },
  methods: {
    openPanel: function() { this.panelVisible = true; this.isMinimized = false; },
    closePanel: function() { this.panelVisible = false; this.isMinimized = false; this.clearList(); },
    minimizePanel: function() { this.isMinimized = true; },
    restorePanel: function() { this.isMinimized = false; },
    startDrag: function(e) {
      this.dragging = true;
      var panel = this.$refs.panel;
      this.dragOffset.x = e.clientX - panel.offsetLeft;
      this.dragOffset.y = e.clientY - panel.offsetTop;
      document.addEventListener('mousemove', this.handleDrag);
      document.addEventListener('mouseup', this.stopDrag);
    },
    handleDrag: function(e) {
      if (!this.dragging) return;
      e.preventDefault();
      this.panelLeft = Math.max(0, Math.min(e.clientX - this.dragOffset.x, window.innerWidth - 400));
      this.panelTop = Math.max(0, Math.min(e.clientY - this.dragOffset.y, window.innerHeight - 100));
    },
    stopDrag: function() {
      this.dragging = false;
      document.removeEventListener('mousemove', this.handleDrag);
      document.removeEventListener('mouseup', this.stopDrag);
    },
    handleResize: function() {
      this.panelLeft = Math.min(this.panelLeft, window.innerWidth - 400);
      this.panelTop = Math.min(this.panelTop, window.innerHeight - 100);
    },
    // ✅ 点击触发文件选择（不带目录属性）
    triggerFileInput: function() { this.$refs.fileInput.click(); },
    handleDrop: function(e) {
      var self = this;
      this.dragover = false;
      var items = e.dataTransfer.items;
      var files = [];
      function traverseFileTree(item, path) {
        return new Promise(function(resolve) {
          if (item.isFile) {
            item.file(function(file) {
              Object.defineProperty(file, 'webkitRelativePath', { value: (path || '') + file.name, writable: false });
              files.push(file); resolve();
            });
          } else if (item.isDirectory) {
            var dirReader = item.createReader();
            dirReader.readEntries(function(entries) {
              var promises = [];
              for (var i = 0; i < entries.length; i++) promises.push(traverseFileTree(entries[i], (path || '') + item.name + '/'));
              Promise.all(promises).then(resolve);
            });
          }
        });
      }
      if (items && items[0] && items[0].webkitGetAsEntry) {
        var promises = [];
        for (var i = 0; i < items.length; i++) {
          var entry = items[i].webkitGetAsEntry();
          if (entry) promises.push(traverseFileTree(entry));
        }
        Promise.all(promises).then(function() { if (files.length > 0) self.addFiles(files); });
      } else {
        var dtFiles = Array.prototype.slice.call(e.dataTransfer.files);
        if (dtFiles.length > 0) self.addFiles(dtFiles);
      }
    },
    handleFileSelect: function(e) {
      var files = Array.prototype.slice.call(e.target.files);
      if (files.length > 0) this.addFiles(files);
      e.target.value = '';
    },
    addFiles: function(files) {
      var total = 0;
      for (var i = 0; i < files.length; i++) total += files[i].size;
      this.totalBytes = total;
      for (var j = 0; j < files.length; j++) {
        var f = files[j];
        this.selectedFiles.push(f);
        this.fileStates.push({
          file: f, relativePath: f.webkitRelativePath || f.name, status: 'waiting', progress: 0,
          loaded: 0, total: f.size, speed: 0, remaining: 0, lastLoaded: 0, lastTime: Date.now(),
          error: null, isBigFile: f.size > this.BIG_FILE_THRESHOLD,
          chunksTotal: f.size > this.BIG_FILE_THRESHOLD ? Math.ceil(f.size / this.CHUNK_SIZE) : 0,
          chunksDone: 0, retryCount: 0
        });
      }
      this.$forceUpdate();
    },
    startUpload: function() {
      var self = this;
      if (this.uploading || this.selectedFiles.length === 0) return;
      this.uploading = true; this.paused = false;
      this.abortControllers = []; this.lastSampleTime = Date.now(); this.lastTotalBytes = this.uploadedBytes;
      this.speedTimer = setInterval(function() { self.updateTotalSpeed(); }, 500);
      var cursor = 0;
      var workers = [];
      function worker() {
        return new Promise(function(resolve) {
          function next() {
            if (cursor >= self.fileStates.length || self.paused) { resolve(); return; }
            var idx = cursor++;
            var state = self.fileStates[idx];
            if (state.status === 'success') { next(); return; }
            self.uploadFile(state).then(next);
          }
          next();
        });
      }
      for (var i = 0; i < this.MAX_CONCURRENT; i++) workers.push(worker());
      Promise.all(workers).then(function() { self.onUploadFinish(); });
    },
    uploadFile: function(state) {
      var self = this;
      return new Promise(function(resolve) {
        if (self.paused) { resolve(); return; }
        if (state.isBigFile) self.uploadBigFile(state).then(resolve);
        else self.uploadSmallFile(state).then(resolve);
      });
    },
    uploadSmallFile: function(state) {
      var self = this;
      return new Promise(function(resolve) {
        var formData = new FormData();
        formData.append('file', state.file);
        formData.append('relative_path', state.relativePath);
        state.status = 'uploading'; state.lastLoaded = 0; state.lastTime = Date.now();
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/upload.php');
        xhr.setRequestHeader('X-Upload-Token', self.UPLOAD_TOKEN);
        xhr.upload.onprogress = function(e) { if (e.lengthComputable && !self.paused) self.handleProgress(state, e, 0, 1); };
        xhr.onload = function() {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              var res = JSON.parse(xhr.responseText);
              state.status = res.success ? 'success' : 'error';
              state.error = res.success ? '' : (res.error || '上传失败');
              if (res.success) { state.progress = 100; state.loaded = state.total; }
            } catch (err) { state.status = 'error'; state.error = '服务器响应异常'; }
          } else { state.status = 'error'; state.error = 'HTTP ' + xhr.status; }
          self.$forceUpdate(); resolve();
        };
        xhr.onerror = function() { if (!self.paused) { state.status = 'error'; self.$forceUpdate(); } resolve(); };
        xhr.onabort = function() { if (self.paused) { state.status = 'paused'; self.$forceUpdate(); } resolve(); };
        var controller = new AbortController();
        self.abortControllers.push(controller);
        controller.signal.addEventListener('abort', function() { xhr.abort(); });
        xhr.send(formData);
      });
    },
    uploadBigFile: function(state) {
      var self = this;
      return new Promise(function(resolve) {
        var totalChunks = state.chunksTotal;
        state.status = 'chunking';
        function uploadChunk(chunkIndex) {
          return new Promise(function(resolveChunk, rejectChunk) {
            if (self.paused) { rejectChunk(new Error('paused')); return; }
            var start = chunkIndex * self.CHUNK_SIZE;
            var end = Math.min(start + self.CHUNK_SIZE, state.file.size);
            var chunkData = state.file.slice(start, end);
            var xhr = new XMLHttpRequest();
            xhr.open('POST', '/upload_chunk.php');
            xhr.setRequestHeader('X-Upload-Token', self.UPLOAD_TOKEN);
            xhr.setRequestHeader('X-Chunk-Index', String(chunkIndex));
            xhr.setRequestHeader('X-Chunk-Total', String(totalChunks));
            xhr.setRequestHeader('X-File-Path', state.relativePath);
            xhr.setRequestHeader('X-Chunk-Size', String(self.CHUNK_SIZE));
            xhr.upload.onprogress = function(e) { if (e.lengthComputable && !self.paused) self.handleProgress(state, e, chunkIndex, totalChunks); };
            xhr.onload = function() {
              if (xhr.status >= 200 && xhr.status < 300) {
                try {
                  var res = JSON.parse(xhr.responseText);
                  if (res.success) { state.chunksDone++; resolveChunk(); }
                  else rejectChunk(new Error(res.error || '分片失败'));
                } catch (err) { rejectChunk(new Error('响应异常')); }
              } else rejectChunk(new Error('HTTP ' + xhr.status));
            };
            xhr.onerror = function() { rejectChunk(new Error('网络错误')); };
            xhr.onabort = function() { rejectChunk(new Error('paused')); };
            var controller = new AbortController();
            self.abortControllers.push(controller);
            controller.signal.addEventListener('abort', function() { xhr.abort(); });
            xhr.send(chunkData);
          });
        }
        function uploadAll() {
          var idx = state.chunksDone;
          function next() {
            if (idx >= totalChunks || self.paused) {
              if (!self.paused) {
                state.status = 'uploading';
                fetch('/merge_chunks.php', {
                  method: 'POST',
                  headers: {
                    'X-Upload-Token': self.UPLOAD_TOKEN,
                    'X-File-Path': state.relativePath,
                    'X-Chunk-Total': String(totalChunks)
                  }
                }).then(function(r) { return r.json(); }).then(function(d) {
                  if (d.success) { state.status = 'success'; state.progress = 100; state.loaded = state.total; }
                  else { state.status = 'error'; state.error = d.error || '下载失败'; }
                  self.$forceUpdate(); resolve();
                }).catch(function() { state.status = 'error'; state.error = '合并请求失败'; self.$forceUpdate(); resolve(); });
              } else resolve();
              return;
            }
            uploadChunk(idx).then(function() { idx++; next(); }).catch(function(err) {
              if (err.message === 'paused') { resolve(); return; }
              state.retryCount = (state.retryCount || 0) + 1;
              if (state.retryCount <= 3) setTimeout(next, 1000 * Math.pow(2, state.retryCount));
              else { state.status = 'error'; state.error = '分片' + (idx + 1) + '失败'; self.$forceUpdate(); resolve(); }
            });
          }
          next();
        }
        uploadAll();
      });
    },
    handleProgress: function(state, e, chunkIndex, totalChunks) {
      var now = Date.now();
      var dt = (now - state.lastTime) / 1000;
      if (dt >= 0.5 && dt > 0) {
        state.speed = (e.loaded - state.lastLoaded) / dt;
        state.remaining = ((totalChunks - (chunkIndex || 0) - 1) * this.CHUNK_SIZE + (e.total - e.loaded)) / state.speed;
        state.lastLoaded = e.loaded; state.lastTime = now;
      }
      var oldLoaded = state.loaded;
      if (state.isBigFile) {
        state.loaded = (chunkIndex || 0) * this.CHUNK_SIZE + e.loaded;
        this.uploadedBytes += (state.loaded - oldLoaded);
      } else {
        state.loaded = e.loaded;
        this.uploadedBytes += (e.loaded - oldLoaded);
      }
      state.progress = (state.loaded / state.total * 100).toFixed(1);
      this.$forceUpdate();
    },
    updateTotalSpeed: function() {
      var now = Date.now();
      if (this.lastSampleTime > 0 && now - this.lastSampleTime >= 500) {
        this.totalSpeed = (this.uploadedBytes - this.lastTotalBytes) / ((now - this.lastSampleTime) / 1000);
        this.lastTotalBytes = this.uploadedBytes;
        this.lastSampleTime = now;
      }
    },
    togglePause: function() {
      var self = this;
      if (!this.uploading) return;
      this.paused = !this.paused;
      if (this.paused) {
        this.abortControllers.forEach(function(c) { c.abort(); });
        this.abortControllers = []; clearInterval(this.speedTimer); this.speedTimer = null;
        this.fileStates.forEach(function(s) { if (s.status === 'uploading' || s.status === 'chunking') s.status = 'paused'; });
        this.$forceUpdate();
      } else {
        this.lastSampleTime = Date.now(); this.lastTotalBytes = this.uploadedBytes;
        this.speedTimer = setInterval(function() { self.updateTotalSpeed(); }, 500);
        this.startUpload();
      }
    },
    clearList: function() {
      if (this.uploading && !this.paused && !confirm('正在上传中，确定清空列表吗？')) return;
      this.abortControllers.forEach(function(c) { c.abort(); });
      clearInterval(this.speedTimer);
      this.selectedFiles = []; this.fileStates = [];
      this.uploading = false; this.paused = false;
      this.uploadedBytes = 0; this.totalBytes = 0; this.totalSpeed = 0;
      this.$forceUpdate();
    },
    onUploadFinish: function() {
      clearInterval(this.speedTimer); this.speedTimer = null;
      this.uploading = false; this.paused = false;
      if (this.uploadStats.success > 0) {
        fetch(this.SCAN_SCRIPT, { method: 'POST' }).catch(function() {});
        this.$root.$emit('upload-complete');
      }
    },
    getFileIcon: function(name) {
      var ext = name.split('.').pop().toLowerCase();
      if (['jpg','jpeg','png','gif','webp','svg'].indexOf(ext) !== -1) return '🖼️';
      if (['mp4','avi','mkv','mov'].indexOf(ext) !== -1) return '🎬';
      if (['zip','rar','7z','tar','gz'].indexOf(ext) !== -1) return '📦';
      if (['pdf','doc','docx','txt','md'].indexOf(ext) !== -1) return '📄';
      return '📄';
    },
    getStatusText: function(state) {
      if (state.status === 'waiting') return '等待中';
      if (state.status === 'uploading') return '上传中';
      if (state.status === 'chunking') return '分片中';
      if (state.status === 'success') return '成功';
      if (state.status === 'error') return state.error || '失败';
      if (state.status === 'paused') return '已暂停';
      return '';
    },
    getProgressClass: function(state) {
      if (state.status === 'uploading') return 'progress-uploading';
      if (state.status === 'chunking') return 'progress-chunking';
      if (state.status === 'success') return 'progress-success';
      if (state.status === 'error') return 'progress-error';
      if (state.status === 'paused') return 'progress-paused';
      return 'progress-waiting';
    },
    formatSize: function(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
      if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
      return (bytes / 1073741824).toFixed(2) + ' GB';
    },
    formatSpeed: function(bps) {
      if (bps < 1024) return bps.toFixed(0) + ' B/s';
      if (bps < 1048576) return (bps / 1024).toFixed(1) + ' KB/s';
      return (bps / 1048576).toFixed(1) + ' MB/s';
    }
  }
};
</script>

<style scoped lang="scss">
.upload-panel-wrapper { position: fixed; z-index: 9999; pointer-events: none; .upload-float-btn, .upload-panel { pointer-events: auto; } }
.upload-float-btn { position: fixed; right: 24px; bottom: 24px; background: #667eea; color: #fff; padding: 12px 24px; border-radius: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); cursor: pointer; &:hover { background: #5568d3; transform: translateY(-2px); } }
.upload-panel { position: fixed; width: 400px; min-height: 100px; max-height: 500px; background: #fff; border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.2); display: flex; flex-direction: column; overflow: hidden; }
.panel-header { background: #667eea; color: #fff; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; cursor: move; .panel-actions { display: flex; gap: 8px; } .panel-btn { background: transparent; border: none; color: #fff; width: 24px; height: 24px; border-radius: 4px; cursor: pointer; &:hover { background: rgba(255,255,255,0.2); } &.close:hover { background: #ef4444; } } }
.panel-minimized { padding: 12px 16px; background: #667eea; color: #fff; cursor: pointer; &:hover { background: #5568d3; } }
.panel-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.upload-area { margin: 16px; padding: 24px; border: 2px dashed #ddd; border-radius: 8px; text-align: center; cursor: pointer; .hidden-input { display: none; } &:hover, &.dragover { border-color: #667eea; background: #f8f9ff; } }
.panel-actions-bar { display: flex; gap: 8px; padding: 0 16px 16px; .btn { flex: 1; padding: 8px 12px; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; &[disabled] { opacity: 0.5; } } .btn-primary { background: #667eea; color: #fff; &:hover:not([disabled]) { background: #5568d3; } } .btn-warning { background: #f59e0b; color: #fff; &:hover:not([disabled]) { background: #d97706; } } .btn-danger { background: #ef4444; color: #fff; &:hover:not([disabled]) { background: #dc2626; } } }
.total-progress { padding: 0 16px 16px; .progress-info { display: flex; justify-content: space-between; font-size: 12px; color: #555; margin-bottom: 6px; } .progress-bar { height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; .progress-fill { height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); } } }
.file-list { flex: 1; overflow-y: auto; padding: 0 16px 16px; .file-item { background: #f8f9fa; border-radius: 8px; padding: 12px; margin-bottom: 8px; .file-info { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; } .file-icon { font-size: 18px; } .file-name { flex: 1; font-size: 13px; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .file-status { font-size: 11px; padding: 2px 8px; border-radius: 10px; } .file-progress .progress-bar.mini { height: 4px; background: #e5e7eb; border-radius: 2px; overflow: hidden; margin-bottom: 4px; } .file-progress-info { display: flex; justify-content: space-between; font-size: 10px; color: #777; } } }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; } .fade-enter, .fade-leave-to { opacity: 0; }
.slide-up-enter-active, .slide-up-leave-active { transition: all 0.3s ease-out; } .slide-up-enter, .slide-up-leave-to { opacity: 0; transform: translateY(20px); }
</style>
