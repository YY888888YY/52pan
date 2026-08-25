<template>
  <div id="app">
    <FilePath :base-url="baseUrl" :file="currentFile" :is-search="isSearch" :query="searchQuery" :current-path="currentPath" />
    <SearchBox :query="searchQuery" @submit="submit" @submit-all="submitAll" />
    <FileExplorer 
      ref="fileExplorer" 
      :files="files" 
      :order-by="orderBy" 
      :desc="desc" 
      @sort="sort" 
      @update-files="updateFiles"
      :navigate-to="navigateTo"
    />
    <UploadPanel />
  </div>
</template>

<script>
import jQuery from 'jquery';
const $ = jQuery;
const _ = require('lodash');

import FilePath from './components/FilePath.vue';
import SearchBox from './components/SearchBox.vue';
import FileExplorer from './components/FileExplorer.vue';
import UploadPanel from './components/UploadPanel.vue';

export default {
  name: 'App',
  components: { FilePath, SearchBox, FileExplorer, UploadPanel },
  data() {
    return {
      baseUrl: window.location.origin,
      files: [],
      orderBy: 'name',
      desc: false,
      isSearch: false,
      searchQuery: '',
      currentFile: { name: '/', path: '/', children: [] },
      // 保存完整文件树和当前路径
      fullTree: null,
      currentPath: '/',
      routerUnwatch: null
    };
  },
  mounted() {
    this.fetchList();
    // 统一由 vue-router 驱动导航：点击面包屑、浏览器前进/后退都能正确返回
    this.routerUnwatch = this.$router.afterEach((to) => {
      if (!this.isSearch) {
        this.renderPath(this.normalizePath(to.path));
      }
    });
    this.$root.$on('upload-complete', this.fetchList);
  },
  beforeDestroy() {
    if (this.routerUnwatch) { this.routerUnwatch(); this.routerUnwatch = null; }
    this.$root.$off('upload-complete', this.fetchList);
  },
  methods: {
    fetchList() {
      var self = this;
      fetch('/list.js?t=' + Date.now())
        .then(function(res) { return res.text(); })
        .then(function(text) {
          var match = text.match(/^\w+\(([\s\S]*)\);?\s*$/);
          if (!match) throw new Error('Invalid list.js format');
          var data = JSON.parse(match[1]);
          data.isDir = true;
          data.path = '/';
          // 递归统一所有节点的 path 与字段（含深层目录）
          self.buildTree(data);
          self.fullTree = data;
          var target = self.$route && self.$route.path ? self.normalizePath(self.$route.path) : '/';
          self.renderPath(target);
        })
        .catch(function() {});
    },
    // 递归统一 path（目录以 / 结尾）与字段
    buildTree(node) {
      var self = this;
      node.isDir = true;
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(function(child) {
          var base = node.path === '/' ? '' : node.path;
          child.isDir = child.hasOwnProperty('children');
          if (child.isDir) {
            child.path = base + child.name + '/';
            self.buildTree(child);
          } else {
            child.path = base + child.name;
            self.prepareFileMeta(child);
          }
        });
      }
    },
    // 渲染指定路径的目录内容
    renderPath(path) {
      var node = this.findNode(this.fullTree, path);
      if (!node || !node.children) {
        node = this.fullTree;
        path = '/';
      }
      this.currentPath = path;
      this.currentFile = node;
      this.files = node.children || [];
    },
    prepareFileMeta(file) {
      var size = file.size || 0;
      if (size < 1024) file.sizeReadable = size + ' B';
      else if (size < 1048576) file.sizeReadable = (size / 1024).toFixed(1) + ' KB';
      else if (size < 1073741824) file.sizeReadable = (size / 1048576).toFixed(1) + ' MB';
      else file.sizeReadable = (size / 1073741824).toFixed(2) + ' GB';
      var d = new Date((file.time || 0) * 1000);
      file.timeForHuman = d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
      var diff = Date.now() / 1000 - (file.time || Date.now() / 1000);
      if (diff < 60) file.timeFromNowForHuman = '刚刚';
      else if (diff < 3600) file.timeFromNowForHuman = Math.floor(diff / 60) + ' 分钟前';
      else if (diff < 86400) file.timeFromNowForHuman = Math.floor(diff / 3600) + ' 小时前';
      else file.timeFromNowForHuman = Math.floor(diff / 86400) + ' 天前';
      if (!file.fullUrl) file.fullUrl = '/uploads/' + file.path;
    },
    // 目录路径统一以 / 结尾，保证与 fullTree 节点匹配
    normalizePath(path) {
      if (!path || path === '/') return '/';
      var p = path;
      if (p.charAt(p.length - 1) !== '/') p += '/';
      return p;
    },
    // 点击文件夹：交给 vue-router 记录历史，天然支持返回
    navigateTo(file) {
      if (!file.isDir) return;
      this.$router.push({ path: file.path });
    },
    // 递归查找文件节点
    findNode(tree, path) {
      if (!tree) return null;
      if (tree.path === path) return tree;
      if (tree.children && tree.children.length > 0) {
        for (var i = 0; i < tree.children.length; i++) {
          var found = this.findNode(tree.children[i], path);
          if (found) return found;
        }
      }
      return null;
    },
    submit(query) {
      this.isSearch = true;
      this.searchQuery = query;
    },
    submitAll() {
      this.isSearch = false;
      this.searchQuery = '';
      this.fetchList();
    },
    sort(field) {
      if (field === this.orderBy) { this.desc = !this.desc; }
      else { this.orderBy = field; this.desc = ['isDir', 'name'].indexOf(field) >= 0 ? false : true; }
    },
    updateFiles(files) { this.files = files; }
  }
};
</script>

<style>
#app { padding: 20px; max-width: 1200px; margin: 0 auto; }
</style>
