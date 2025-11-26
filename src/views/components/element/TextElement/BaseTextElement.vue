<template>
  <div 
    class="base-element-text"
    :style="{
      top: elementInfo.top + 'px',
      left: elementInfo.left + 'px',
      width: elementInfo.width + 'px',
      height: elementInfo.height + 'px',
    }"
  >
    <div
      class="rotate-wrapper"
      :style="{ transform: `rotate(${elementInfo.rotate}deg)` }"
    >
      <div 
        class="element-content"
        :style="{
          width: elementInfo.vertical ? 'auto' : elementInfo.width + 'px',
          height: elementInfo.vertical ? elementInfo.height + 'px' : 'auto',
          backgroundColor: elementInfo.fill,
          opacity: elementInfo.opacity,
          textShadow: shadowStyle,
          lineHeight: elementInfo.lineHeight,
          letterSpacing: (elementInfo.wordSpace || 0) + 'px',
          color: elementInfo.defaultColor,
          fontFamily: elementInfo.defaultFontName,
          writingMode: elementInfo.vertical ? 'vertical-rl' : 'horizontal-tb',
        }"
      >
        <ElementOutline
          :width="elementInfo.width"
          :height="elementInfo.height"
          :outline="elementInfo.outline"
        />
        <div 
          class="text ProseMirror-static" 
          :class="{ 'thumbnail': target === 'thumbnail' }"
          :style="{
            '--paragraphSpace': `${elementInfo.paragraphSpace === undefined ? 5 : elementInfo.paragraphSpace}px`,
          }"
          v-html="renderedContent"
        ></div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import type { PPTTextElement } from '@/types/slides'
import ElementOutline from '@/views/components/element/ElementOutline.vue'
import { parseMarkdown } from '@/utils/markdownRenderer'

import useElementShadow from '@/views/components/element/hooks/useElementShadow'

const props = defineProps<{
  elementInfo: PPTTextElement
  target?: string
}>()

const shadow = computed(() => props.elementInfo.shadow)
const { shadowStyle } = useElementShadow(shadow)

// 渲染 markdown 内容
const renderedContent = computed(() => {
  if (!props.elementInfo.content) return ''
  return parseMarkdown(props.elementInfo.content)
})
</script>

<style lang="scss" scoped>
.base-element-text {
  position: absolute;
}
.rotate-wrapper {
  width: 100%;
  height: 100%;
}
.element-content {
  position: relative;
  padding: 10px;
  line-height: 1.5;
  word-break: break-word;

  .text {
    position: relative;

    &.thumbnail {
      pointer-events: none;
    }
    
    // Markdown 样式
    ::v-deep(h1), ::v-deep(h2), ::v-deep(h3), ::v-deep(h4), ::v-deep(h5), ::v-deep(h6) {
      margin: 0.5em 0;
      font-weight: bold;
    }
    
    ::v-deep(p) {
      margin: 0.5em 0;
    }
    
    ::v-deep(ul), ::v-deep(ol) {
      margin: 0.5em 0;
      padding-left: 1.5em;
    }
    
    ::v-deep(li) {
      margin: 0.25em 0;
    }
    
    ::v-deep(strong) {
      font-weight: bold;
    }
    
    ::v-deep(em) {
      font-style: italic;
    }
    
    ::v-deep(code) {
      background-color: rgba(0, 0, 0, 0.1);
      padding: 0.1em 0.3em;
      border-radius: 3px;
      font-family: monospace;
    }
    
    ::v-deep(blockquote) {
      border-left: 3px solid rgba(0, 0, 0, 0.2);
      padding-left: 1em;
      margin: 0.5em 0;
    }
    
    // Markdown 表格样式
    ::v-deep(table) {
      border-collapse: collapse;
      border-spacing: 0;
      width: 100%;
      margin: 0.5em 0;
      display: table;
      
      th, td {
        border: 1px solid rgba(0, 0, 0, 0.2);
        padding: 0.5em;
        text-align: left;
      }
      
      th {
        background-color: rgba(0, 0, 0, 0.05);
        font-weight: bold;
      }
      
      tr:nth-child(even) {
        background-color: rgba(0, 0, 0, 0.02);
      }
    }
  }
}
</style>
