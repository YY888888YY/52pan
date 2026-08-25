<template>
    <FileExplorer :base-url="baseUrl" :root="data" />
</template>

<script>
    import FileExplorer from '../components/FileExplorer';
    import {prepareFiles} from '../helpers';

    export default {
        components: {
            FileExplorer
        },
        props: {
            baseUrl: {
                type: String,
                default: 'http://192.168.1.246'
            },
            list: {
                type: Object,
                default() {
                    return {
                        name: '/',
                        path: '/',
                        children: []
                    };
                }
            }
        },
        computed: {
            data() {
                return prepareFiles(this.list, this.baseUrl);
            }
        }
    };
</script>
