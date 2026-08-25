<template>
    <div>
        <ol ref="ol" class="breadcrumb">
            <li v-for="part in parts" :key="part.key" :class="{active: part.active}" class="breadcrumb-item">
                <span v-if="part.active">{{ part.name }}</span>
                <router-link v-else :to="part.path">{{ part.name }}</router-link>
            </li>
            <li v-if="isSearch" class="breadcrumb-item">
                <span>搜索文件：{{ query }}</span>
            </li>
        </ol>
    </div>
</template>

<script>
import jQuery from 'jquery';
const $ = jQuery;
const _ = require('lodash');

export default {
    components: {},
    props: {
        baseUrl: { type: String, default: '' },
        file: {
            type: Object,
            default() { return { name: '/', path: '/', children: [] }; }
        },
        isSearch: { type: Boolean, default: false },
        query: { type: String, default: '' },
        // 当前所在目录路径，用于生成可点击返回的面包屑
        currentPath: { type: String, default: '/' }
    },
    computed: {
        parts() {
            if (this.isSearch) return [];
            var parts = [];
            var path = this.currentPath || '/';
            // 根目录
            parts.push({ key: 'root', name: '根目录', path: '/', active: path === '/' || path === '' });
            if (path !== '/' && path) {
                var segments = path.split('/').filter(Boolean);
                var cur = '';
                segments.forEach(function(seg, idx) {
                    cur += '/' + seg;
                    parts.push({
                        key: cur,
                        name: seg,
                        path: cur + '/',
                        active: idx === segments.length - 1
                    });
                });
            }
            return parts;
        }
    }
};
</script>

<!-- ✅ 仅保留面包屑自身样式，无任何其他组件样式 -->
<style scoped lang="scss">
.breadcrumb {
    display: flex; flex-wrap: wrap;
    padding: 8px 16px; margin-bottom: 16px;
    list-style: none; background: #f8f9fa; border-radius: 8px; font-size: 14px;
}
.breadcrumb-item {
    display: flex; align-items: center;
    + .breadcrumb-item::before { content: "/"; padding: 0 8px; color: #aaa; }
    a { color: #667eea; text-decoration: none; transition: color 0.2s;
        &:hover { color: #5568d3; text-decoration: underline; }
    }
    &.active span { color: #333; font-weight: 500; }
}
</style>
